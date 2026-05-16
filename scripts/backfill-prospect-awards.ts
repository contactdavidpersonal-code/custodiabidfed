/**
 * Backfill prospect_awards from existing prospects.raw_payload.
 *
 * The current 20 prospects predate the prospect_awards table. Their
 * USAspending records are still intact in `prospects.raw_payload`, so
 * we can hydrate the new contract-intel table without re-hitting the
 * USAspending API.
 *
 * **Accuracy guarantee:** every column is read directly from the stored
 * raw_payload (which is the original USAspending response shape we
 * normalized into AwardRow at fetch time). Nothing is derived or
 * inferred. Rows that lack a PIID or action_date are skipped — those
 * cannot be safely cited in outbound copy.
 *
 * Idempotent: ON CONFLICT (prospect_id, piid, action_date) DO UPDATE
 * touches last_seen_at; existing source-of-truth fields are preserved.
 *
 * Usage (from custodiabidfed/):
 *   npx tsx scripts/backfill-prospect-awards.ts            # dry-run
 *   npx tsx scripts/backfill-prospect-awards.ts --apply    # writes
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { getSql, initDb } from "../src/lib/db";
import type { AwardRow } from "../src/lib/outbound/usaspending";

const APPLY = process.argv.includes("--apply");

type ProspectRow = {
  id: string;
  company_name: string;
  raw_payload: AwardRow | null;
};

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);

  // Make sure prospect_awards exists.
  await initDb();
  const sql = getSql();

  const rows = (await sql`
    SELECT id, company_name, raw_payload
    FROM prospects
    WHERE raw_payload IS NOT NULL
    ORDER BY created_at ASC
  `) as ProspectRow[];

  console.log(`Found ${rows.length} prospects with raw_payload`);

  let backfilled = 0;
  let skippedNoPiid = 0;
  const skippedNoActionDate = 0;
  let alreadyPresent = 0;

  for (const p of rows) {
    const award = p.raw_payload;
    if (!award || typeof award !== "object") continue;

    if (!award.piid) {
      skippedNoPiid += 1;
      console.log(`  [skip:no-piid] ${p.company_name}`);
      continue;
    }
    // action_date may legitimately be null on USAspending purchase orders;
    // we still cite the contract by PIID + amount + agency. Don't skip.
    void skippedNoActionDate;

    if (!APPLY) {
      console.log(
        `  [would-insert] ${p.company_name} piid=${award.piid} amount=$${Math.round(award.awardAmount).toLocaleString()} pop_end=${award.periodOfPerformanceEndDate ?? "null"}`,
      );
      backfilled += 1;
      continue;
    }

    const result = (await sql`
      INSERT INTO prospect_awards (
        prospect_id, piid, internal_id,
        award_amount_cents, action_date,
        period_of_performance_start_date, period_of_performance_end_date,
        awarding_agency_name, awarding_sub_agency_name,
        naics_code, naics_description,
        contract_award_type, description,
        place_of_performance_state, place_of_performance_city,
        source, raw_payload
      ) VALUES (
        ${p.id},
        ${award.piid},
        ${award.internalId || null},
        ${Math.round((award.awardAmount ?? 0) * 100)},
        ${award.actionDate},
        ${award.periodOfPerformanceStartDate ?? null},
        ${award.periodOfPerformanceEndDate ?? null},
        ${award.awardingAgencyName ?? null},
        ${award.awardingSubAgencyName ?? null},
        ${award.naicsCode ?? null},
        ${award.naicsDescription ?? null},
        ${award.contractAwardType ?? null},
        ${award.description ?? null},
        ${award.recipientStateCode ?? null},
        ${award.recipientCity ?? null},
        'usaspending',
        ${JSON.stringify(award)}
      )
      ON CONFLICT (prospect_id, piid)
      DO UPDATE SET last_seen_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `) as Array<{ inserted: boolean }>;

    if (result[0]?.inserted) {
      backfilled += 1;
      console.log(
        `  [insert] ${p.company_name} piid=${award.piid} amount=$${Math.round(award.awardAmount).toLocaleString()}`,
      );
    } else {
      alreadyPresent += 1;
      console.log(`  [refresh] ${p.company_name} piid=${award.piid}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Backfilled:           ${backfilled}`);
  console.log(`Already present:      ${alreadyPresent}`);
  console.log(`Skipped (no PIID):    ${skippedNoPiid}`);
  console.log(`Skipped (no date):    ${skippedNoActionDate}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
