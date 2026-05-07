/**
 * Discovery pipeline v3 — three stages, agent-driven.
 *
 *   1. USAspending  → recent DoD set-aside prime awards, $25k-$2M,
 *                     last 180 days, all NAICS, paginate up to 10 pages
 *   2. Stage-1 rule filter → drop only obvious non-fits (megaprimes,
 *                     universities, JVs, foreign, out-of-band amounts)
 *   3. Stage-2 Claude review → rank survivors, pick top N for outreach
 *   4. Stage-3 Hunter enrichment → for each kept lead, find best
 *                     personal email + verification status
 *
 * Designed so 1 run pulls roughly 10 high-quality leads-with-emails,
 * 3 runs/day = ~30/day pipeline.
 *
 * Cost per run (rough):
 *   - USAspending: free
 *   - Claude (Sonnet 4.6): ~3k input + ~1.5k output ≈ $0.02
 *   - Hunter: ~10 domain-search calls (≤500/mo plan, 30/day = 900/mo so OK)
 */

import { getSql } from "@/lib/db";
import {
  searchAwards,
  type AwardRow,
} from "@/lib/outbound/usaspending";
import { scoreAward, inferDomain, type IcpScore } from "@/lib/outbound/icp";
import { rankAndPick, type ReviewVerdict } from "@/lib/outbound/ai-review";
import {
  domainSearch,
  bestContactForDomain,
  type HunterDomainEmail,
} from "@/lib/outbound/hunter";

export type DiscoveryParams = {
  daysBack: number;
  minAmount: number;
  maxAmount: number;
  pageLimit: number;
  apply: boolean;
  /** Whether to call Hunter for kept leads. Off = leads land without emails. */
  enrichWithHunter: boolean;
};

export const SMART_DEFAULTS: DiscoveryParams = {
  // 180d window: empirically a 90d set-aside slice yields ~5 awards
  // (too narrow); 180d yields ~500 SMB candidates across all NAICS.
  daysBack: 180,
  minAmount: 25_000,
  maxAmount: 2_000_000,
  pageLimit: 100,
  apply: true,
  enrichWithHunter: true,
};

const MAX_PAGES = 10;
/** Max candidates to send to Claude in one batch. Caps prompt size + cost. */
const MAX_AI_BATCH = 40;

export type DiscoveryRunResult = {
  ok: boolean;
  dryRun: boolean;
  params: DiscoveryParams;
  targetCount: number;
  range: { start: string; end: string };
  awards: { fetched: number; pagesScanned: number; error: string | null };
  ruleFilter: { passed: number; rejected: number };
  ai: {
    reviewed: number;
    kept: number;
    inputTokens: number;
    outputTokens: number;
    error: string | null;
  };
  enrichment: {
    attempted: number;
    contactsWritten: number;
    error: string | null;
  };
  prospects: { written: number; updated: number };
  durationMs: number;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Candidate = {
  award: AwardRow;
  ruleScore: IcpScore;
};

/**
 * Persist an AI-approved prospect. Idempotent on (company, domain).
 * Stores both the rule-score and the AI verdict.
 */
async function persistApproved(
  award: AwardRow,
  rule: IcpScore,
  verdict: ReviewVerdict,
  domainGuess: string | null,
  apply: boolean,
): Promise<{ id: string | null; written: boolean; updated: boolean }> {
  if (!apply) return { id: null, written: true, updated: false };
  const sql = getSql();
  const status = verdict.recommend === "keep" ? "approved" : "rejected";

  const rows = (await sql`
    INSERT INTO prospects (
      company_name, domain, uei, naics_code, state, city,
      total_award_amount, most_recent_award_at,
      data_source, raw_payload,
      icp_score, icp_band, icp_reasons,
      ai_score, ai_band, ai_reasoning, ai_reviewed_at,
      status
    )
    VALUES (
      ${award.recipientName},
      ${domainGuess},
      ${award.recipientUei},
      ${award.naicsCode},
      ${award.recipientStateCode},
      ${award.recipientCity},
      ${Math.round(award.awardAmount)},
      ${award.actionDate},
      'usaspending',
      ${JSON.stringify(award)},
      ${rule.score},
      ${rule.band},
      ${JSON.stringify(rule.reasons)},
      ${verdict.aiScore},
      ${verdict.aiBand},
      ${verdict.reasoning},
      NOW(),
      ${status}
    )
    ON CONFLICT (company_name, COALESCE(domain, ''))
    DO UPDATE SET
      icp_score = EXCLUDED.icp_score,
      icp_band = EXCLUDED.icp_band,
      icp_reasons = EXCLUDED.icp_reasons,
      ai_score = EXCLUDED.ai_score,
      ai_band = EXCLUDED.ai_band,
      ai_reasoning = EXCLUDED.ai_reasoning,
      ai_reviewed_at = NOW(),
      total_award_amount = GREATEST(prospects.total_award_amount, EXCLUDED.total_award_amount),
      most_recent_award_at = GREATEST(prospects.most_recent_award_at, EXCLUDED.most_recent_award_at),
      domain = COALESCE(prospects.domain, EXCLUDED.domain),
      status = CASE
        WHEN prospects.status IN ('engaged','converted','queued','sending')
          THEN prospects.status
        ELSE EXCLUDED.status
      END,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `) as Array<{ id: string; inserted: boolean }>;

  const row = rows[0];
  if (!row) return { id: null, written: false, updated: false };
  return { id: row.id, written: row.inserted, updated: !row.inserted };
}

/**
 * Update the prospect's domain if Hunter resolved a real one.
 */
async function updateProspectDomain(prospectId: string, domain: string) {
  const sql = getSql();
  await sql`
    UPDATE prospects
    SET domain = ${domain}, updated_at = NOW()
    WHERE id = ${prospectId} AND (domain IS NULL OR domain != ${domain})
  `;
}

/**
 * Persist a Hunter contact for a prospect. Idempotent on email.
 */
async function persistContact(
  prospectId: string,
  email: HunterDomainEmail,
): Promise<boolean> {
  const sql = getSql();
  const verification = email.verification.status;
  const allowedStatuses = new Set([
    "valid",
    "accept_all",
    "webmail",
    "disposable",
    "invalid",
    "unknown",
  ]);
  const status = verification && allowedStatuses.has(verification)
    ? verification
    : "unknown";

  const rows = (await sql`
    INSERT INTO prospect_contacts (
      prospect_id, email, first_name, last_name, title, linkedin_url,
      hunter_confidence, verification_status, enrichment_source
    )
    VALUES (
      ${prospectId},
      ${email.value},
      ${email.firstName},
      ${email.lastName},
      ${email.position},
      ${email.linkedin},
      ${email.confidence},
      ${status},
      'hunter'
    )
    ON CONFLICT (email) DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, prospect_contacts.first_name),
      last_name = COALESCE(EXCLUDED.last_name, prospect_contacts.last_name),
      title = COALESCE(EXCLUDED.title, prospect_contacts.title),
      hunter_confidence = GREATEST(prospect_contacts.hunter_confidence, EXCLUDED.hunter_confidence),
      verification_status = EXCLUDED.verification_status,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `) as Array<{ inserted: boolean }>;

  return rows[0]?.inserted ?? false;
}

/**
 * Hunter enrichment for a single kept lead.
 *
 * Strategy:
 *   1. Try a domain-search by company name (Hunter resolves the domain
 *      from the name when no domain is supplied).
 *   2. Pick the best contact (executive title + high confidence) via
 *      bestContactForDomain.
 *   3. Persist that single contact.
 *
 * Falls back to inferred-domain guess if name-based search fails. Throws
 * are caught by the caller — Hunter failures don't kill a run.
 */
async function enrichOne(
  prospectId: string,
  award: AwardRow,
  domainGuess: string | null,
): Promise<{ contactsWritten: number; resolvedDomain: string | null }> {
  let resolvedDomain: string | null = null;
  let bestEmail: HunterDomainEmail | null = null;

  // Try by company name first (Hunter does the domain resolution).
  try {
    const search = await domainSearch({
      company: award.recipientName,
      domain: domainGuess ?? "",
      limit: 25,
      personalOnly: true,
    });
    resolvedDomain = search.domain || domainGuess;
    if (search.emails.length > 0) {
      // Re-use bestContactForDomain's selection logic by calling on the
      // resolved domain (ensures consistent title-prefer scoring).
      bestEmail = await bestContactForDomain(search.domain || domainGuess || "");
    }
  } catch {
    // First-pass failed; try guess directly if we have one
    if (domainGuess) {
      try {
        bestEmail = await bestContactForDomain(domainGuess);
        resolvedDomain = domainGuess;
      } catch {
        // give up
      }
    }
  }

  if (resolvedDomain) {
    await updateProspectDomain(prospectId, resolvedDomain);
  }
  if (!bestEmail) return { contactsWritten: 0, resolvedDomain };

  const inserted = await persistContact(prospectId, bestEmail);
  return { contactsWritten: inserted ? 1 : 0, resolvedDomain };
}

/**
 * Agent entry point. "Bring me N qualified CMMC L1 leads with emails."
 */
export async function runDiscovery(
  targetCount: number,
  triggeredBy: "cron" | "admin" | "manual" = "manual",
): Promise<DiscoveryRunResult> {
  const startedAt = Date.now();
  const desired = Math.max(1, Math.min(targetCount, MAX_AI_BATCH));
  const params: DiscoveryParams = { ...SMART_DEFAULTS };
  const end = new Date();
  const start = new Date(end.getTime() - params.daysBack * 86_400_000);

  const candidates: Candidate[] = [];
  let awardsFetched = 0;
  let pagesScanned = 0;
  let rejectedByRule = 0;
  let usaspendingError: string | null = null;

  // Aim for ~3-4x desired in candidates so Claude has real choices.
  const candidateTarget = Math.min(MAX_AI_BATCH, Math.max(desired * 4, 30));
  for (let page = 1; page <= MAX_PAGES; page++) {
    pagesScanned = page;
    let rows: AwardRow[] = [];
    try {
      const res = await searchAwards({
        startDate: isoDate(start),
        endDate: isoDate(end),
        // No NAICS filter: empirically the DoD-IT NAICS list narrows
        // results to megaprime-only territory (Tetra Tech, Jacobs,
        // CDM, etc.) even within a $25k-$2M band. Combining
        // smallBusinessOnly (set-aside) with no-NAICS surfaces
        // hundreds of real SMB primes across all NAICS — Claude
        // then filters for FCI-relevant work.
        minAwardAmount: params.minAmount,
        maxAwardAmount: params.maxAmount,
        limit: params.pageLimit,
        page,
        smallBusinessOnly: true,
      });
      rows = res.rows;
      if (rows.length === 0) break;
    } catch (e) {
      usaspendingError = e instanceof Error ? e.message : String(e);
      break;
    }
    awardsFetched += rows.length;

    for (const award of rows) {
      const ruleScore = scoreAward({ award });
      if (ruleScore.band === "reject") {
        rejectedByRule += 1;
        continue;
      }
      // Dedupe by company name within a single run — USAspending often
      // returns the same prime across multiple awards.
      if (candidates.some((c) => c.award.recipientName === award.recipientName)) {
        continue;
      }
      candidates.push({ award, ruleScore });
      if (candidates.length >= candidateTarget) break;
    }
    if (candidates.length >= candidateTarget) break;
  }

  // Stage 2 — Claude review.
  let aiInputTokens = 0;
  let aiOutputTokens = 0;
  let aiError: string | null = null;
  let kept: ReviewVerdict[] = [];
  if (candidates.length > 0) {
    try {
      const review = await rankAndPick(candidates, desired);
      kept = review.winners;
      aiInputTokens = review.tokens.input;
      aiOutputTokens = review.tokens.output;
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  // Stage 3 — persist + enrich.
  let written = 0;
  let updated = 0;
  let enrichmentAttempted = 0;
  let contactsWritten = 0;
  let enrichmentError: string | null = null;

  if (kept.length > 0 && params.apply) {
    const byId = new Map(candidates.map((c) => [c.award.internalId, c]));
    for (const v of kept) {
      const c = byId.get(v.internalId);
      if (!c) continue;
      const domainGuess = inferDomain(c.award.recipientName);
      const r = await persistApproved(c.award, c.ruleScore, v, domainGuess, params.apply);
      if (r.written) written += 1;
      if (r.updated) updated += 1;

      if (params.enrichWithHunter && r.id && process.env.HUNTER_API_KEY) {
        enrichmentAttempted += 1;
        try {
          const er = await enrichOne(r.id, c.award, domainGuess);
          contactsWritten += er.contactsWritten;
        } catch (e) {
          // Record the first error but keep going — partial enrichment is fine.
          if (!enrichmentError) {
            enrichmentError = e instanceof Error ? e.message : String(e);
          }
        }
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  const result: DiscoveryRunResult = {
    ok: !usaspendingError && !aiError,
    dryRun: !params.apply,
    params,
    targetCount: desired,
    range: { start: isoDate(start), end: isoDate(end) },
    awards: { fetched: awardsFetched, pagesScanned, error: usaspendingError },
    ruleFilter: { passed: candidates.length, rejected: rejectedByRule },
    ai: {
      reviewed: candidates.length,
      kept: kept.length,
      inputTokens: aiInputTokens,
      outputTokens: aiOutputTokens,
      error: aiError,
    },
    enrichment: {
      attempted: enrichmentAttempted,
      contactsWritten,
      error: enrichmentError,
    },
    prospects: { written, updated },
    durationMs,
  };

  await logRun(result, triggeredBy);
  return result;
}

async function logRun(result: DiscoveryRunResult, triggeredBy: string) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO discovery_runs (
        triggered_by, params, target_count, range_start, range_end,
        awards_fetched, pages_scanned,
        prospects_written, prospects_updated, prospects_rejected,
        contacts_attempted, contacts_written, error_message, duration_ms,
        dry_run, ai_reviewed, ai_kept, ai_input_tokens, ai_output_tokens
      )
      VALUES (
        ${triggeredBy},
        ${JSON.stringify(result.params)},
        ${result.targetCount},
        ${result.range.start},
        ${result.range.end},
        ${result.awards.fetched},
        ${result.awards.pagesScanned},
        ${result.prospects.written},
        ${result.prospects.updated},
        ${result.ruleFilter.rejected},
        ${result.enrichment.attempted},
        ${result.enrichment.contactsWritten},
        ${result.awards.error ?? result.ai.error ?? result.enrichment.error ?? null},
        ${result.durationMs},
        ${result.dryRun},
        ${result.ai.reviewed},
        ${result.ai.kept},
        ${result.ai.inputTokens},
        ${result.ai.outputTokens}
      )
    `;
  } catch {
    // logging never fails a run
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
  ai_reviewed: number;
  ai_kept: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  created_at: string;
};

export async function listRecentRuns(limit = 10): Promise<DiscoveryRunRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, triggered_by, target_count, range_start, range_end,
           awards_fetched, pages_scanned,
           prospects_written, prospects_updated, prospects_rejected,
           contacts_attempted, contacts_written, error_message, duration_ms,
           dry_run, ai_reviewed, ai_kept, ai_input_tokens, ai_output_tokens,
           created_at
    FROM discovery_runs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as DiscoveryRunRow[];
  return rows;
}
