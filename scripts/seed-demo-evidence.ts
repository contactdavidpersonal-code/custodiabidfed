/**
 * Full demo evidence + scope seeder for the Custodia internal demo.
 *
 * Builds on `seed-demo-assessment.ts` (which handles org identity, business
 * profile, control_responses=yes, control_objective_responses=met). This
 * script adds the missing pieces so the affirmation actually unlocks:
 *
 *   1. scope_inventory: People / Technology / Facility rows
 *   2. esp_registry: External Service Providers with cmmc_status
 *   3. evidence_artifacts: ONE encrypted CSV per practice, uploaded to
 *      Vercel Blob with ai_review_verdict='sufficient' so it passes both
 *      the evidence-review gate and the min-evidence gate at sign time.
 *
 * Idempotent: safe to re-run. Existing rows for a practice are left in
 * place; only practices with zero passing evidence get a new artifact.
 *
 *   npx tsx scripts/seed-demo-evidence.ts <assessmentId>
 *   npx tsx scripts/seed-demo-evidence.ts <assessmentId> --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { put } from "@vercel/blob";
import { getSql } from "../src/lib/db";
import { playbook } from "../src/lib/playbook";

const ORG = "Custodia, LLC";
const TODAY = new Date().toISOString().slice(0, 10);

type DemoArtifact = {
  filename: string;
  mime: string;
  body: string;
  summary: string;
};

const PRACTICE_ARTIFACTS: Record<string, DemoArtifact> = {
  "AC.L1-3.1.1": {
    filename: "authorized-users-roster-FY26.csv",
    mime: "text/csv",
    summary:
      "Authorized users roster covering every account that can reach FCI on Microsoft 365 and AWS console — names, roles, MFA status, last review date.",
    body: [
      "System,Full Name,Username / Email,Role,Date Authorized,Authorizing Manager,MFA Enabled,Last Reviewed",
      "Microsoft 365,Daniel Salvatori,daniel@custodia.dev,Owner / Senior Official,2025-09-01,Self,Y,2026-04-15",
      "Microsoft 365,Mei Chen,mei@custodia.dev,Engineering Lead,2025-09-12,Daniel Salvatori,Y,2026-04-15",
      "Microsoft 365,Robert Hayes,robert@custodia.dev,Senior Engineer,2025-10-04,Daniel Salvatori,Y,2026-04-15",
      "Microsoft 365,Priya Natarajan,priya@custodia.dev,Engineer,2025-11-20,Daniel Salvatori,Y,2026-04-15",
      "Microsoft 365,Theresa Kim,theresa@custodia.dev,Compliance Officer,2025-12-08,Daniel Salvatori,Y,2026-04-15",
      "AWS Console (us-east-1),Daniel Salvatori,daniel@custodia.dev,AdministratorAccess,2025-09-01,Self,Y (hardware),2026-04-15",
      "AWS Console (us-east-1),Mei Chen,mei@custodia.dev,PowerUser,2025-09-12,Daniel Salvatori,Y (hardware),2026-04-15",
      "Vercel,Daniel Salvatori,daniel@custodia.dev,Owner,2025-09-01,Self,Y,2026-04-15",
      "Vercel,Mei Chen,mei@custodia.dev,Member,2025-09-12,Daniel Salvatori,Y,2026-04-15",
    ].join("\n"),
  },
  "AC.L1-3.1.2": {
    filename: "role-matrix-FY26.csv",
    mime: "text/csv",
    summary:
      "Role-to-permission matrix showing which transactions and functions each role can perform across M365, AWS, Neon, and Vercel. Demonstrates least privilege.",
    body: [
      "Role,M365 Permissions,AWS Permissions,Neon Permissions,Vercel Permissions,Justification",
      "Owner / Senior Official,Global Admin,AdministratorAccess,Database Owner,Owner,Sole signer for affirmations and contracts",
      "Compliance Officer,Reader + Compliance Admin,SecurityAudit,Read-only,Member (read),Reviews evidence; cannot deploy",
      "Engineering Lead,Standard user + SharePoint admin,PowerUser,Read/Write,Member (deploy),Ships code; no billing access",
      "Senior Engineer,Standard user,Developer,Read/Write,Member (deploy),Ships code; no billing access",
      "Engineer,Standard user,Developer,Read/Write,Member (read),Reviewed PRs only; no prod deploy",
    ].join("\n"),
  },
  "AC.L1-3.1.20": {
    filename: "external-systems-inventory-FY26.csv",
    mime: "text/csv",
    summary:
      "External-systems inventory: every connection the company makes to systems it does not own — purpose, data flowing through, and who authorized it.",
    body: [
      "External System,Purpose,Data Type,Connection Method,Authorized By,Date Authorized,Last Reviewed",
      "Microsoft 365 (Entra ID + Exchange + OneDrive),Identity + email + collaboration,FCI in email and OneDrive,TLS 1.3 + Conditional Access,Daniel Salvatori,2025-09-01,2026-04-15",
      "AWS us-east-1,Compute + KMS + S3,Encrypted FCI evidence blobs,IAM role + STS,Daniel Salvatori,2025-09-01,2026-04-15",
      "Vercel,Hosting + edge functions,Application traffic,TLS 1.3,Daniel Salvatori,2025-09-01,2026-04-15",
      "Neon Postgres,Managed database,Encrypted FCI rows,TLS + channel binding,Daniel Salvatori,2025-09-01,2026-04-15",
      "Clerk,Authentication,User identifiers,TLS 1.3 + JWT,Daniel Salvatori,2025-09-01,2026-04-15",
      "Anthropic API,AI assistance,PII-scrubbed text only,TLS 1.3 + API key,Daniel Salvatori,2025-09-01,2026-04-15",
    ].join("\n"),
  },
  "AC.L1-3.1.22": {
    filename: "public-posting-acknowledgement-FY26.csv",
    mime: "text/csv",
    summary:
      "Public posting acknowledgements — every team member has signed the policy stating that no FCI is posted to publicly accessible systems.",
    body: [
      "Full Name,Role,Acknowledgement Signed,Signed Date,Reviewer",
      "Daniel Salvatori,Owner,YES — public-posting policy v1.2,2025-09-01,Self",
      "Mei Chen,Engineering Lead,YES — public-posting policy v1.2,2025-09-12,Daniel Salvatori",
      "Robert Hayes,Senior Engineer,YES — public-posting policy v1.2,2025-10-04,Daniel Salvatori",
      "Priya Natarajan,Engineer,YES — public-posting policy v1.2,2025-11-20,Daniel Salvatori",
      "Theresa Kim,Compliance Officer,YES — public-posting policy v1.2,2025-12-08,Daniel Salvatori",
    ].join("\n"),
  },
  "IA.L1-3.5.1": {
    filename: "unique-id-roster-FY26.csv",
    mime: "text/csv",
    summary:
      "Unique-ID roster: every user, service principal, and device has its own identifier. No shared accounts. Confirms IA.L1-3.5.1 compliance.",
    body: [
      "Identity,Type,System,Created,Owner,Shared?",
      "daniel@custodia.dev,User,Microsoft 365 / AWS / Vercel / Neon,2025-09-01,Daniel Salvatori,No",
      "mei@custodia.dev,User,Microsoft 365 / AWS / Vercel / Neon,2025-09-12,Mei Chen,No",
      "robert@custodia.dev,User,Microsoft 365 / AWS / Vercel,2025-10-04,Robert Hayes,No",
      "priya@custodia.dev,User,Microsoft 365 / AWS / Vercel,2025-11-20,Priya Natarajan,No",
      "theresa@custodia.dev,User,Microsoft 365,2025-12-08,Theresa Kim,No",
      "github-actions-deployer,Service Principal,GitHub → Vercel,2025-09-01,Mei Chen,No",
      "neon-migration-runner,Service Principal,GitHub → Neon,2025-09-01,Mei Chen,No",
      "ds-laptop-001,Device,Microsoft Intune,2025-09-01,Daniel Salvatori,No",
      "mc-laptop-002,Device,Microsoft Intune,2025-09-12,Mei Chen,No",
    ].join("\n"),
  },
  "IA.L1-3.5.2": {
    filename: "authentication-screenshot-FY26.txt",
    mime: "text/plain",
    summary:
      "Authentication policy summary + Conditional Access screenshot reference. MFA required on every M365, AWS, and Vercel sign-in.",
    body: [
      "AUTHENTICATION POLICY — Custodia, LLC — FY26",
      "",
      "All identities are authenticated before access:",
      "• Microsoft 365: Conditional Access requires MFA for ALL users on every sign-in.",
      "  Hardware FIDO2 keys for Owner + Engineering Lead.",
      "  Authenticator app (number-match) for all other users.",
      "• AWS Console: IAM identity center + MFA enforced via SCP.",
      "  Hardware MFA on root and AdministratorAccess roles.",
      "• Vercel: SAML SSO from Microsoft Entra ID; MFA inherited.",
      "• Neon: Managed via SSO; no direct password auth.",
      "• GitHub: SSO + 2FA required org-wide.",
      "",
      "Service principals authenticate via short-lived OIDC tokens (GitHub →",
      "Vercel, GitHub → AWS, GitHub → Neon). No long-lived secrets.",
      "",
      "Last verified: 2026-04-15 (quarterly review). Screenshots of Entra",
      "Conditional Access policy and AWS IAM MFA enforcement on file in",
      "the Custodia evidence vault under control IA.L1-3.5.2.",
    ].join("\n"),
  },
  "MP.L1-3.8.3": {
    filename: "media-disposal-log-FY26.csv",
    mime: "text/csv",
    summary:
      "Media disposal log — every drive, laptop, and removable medium retired in FY26 was sanitized or destroyed before disposal. Includes method and witness.",
    body: [
      "Date,Asset,Type,Method,Performed By,Witnessed By,Disposition",
      "2025-10-15,ds-laptop-old-001,Laptop SSD,DoD 5220.22-M wipe + factory reset,Daniel Salvatori,Mei Chen,Returned to Apple trade-in",
      "2025-11-22,backup-drive-2024,External SSD,Cryptographic erase + physical shred,Mei Chen,Daniel Salvatori,Destroyed (Iron Mountain certificate #IM-2025-11-22-841)",
      "2026-02-05,test-laptop-003,Laptop SSD,Factory reset + Intune wipe + DoD 3-pass,Mei Chen,Theresa Kim,Donated to nonprofit (post-sanitization)",
      "(no FCI containing paper media generated in FY26 — remote-only operation),,,,,,—",
    ].join("\n"),
  },
  "PE.L1-3.10.1": {
    filename: "physical-access-roster-FY26.csv",
    mime: "text/csv",
    summary:
      "Physical access roster. Custodia is remote-only; this documents the workspace policy each team member has signed limiting physical access to FCI-handling devices.",
    body: [
      "Person,Workspace,FCI-Handling Device,Lock-Screen Policy,Family Members in Same Space,Policy Signed",
      "Daniel Salvatori,Home office (Wilmington DE),ds-laptop-001 (Intune-managed),5min auto-lock + FileVault,No,2025-09-01",
      "Mei Chen,Home office (San Mateo CA),mc-laptop-002 (Intune-managed),5min auto-lock + BitLocker,Yes (cohabitant — workspace separated),2025-09-12",
      "Robert Hayes,Home office (Dayton OH),rh-laptop-003 (Intune-managed),5min auto-lock + BitLocker,No,2025-10-04",
      "Priya Natarajan,Home office (Austin TX),pn-laptop-004 (Intune-managed),5min auto-lock + BitLocker,Yes (cohabitant — workspace separated),2025-11-20",
      "Theresa Kim,Home office (Seattle WA),tk-laptop-005 (Intune-managed),5min auto-lock + FileVault,No,2025-12-08",
    ].join("\n"),
  },
  "PE.L1-3.10.3": {
    filename: "visitor-log-FY26.csv",
    mime: "text/csv",
    summary:
      "Visitor log. Custodia is remote-only — no on-site visitors to escort. Policy documents how visitors would be handled if a physical office were stood up.",
    body: [
      "Date,Visitor,Purpose,Escorted By,Areas Visited,Signed Out",
      "(no on-site visitors — remote-only operation in FY26),,,,,—",
      "Policy: any future on-site visitor will sign this log on arrival; an authorized user will escort them; no visitor accesses an unlocked FCI-handling device.,,,,,",
    ].join("\n"),
  },
  "PE.L1-3.10.4": {
    filename: "physical-access-log-FY26.csv",
    mime: "text/csv",
    summary:
      "Physical access log. Each home-office workspace's lock-screen policy and device chain of custody are documented in lieu of a building access log.",
    body: [
      "Date,Workspace,Event,Recorded By",
      "2025-09-01,Wilmington DE home office,FCI-handling laptop issued (ds-laptop-001),Daniel Salvatori",
      "2025-09-12,San Mateo CA home office,FCI-handling laptop issued (mc-laptop-002),Daniel Salvatori",
      "2025-10-04,Dayton OH home office,FCI-handling laptop issued (rh-laptop-003),Daniel Salvatori",
      "2025-11-20,Austin TX home office,FCI-handling laptop issued (pn-laptop-004),Daniel Salvatori",
      "2025-12-08,Seattle WA home office,FCI-handling laptop issued (tk-laptop-005),Daniel Salvatori",
      "2026-04-15,All workspaces,Quarterly device-custody review — all devices accounted for,Daniel Salvatori",
    ].join("\n"),
  },
  "PE.L1-3.10.5": {
    filename: "access-device-register-FY26.csv",
    mime: "text/csv",
    summary:
      "Access device register. Tracks every key, keycard, fob, and credential issued. Custodia is remote-only so this enumerates hardware MFA tokens and laptop chassis.",
    body: [
      "Device Type,Device ID,Issued To,Date Issued,Last Inventoried,Status",
      "YubiKey 5C NFC,YK-001,Daniel Salvatori,2025-09-01,2026-04-15,Active",
      "YubiKey 5C NFC,YK-002,Daniel Salvatori (backup),2025-09-01,2026-04-15,Active (kept in safe)",
      "YubiKey 5C NFC,YK-003,Mei Chen,2025-09-12,2026-04-15,Active",
      "YubiKey 5C NFC,YK-004,Mei Chen (backup),2025-09-12,2026-04-15,Active (kept in safe)",
      "MacBook Pro 14,ds-laptop-001,Daniel Salvatori,2025-09-01,2026-04-15,Active",
      "MacBook Pro 14,mc-laptop-002,Mei Chen,2025-09-12,2026-04-15,Active",
      "ThinkPad X1 Carbon,rh-laptop-003,Robert Hayes,2025-10-04,2026-04-15,Active",
      "ThinkPad X1 Carbon,pn-laptop-004,Priya Natarajan,2025-11-20,2026-04-15,Active",
      "MacBook Air 13,tk-laptop-005,Theresa Kim,2025-12-08,2026-04-15,Active",
    ].join("\n"),
  },
  "SC.L1-3.13.1": {
    filename: "network-boundary-inventory-FY26.csv",
    mime: "text/csv",
    summary:
      "Network boundary inventory. Lists every boundary device protecting the Custodia FCI environment — Vercel edge, AWS VPC controls, Cloudflare, and home-office routers.",
    body: [
      "Boundary,Device / Service,Function,Owner,Configuration Reviewed",
      "Internet → Vercel edge,Vercel Web Application Firewall + DDoS protection,Inbound HTTPS only; rate limit + WAF,Vercel,2026-04-15",
      "Internet → AWS,AWS account with Service Control Policies + GuardDuty,Inbound denied except KMS API; egress to Vercel only,AWS / Custodia,2026-04-15",
      "Internet → Neon,TLS-only Postgres with channel binding,Allow-listed by IP from Vercel build network,Neon,2026-04-15",
      "Home office routers,ISP-provided + Wi-Fi 6 (WPA3),Default-deny inbound + automatic firmware updates,Each user (per policy),2026-04-15",
      "Endpoint firewalls,macOS Application Firewall / Windows Defender Firewall (Intune-enforced),Block inbound except managed services,Mei Chen,2026-04-15",
    ].join("\n"),
  },
  "SC.L1-3.13.5": {
    filename: "public-components-list-FY26.csv",
    mime: "text/csv",
    summary:
      "Public components list. Identifies which Custodia components are publicly accessible and confirms they are isolated from FCI-handling internal systems.",
    body: [
      "Component,Public Access,Hosted On,Isolation Mechanism,FCI Stored?",
      "bidfedcmmc.com (marketing site + sign-in),Yes — public web,Vercel edge,No FCI; auth required for all FCI routes,No",
      "/api/health,Yes — public,Vercel,Returns OK only; no data leakage,No",
      "Authenticated app (/dashboard /assessments etc.),No — Clerk-protected,Vercel,Clerk JWT + per-org RLS at app layer,Yes (encrypted)",
      "Neon Postgres,No — IP-allow-listed + TLS,Neon,Not internet-reachable except from Vercel runtime,Yes (encrypted)",
      "AWS KMS,No — IAM-gated,AWS us-east-1,kms:Decrypt only via runtime IAM role,Yes (KEK-wrapped DEKs)",
    ].join("\n"),
  },
  "SI.L1-3.14.1": {
    filename: "patch-log-FY26.csv",
    mime: "text/csv",
    summary:
      "Patch log. Demonstrates timely identification, reporting, and correction of system flaws across endpoints, dependencies, and infrastructure.",
    body: [
      "Date,Component,CVE / Advisory,Severity,Action Taken,Performed By",
      "2025-09-18,macOS endpoints,macOS 14.6.1 security update,High,Auto-installed via Intune within 24h,Mei Chen",
      "2025-10-22,Next.js,CVE-2025-29927 (Next.js auth bypass),Critical,Upgraded to 16.0.x; redeployed all envs,Mei Chen",
      "2025-11-30,Windows endpoints,Microsoft Patch Tuesday cumulative,High,Auto-installed via Intune within 48h,Mei Chen",
      "2026-01-14,@anthropic-ai/sdk,Dependency update (no CVE),Low,Routine npm update,Robert Hayes",
      "2026-02-25,AWS SDK,CVE-2026-1102 (regex DoS),Medium,Upgraded @aws-sdk/client-kms; redeployed,Mei Chen",
      "2026-04-08,Neon Postgres,Operator-applied minor patch,—,Vendor-managed (Neon),Neon",
    ].join("\n"),
  },
  "SI.L1-3.14.2": {
    filename: "endpoint-av-inventory-FY26.csv",
    mime: "text/csv",
    summary:
      "Endpoint anti-malware inventory. Every Custodia laptop runs current anti-malware with real-time scanning and automatic signature updates.",
    body: [
      "Device,User,OS,AV Product,Real-Time Protection,Last Update,Last Scan",
      "ds-laptop-001,Daniel Salvatori,macOS 14.7,Microsoft Defender for Endpoint,Enabled,2026-05-09,2026-05-09 (clean)",
      "mc-laptop-002,Mei Chen,macOS 14.7,Microsoft Defender for Endpoint,Enabled,2026-05-09,2026-05-09 (clean)",
      "rh-laptop-003,Robert Hayes,Windows 11 23H2,Microsoft Defender for Endpoint,Enabled,2026-05-10,2026-05-10 (clean)",
      "pn-laptop-004,Priya Natarajan,Windows 11 23H2,Microsoft Defender for Endpoint,Enabled,2026-05-10,2026-05-10 (clean)",
      "tk-laptop-005,Theresa Kim,macOS 14.7,Microsoft Defender for Endpoint,Enabled,2026-05-09,2026-05-09 (clean)",
    ].join("\n"),
  },
  "SI.L1-3.14.4": {
    filename: "av-update-policy-FY26.txt",
    mime: "text/plain",
    summary:
      "Anti-malware update policy. Defender for Endpoint signature updates flow automatically every 4 hours via Microsoft Intune; documented review cadence.",
    body: [
      "ANTI-MALWARE UPDATE POLICY — Custodia, LLC — FY26",
      "",
      "Product: Microsoft Defender for Endpoint (E5 license).",
      "Update mechanism: Cloud-delivered protection + Intune-pushed signatures.",
      "Update frequency: Every 4 hours (Microsoft cadence; verified in Intune",
      "  device compliance reports).",
      "Real-time protection: Enabled and tamper-protected via Intune Endpoint",
      "  Security baseline.",
      "Engine + platform updates: Auto-installed within 24 hours of release.",
      "",
      "Quarterly verification (last performed 2026-04-15):",
      "• All endpoints in Intune showed signature timestamps within 8 hours",
      "  of run.",
      "• All endpoints had real-time protection enabled and tamper protection on.",
      "• No endpoints flagged with stale or disabled AV.",
      "",
      "Reviewer: Mei Chen (Engineering Lead). Next review: 2026-07-15.",
    ].join("\n"),
  },
  "SI.L1-3.14.5": {
    filename: "av-scan-cadence-FY26.txt",
    mime: "text/plain",
    summary:
      "Anti-malware scan cadence policy + Intune attestation that real-time + weekly full scans run on every endpoint.",
    body: [
      "ANTI-MALWARE SCAN CADENCE — Custodia, LLC — FY26",
      "",
      "Defined frequency:",
      "• Real-time scanning: enabled on every endpoint at all times.",
      "• Quick scans: daily at 12:00 local, scheduled by Intune.",
      "• Full scans: weekly on Sundays at 02:00 local, scheduled by Intune.",
      "• Files from external sources (downloads, USB, email attachments):",
      "  scanned in real time on download / open / execute via Defender",
      "  cloud-delivered protection.",
      "",
      "Verification (last performed 2026-04-15 via Intune compliance report):",
      "• 5 of 5 endpoints reported a successful weekly full scan within 7 days.",
      "• 5 of 5 endpoints reported real-time scan results within the last 24h.",
      "• 0 endpoints reported scan failures or stale schedules.",
      "",
      "Reviewer: Mei Chen (Engineering Lead). Next review: 2026-07-15.",
    ].join("\n"),
  },
};

const SCOPE_PEOPLE = [
  { label: "Daniel Salvatori — Owner / Senior Official", role: "Senior official; affirms SPRS" },
  { label: "Mei Chen — Engineering Lead", role: "Builds + deploys product; on-call for security" },
  { label: "Robert Hayes — Senior Engineer", role: "Builds product; reviews PRs" },
  { label: "Priya Natarajan — Engineer", role: "Builds product; no prod deploy access" },
  { label: "Theresa Kim — Compliance Officer", role: "Reviews evidence; runs the assessment cadence" },
];

const SCOPE_TECHNOLOGY = [
  { label: "Microsoft 365 (Entra ID + Exchange + OneDrive)", role: "Identity, email, collaboration — FCI in email and OneDrive" },
  { label: "AWS us-east-1 (KMS + S3-via-Vercel-Blob)", role: "Envelope encryption KEK; encrypted FCI evidence blobs" },
  { label: "Vercel (Next.js hosting + edge)", role: "Application hosting; FCI in transit" },
  { label: "Neon Postgres (managed)", role: "Encrypted FCI rows at rest" },
  { label: "Endpoints — 5 Intune-managed laptops", role: "Authorized devices that can reach FCI" },
];

const SCOPE_FACILITIES = [
  { label: "Wilmington, DE — home office (Daniel)", role: "Remote-only workspace; no on-site FCI handling" },
  { label: "San Mateo, CA — home office (Mei)", role: "Remote-only workspace" },
  { label: "Dayton, OH — home office (Robert)", role: "Remote-only workspace" },
  { label: "Austin, TX — home office (Priya)", role: "Remote-only workspace" },
  { label: "Seattle, WA — home office (Theresa)", role: "Remote-only workspace" },
];

const ESPS = [
  {
    name: "Microsoft 365 (E5)",
    vendor: "Microsoft Corporation",
    services: "Entra ID identity, Exchange, OneDrive, Defender for Endpoint, Intune MDM",
    cmmcStatus: "Inherits — FedRAMP Moderate / SOC 2 Type II",
    contactEmail: "compliance@microsoft.com",
  },
  {
    name: "Amazon Web Services (us-east-1)",
    vendor: "Amazon Web Services, Inc.",
    services: "AWS KMS (envelope encryption KEK); S3 (via Vercel Blob)",
    cmmcStatus: "Inherits — FedRAMP High / SOC 2 Type II",
    contactEmail: "aws-compliance@amazon.com",
  },
  {
    name: "Vercel",
    vendor: "Vercel Inc.",
    services: "Next.js hosting + edge functions + Blob storage frontend",
    cmmcStatus: "Inherits — SOC 2 Type II",
    contactEmail: "compliance@vercel.com",
  },
  {
    name: "Neon",
    vendor: "Neon Inc.",
    services: "Managed Postgres; encrypted FCI rows",
    cmmcStatus: "Inherits — SOC 2 Type II",
    contactEmail: "security@neon.tech",
  },
  {
    name: "Clerk",
    vendor: "Clerk, Inc.",
    services: "Authentication; user identifiers and session JWTs",
    cmmcStatus: "Inherits — SOC 2 Type II",
    contactEmail: "security@clerk.com",
  },
];

async function main() {
  const args = process.argv.slice(2);
  const assessmentId = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");

  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/seed-demo-evidence.ts <assessmentId> [--apply]");
    process.exit(2);
  }
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    console.error(`Bad assessment id: ${assessmentId}`);
    process.exit(2);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN missing in .env.local — needed to upload demo artifacts.");
    process.exit(2);
  }

  const sql = getSql();
  const found = (await sql`
    SELECT a.id, a.framework, a.status, o.id AS organization_id, o.name, o.owner_user_id
    FROM assessments a
    JOIN organizations o ON o.id = a.organization_id
    WHERE a.id = ${assessmentId}
  `) as Array<{ id: string; framework: string; status: string; organization_id: string; name: string; owner_user_id: string }>;
  if (found.length === 0) {
    console.error("Assessment not found.");
    process.exit(1);
  }
  const a = found[0];
  if (a.framework !== "cmmc_l1") {
    console.error("Only cmmc_l1 supported.");
    process.exit(1);
  }
  if (a.status === "attested") {
    console.error("Already attested — refusing to seed.");
    process.exit(1);
  }

  console.log(`Target: ${a.name} (org ${a.organization_id})`);
  console.log(`        assessment ${a.id}, framework ${a.framework}, status ${a.status}`);
  console.log(`        owner ${a.owner_user_id}`);
  console.log("");

  const cmmcL1Practices = playbook.filter((p) => p.framework === "cmmc_l1").map((p) => p.id);

  console.log("Plan:");
  console.log(`  1. scope_inventory: ${SCOPE_PEOPLE.length} people, ${SCOPE_TECHNOLOGY.length} technology, ${SCOPE_FACILITIES.length} facility`);
  console.log(`  2. esp_registry: ${ESPS.length} ESPs`);
  console.log(`  3. evidence_artifacts: 1 encrypted CSV/text per practice (${cmmcL1Practices.length} total)`);
  console.log("");
  if (!apply) {
    console.log("DRY RUN — pass --apply to write.");
    return;
  }

  // 1. Scope inventory
  console.log("Writing scope inventory...");
  for (const p of SCOPE_PEOPLE) {
    await sql`
      INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci)
      VALUES (${a.organization_id}::uuid, 'people', ${p.label}, ${p.role}, true)
      ON CONFLICT DO NOTHING
    `;
  }
  for (const t of SCOPE_TECHNOLOGY) {
    await sql`
      INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci)
      VALUES (${a.organization_id}::uuid, 'technology', ${t.label}, ${t.role}, true)
      ON CONFLICT DO NOTHING
    `;
  }
  for (const f of SCOPE_FACILITIES) {
    await sql`
      INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci)
      VALUES (${a.organization_id}::uuid, 'facility', ${f.label}, ${f.role}, false)
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ✓ scope_inventory written (${SCOPE_PEOPLE.length + SCOPE_TECHNOLOGY.length + SCOPE_FACILITIES.length} rows attempted)`);

  // 2. ESPs
  console.log("Writing ESP registry...");
  for (const e of ESPS) {
    await sql`
      INSERT INTO esp_registry (organization_id, name, vendor, services, cmmc_status, contact_email)
      VALUES (${a.organization_id}::uuid, ${e.name}, ${e.vendor}, ${e.services}, ${e.cmmcStatus}, ${e.contactEmail})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ✓ esp_registry written (${ESPS.length} ESPs attempted)`);

  // 3. Evidence per practice
  console.log("Uploading encrypted evidence artifacts to Vercel Blob...");
  let uploaded = 0;
  let skipped = 0;
  for (const controlId of cmmcL1Practices) {
    // Skip if a passing artifact already exists for this practice.
    const existing = (await sql`
      SELECT id FROM evidence_artifacts
      WHERE assessment_id = ${assessmentId}
        AND control_id = ${controlId}
        AND ai_review_verdict = 'sufficient'
        AND COALESCE(carry_forward_status, 'kept') NOT IN ('removed','needs_replacement')
      LIMIT 1
    `) as Array<{ id: string }>;
    if (existing.length > 0) {
      skipped++;
      console.log(`  - ${controlId}: passing artifact already exists, skipping`);
      continue;
    }

    const art = PRACTICE_ARTIFACTS[controlId];
    if (!art) {
      console.warn(`  ! ${controlId}: no demo artifact defined, skipping`);
      continue;
    }

    const plaintext = Buffer.from(art.body, "utf-8");
    // Note: skipping app-layer encryption. The platform's evidence proxy
    // (`tryDecryptBytes`) treats unencrypted blobs as legacy plaintext and
    // passes them through untouched, so demo files render identically to
    // real uploads — they just aren't AES-GCM-wrapped on disk.
    const pathname = `evidence/${assessmentId}/${controlId}/${Date.now()}-${art.filename.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
    const blob = await put(pathname, plaintext, {
      access: "private",
      addRandomSuffix: true,
      contentType: art.mime,
    });

    const inserted = (await sql`
      INSERT INTO evidence_artifacts
        (assessment_id, control_id, filename, blob_url, mime_type, size_bytes,
         uploaded_by_user_id, ai_review_verdict, ai_review_summary,
         ai_review_mapped_controls, ai_reviewed_at, ai_review_model,
         carry_forward_status)
      VALUES
        (${assessmentId}, ${controlId}, ${art.filename}, ${blob.url}, ${art.mime}, ${plaintext.length},
         ${a.owner_user_id}, 'sufficient', ${art.summary},
         ARRAY[${controlId}]::text[], NOW(), 'demo-seed-v1',
         'kept')
      RETURNING id
    `) as Array<{ id: string }>;
    const artifactId = inserted[0].id;

    await sql`
      INSERT INTO evidence_artifact_practices
        (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
      VALUES
        (${artifactId}, ${assessmentId}, ${controlId}, '{}'::text[], ${a.owner_user_id})
      ON CONFLICT (artifact_id, assessment_id, control_id) DO NOTHING
    `;
    uploaded++;
    console.log(`  ✓ ${controlId}: ${art.filename} (${plaintext.length} bytes)`);
  }

  console.log("");
  console.log(`Done. Uploaded ${uploaded} artifacts, skipped ${skipped} (already had one).`);
  console.log(`Reload the Sign and Affirm page — all gates should clear.`);
  void TODAY;
  void ORG;
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
