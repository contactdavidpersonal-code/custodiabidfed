/**
 * Discovery pipeline — agent that finds qualified CMMC L1 prospects.
 *
 * Two-stage funnel:
 *
 *   1. USAspending → rule-based ICP scorer (fast, cheap)
 *      Drops universities, megaprimes, public engineering firms, JVs,
 *      out-of-band amounts, non-US states, etc.
 *
 *   2. Survivors → Claude review agent (one batched call)
 *      Reads company name, NAICS, agency, award size, state, etc. and
 *      ranks for fit. Picks top-N "keep" recommendations.
 *
 * Hunter enrichment is OFF in this revision — we want a clean pool of
 * AI-vetted leads first, then we'll burn credits selectively.
 */

import { getSql } from "@/lib/db";
import {
  searchAwards,
  type AwardRow,
  DEFAULT_DOD_NAICS,
} from "@/lib/outbound/usaspending";
import { scoreAward, inferDomain, type IcpScore } from "@/lib/outbound/icp";
import { rankAndPick, type ReviewVerdict } from "@/lib/outbound/ai-review";

export type DiscoveryParams = {
  daysBack: number;
  minAmount: number;
  maxAmount: number;
  pageLimit: number;
  apply: boolean;
};

/**
 * Defaults for the agent. Wider net than v1 — let Claude do the
 * fine-grained filtering.
 *
 *   - 60 days back: enough catalog depth that we always fill a 10-lead quota
 *   - $100k–$25M: SMB to mid-market band; AI rejects megacorps regardless
 *   - 100/page (USAspending max)
 */
export const SMART_DEFAULTS: DiscoveryParams = {
  daysBack: 60,
  minAmount: 100_000,
  maxAmount: 25_000_000,
  pageLimit: 100,
  apply: true,
};

const MAX_PAGES = 5;
/** Max candidates to send to Claude in one batch. Keeps prompts under ~3k tokens. */
const MAX_AI_BATCH = 30;

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
 * Persist a single AI-approved prospect. Idempotent. Returns whether
 * this insert was new or an update.
 */
async function persistApproved(
  award: AwardRow,
  rule: IcpScore,
  verdict: ReviewVerdict,
  apply: boolean,
): Promise<{ written: boolean; updated: boolean; id: string | null }> {
  if (!apply) return { written: true, updated: false, id: null };
  const sql = getSql();
  const domain = inferDomain(award.recipientName);
  // The AI's decision drives the persisted band/score. We keep the
  // rule-score around in `icp_score` for comparison.
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
      ${domain},
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
      status = CASE
        WHEN prospects.status IN ('engaged','converted','queued','sending')
          THEN prospects.status
        ELSE EXCLUDED.status
      END,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `) as Array<{ id: string; inserted: boolean }>;

  const row = rows[0];
  if (!row) return { written: false, updated: false, id: null };
  return { written: row.inserted, updated: !row.inserted, id: row.id };
}

/**
 * Agent entry point. "Bring me N qualified leads."
 *
 *   - Pulls awards from USAspending (auto-paginates up to MAX_PAGES)
 *   - Rule-filters to drop obvious rejects
 *   - Sends survivors (up to MAX_AI_BATCH) to Claude for ranking
 *   - Persists Claude's top-N picks as `status='approved'`
 *
 * Hunter is intentionally NOT called — emails come later, after manual
 * review of the AI-curated list.
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

  // Stage 1 — pull + rule-filter. We aim for ~3x desired in candidates so
  // Claude has real choices to make.
  const candidateTarget = Math.min(MAX_AI_BATCH, desired * 3);
  for (let page = 1; page <= MAX_PAGES; page++) {
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
      const ruleScore = scoreAward({ award });
      if (ruleScore.band === "reject") {
        rejectedByRule += 1;
        continue;
      }
      candidates.push({ award, ruleScore });
      if (candidates.length >= candidateTarget) break;
    }
    if (candidates.length >= candidateTarget) break;
  }

  // Stage 2 — Claude review. Single batched call.
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

  // Stage 3 — persist approved leads.
  let written = 0;
  let updated = 0;
  if (kept.length > 0 && params.apply) {
    const byId = new Map(candidates.map((c) => [c.award.internalId, c]));
    for (const v of kept) {
      const c = byId.get(v.internalId);
      if (!c) continue;
      const r = await persistApproved(c.award, c.ruleScore, v, params.apply);
      if (r.written) written += 1;
      if (r.updated) updated += 1;
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
        ${0},
        ${0},
        ${result.awards.error ?? result.ai.error ?? null},
        ${result.durationMs},
        ${result.dryRun},
        ${result.ai.reviewed},
        ${result.ai.kept},
        ${result.ai.inputTokens},
        ${result.ai.outputTokens}
      )
    `;
  } catch {
    // logging errors never fail a run
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
