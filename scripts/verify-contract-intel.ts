import { config } from "dotenv";
config({ path: ".env.local" });

import { getOutboundContractIntel, formatAwardAmount } from "../src/lib/outbound/contract-intel";
import { getSql } from "../src/lib/db";

async function main() {
  const sql = getSql();
  const ps = (await sql`
    SELECT id, company_name FROM prospects ORDER BY created_at DESC LIMIT 5
  `) as Array<{ id: string; company_name: string }>;
  for (const p of ps) {
    const award = await getOutboundContractIntel(p.id);
    console.log(`\n=== ${p.company_name}`);
    if (!award) {
      console.log("  no citeable award (would use generic copy)");
      continue;
    }
    console.log(`  PIID:        ${award.piid}`);
    console.log(`  Amount:      ${formatAwardAmount(award.awardAmountCents) ?? "(unknown)"}`);
    console.log(`  Sub-agency:  ${award.awardingSubAgencyName ?? "(null)"}`);
    console.log(`  NAICS:       ${award.naicsCode} - ${award.naicsDescription}`);
    console.log(`  Type:        ${award.contractAwardType ?? "(null)"}`);
    console.log(`  Description: ${award.description ?? "(null)"}`);
    console.log(`  Action date: ${award.actionDate ?? "(null)"}`);
    console.log(`  POP end:     ${award.periodOfPerformanceEndDate ?? "(null)"}`);
  }
}
main().catch(console.error);
