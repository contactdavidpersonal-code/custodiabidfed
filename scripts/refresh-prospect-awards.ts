/**
 * Re-fetch contract intel from USAspending for prospects whose
 * raw_payload predates the description / NAICS-object / POP-date
 * fields. Writes a fresh row per (prospect, piid) into prospect_awards.
 *
 * Idempotent: ON CONFLICT (prospect_id, piid) DO UPDATE refreshes
 * source-of-truth fields with whatever USAspending returns now.
 *
 * Usage:
 *   npx tsx scripts/refresh-prospect-awards.ts            # dry-run
 *   npx tsx scripts/refresh-prospect-awards.ts --apply    # writes
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getSql } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

const USASPENDING = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

type RawNaics = string | { code?: string | null; description?: string | null } | null;
type RawAward = {
  internal_id?: number | string;
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Recipient UEI"?: string | null;
  "Award Amount"?: number | string | null;
  "Action Date"?: string | null;
  "Period of Performance Start Date"?: string | null;
  "Period of Performance Current End Date"?: string | null;
  "Awarding Agency"?: string | null;
  "Awarding Sub Agency"?: string | null;
  "Place of Performance State Code"?: string | null;
  "Place of Performance City Code"?: string | null;
  Description?: string | null;
  "Contract Award Type"?: string | null;
  NAICS?: RawNaics;
};

function extractNaicsCode(r: RawAward): string | null {
  const n = r.NAICS;
  if (n && typeof n === "object" && typeof n.code === "string") {
    const m = n.code.match(/^\d{4,6}/);
    if (m) return m[0];
  }
  return null;
}
function extractNaicsDesc(r: RawAward): string | null {
  const n = r.NAICS;
  if (n && typeof n === "object" && typeof n.description === "string") return n.description;
  return null;
}

async function fetchByPiids(piids: string[]): Promise<Map<string, RawAward>> {
  const body = {
    filters: {
      // Wide window so any contract in our set lands inside it.
      time_period: [{ start_date: "2020-01-01", end_date: "2027-12-31" }],
      award_type_codes: ["A", "B", "C", "D"],
      agencies: [{ type: "awarding", tier: "toptier", name: "Department of Defense" }],
      award_ids: piids,
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Recipient UEI",
      "Award Amount",
      "Action Date",
      "Period of Performance Start Date",
      "Period of Performance Current End Date",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Place of Performance State Code",
      "Place of Performance City Code",
      "NAICS",
      "Description",
      "Contract Award Type",
    ],
    page: 1,
    limit: 100,
    sort: "Award Amount",
    order: "asc",
    subawards: false,
  };
  const res = await fetch(USASPENDING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`USAspending ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { results?: RawAward[] };
  const map = new Map<string, RawAward>();
  for (const r of data.results ?? []) {
    if (r["Award ID"]) map.set(r["Award ID"], r);
  }
  return map;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writes)" : "DRY-RUN"}`);
  const sql = getSql();
  const rows = (await sql`
    SELECT prospect_awards.id AS award_row_id,
           prospect_awards.prospect_id,
           prospect_awards.piid,
           prospects.company_name
    FROM prospect_awards
    JOIN prospects ON prospects.id = prospect_awards.prospect_id
    ORDER BY prospects.created_at ASC
  `) as Array<{ award_row_id: string; prospect_id: string; piid: string; company_name: string }>;

  const piids = [...new Set(rows.map((r) => r.piid).filter(Boolean))];
  console.log(`Fetching USAspending for ${piids.length} unique PIIDs in batches of 50…`);

  const fetched = new Map<string, RawAward>();
  for (let i = 0; i < piids.length; i += 50) {
    const batch = piids.slice(i, i + 50);
    const part = await fetchByPiids(batch);
    for (const [k, v] of part) fetched.set(k, v);
    console.log(`  batch ${i / 50 + 1}: got ${part.size} of ${batch.length}`);
  }

  let updated = 0;
  let missing = 0;
  for (const r of rows) {
    const a = fetched.get(r.piid);
    if (!a) {
      missing += 1;
      console.log(`  [miss] ${r.company_name} piid=${r.piid} (not in USAspending right now)`);
      continue;
    }
    const summary = {
      desc: a.Description ?? null,
      type: a["Contract Award Type"] ?? null,
      naics: extractNaicsCode(a),
      naicsDesc: extractNaicsDesc(a),
      pop_end: a["Period of Performance Current End Date"] ?? null,
    };
    if (!APPLY) {
      console.log(
        `  [would-update] ${r.company_name} piid=${r.piid} naics=${summary.naics} type=${summary.type} desc="${(summary.desc ?? "").slice(0, 60)}"`,
      );
      updated += 1;
      continue;
    }
    await sql`
      UPDATE prospect_awards
      SET
        award_amount_cents = ${Math.round(Number(a["Award Amount"] ?? 0) * 100)},
        action_date = ${a["Action Date"] ?? null},
        period_of_performance_start_date = ${a["Period of Performance Start Date"] ?? null},
        period_of_performance_end_date = ${a["Period of Performance Current End Date"] ?? null},
        awarding_agency_name = ${a["Awarding Agency"] ?? null},
        awarding_sub_agency_name = ${a["Awarding Sub Agency"] ?? null},
        naics_code = ${summary.naics},
        naics_description = ${summary.naicsDesc},
        contract_award_type = ${a["Contract Award Type"] ?? null},
        description = ${a.Description ?? null},
        place_of_performance_state = ${a["Place of Performance State Code"] ?? null},
        place_of_performance_city = ${a["Place of Performance City Code"] ?? null},
        raw_payload = ${JSON.stringify(a)},
        last_seen_at = NOW()
      WHERE id = ${r.award_row_id}
    `;
    updated += 1;
    console.log(
      `  [update] ${r.company_name} piid=${r.piid} naics=${summary.naics} type=${summary.type} desc="${(summary.desc ?? "").slice(0, 60)}"`,
    );
  }

  console.log(`\n--- Summary ---\nUpdated: ${updated}\nMissing in API: ${missing}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
