/**
 * Run the live discovery pipeline once, end-to-end. Hits real
 * USAspending + Claude + Hunter + DB. Use to verify a full run
 * yields N new leads with contacts before pushing UI changes.
 *
 * Usage:
 *   npx tsx scripts/run-discovery-live.ts          # 10 leads
 *   npx tsx scripts/run-discovery-live.ts 5        # 5 leads
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { runDiscovery } from "../src/lib/outbound/discovery-pipeline";

async function main() {
  const target = Number(process.argv[2] ?? "10");
  console.log(`\n=== LIVE DISCOVERY RUN — target ${target} new leads ===\n`);
  const r = await runDiscovery(target, "manual");
  console.log(JSON.stringify({
    ok: r.ok,
    range: r.range,
    awards: r.awards,
    ruleFilter: r.ruleFilter,
    ai: { reviewed: r.ai.reviewed, kept: r.ai.kept, tokens: { in: r.ai.inputTokens, out: r.ai.outputTokens }, error: r.ai.error },
    prospects: r.prospects,
    enrichment: r.enrichment,
    durationMs: r.durationMs,
  }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
