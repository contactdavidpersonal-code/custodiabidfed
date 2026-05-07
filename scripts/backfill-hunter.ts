/**
 * Backfill Hunter enrichment for prospects that don't yet have a contact.
 *
 * Useful when:
 *   - Hunter rate-limited mid-run
 *   - Domain inference failed and we need to retry by company name
 *   - We've improved the enrichment logic and want to re-run on existing rows
 *
 * Idempotent: skips prospects that already have any prospect_contacts row.
 *
 * Usage (from project root):
 *   npx tsx scripts/backfill-hunter.ts            # dry-run (no DB writes)
 *   npx tsx scripts/backfill-hunter.ts --apply    # actually call Hunter + write
 *   npx tsx scripts/backfill-hunter.ts --apply --limit 10
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { getSql } from "../src/lib/db";
import { enrichOne } from "../src/lib/outbound/discovery-pipeline";
import { inferDomain } from "../src/lib/outbound/icp";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : 50;

type Row = {
  id: string;
  company_name: string;
  domain: string | null;
};

async function main() {
  if (!process.env.HUNTER_API_KEY) {
    console.error("HUNTER_API_KEY not set in .env.local");
    process.exit(1);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT p.id, p.company_name, p.domain
    FROM prospects p
    LEFT JOIN prospect_contacts c ON c.prospect_id = p.id
    WHERE p.status = 'approved'
      AND c.id IS NULL
    GROUP BY p.id, p.company_name, p.domain
    ORDER BY p.created_at DESC
    LIMIT ${LIMIT}
  `) as Row[];

  console.log(`\n=== HUNTER BACKFILL — ${rows.length} prospects without contacts (apply=${APPLY}) ===\n`);
  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let written = 0;
  let resolved = 0;
  let misses = 0;

  for (const r of rows) {
    const domainGuess = r.domain ?? inferDomain(r.company_name);
    if (!APPLY) {
      console.log(`  [dry] ${r.company_name.padEnd(45)} guess=${domainGuess ?? "(none)"}`);
      continue;
    }
    try {
      const out = await enrichOne(r.id, r.company_name, domainGuess);
      if (out.contactsWritten > 0) {
        written += 1;
        console.log(`  ✓ ${r.company_name.padEnd(45)} domain=${out.resolvedDomain ?? "?"}  (+1 contact)`);
      } else {
        misses += 1;
        console.log(`  ✗ ${r.company_name.padEnd(45)} domain=${out.resolvedDomain ?? "?"}  (no email found)`);
      }
      if (out.resolvedDomain) resolved += 1;
    } catch (e) {
      misses += 1;
      console.log(`  ! ${r.company_name.padEnd(45)} ERROR: ${(e as Error).message}`);
    }
  }

  console.log();
  if (APPLY) {
    console.log(`Done. ${written} contacts written, ${resolved} domains resolved, ${misses} misses.`);
  } else {
    console.log(`Dry-run complete. Re-run with --apply to actually call Hunter.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
