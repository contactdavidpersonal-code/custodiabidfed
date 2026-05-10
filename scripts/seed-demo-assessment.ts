/**
 * One-shot demo seeder for the Custodia internal demo assessment.
 *
 * Fills in just enough state for the bid-ready journey to walk forward:
 *   1. Org has scoped_systems, UEI, NAICS, CAGE, entity_type
 *   2. business_profile exists with completeness_score >= 60 and a
 *      populated `bid_ready` block so the packet has real content
 *   3. Every legacy CMMC L1 control_responses row = "yes"
 *   4. Every v2.13 control_objective_responses row = "met"
 *
 * It STOPS short of attesting — the user signs themselves to see the
 * Sign-and-Affirm flow live and to watch the Bid-Ready Packet,
 * Deliverables, and Find/Submit Bids cards unlock in the sidebar.
 *
 * Dry-run by default. Pass --apply to write.
 *
 *   npx tsx scripts/seed-demo-assessment.ts <assessmentId>
 *   npx tsx scripts/seed-demo-assessment.ts <assessmentId> --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getSql } from "../src/lib/db";
import { playbook, practiceObjectives, legacyToRequirement } from "../src/lib/playbook";

const DEMO_ORG = {
  name: "Custodia",
  entity_type: "Delaware C-Corp",
  sam_uei: "DEMO12345CUS",
  cage_code: "9CUS1",
  naics_codes: ["541512", "541519", "541611"],
  scoped_systems: [
    "Custodia is a SaaS platform delivered from Vercel-hosted Next.js workloads on AWS us-east-1.",
    "FCI in scope: contract metadata, capability statements, and bid-ready packets exchanged with federal customers via authenticated portals.",
    "People in scope: 4 full-time engineers + 1 compliance officer, all on managed Microsoft 365 identities with hardware-MFA.",
    "Technology in scope: Microsoft 365 (Entra ID, Exchange, OneDrive), Vercel, Neon Postgres, AWS KMS for envelope encryption.",
    "Facilities in scope: remote-only — no physical FCI handling. Home offices follow a written workspace policy.",
    "ESPs in scope: Microsoft (M365, Defender), AWS (KMS, S3 via Vercel Blob), Vercel (hosting), Clerk (auth), Neon (managed Postgres). All under SOC 2 Type II.",
  ].join("\n"),
};

const BID_READY = {
  capability_statement:
    "Custodia is the operating system for federal small-business compliance. We turn FAR 52.204-21 from a paper exercise into a continuously-defended posture: per-tenant envelope encryption, signed assessment artifacts, and a credentialed Virtual Compliance Officer that walks every contractor through CMMC Level 1 self-affirmation, SPRS filing, and ongoing monitoring.\n\nWe ship hardened, contract-ready software for civilian and DoD prime contractors who need to prove FCI safeguarding without standing up a security team.",
  differentiators:
    "• Carnegie Mellon-trained information security engineers behind the platform\n• Application-layer envelope encryption with per-tenant data keys (crypto-shred ready)\n• Every artifact (SSP, affirmation, evidence) is HMAC-signed and assessor-grade\n• 14-day free trial, no credit card — most customers ship their first bid-ready packet inside the trial",
  core_competencies:
    "FAR 52.204-21 / CMMC Level 1 self-affirmation\nNIST SP 800-171A objective-level evidence collection\nSPRS attestation generation and submission\nPer-tenant envelope encryption and key custody\nManaged Microsoft 365 / AWS / Vercel security baselines\nFederal opportunity discovery and bid-package generation",
  poc_name: "D. Salvatori",
  poc_title: "Founder & Principal Compliance Officer",
  poc_email: "support@custodia.dev",
  poc_phone: "+1 (302) 555-0182",
  website: "https://bidfedcmmc.com",
  set_asides: ["small_business"],
  insurance: {
    carrier: "Hiscox Insurance Company",
    policy_number: "UDC-1442098-25",
    general_liability_limit: "$2,000,000 per occurrence / $4,000,000 aggregate",
    professional_liability_limit: "$2,000,000 per claim / $4,000,000 aggregate (cyber + tech E&O)",
    expiration_date: "2027-03-15",
  },
  bonding: {
    bonding_company: "Not bonded — software services, no construction scope",
    bonding_capacity_usd: "—",
  },
  past_performance: [
    {
      id: "pp-demo-1",
      agency: "U.S. Air Force — AFWERX",
      contract_no: "FA8649-24-P-0142",
      naics: "541512",
      period_start: "2024-08-01",
      period_end: "2025-02-28",
      value_usd: "$149,750",
      scope: "Phase I SBIR — compliance automation prototype for small-business contractors handling FCI under FAR 52.204-21.",
      customer_name: "Capt. R. Hayes",
      customer_email: "robert.hayes@us.af.mil",
      customer_phone: "+1 (937) 555-0148",
    },
    {
      id: "pp-demo-2",
      agency: "Department of Defense — DIU",
      contract_no: "HQ0034-25-C-0019",
      naics: "541519",
      period_start: "2025-04-01",
      period_end: "2026-03-31",
      value_usd: "$485,000",
      scope: "Software prototype OT for continuous CMMC L1 posture monitoring across a 12-vendor pilot cohort.",
      customer_name: "Dr. M. Chen",
      customer_email: "mei.chen.ctr@diu.mil",
      customer_phone: "+1 (650) 555-0117",
    },
  ],
};

const DEMO_NARRATIVE = {
  yes: "Implemented and verified during the FY26 self-assessment. Evidence captured in the assessment workspace; cross-referenced to NIST SP 800-171A objectives. — Demo seed data.",
};

type ApplyMode = boolean;

async function main() {
  const args = process.argv.slice(2);
  const assessmentId = args.find((a) => !a.startsWith("--"));
  const apply: ApplyMode = args.includes("--apply");

  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/seed-demo-assessment.ts <assessmentId> [--apply]");
    process.exit(2);
  }
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    console.error(`Bad assessment id: ${assessmentId}`);
    process.exit(2);
  }

  const sql = getSql();

  const found = (await sql`
    SELECT a.id AS assessment_id, a.framework, a.status, a.cycle_label,
           o.id AS organization_id, o.name, o.sam_uei, o.cage_code,
           o.naics_codes, o.scoped_systems, o.entity_type
    FROM assessments a
    JOIN organizations o ON o.id = a.organization_id
    WHERE a.id = ${assessmentId}
  `) as Array<{
    assessment_id: string;
    framework: string;
    status: string;
    cycle_label: string;
    organization_id: string;
    name: string;
    sam_uei: string | null;
    cage_code: string | null;
    naics_codes: string[];
    scoped_systems: string | null;
    entity_type: string | null;
  }>;

  if (found.length === 0) {
    console.error(`No assessment found for id ${assessmentId}`);
    process.exit(1);
  }
  const a = found[0];

  console.log("Target assessment:");
  console.log(`  id              ${a.assessment_id}`);
  console.log(`  framework       ${a.framework}`);
  console.log(`  cycle           ${a.cycle_label}`);
  console.log(`  status          ${a.status}`);
  console.log(`  organization    ${a.name} (${a.organization_id})`);
  console.log("");

  if (a.framework !== "cmmc_l1") {
    console.error("Seeder only handles framework=cmmc_l1");
    process.exit(1);
  }
  if (a.status === "attested") {
    console.error("Assessment is already attested — refusing to seed.");
    process.exit(1);
  }

  const cmmcL1Practices = playbook
    .filter((p) => p.framework === "cmmc_l1")
    .map((p) => p.id);

  console.log("Plan:");
  console.log(`  1. organizations row → name=Custodia, UEI=${DEMO_ORG.sam_uei}, CAGE=${DEMO_ORG.cage_code}, NAICS=${DEMO_ORG.naics_codes.join(",")}, scoped_systems=<paragraph>, entity_type=${DEMO_ORG.entity_type}`);
  console.log(`  2. business_profile row → completeness_score=80, data.bid_ready populated for Custodia`);
  console.log(`  3. control_responses → ${cmmcL1Practices.length} rows, every status='yes' with demo narrative`);
  console.log(`     (${cmmcL1Practices.join(", ")})`);
  let objectiveCount = 0;
  for (const id of cmmcL1Practices) objectiveCount += (practiceObjectives[id] ?? []).length;
  console.log(`  4. control_objective_responses → ${objectiveCount} rows seeded, every status='met'`);
  console.log("");

  if (!apply) {
    console.log("DRY RUN — pass --apply to actually write.");
    return;
  }

  console.log("Applying...");

  // 1. Org — only fill blanks; preserve any real values already on file.
  const keepName = a.name && a.name.trim().length > 0 && a.name !== "My Organization" ? a.name : DEMO_ORG.name;
  const keepEntity = a.entity_type && a.entity_type.trim().length > 0 ? a.entity_type : DEMO_ORG.entity_type;
  const keepUei = a.sam_uei && a.sam_uei.trim().length > 0 ? a.sam_uei : DEMO_ORG.sam_uei;
  const keepCage = a.cage_code && a.cage_code.trim().length > 0 ? a.cage_code : DEMO_ORG.cage_code;
  const keepNaics = a.naics_codes && a.naics_codes.length > 0 ? a.naics_codes : DEMO_ORG.naics_codes;
  const keepScope = a.scoped_systems && a.scoped_systems.trim().length > 0 ? a.scoped_systems : DEMO_ORG.scoped_systems;
  await sql`
    UPDATE organizations
    SET name = ${keepName},
        entity_type = ${keepEntity},
        sam_uei = ${keepUei},
        cage_code = ${keepCage},
        naics_codes = ${keepNaics}::text[],
        scoped_systems = ${keepScope},
        updated_at = NOW()
    WHERE id = ${a.organization_id}
  `;
  console.log(`  ✓ organizations updated (name=${keepName}, UEI=${keepUei}, CAGE=${keepCage})`);

  // 2. business_profile
  const profileData = {
    bid_ready: { ...BID_READY, updated_at: new Date().toISOString() },
    what_they_do:
      "SaaS platform that turns FAR 52.204-21 / CMMC Level 1 into a continuously-defended posture for federal small-business contractors.",
    customers: "DoD primes and civilian agencies and the small businesses bidding on their work.",
    team_size: "5 — 4 engineers and 1 compliance officer.",
    experience_level: "experienced",
    hq_state: "Delaware",
    primary_naics: "541512",
  };
  await sql`
    INSERT INTO business_profile (organization_id, data, completeness_score, last_updated_at, last_updated_by)
    VALUES (${a.organization_id}, ${JSON.stringify(profileData)}::jsonb, 80, NOW(), 'user')
    ON CONFLICT (organization_id) DO UPDATE SET
      data = EXCLUDED.data,
      completeness_score = GREATEST(business_profile.completeness_score, 80),
      last_updated_at = NOW()
  `;
  console.log("  ✓ business_profile upserted (score=80, bid_ready populated)");

  // 3. control_responses
  for (const controlId of cmmcL1Practices) {
    await sql`
      INSERT INTO control_responses (assessment_id, control_id, status, narrative, updated_at)
      VALUES (${assessmentId}, ${controlId}, 'yes', ${DEMO_NARRATIVE.yes}, NOW())
      ON CONFLICT (assessment_id, control_id) DO UPDATE SET
        status = 'yes',
        narrative = COALESCE(control_responses.narrative, EXCLUDED.narrative),
        updated_at = NOW()
    `;
  }
  console.log(`  ✓ control_responses seeded (${cmmcL1Practices.length} rows)`);

  // 4. control_objective_responses
  const controlIds: string[] = [];
  const requirementIds: string[] = [];
  const letters: string[] = [];
  for (const controlId of cmmcL1Practices) {
    const reqId = legacyToRequirement[controlId];
    if (!reqId) continue;
    for (const obj of practiceObjectives[controlId] ?? []) {
      controlIds.push(controlId);
      requirementIds.push(reqId);
      letters.push(obj.letter);
    }
  }
  await sql`
    INSERT INTO control_objective_responses
      (assessment_id, control_id, requirement_id, objective_letter, status, narrative, method)
    SELECT ${assessmentId}::uuid, c, r, l, 'met', ${DEMO_NARRATIVE.yes}, 'examine'
    FROM UNNEST(
      ${controlIds}::text[],
      ${requirementIds}::text[],
      ${letters}::text[]
    ) AS t(c, r, l)
    ON CONFLICT (assessment_id, control_id, objective_letter) DO UPDATE SET
      status = 'met',
      narrative = COALESCE(control_objective_responses.narrative, EXCLUDED.narrative),
      method = COALESCE(control_objective_responses.method, EXCLUDED.method),
      updated_at = NOW()
  `;
  console.log(`  ✓ control_objective_responses seeded (${controlIds.length} rows, all met)`);

  console.log("");
  console.log("Done. Reload the assessment page — Sign and Affirm should be unlocked.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
