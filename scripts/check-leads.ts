import { config } from "dotenv";
config({ path: ".env.local" });
import { getSql } from "../src/lib/db";

async function main() {
  const sql = getSql();
  const rows = (await sql`
    SELECT p.company_name, p.domain, c.email, c.enrichment_source, c.hunter_confidence, c.title
    FROM prospects p
    LEFT JOIN prospect_contacts c ON c.prospect_id = p.id
    WHERE p.status = 'approved'
    ORDER BY p.created_at DESC
    LIMIT 20
  `) as Array<{ company_name: string; domain: string | null; email: string | null; enrichment_source: string | null; hunter_confidence: number | null; title: string | null }>;
  console.log(`\n${rows.length} rows`);
  for (const r of rows) {
    const tag = r.enrichment_source === "guessed" ? "[GUESS]" : "[HUNTER]";
    console.log(`  ${tag.padEnd(9)} ${(r.email ?? "(none)").padEnd(40)} conf=${r.hunter_confidence ?? "-"}  ${r.company_name}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
