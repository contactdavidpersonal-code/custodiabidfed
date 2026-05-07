/**
 * Outbound contract intel — read-only accessors for cold-email templating.
 *
 * **Why a separate module:** persistence (discovery-pipeline.ts) writes
 * the source-of-truth USAspending fields into `prospect_awards`. This
 * module reads them back for outbound copy hydration with strict
 * accuracy guarantees:
 *
 *   1. We never invent values. If a field was null in USAspending, it
 *      stays null here. Templating callers must handle null and skip
 *      the personalized line — never fall back to "[redacted]" or a
 *      placeholder that could read as fabricated.
 *
 *   2. We surface provenance: every returned record carries
 *      `source = 'usaspending'` and `firstSeenAt` so the operator can
 *      audit when the data was captured.
 *
 *   3. PIID is the contract number we cite to the recipient. If it's
 *      empty, the whole record is suppressed (we won't email someone
 *      claiming "your contract" with no contract identifier).
 *
 * The Instantly campaign push will call `getOutboundContractIntel` for
 * each prospect and pass the result as Instantly custom variables.
 */

import { getSql } from "@/lib/db";

export type ProspectAwardRecord = {
  id: string;
  prospectId: string;
  /** Procurement Instrument Identifier — the contract number, e.g. "W56HZV-25-D-0042". */
  piid: string;
  awardAmountCents: number;
  /** ISO date string (YYYY-MM-DD) or null. */
  actionDate: string | null;
  periodOfPerformanceStartDate: string | null;
  periodOfPerformanceEndDate: string | null;
  awardingAgencyName: string | null;
  awardingSubAgencyName: string | null;
  naicsCode: string | null;
  naicsDescription: string | null;
  contractAwardType: string | null;
  description: string | null;
  placeOfPerformanceState: string | null;
  placeOfPerformanceCity: string | null;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type AwardRow = {
  id: string;
  prospect_id: string;
  piid: string;
  award_amount_cents: string | number;
  action_date: string | null;
  period_of_performance_start_date: string | null;
  period_of_performance_end_date: string | null;
  awarding_agency_name: string | null;
  awarding_sub_agency_name: string | null;
  naics_code: string | null;
  naics_description: string | null;
  contract_award_type: string | null;
  description: string | null;
  place_of_performance_state: string | null;
  place_of_performance_city: string | null;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
};

function toRecord(r: AwardRow): ProspectAwardRecord {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    piid: r.piid,
    awardAmountCents: Number(r.award_amount_cents),
    actionDate: r.action_date,
    periodOfPerformanceStartDate: r.period_of_performance_start_date,
    periodOfPerformanceEndDate: r.period_of_performance_end_date,
    awardingAgencyName: r.awarding_agency_name,
    awardingSubAgencyName: r.awarding_sub_agency_name,
    naicsCode: r.naics_code,
    naicsDescription: r.naics_description,
    contractAwardType: r.contract_award_type,
    description: r.description,
    placeOfPerformanceState: r.place_of_performance_state,
    placeOfPerformanceCity: r.place_of_performance_city,
    source: r.source,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
  };
}

/**
 * Get all stored awards for a prospect, newest action_date first.
 *
 * Returns an empty array (never throws) if the prospect has no recorded
 * awards. Callers must treat empty as "no personalization available."
 */
export async function listProspectAwards(prospectId: string): Promise<ProspectAwardRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, prospect_id, piid, award_amount_cents,
           action_date, period_of_performance_start_date, period_of_performance_end_date,
           awarding_agency_name, awarding_sub_agency_name,
           naics_code, naics_description,
           contract_award_type, description,
           place_of_performance_state, place_of_performance_city,
           source, first_seen_at, last_seen_at
    FROM prospect_awards
    WHERE prospect_id = ${prospectId}
    ORDER BY action_date DESC NULLS LAST, award_amount_cents DESC
  `) as AwardRow[];
  return rows.map(toRecord);
}

/**
 * Pick the single best award to cite in outbound copy.
 *
 * Selection rule (in order):
 *   1. Must have a non-empty PIID. If no record has a PIID, return null.
 *      We will not email someone claiming "your contract" without a real
 *      contract identifier we can reference verbatim.
 *   2. Most recent action_date wins; rows with null action_date sort last.
 *   3. Tie-break: largest award amount.
 *
 * Note: USAspending returns null Action Date / Period of Performance for
 * many small purchase orders. That's still citeable — PIID + amount +
 * agency are reliable on those rows. Templating callers should check each
 * field for null and skip lines that depend on missing values.
 *
 * Returning null is a feature: it tells the email pusher to use the
 * generic (non-cited) template instead of inventing a contract.
 */
export async function getOutboundContractIntel(
  prospectId: string,
): Promise<ProspectAwardRecord | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, prospect_id, piid, award_amount_cents,
           action_date, period_of_performance_start_date, period_of_performance_end_date,
           awarding_agency_name, awarding_sub_agency_name,
           naics_code, naics_description,
           contract_award_type, description,
           place_of_performance_state, place_of_performance_city,
           source, first_seen_at, last_seen_at
    FROM prospect_awards
    WHERE prospect_id = ${prospectId}
      AND piid IS NOT NULL
      AND piid <> ''
    ORDER BY action_date DESC NULLS LAST, award_amount_cents DESC
    LIMIT 1
  `) as AwardRow[];
  const row = rows[0];
  return row ? toRecord(row) : null;
}

/**
 * Format an award amount in dollars for human-facing copy.
 *   $487,500   → "$487K"
 *   $1,250,000 → "$1.2M"
 *   $25,000    → "$25K"
 *
 * Cents in, no decimals on the K side, one decimal on the M side.
 * Returns null if the input is non-positive.
 */
export function formatAwardAmount(cents: number): string | null {
  if (!Number.isFinite(cents) || cents <= 0) return null;
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (dollars >= 1_000) {
    return `$${Math.round(dollars / 1_000)}K`;
  }
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}
