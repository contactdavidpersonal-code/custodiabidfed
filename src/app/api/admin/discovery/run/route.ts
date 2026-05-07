import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/admin-auth";
import { getSql, initDb } from "@/lib/db";
import {
  searchAwards,
  type AwardRow,
  DEFAULT_DOD_NAICS,
} from "@/lib/outbound/usaspending";
import { scoreAward, inferDomain } from "@/lib/outbound/icp";
import { bestContactForDomain } from "@/lib/outbound/hunter";

/**
 * Admin discovery endpoint — runs the prospect pipeline on demand.
 *
 *   1. USAspending: pull DoD prime contracts in target NAICS in the last
 *      `daysBack` days, $minAmount–$maxAmount band.
 *   2. ICP score every award. Persist as `prospects` rows (idempotent —
 *      same company+domain dedups). Reject-banded rows still get written
 *      with status='rejected' so we never pull them again.
 *   3. For every band-A or band-B prospect with no contact yet, ask
 *      Hunter for the best decision-maker email (when `enrich=true`).
 *      Persist as `prospect_contacts`.
 *
 * Default mode is **dry run** — pass `?apply=1` to actually write.
 *
 * SECURITY: requireAdmin() gates the route. Hunter spend is bounded by
 * `enrichLimit` (default 10) so an accidental run can't drain credits.
 *
 * Runtime: nodejs (we use fetch + DB; no edge constraints).
 */
export const runtime = "nodejs";

type DiscoveryParams = {
  daysBack: number;
  minAmount: number;
  maxAmount: number;
  pageLimit: number;
  enrich: boolean;
  enrichLimit: number;
  apply: boolean;
};

function parseParams(url: URL): DiscoveryParams {
  const num = (k: string, def: number) => {
    const raw = url.searchParams.get(k);
    if (!raw) return def;
    const n = Number(raw);
    return Number.isFinite(n) ? n : def;
  };
  const bool = (k: string, def: boolean) => {
    const raw = url.searchParams.get(k);
    if (!raw) return def;
    return raw === "1" || raw === "true" || raw === "yes";
  };
  return {
    daysBack: Math.max(1, Math.min(num("daysBack", 30), 365)),
    minAmount: Math.max(0, num("minAmount", 100_000)),
    maxAmount: Math.max(0, num("maxAmount", 10_000_000)),
    pageLimit: Math.max(1, Math.min(num("pageLimit", 100), 100)),
    enrich: bool("enrich", true),
    enrichLimit: Math.max(0, Math.min(num("enrichLimit", 10), 50)),
    apply: bool("apply", false),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ProspectInsertResult = {
  written: number;
  skipped: number;
  rejected: number;
  topBandIds: string[];
};

async function persistProspects(
  awards: AwardRow[],
  apply: boolean,
): Promise<ProspectInsertResult> {
  const sql = getSql();
  let written = 0;
  let skipped = 0;
  let rejected = 0;
  const topBandIds: string[] = [];

  for (const award of awards) {
    const { score, band, reasons } = scoreAward({ award });
    const domain = inferDomain(award.recipientName);
    const status = band === "reject" ? "rejected" : "new";
    if (band === "reject") rejected += 1;

    if (!apply) {
      // Dry run: count what we would write but don't touch DB.
      if (band !== "reject") written += 1;
      continue;
    }

    // Idempotent insert — the unique index on (company_name, COALESCE(domain,''))
    // prevents duplicates. ON CONFLICT DO UPDATE refreshes scoring + raw payload
    // when we re-encounter the same company in a later run.
    const rows = (await sql`
      INSERT INTO prospects (
        company_name, domain, uei, naics_code, state, city,
        total_award_amount, most_recent_award_at,
        data_source, raw_payload,
        icp_score, icp_band, icp_reasons, status
      )
      VALUES (
        ${award.recipientName},
        ${domain},
        ${award.recipientUei},
        ${award.naicsCode},
        ${award.recipientStateCode},
        ${award.recipientCity},
        ${Math.round(award.awardAmount)},
        ${award.actionDate},
        'usaspending',
        ${JSON.stringify(award)},
        ${score},
        ${band},
        ${JSON.stringify(reasons)},
        ${status}
      )
      ON CONFLICT (company_name, COALESCE(domain, ''))
      DO UPDATE SET
        icp_score = EXCLUDED.icp_score,
        icp_band = EXCLUDED.icp_band,
        icp_reasons = EXCLUDED.icp_reasons,
        total_award_amount = GREATEST(prospects.total_award_amount, EXCLUDED.total_award_amount),
        most_recent_award_at = GREATEST(prospects.most_recent_award_at, EXCLUDED.most_recent_award_at),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `) as Array<{ id: string; inserted: boolean }>;

    const row = rows[0];
    if (!row) continue;
    if (row.inserted) written += 1;
    else skipped += 1;
    if (band === "A" || band === "B") topBandIds.push(row.id);
  }

  return { written, skipped, rejected, topBandIds };
}

type EnrichResult = {
  attempted: number;
  contactsFound: number;
  contactsWritten: number;
  errors: string[];
};

async function enrichTopProspects(
  prospectIds: string[],
  enrichLimit: number,
  apply: boolean,
): Promise<EnrichResult> {
  const sql = getSql();
  const errors: string[] = [];
  let attempted = 0;
  let contactsFound = 0;
  let contactsWritten = 0;

  // Cap to enrichLimit — protects Hunter spend.
  const slice = prospectIds.slice(0, enrichLimit);
  for (const id of slice) {
    const rows = (await sql`
      SELECT id, company_name, domain
      FROM prospects
      WHERE id = ${id}
        AND NOT EXISTS (SELECT 1 FROM prospect_contacts WHERE prospect_id = prospects.id)
      LIMIT 1
    `) as Array<{ id: string; company_name: string; domain: string | null }>;
    const p = rows[0];
    if (!p?.domain) continue;
    attempted += 1;

    let contact = null;
    try {
      contact = await bestContactForDomain(p.domain);
    } catch (e) {
      errors.push(
        `${p.company_name} (${p.domain}): ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    if (!contact) continue;
    contactsFound += 1;

    if (!apply) continue;

    const verification = contact.verification.status ?? "unknown";
    await sql`
      INSERT INTO prospect_contacts (
        prospect_id, email, first_name, last_name, title, linkedin_url,
        hunter_confidence, verification_status, enrichment_source
      )
      VALUES (
        ${p.id},
        ${contact.value},
        ${contact.firstName ?? null},
        ${contact.lastName ?? null},
        ${contact.position ?? null},
        ${contact.linkedin ?? null},
        ${contact.confidence ?? null},
        ${verification},
        'hunter'
      )
      ON CONFLICT (email) DO NOTHING
    `;
    contactsWritten += 1;
  }
  return { attempted, contactsFound, contactsWritten, errors };
}

export async function POST(req: Request) {
  await requireAdmin();
  await initDb();

  const url = new URL(req.url);
  const params = parseParams(url);

  const end = new Date();
  const start = new Date(end.getTime() - params.daysBack * 86_400_000);

  // 1. Pull awards (single page for now — caller can re-run with daysBack
  //    extended if more depth is needed; pageLimit caps at 100).
  let awards: AwardRow[] = [];
  let usaspendingError: string | null = null;
  try {
    const result = await searchAwards({
      startDate: isoDate(start),
      endDate: isoDate(end),
      naicsCodes: DEFAULT_DOD_NAICS,
      minAwardAmount: params.minAmount,
      maxAwardAmount: params.maxAmount,
      limit: params.pageLimit,
      page: 1,
    });
    awards = result.rows;
  } catch (e) {
    usaspendingError = e instanceof Error ? e.message : String(e);
  }

  // 2. Persist prospects (or dry-run count).
  const persist = await persistProspects(awards, params.apply);

  // 3. Optional Hunter enrichment for newly-inserted top-band prospects.
  let enrich: EnrichResult = {
    attempted: 0,
    contactsFound: 0,
    contactsWritten: 0,
    errors: [],
  };
  if (params.enrich && params.apply && persist.topBandIds.length > 0) {
    enrich = await enrichTopProspects(
      persist.topBandIds,
      params.enrichLimit,
      params.apply,
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun: !params.apply,
    params,
    range: { start: isoDate(start), end: isoDate(end) },
    awards: { fetched: awards.length, error: usaspendingError },
    prospects: persist,
    enrichment: enrich,
  });
}
