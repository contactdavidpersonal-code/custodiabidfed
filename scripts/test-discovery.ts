/**
 * Local test harness for the discovery pipeline.
 *
 * Runs the agent against live USAspending + (optionally) Claude, in
 * dry-run mode (no DB writes). Iterates filter widths until it gets
 * the target number of keeps, then prints the result.
 *
 * Usage (from project root):
 *   npx tsx scripts/test-discovery.ts            # dry, no Claude
 *   npx tsx scripts/test-discovery.ts --ai       # also call Claude
 *   npx tsx scripts/test-discovery.ts --ai --target 10
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { searchAwards, type AwardRow, DEFAULT_DOD_NAICS } from "../src/lib/outbound/usaspending";
import { scoreAward, type IcpScore } from "../src/lib/outbound/icp";
import { rankAndPick } from "../src/lib/outbound/ai-review";

const args = new Set(process.argv.slice(2));
const useAI = args.has("--ai");
const targetIdx = process.argv.indexOf("--target");
const TARGET = targetIdx > 0 ? Number(process.argv[targetIdx + 1]) : 10;

type Strategy = {
  name: string;
  daysBack: number;
  minAmount: number;
  maxAmount: number;
  smallBusinessOnly: boolean;
  useNaics: boolean;
  maxPages: number;
};

// Strategies in order of preference. Tighter first, widen if not enough.
const STRATEGIES: Strategy[] = [
  {
    name: "A: 90d set-aside any-NAICS $25k-$2M",
    daysBack: 90,
    minAmount: 25_000,
    maxAmount: 2_000_000,
    smallBusinessOnly: true,
    useNaics: false,
    maxPages: 5,
  },
  {
    name: "B: 180d set-aside any-NAICS $25k-$2M",
    daysBack: 180,
    minAmount: 25_000,
    maxAmount: 2_000_000,
    smallBusinessOnly: true,
    useNaics: false,
    maxPages: 10,
  },
  {
    name: "C: 365d set-aside any-NAICS $25k-$2M",
    daysBack: 365,
    minAmount: 25_000,
    maxAmount: 2_000_000,
    smallBusinessOnly: true,
    useNaics: false,
    maxPages: 10,
  },
  {
    name: "D: 365d set-aside any-NAICS $25k-$5M",
    daysBack: 365,
    minAmount: 25_000,
    maxAmount: 5_000_000,
    smallBusinessOnly: true,
    useNaics: false,
    maxPages: 10,
  },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtAmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

async function tryStrategy(
  s: Strategy,
): Promise<{ candidates: Array<{ award: AwardRow; ruleScore: IcpScore }>; awardsFetched: number; pagesScanned: number }> {
  const end = new Date();
  const start = new Date(end.getTime() - s.daysBack * 86_400_000);
  const candidates: Array<{ award: AwardRow; ruleScore: IcpScore }> = [];
  let awardsFetched = 0;
  let pagesScanned = 0;
  const seenNames = new Set<string>();

  for (let page = 1; page <= s.maxPages; page++) {
    pagesScanned = page;
    const res = await searchAwards({
      startDate: isoDate(start),
      endDate: isoDate(end),
      naicsCodes: s.useNaics ? DEFAULT_DOD_NAICS : undefined,
      minAwardAmount: s.minAmount,
      maxAwardAmount: s.maxAmount,
      limit: 100,
      page,
      smallBusinessOnly: s.smallBusinessOnly,
    });
    awardsFetched += res.rows.length;
    if (res.rows.length === 0) break;

    for (const award of res.rows) {
      const ruleScore = scoreAward({ award });
      if (ruleScore.band === "reject") continue;
      if (seenNames.has(award.recipientName)) continue;
      seenNames.add(award.recipientName);
      candidates.push({ award, ruleScore });
    }
    if (!res.hasMore) break;
  }
  return { candidates, awardsFetched, pagesScanned };
}

async function main() {
  console.log(`\n=== DISCOVERY DRY-RUN — target ${TARGET} keeps, AI=${useAI} ===\n`);

  let chosen: { strategy: Strategy; candidates: Array<{ award: AwardRow; ruleScore: IcpScore }>; awardsFetched: number; pagesScanned: number } | null = null;

  for (const s of STRATEGIES) {
    process.stdout.write(`Trying ${s.name}... `);
    try {
      const r = await tryStrategy(s);
      console.log(`fetched ${r.awardsFetched} awards (${r.pagesScanned}p), ${r.candidates.length} survived rule filter`);
      if (r.candidates.length >= TARGET * 2 || s === STRATEGIES[STRATEGIES.length - 1]) {
        chosen = { strategy: s, ...r };
        break;
      }
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
    }
  }

  if (!chosen) {
    console.error("No strategy yielded any candidates. Done.");
    return;
  }

  console.log(`\nChosen strategy: ${chosen.strategy.name}`);
  console.log(`Candidates for review: ${chosen.candidates.length}\n`);

  // Show first 30 raw survivors
  console.log("--- Rule-filtered survivors (first 30) ---");
  for (const c of chosen.candidates.slice(0, 30)) {
    console.log(
      `  ${fmtAmt(c.award.awardAmount).padStart(8)}  ${(c.award.naicsCode ?? "?????").padEnd(7)}  ${c.award.recipientStateCode ?? "??"}  ${c.award.recipientName}`,
    );
  }
  console.log();

  if (!useAI) {
    console.log("(skipping Claude — pass --ai to call)");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    return;
  }

  const reviewBatch = chosen.candidates.slice(0, 40);
  console.log(`Sending ${reviewBatch.length} candidates to Claude...`);
  const review = await rankAndPick(reviewBatch, TARGET);
  console.log(`Claude returned ${review.allVerdicts.length} verdicts; ${review.winners.length} kept.`);
  console.log(`Tokens: ${review.tokens.input} in / ${review.tokens.output} out`);
  console.log();

  console.log(`--- TOP ${review.winners.length} KEEPS ---`);
  const byId = new Map(reviewBatch.map((c) => [c.award.internalId, c]));
  for (const v of review.winners) {
    const c = byId.get(v.internalId);
    if (!c) continue;
    console.log(
      `  [${v.aiBand} ${v.aiScore}] ${c.award.recipientName} — ${fmtAmt(c.award.awardAmount)} ${c.award.recipientStateCode ?? ""} NAICS ${c.award.naicsCode ?? "?"}`,
    );
    console.log(`         → ${v.reasoning}`);
  }
  console.log();

  console.log(`--- ALL VERDICTS (sorted) ---`);
  const sorted = [...review.allVerdicts].sort((a, b) => b.aiScore - a.aiScore);
  for (const v of sorted) {
    const c = byId.get(v.internalId);
    if (!c) continue;
    const tag = v.recommend === "keep" ? "✓" : "✗";
    console.log(`  ${tag} [${v.aiBand} ${v.aiScore}] ${c.award.recipientName} → ${v.reasoning}`);
  }

  console.log(`\nDone. Final count: ${review.winners.length}/${TARGET} target.`);
  if (review.winners.length < TARGET) {
    console.log(`⚠ UNDER TARGET. Consider widening filters or relaxing prompt.`);
  } else {
    console.log(`✓ AT TARGET. Safe to deploy.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
