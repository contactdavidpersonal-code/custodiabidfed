/**
 * Discovery pipeline — the "agent" that runs end-to-end:
 *
 *   USAspending → ICP score → upsert `prospects` → Hunter → upsert `prospect_contacts`
 *
 * Agent mode: caller says "fetch me N qualified leads with emails."
 * The pipeline auto-paginates USAspending until we have N band-A/B
 * prospects with a Hunter contact, or hits MAX_PAGES / MAX_HUNTER_CALLS.
 *
 * The admin UI exposes a single number ("how many?") and a button.
 * Cron passes a fixed daily target. No knobs in normal use.
 */

import { getSql } from "@/lib/db";
import {
  searchAwards,
  type AwardRow,
  DEFAULT_DOD_NAICS,
} from "@/lib/outbound/usaspending";
import { scoreAward, inferDomain } from "@/lib/outbound/icp";
import { bestContactForDomain } from "@/lib/outbound/hunter";

export type DiscoveryParams = {
  daysBack: number;
  minAmount: number;
  maxAmount: number;
  pageLimit: number;
  enrich: boolean;
  enrichLimit: number;
  apply: boolean;
};

/**
 * Defaults for the agent. Tuned to find SMB-prime CMMC L1 ICPs:
 *   - 30 days back: fresh urgency, deep enough catalog
 *   - $250k–$5M: SMB sweet spot
 *   - 100 awards/page: USAspending max
 */
export const SMART_DEFAULTS: DiscoveryParams = {
  daysBack: 30,
  minAmount: 250_000,
  maxAmount: 5_000_000,
  pageLimit: 100,
  enrich: true,
  enrichLimit: 10,
  apply: true,
};

/** Hard caps so a runaway agent can't burn unlimited Hunter credits. */
const MAX_PAGES = 5; // 500 awards max
const MAX_HUNTER_CALLS = 50; // ~$0.50 ceiling per run

export type ProspectInsertResult = {
  written: number;
  skipped: number;
  rejected: number;
  topBandIds: string[];
};

export type EnrichResult = {
  attempted: number;
  contactsFound: number;
  contactsWritten: number;
  errors: string[];
};

export type DiscoveryRunResult = {
  ok: boolean;
  dryRun: boolean;
  params: DiscoveryParams;
  targetCount: number | null;
  range: { start: string; end: string };
  awards: { fetched: number; pagesScanned: number; error: string | null };
  prospects: ProspectInsertResult;
  enrichment: EnrichResult;
  durationMs: number;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function persistOneAward(
  award: AwardRow,
  apply: boolean,
): Promise<{
  written: boolean;
  updated: boolean;
  rejected: boolean;
  band: string;
  id: string | null;
}> {
  const sql = getSql();
  const { score, band, reasons } = scoreAward({ award });
  const domain = inferDomain(award.recipientName);
  const status = band === "reject" ? "rejected" : "new";

  if (band === "reject") {
    return { written: false, updated: false, rejected: true, band, id: null };
  }
  if (!apply) {
    return { written: true, updated: false, rejected: false, band, id: null };
  }

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
  if (!row) {
    return { written: false, updated: false, rejected: false, band, id: null };
  }
  return {
    written: row.inserted,
    updated: !row.inserted,
    rejected: false,
    band,
    id: row.id,
  };
}

async function enrichProspect(
  prospectId: string,
  apply: boolean,
): Promise<{ found: boolean; written: boolean; error: string | null }> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, company_name, domain
    FROM prospects
    WHERE id = ${prospectId}
      AND NOT EXISTS (SELECT 1 FROM prospect_contacts WHERE prospect_id = prospects.id)
    LIMIT 1
  `) as Array<{ id: string; company_name: string; domain: string | null }>;
  const p = rows[0];
  if (!p?.domain) return { found: false, written: false, error: null };

  let contact = null;
  try {
    contact = await bestContactForDomain(p.domain);
  } catch (e) {
    return {
      found: false,
      written: false,
      error: `${p.company_name} (${p.domain}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!contact) return { found: false, written: false, error: null };
  if (!apply) return { found: true, written: false, error: null };

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
  return { found: true, written: true, error: null };
}

/**
 * Agent entry point. "Bring me N qualified leads with emails."
 *
 * Walks USAspending pages, scoring + persisting + enriching as it goes,
 * stopping the moment we have `targetCount` written contacts (or hit
 * MAX_PAGES / MAX_HUNTER_CALLS).
 */
export async function runDiscovery(
  targetCount: number,
  triggeredBy: "cron" | "admin" | "manual" = "manual",
): Promise<DiscoveryRunResult> {
  const startedAt = Date.now();
  const desired = Math.max(1, Math.min(targetCount, MAX_HUNTER_CALLS));
  const params: DiscoveryParams = {
    ...SMART_DEFAULTS,
    enrichLimit: desired,
  };
  const end = new Date();
  const start = new Date(end.getTime() - params.daysBack * 86_400_000);

  const persist: ProspectInsertResult = {
    written: 0,
    skipped: 0,
    rejected: 0,
    topBandIds: [],
  };
  const enrich: EnrichResult = {
    attempted: 0,
    contactsFound: 0,
    contactsWritten: 0,
    errors: [],
  };
  let awardsFetched = 0;
  let pagesScanned = 0;
  let usaspendingError: string | null = null;

  pageLoop: for (let page = 1; page <= MAX_PAGES; page++) {
    pagesScanned = page;
    let rows: AwardRow[] = [];
    try {
      const res = await searchAwards({
        startDate: isoDate(start),
        endDate: isoDate(end),
        naicsCodes: DEFAULT_DOD_NAICS,
        minAwardAmount: params.minAmount,
        maxAwardAmount: params.maxAmount,
        limit: params.pageLimit,
        page,
      });
      rows = res.rows;
      if (rows.length === 0) break;
    } catch (e) {
      usaspendingError = e instanceof Error ? e.message : String(e);
      break;
    }
    awardsFetched += rows.length;

    for (const award of rows) {
      const r = await persistOneAward(award, params.apply);
      if (r.rejected) persist.rejected += 1;
      else if (r.written) persist.written += 1;
      else if (r.updated) persist.skipped += 1;

      // Only enrich band-A/B with a fresh insert. Cap by MAX_HUNTER_CALLS
      // and by the user-requested target so the agent stops the moment
      // it has what was asked for.
      if (
        r.id &&
        (r.band === "A" || r.band === "B") &&
        enrich.attempted < MAX_HUNTER_CALLS &&
        enrich.contactsWritten < desired
      ) {
        persist.topBandIds.push(r.id);
        enrich.attempted += 1;
        const e = await enrichProspect(r.id, params.apply);
        if (e.error) enrich.errors.push(e.error);
        if (e.found) enrich.contactsFound += 1;
        if (e.written) enrich.contactsWritten += 1;
        if (enrich.contactsWritten >= desired) break pageLoop;
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  const result: DiscoveryRunResult = {
    ok: !usaspendingError,
    dryRun: !params.apply,
    params,
    targetCount: desired,
    range: { start: isoDate(start), end: isoDate(end) },
    awards: { fetched: awardsFetched, pagesScanned, error: usaspendingError },
    prospects: persist,
    enrichment: enrich,
    durationMs,
  };

  await logRun(result, triggeredBy, desired);
  return result;
}

async function logRun(
  result: DiscoveryRunResult,
  triggeredBy: string,
  targetCount: number | null,
) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO discovery_runs (
        triggered_by, params, target_count, range_start, range_end,
        awards_fetched, pages_scanned,
        prospects_written, prospects_updated, prospects_rejected,
        contacts_attempted, contacts_written, error_message, duration_ms,
        dry_run
      )
      VALUES (
        ${triggeredBy},
        ${JSON.stringify(result.params)},
        ${targetCount},
        ${result.range.start},
        ${result.range.end},
        ${result.awards.fetched},
        ${result.awards.pagesScanned},
        ${result.prospects.written},
        ${result.prospects.skipped},
        ${result.prospects.rejected},
        ${result.enrichment.attempted},
        ${result.enrichment.contactsWritten},
        ${result.awards.error ?? (result.enrichment.errors[0] ?? null)},
        ${result.durationMs},
        ${result.dryRun}
      )
    `;
  } catch {
    // never fail a run because logging didn't work
  }
}

export type DiscoveryRunRow = {
  id: string;
  triggered_by: string;
  target_count: number | null;
  range_start: string;
  range_end: string;
  awards_fetched: number;
  pages_scanned: number;
  prospects_written: number;
  prospects_updated: number;
  prospects_rejected: number;
  contacts_attempted: number;
  contacts_written: number;
  error_message: string | null;
  duration_ms: number;
  dry_run: boolean;
  created_at: string;
};

export async function listRecentRuns(limit = 10): Promise<DiscoveryRunRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, triggered_by, target_count, range_start, range_end,
           awards_fetched, pages_scanned,
           prospects_written, prospects_updated, prospects_rejected,
           contacts_attempted, contacts_written, error_message, duration_ms,
           dry_run, created_at
    FROM discovery_runs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as DiscoveryRunRow[];
  return rows;
}
