/**
 * Full demo evidence + scope + practice-conversation seeder.
 *
 * For each CMMC L1 practice, this seeder:
 *   1. Uploads ONE evidence artifact per *required* slot defined in
 *      `practice-spec.ts`, tagged with `[slot:KEY]__filename` so the
 *      EvidencePanel counts it as N of N collected.
 *   2. Sets `practice_conversations.objective_verdicts` to all-covered
 *      and stamps `locked_at`, so the per-practice page renders as MET
 *      with every objective lit green.
 *   3. Seeds scope_inventory (People / Technology / Facility) and
 *      esp_registry rows so the Scope step shows complete.
 *
 *   npx tsx scripts/seed-demo-evidence.ts <assessmentId>
 *   npx tsx scripts/seed-demo-evidence.ts <assessmentId> --apply
 *   npx tsx scripts/seed-demo-evidence.ts <assessmentId> --apply --reset
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { put } from "@vercel/blob";
import { getSql } from "../src/lib/db";
import { playbook } from "../src/lib/playbook";
import { practiceSpecs, type EvidenceSlot } from "../src/lib/cmmc/practice-spec";

const SCOPE_PEOPLE = [
  { label: "Daniel Salvatori — Owner / Senior Official", role: "Senior official; affirms SPRS" },
  { label: "Mei Chen — Engineering Lead", role: "Builds + deploys product; on-call for security" },
  { label: "Robert Hayes — Senior Engineer", role: "Builds product; reviews PRs" },
  { label: "Priya Natarajan — Engineer", role: "Builds product; no prod deploy access" },
  { label: "Theresa Kim — Compliance Officer", role: "Reviews evidence; runs the assessment cadence" },
];
const SCOPE_TECH = [
  { label: "Microsoft 365 (Entra + Exchange + OneDrive + Intune)", role: "Identity, email, MDM" },
  { label: "AWS us-east-1 (KMS + envelope encryption)", role: "Wraps DEKs that protect FCI evidence" },
  { label: "Vercel (Next.js hosting + edge + Blob)", role: "App hosting + evidence vault" },
  { label: "Neon Postgres (managed)", role: "Encrypted FCI rows" },
  { label: "Endpoints — 5 Intune-managed laptops", role: "Authorized devices reaching FCI" },
];
const SCOPE_FACILITY = [
  { label: "Wilmington, DE — home office (Daniel)", role: "Remote-only workspace" },
  { label: "San Mateo, CA — home office (Mei)", role: "Remote-only workspace" },
  { label: "Dayton, OH — home office (Robert)", role: "Remote-only workspace" },
  { label: "Austin, TX — home office (Priya)", role: "Remote-only workspace" },
  { label: "Seattle, WA — home office (Theresa)", role: "Remote-only workspace" },
];
const ESPS = [
  { name: "Microsoft 365 (E5)", vendor: "Microsoft Corporation", services: "Entra ID, Exchange, OneDrive, Defender, Intune", cmmcStatus: "Inherits — FedRAMP Moderate / SOC 2", contactEmail: "compliance@microsoft.com" },
  { name: "Amazon Web Services (us-east-1)", vendor: "Amazon Web Services, Inc.", services: "AWS KMS; S3 (via Vercel Blob)", cmmcStatus: "Inherits — FedRAMP High / SOC 2", contactEmail: "aws-compliance@amazon.com" },
  { name: "Vercel", vendor: "Vercel Inc.", services: "Next.js hosting + edge + Blob", cmmcStatus: "Inherits — SOC 2 Type II", contactEmail: "compliance@vercel.com" },
  { name: "Neon", vendor: "Neon Inc.", services: "Managed Postgres", cmmcStatus: "Inherits — SOC 2 Type II", contactEmail: "security@neon.tech" },
  { name: "Clerk", vendor: "Clerk, Inc.", services: "Authentication; session JWTs", cmmcStatus: "Inherits — SOC 2 Type II", contactEmail: "security@clerk.com" },
];

// One realistic body per slot key. Generic-by-kind fallback for unlisted slots.
const SLOT_CONTENT: Record<string, { ext: string; mime: string; body: string }> = {
  // AC.L1-3.1.1
  authorized_users_roster: { ext: "csv", mime: "text/csv", body: ["Full Name,Email,Role,System,Date Authorized,MFA","Daniel Salvatori,daniel@custodia.dev,Owner,M365 / AWS / Vercel / Neon,2025-09-01,Hardware FIDO2","Mei Chen,mei@custodia.dev,Eng Lead,M365 / AWS / Vercel / Neon,2025-09-12,Hardware FIDO2","Robert Hayes,robert@custodia.dev,Senior Eng,M365 / AWS / Vercel,2025-10-04,Authenticator","Priya Natarajan,priya@custodia.dev,Engineer,M365 / AWS / Vercel,2025-11-20,Authenticator","Theresa Kim,theresa@custodia.dev,Compliance,M365,2025-12-08,Authenticator"].join("\n") },
  authorized_devices_inventory: { ext: "csv", mime: "text/csv", body: ["Device,Type,Owner,Managed,Issued","ds-laptop-001,MacBook Pro 14,Daniel Salvatori,Intune,2025-09-01","mc-laptop-002,MacBook Pro 14,Mei Chen,Intune,2025-09-12","rh-laptop-003,ThinkPad X1 Carbon,Robert Hayes,Intune,2025-10-04","pn-laptop-004,ThinkPad X1 Carbon,Priya Natarajan,Intune,2025-11-20","tk-laptop-005,MacBook Air 13,Theresa Kim,Intune,2025-12-08"].join("\n") },
  service_accounts_list: { ext: "csv", mime: "text/csv", body: ["Account,Purpose,Runs On,Owner","github-actions-deployer,Deploys app to Vercel,GitHub Actions OIDC,Mei Chen","neon-migration-runner,Runs DB migrations,GitHub Actions OIDC,Mei Chen","aws-kms-runtime,KMS Decrypt for FCI evidence,Vercel runtime IAM role,Mei Chen","sentry-ingest-token,Error reporting,Vercel build,Mei Chen"].join("\n") },
  access_procedure: { ext: "md", mime: "text/markdown", body: `# Access Grant / Removal Procedure — Custodia, LLC\n\n## Granting access\n1. Hiring manager files an access request (M365 form) naming the systems and role.\n2. Owner (Daniel Salvatori) approves in writing within 1 business day.\n3. Engineering Lead (Mei Chen) provisions the M365, AWS, Vercel, and Neon accounts using IdP groups that map to role.\n4. New user enrolls hardware MFA + Intune device before first login.\n\n## Removing access\n1. Manager files termination ticket the same day notice is given.\n2. Within 4 hours: Entra disable + revoke sessions, AWS IAM disable, Vercel + Neon role removal.\n3. Within 24 hours: laptop wipe via Intune, MFA tokens revoked, recovery-keys rotated.\n\n## Quarterly review\nCompliance Officer (Theresa Kim) reconciles the authorized-users roster against the live IdP every quarter and signs off in the assessment record.` },
  enforcement_proof: { ext: "txt", mime: "text/plain", body: `ENFORCEMENT PROOF — Conditional Access policy export\n\nTenant: custodia.dev\nPolicy: "Require MFA for all FCI-handling apps"\nState: Enabled\nUsers: All users in 'fci-handlers' group (5 of 5 employees)\nApps: Office 365, Vercel SSO, AWS Console, Neon\nGrant: Require MFA + Compliant device + Approved client app\nLast modified: 2026-04-15 by daniel@custodia.dev\n\nScreenshot of Entra Conditional Access blade saved to evidence vault on file. This export confirms the live enforcement of the authorized-users roster.` },
  // AC.L1-3.1.2
  role_matrix: { ext: "csv", mime: "text/csv", body: ["Role,M365,AWS,Neon,Vercel,Justification","Owner,Global Admin,AdministratorAccess,Owner,Owner,Sole signer / SPRS","Compliance Officer,Compliance Reader,SecurityAudit,Read,Member-Read,Reviews evidence; cannot deploy","Eng Lead,SharePoint Admin,PowerUser,Read/Write,Member-Deploy,Ships code","Senior Eng,Standard,Developer,Read/Write,Member-Deploy,Ships code","Engineer,Standard,Developer,Read/Write,Member-Read,PRs only"].join("\n") },
  admin_users_screenshot: { ext: "txt", mime: "text/plain", body: `ENTRA ADMIN ROLE ASSIGNMENTS — Tenant: custodia.dev — Pulled 2026-05-09\n\nGlobal Administrator: daniel@custodia.dev (Daniel Salvatori) — break-glass + 1 of 1\nSharePoint Administrator: mei@custodia.dev (Mei Chen)\nCompliance Administrator: theresa@custodia.dev (Theresa Kim)\nUser Administrator: (unassigned)\nBilling Administrator: daniel@custodia.dev (Daniel Salvatori)\n\nStandard-user baseline screenshot (robert@custodia.dev): NO admin roles assigned. Role: Member only.` },
  least_privilege_procedure: { ext: "md", mime: "text/markdown", body: `# Least-Privilege Procedure — Custodia, LLC\n\nAt hire, every user gets the *Member* role only. Privileged roles (Global Admin, AdministratorAccess, Database Owner) are assigned by exception with written justification from the Owner. Admin assignments are reviewed quarterly and revoked when no longer needed. Standing admin access for daily work is prohibited; engineers use just-in-time elevation via Entra PIM where applicable.` },
  // AC.L1-3.1.20
  external_systems_inventory: { ext: "csv", mime: "text/csv", body: ["External System,Purpose,Data,Connection,Authorized By,Date","Microsoft 365,Identity + email + collab,FCI in email/OneDrive,TLS 1.3 + CA,Daniel Salvatori,2025-09-01","AWS us-east-1,KMS + Blob,Encrypted FCI,IAM + STS,Daniel Salvatori,2025-09-01","Vercel,Hosting,App traffic,TLS 1.3,Daniel Salvatori,2025-09-01","Neon Postgres,DB,Encrypted rows,TLS + channel binding,Daniel Salvatori,2025-09-01","Clerk,Auth,User IDs,TLS 1.3,Daniel Salvatori,2025-09-01","Anthropic API,AI,PII-scrubbed text,TLS 1.3,Daniel Salvatori,2025-09-01"].join("\n") },
  external_access_controls: { ext: "txt", mime: "text/plain", body: `EXTERNAL ACCESS CONTROLS — Pulled 2026-04-15\n\nAll external SaaS reachable only via Entra SSO + Conditional Access:\n- Vercel: SAML SSO from Entra; MFA inherited; only 'fci-handlers' group can sign in\n- Neon: SSO via GitHub OAuth (org-restricted); 2FA org-wide enforced\n- Clerk: admin console SSO + MFA on every signin\n- AWS Console: IAM Identity Center backed by Entra; MFA + hardware token enforced via SCP\n\nVendor MFA / SOC 2 attestations on file in vendor-binders/ for every system above.` },
  external_use_policy: { ext: "md", mime: "text/markdown", body: `# External-Use Policy — Custodia, LLC\n\nApproved external systems are listed in the External Systems Inventory. Adding a new external SaaS or contractor system requires Owner approval in writing. Personal cloud storage (Dropbox, Google Drive personal accounts) is prohibited for FCI. Quarterly the Compliance Officer reviews the inventory and removes systems no longer used.` },
  // AC.L1-3.1.22
  authorized_posters_ack: { ext: "csv", mime: "text/csv", body: ["Name,Role,Acknowledgement,Signed","Daniel Salvatori,Owner,Public-posting policy v1.2,2025-09-01","Mei Chen,Eng Lead,Public-posting policy v1.2,2025-09-12","Theresa Kim,Compliance Officer,Public-posting policy v1.2,2025-12-08"].join("\n") },
  public_posting_procedure: { ext: "md", mime: "text/markdown", body: `# Public-Posting Review Procedure — Custodia, LLC\n\n1. Author drafts copy in a Notion page tagged \`#public-review\`.\n2. Compliance Officer reviews for FCI / customer-name / contract-detail leakage within 1 business day.\n3. Owner approves in writing.\n4. Author publishes only after the approval comment lands.\n5. Improper posts: Owner removes within 1 hour of detection; Compliance Officer files incident note in /incidents/.` },
  review_evidence: { ext: "txt", mime: "text/plain", body: `SAMPLE REVIEW — Blog post "How small primes win AFWERX SBIRs"\n\nDraft submitted 2026-03-12 by Daniel.\nCompliance review (Theresa, 2026-03-12 14:22): "Strip the customer name from para 4. Otherwise good." — change applied.\nOwner approval (Daniel, 2026-03-13 09:01): "Ship it."\nPublished 2026-03-13 09:45.\n\nEmail thread + redlined draft saved to /public-review/2026-03-blog-afwerx/.` },
  // IA.L1-3.5.1
  user_identifiers_list: { ext: "csv", mime: "text/csv", body: ["Username,Display Name,Type,Shared","daniel@custodia.dev,Daniel Salvatori,User,No","mei@custodia.dev,Mei Chen,User,No","robert@custodia.dev,Robert Hayes,User,No","priya@custodia.dev,Priya Natarajan,User,No","theresa@custodia.dev,Theresa Kim,User,No"].join("\n") },
  process_identifiers_list: { ext: "csv", mime: "text/csv", body: ["Service Principal,Purpose,Owner","github-actions-deployer,Deploys to Vercel via OIDC,Mei Chen","neon-migration-runner,Runs DB migrations via OIDC,Mei Chen","aws-kms-runtime,Vercel runtime IAM role,Mei Chen"].join("\n") },
  device_identifiers_list: { ext: "csv", mime: "text/csv", body: ["Hostname,Serial,Owner","ds-laptop-001,FVFY1234DS01,Daniel Salvatori","mc-laptop-002,FVFY1234MC02,Mei Chen","rh-laptop-003,PF3CVRH03,Robert Hayes","pn-laptop-004,PF3CVPN04,Priya Natarajan","tk-laptop-005,FVFY1234TK05,Theresa Kim"].join("\n") },
  // IA.L1-3.5.2
  mfa_enforcement: { ext: "txt", mime: "text/plain", body: `MFA ENFORCEMENT — Conditional Access policy export, 2026-04-15\n\nPolicy: "Require MFA for all users — all apps"\nState: Enabled\nUsers: All cloud users (5 of 5)\nClients: Browser + Mobile + Desktop\nGrant: Require MFA AND Compliant device\nException: None\n\nEvery sign-in across M365, Vercel SSO, AWS Console, Neon GitHub-SSO, Clerk requires MFA.` },
  password_policy: { ext: "md", mime: "text/markdown", body: `# Authentication & Password Policy — Custodia, LLC\n\n- Minimum length: 14 characters\n- Complexity: passphrase encouraged; banned-password list enforced via Entra Password Protection\n- Rotation: only on suspected compromise (NIST SP 800-63B)\n- Account lockout: 10 invalid attempts → 15-min lockout\n- MFA: required for every sign-in; hardware FIDO2 for Owner + Eng Lead\n- No shared accounts permitted under any circumstance.` },
  process_auth_method: { ext: "md", mime: "text/markdown", body: `# Process / Service-Account Authentication — Custodia, LLC\n\nAll automation uses short-lived OIDC tokens minted by GitHub Actions or Vercel runtime IAM roles. No long-lived secrets are stored in code. The single API key in use (Anthropic) is stored in Vercel encrypted environment variables and rotated quarterly. AWS KMS access uses an IAM role attached to the Vercel runtime — no static AWS keys exist anywhere in the codebase.` },
  device_auth_evidence: { ext: "txt", mime: "text/plain", body: `DEVICE AUTHENTICATION — Intune compliance dashboard export, 2026-04-15\n\nCompliance policy "Custodia FCI Devices":\n- OS encryption: required (FileVault / BitLocker)\n- Defender real-time protection: required\n- Min OS: macOS 14.x / Windows 11 23H2\n- Device certificate: required\n\nDevice posture (5 of 5 Compliant): ds-laptop-001, mc-laptop-002, rh-laptop-003, pn-laptop-004, tk-laptop-005.\n\nConditional Access blocks any sign-in from a non-compliant device.` },
  // MP.L1-3.8.3
  media_disposal_log: { ext: "csv", mime: "text/csv", body: ["Date,Asset,Method,Performed By,Witness","2025-10-15,ds-laptop-old-001,DoD wipe + factory reset,Daniel,Mei","2025-11-22,backup-drive-2024,Crypto-erase + shred (Iron Mountain IM-2025-11-22-841),Mei,Daniel","2026-02-05,test-laptop-003,Intune wipe + DoD 3-pass,Mei,Theresa"].join("\n") },
  sanitization_procedure: { ext: "md", mime: "text/markdown", body: `# Media Sanitization Procedure — Custodia, LLC\n\nFollows NIST SP 800-88 Rev 1.\n\n- **Clear** (laptops returned to vendor): factory reset + DoD 5220.22-M 3-pass wipe.\n- **Purge** (high-risk devices): cryptographic erase via Intune + secondary wipe.\n- **Destroy** (failed drives, end-of-life backup media): physical shred via Iron Mountain with certificate of destruction filed.\n\nEvery event logged in the Media Disposal Log within 1 business day. Compliance Officer reviews quarterly.` },
  // PE.L1-3.10.1
  physical_access_roster: { ext: "csv", mime: "text/csv", body: ["Person,Workspace,Lock,Family in Space,Signed","Daniel,Wilmington DE home office,5min auto + FileVault,No,2025-09-01","Mei,San Mateo CA home office,5min auto + BitLocker,Yes (separated),2025-09-12","Robert,Dayton OH home office,5min auto + BitLocker,No,2025-10-04","Priya,Austin TX home office,5min auto + BitLocker,Yes (separated),2025-11-20","Theresa,Seattle WA home office,5min auto + FileVault,No,2025-12-08"].join("\n") },
  physical_access_enforcement: { ext: "txt", mime: "text/plain", body: `PHYSICAL ENFORCEMENT — Custodia is remote-only.\n\nEach FCI-handling laptop is Intune-managed with:\n- Auto-lock 5 minutes idle\n- Full-disk encryption (FileVault / BitLocker)\n- Hardware FIDO2 or Authenticator MFA on every wake\n- "Find My / Microsoft Find" enabled for remote wipe\n\nWorkspace photos on file in /workspace-photos/ for the 2026-04-15 quarterly review.` },
  physical_access_procedure: { ext: "md", mime: "text/markdown", body: `# Physical Access Procedure — Custodia, LLC\n\nCustodia is remote-only with 5 home offices. Each team member signs the Workspace Policy at hire (workspace separated from cohabitants, FCI-handling laptop never used by family, lock-screen always on when stepping away). Devices are Intune-enrolled before any FCI access. At termination, Mei wipes the device via Intune within 4 hours and the device is shipped back. The Owner reviews the workspace roster quarterly.` },
  // PE.L1-3.10.3
  visitor_log: { ext: "csv", mime: "text/csv", body: ["Date,Visitor,Purpose,Host,Signed Out","(no on-site visitors — remote-only operation),,,,","Policy: any future on-site visitor signs this log; an authorized user escorts them.,,,,"].join("\n") },
  visitor_procedure: { ext: "md", mime: "text/markdown", body: `# Visitor Escort & Monitoring — Custodia, LLC\n\nCustodia is remote-only; there is no on-site office. The Workspace Policy each team member signs prohibits non-employee access to FCI-handling laptops at home. Should an on-site office be stood up, the procedure is: visitor signs log on arrival, the host escorts at all times, FCI-handling devices are locked before the visitor enters, the host signs the visitor out on departure.` },
  // PE.L1-3.10.4
  physical_access_log: { ext: "csv", mime: "text/csv", body: ["Date,Workspace,Event,Recorded By","2025-09-01,Wilmington DE,FCI laptop issued (ds-laptop-001),Daniel","2025-09-12,San Mateo CA,FCI laptop issued (mc-laptop-002),Daniel","2025-10-04,Dayton OH,FCI laptop issued (rh-laptop-003),Daniel","2025-11-20,Austin TX,FCI laptop issued (pn-laptop-004),Daniel","2025-12-08,Seattle WA,FCI laptop issued (tk-laptop-005),Daniel","2026-04-15,All workspaces,Quarterly device-custody review — all accounted,Daniel"].join("\n") },
  log_retention_procedure: { ext: "md", mime: "text/markdown", body: `# Log Retention Procedure — Custodia, LLC\n\nPhysical access events (laptop issuance / return / quarterly verification) are logged in the Physical Access Log immediately. Logs are retained for 3 years in the Custodia evidence vault on Vercel Blob (encrypted, AES-GCM with AAD bound to the org). The Owner reviews the log quarterly and signs the review attestation.` },
  // PE.L1-3.10.5
  access_device_register: { ext: "csv", mime: "text/csv", body: ["Device Type,ID,Issued To,Issued,Status","YubiKey 5C NFC,YK-001,Daniel,2025-09-01,Active","YubiKey 5C NFC,YK-002,Daniel (backup),2025-09-01,Active (safe)","YubiKey 5C NFC,YK-003,Mei,2025-09-12,Active","YubiKey 5C NFC,YK-004,Mei (backup),2025-09-12,Active (safe)","MacBook Pro 14,ds-laptop-001,Daniel,2025-09-01,Active","MacBook Pro 14,mc-laptop-002,Mei,2025-09-12,Active","ThinkPad X1,rh-laptop-003,Robert,2025-10-04,Active","ThinkPad X1,pn-laptop-004,Priya,2025-11-20,Active","MacBook Air 13,tk-laptop-005,Theresa,2025-12-08,Active"].join("\n") },
  access_device_procedure: { ext: "md", mime: "text/markdown", body: `# Access Device Issue / Revoke Procedure — Custodia, LLC\n\nAt hire: Owner orders the laptop + 2x YubiKeys; serials are added to the Access Device Register before shipment. New hire enrolls both YubiKeys in Entra at first login. Lost devices: reported to Owner within 4 hours; Mei revokes the credential and disables the device in Intune. At termination: laptop returned + wiped; YubiKeys returned and revoked. Register audited quarterly.` },
  // SC.L1-3.13.1
  network_boundary_inventory: { ext: "csv", mime: "text/csv", body: ["Boundary,Device,Function,Reviewed","Internet → Vercel edge,Vercel WAF + DDoS,Inbound HTTPS only,2026-04-15","Internet → AWS,AWS SCP + GuardDuty,Inbound denied except KMS API,2026-04-15","Internet → Neon,TLS Postgres + IP allow-list,Allow only Vercel build,2026-04-15","Home routers,WPA3 + auto-firmware,Default-deny inbound,2026-04-15","Endpoints,Defender Firewall (Intune),Block inbound,2026-04-15"].join("\n") },
  firewall_config: { ext: "txt", mime: "text/plain", body: `FIREWALL CONFIGURATION — Custodia, LLC — Snapshot 2026-04-15\n\n[Vercel WAF rules]\n- Block known bad bots (managed list)\n- Rate limit: 60 req/IP/min on /api/*\n- Block requests with no User-Agent\n\n[AWS SCP — production OU]\n- Deny all except kms:Decrypt + kms:GenerateDataKey on the Custodia KEK\n- Region lock: us-east-1 only\n\n[Neon network policy]\n- IP allow-list: Vercel build IPs (auto-rotated)\n- TLS 1.3 + channel binding required\n\n[Intune endpoint firewall baseline]\n- Inbound: block all except managed services\n- Outbound: allow; logging on` },
  encryption_evidence: { ext: "txt", mime: "text/plain", body: `ENCRYPTION-IN-TRANSIT EVIDENCE — Custodia, LLC — 2026-04-15\n\nbidfedcmmc.com → SSL Labs result: A+\n  TLS 1.3 only; HSTS preload; no weak ciphers\n  Cert: Let's Encrypt R3, expires 2026-08-12, auto-renewed\n\nNeon: TLS 1.3 + channel binding (RFC 5929)\nAWS KMS: TLS 1.3 enforced by AWS\nM365: TLS 1.2+ enforced tenant-wide\n\nNo plaintext FCI traverses any boundary.` },
  // SC.L1-3.13.5
  public_components_list: { ext: "csv", mime: "text/csv", body: ["Component,Public,Hosted,Isolation,FCI?","bidfedcmmc.com (marketing + sign-in),Yes,Vercel edge,Auth required for all FCI routes,No","/api/health,Yes,Vercel,Returns OK only,No","Authenticated app,No (Clerk-protected),Vercel,Per-org JWT + RLS,Yes (encrypted)","Neon Postgres,No (IP-allow-listed),Neon,Not internet-reachable,Yes (encrypted)","AWS KMS,No (IAM-gated),AWS,kms:Decrypt only via runtime role,Yes (KEK-wrapped)"].join("\n") },
  separation_evidence: { ext: "md", mime: "text/markdown", body: `# Public-System Separation Attestation — Custodia, LLC\n\nThe public-facing surface of bidfedcmmc.com is a single Next.js app on Vercel. Pages outside \`/sign-in\`, \`/sign-up\`, \`/blog\`, and the marketing routes are Clerk-protected — every request to an FCI route is rejected without a valid session. The FCI data plane (Neon Postgres + AWS KMS + Vercel Blob evidence vault) is not reachable from the public internet: Neon is IP-allow-listed to Vercel build IPs only; AWS KMS is gated by an IAM role attached to the Vercel runtime; Vercel Blob URLs require the read-write token to fetch. Public components and FCI components share no datastore and no IAM principal.` },
  // SI.L1-3.14.1
  patch_policy: { ext: "md", mime: "text/markdown", body: `# Patch / Flaw Remediation Policy — Custodia, LLC\n\nSeverity (CVSS) → time-to-correct:\n- Critical (9.0–10.0): within 7 days of vendor advisory\n- High (7.0–8.9): within 30 days\n- Medium (4.0–6.9): within 90 days\n- Low (<4.0): next routine cycle\n\nIdentification: Microsoft Defender Threat & Vulnerability Management + GitHub Dependabot + manual quarterly review.\nReporting: any Critical/High finding posted in #security within 24 hours of detection.\nCorrection: tracked in the Patch Log; quarterly review by Eng Lead.` },
  patch_log: { ext: "csv", mime: "text/csv", body: ["Date,Component,Severity,Action,By","2025-09-18,macOS endpoints,High,Auto via Intune <24h,Mei","2025-10-22,Next.js (CVE-2025-29927),Critical,Upgraded 16.0.x same day,Mei","2025-11-30,Windows endpoints,High,Patch Tuesday auto <48h,Mei","2026-01-14,@anthropic-ai/sdk,Low,Routine npm update,Robert","2026-02-25,@aws-sdk/client-kms (regex DoS),Medium,Upgraded same week,Mei","2026-04-08,Neon Postgres,—,Vendor-applied,Neon"].join("\n") },
  auto_update_evidence: { ext: "txt", mime: "text/plain", body: `AUTO-UPDATE EVIDENCE — Intune Update Compliance, 2026-04-15\n\nUpdate ring "Custodia FCI Devices":\n- Quality updates: install within 2 days of release\n- Feature updates: within 30 days\n- Active hours: respect user; force-restart deadline 7 days\n\nDevice compliance (5 of 5 devices on latest):\nds-laptop-001 — macOS 14.7, last update 2026-05-03\nmc-laptop-002 — macOS 14.7, last update 2026-05-03\nrh-laptop-003 — Windows 11 23H2, KB5040528, last update 2026-05-09\npn-laptop-004 — Windows 11 23H2, KB5040528, last update 2026-05-09\ntk-laptop-005 — macOS 14.7, last update 2026-05-03` },
  // SI.L1-3.14.2
  endpoint_av_inventory: { ext: "csv", mime: "text/csv", body: ["Device,User,OS,AV,Real-Time,Last Update,Last Scan","ds-laptop-001,Daniel,macOS 14.7,Defender for Endpoint,On,2026-05-09,2026-05-09 clean","mc-laptop-002,Mei,macOS 14.7,Defender for Endpoint,On,2026-05-09,2026-05-09 clean","rh-laptop-003,Robert,Win 11 23H2,Defender for Endpoint,On,2026-05-10,2026-05-10 clean","pn-laptop-004,Priya,Win 11 23H2,Defender for Endpoint,On,2026-05-10,2026-05-10 clean","tk-laptop-005,Theresa,macOS 14.7,Defender for Endpoint,On,2026-05-09,2026-05-09 clean"].join("\n") },
  av_protection_screenshot: { ext: "txt", mime: "text/plain", body: `AV PROTECTION — Defender for Endpoint dashboard, 2026-05-09\n\nDevice: ds-laptop-001 (macOS)\n  Real-time protection: ON\n  Cloud-delivered protection: ON\n  Tamper protection: ON (Intune-locked)\n  Last quick scan: 2026-05-09 12:00 — no threats\n\nDevice: rh-laptop-003 (Windows)\n  Real-time protection: ON\n  Cloud-delivered protection: ON\n  Tamper protection: ON\n  Last quick scan: 2026-05-10 12:00 — no threats` },
  av_policy: { ext: "md", mime: "text/markdown", body: `# Endpoint AV Policy — Custodia, LLC\n\n- Microsoft Defender for Endpoint required on every Custodia device.\n- Real-time + cloud-delivered + tamper protection must be ON; users cannot disable (Intune Endpoint Security baseline).\n- Signature updates: every 4 hours, automatic.\n- Quick scan: daily at 12:00 local. Full scan: weekly Sunday 02:00 local.\n- Any disabled-AV report from Intune triggers an incident; device is revoked from Conditional Access until resolved.` },
  // SI.L1-3.14.4
  av_update_screenshot: { ext: "txt", mime: "text/plain", body: `AV UPDATE STATE — Defender for Endpoint, 2026-05-09\n\nSignature version: 1.421.998.0\nEngine version: 1.1.24050.5\nPlatform version: 4.18.24050.7\nLast update: 2026-05-09 06:32 UTC (4 hours ago)\nUpdate cadence: every 4 hours via Intune cloud-delivered protection\n\n5 of 5 endpoints on latest signature (verified via Intune compliance dashboard).` },
  // SI.L1-3.14.5
  scan_schedule_screenshot: { ext: "txt", mime: "text/plain", body: `SCHEDULED SCAN CONFIGURATION — Defender for Endpoint, 2026-05-09\n\nQuick scan: daily at 12:00 local time\nFull scan: weekly, Sunday 02:00 local time\nLast full scan results (5 of 5 endpoints):\n- ds-laptop-001 — 2026-05-04 02:14, no threats\n- mc-laptop-002 — 2026-05-04 02:21, no threats\n- rh-laptop-003 — 2026-05-04 02:09, no threats\n- pn-laptop-004 — 2026-05-04 02:33, no threats\n- tk-laptop-005 — 2026-05-04 02:18, no threats` },
  realtime_scan_screenshot: { ext: "txt", mime: "text/plain", body: `REAL-TIME SCAN CONFIGURATION — Defender for Endpoint, 2026-05-09\n\nReal-time protection: ENABLED\nCloud-delivered protection: ENABLED\nBehavior monitoring: ENABLED\nScan downloaded files and attachments: ENABLED\nScan removable drives during full scan: ENABLED\nTamper protection: ENABLED (Intune-locked; user cannot disable)\n\nExtension scan: every download, open, and execute is scanned in real time before the file is delivered to the application.` },
  scan_frequency_policy: { ext: "md", mime: "text/markdown", body: `# Scan Frequency Policy — Custodia, LLC\n\nFull system scans run weekly on every endpoint (Sunday 02:00 local time). Quick scans run daily at noon local. Real-time on-access scanning is enabled at all times and tamper-protected via Intune Endpoint Security baseline. Users cannot disable any scan layer; attempts are logged and trigger an incident.` },
};

function bodyForSlot(controlId: string, slot: EvidenceSlot): { ext: string; mime: string; body: string } {
  const explicit = SLOT_CONTENT[slot.key];
  if (explicit) return explicit;
  const header = `${slot.label} — Custodia, LLC — ${controlId}`;
  switch (slot.kind) {
    case "roster_csv":
      return { ext: "csv", mime: "text/csv", body: `Item,Note\n${slot.key},${slot.hint.replace(/,/g, ";")}\nReviewed,2026-04-15\nOwner,Daniel Salvatori` };
    case "screenshot":
    case "config_export":
      return { ext: "txt", mime: "text/plain", body: `${header}\n\n${slot.hint}\n\nExported 2026-04-15 by Mei Chen.` };
    default:
      return { ext: "md", mime: "text/markdown", body: `# ${slot.label} — Custodia, LLC\n\n${slot.hint}\n\nReviewed quarterly; last review 2026-04-15.` };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const assessmentId = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  const reset = args.includes("--reset");
  if (!assessmentId) { console.error("Usage: npx tsx scripts/seed-demo-evidence.ts <assessmentId> [--apply] [--reset]"); process.exit(2); }
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) { console.error(`Bad id: ${assessmentId}`); process.exit(2); }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error("BLOB_READ_WRITE_TOKEN missing in .env.local"); process.exit(2); }

  const sql = getSql();
  const found = (await sql`
    SELECT a.id, a.framework, a.status, o.id AS organization_id, o.name, o.owner_user_id
    FROM assessments a JOIN organizations o ON o.id = a.organization_id
    WHERE a.id = ${assessmentId}
  `) as Array<{ id: string; framework: string; status: string; organization_id: string; name: string; owner_user_id: string }>;
  if (found.length === 0) { console.error("Assessment not found."); process.exit(1); }
  const a = found[0];
  if (a.framework !== "cmmc_l1") { console.error("Only cmmc_l1 supported."); process.exit(1); }
  if (a.status === "attested") { console.error("Already attested — refusing."); process.exit(1); }

  const cmmcL1Practices = playbook.filter((p) => p.framework === "cmmc_l1").map((p) => p.id);
  const totalSlots = cmmcL1Practices.reduce((n, c) => n + (practiceSpecs[c]?.evidenceSlots.filter((s) => s.required).length ?? 0), 0);

  console.log(`Target: ${a.name} (org ${a.organization_id})`);
  console.log(`        assessment ${a.id}, status ${a.status}`);
  console.log("");
  console.log("Plan:");
  console.log(`  1. scope_inventory: ${SCOPE_PEOPLE.length + SCOPE_TECH.length + SCOPE_FACILITY.length} rows`);
  console.log(`  2. esp_registry: ${ESPS.length} ESPs`);
  console.log(`  3. evidence_artifacts: ~${totalSlots} (one per required slot across ${cmmcL1Practices.length} practices)`);
  console.log(`  4. practice_conversations: ${cmmcL1Practices.length} (all-covered + locked)`);
  if (reset) console.log(`  --reset: delete prior demo-seed-v1 artifacts + practice conversations first`);
  console.log("");
  if (!apply) { console.log("DRY RUN — pass --apply to write."); return; }

  if (reset) {
    console.log("Resetting prior demo data...");
    await sql`DELETE FROM practice_conversations WHERE assessment_id = ${assessmentId}`;
    await sql`
      DELETE FROM evidence_artifact_practices
      WHERE artifact_id IN (
        SELECT id FROM evidence_artifacts
        WHERE assessment_id = ${assessmentId} AND ai_review_model = 'demo-seed-v1'
      )
    `;
    await sql`DELETE FROM evidence_artifacts WHERE assessment_id = ${assessmentId} AND ai_review_model = 'demo-seed-v1'`;
    console.log("  ✓ reset");
  }

  console.log("Writing scope inventory...");
  for (const p of SCOPE_PEOPLE) await sql`INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci) VALUES (${a.organization_id}::uuid, 'people', ${p.label}, ${p.role}, true) ON CONFLICT DO NOTHING`;
  for (const t of SCOPE_TECH) await sql`INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci) VALUES (${a.organization_id}::uuid, 'technology', ${t.label}, ${t.role}, true) ON CONFLICT DO NOTHING`;
  for (const f of SCOPE_FACILITY) await sql`INSERT INTO scope_inventory (organization_id, kind, label, role, handles_fci) VALUES (${a.organization_id}::uuid, 'facility', ${f.label}, ${f.role}, false) ON CONFLICT DO NOTHING`;
  console.log("  ✓ scope_inventory");

  console.log("Writing ESP registry...");
  for (const e of ESPS) await sql`INSERT INTO esp_registry (organization_id, name, vendor, services, cmmc_status, contact_email) VALUES (${a.organization_id}::uuid, ${e.name}, ${e.vendor}, ${e.services}, ${e.cmmcStatus}, ${e.contactEmail}) ON CONFLICT DO NOTHING`;
  console.log("  ✓ esp_registry");

  console.log("Uploading evidence artifacts (one per required slot)...");
  let totalUploaded = 0;
  for (const controlId of cmmcL1Practices) {
    const spec = practiceSpecs[controlId];
    if (!spec) continue;
    const requiredSlots = spec.evidenceSlots.filter((s) => s.required);
    let practiceCount = 0;
    for (const slot of requiredSlots) {
      const slotPrefix = `[slot:${slot.key}]__`;
      const existing = (await sql`
        SELECT id FROM evidence_artifacts
        WHERE assessment_id = ${assessmentId}
          AND control_id = ${controlId}
          AND filename LIKE ${slotPrefix + "%"}
          AND ai_review_verdict = 'sufficient'
          AND COALESCE(carry_forward_status, 'kept') NOT IN ('removed','needs_replacement')
        LIMIT 1
      `) as Array<{ id: string }>;
      if (existing.length > 0) { practiceCount++; continue; }

      const { ext, mime, body } = bodyForSlot(controlId, slot);
      const baseName = slot.key.replace(/_/g, "-");
      const filename = `[slot:${slot.key}]__${baseName}.${ext}`;
      const plaintext = Buffer.from(body, "utf-8");
      const pathname = `evidence/${assessmentId}/${controlId}/${Date.now()}-${baseName}.${ext}`;
      const blob = await put(pathname, plaintext, { access: "private", addRandomSuffix: true, contentType: mime });
      const summary = `${slot.label} for ${controlId}. ${slot.hint}`;
      const inserted = (await sql`
        INSERT INTO evidence_artifacts
          (assessment_id, control_id, filename, blob_url, mime_type, size_bytes,
           uploaded_by_user_id, ai_review_verdict, ai_review_summary,
           ai_review_mapped_controls, ai_reviewed_at, ai_review_model,
           carry_forward_status)
        VALUES
          (${assessmentId}, ${controlId}, ${filename}, ${blob.url}, ${mime}, ${plaintext.length},
           ${a.owner_user_id}, 'sufficient', ${summary},
           ARRAY[${controlId}]::text[], NOW(), 'demo-seed-v1',
           'kept')
        RETURNING id
      `) as Array<{ id: string }>;
      await sql`
        INSERT INTO evidence_artifact_practices
          (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
        VALUES (${inserted[0].id}, ${assessmentId}, ${controlId}, ${slot.satisfies}::text[], ${a.owner_user_id})
        ON CONFLICT (artifact_id, assessment_id, control_id) DO NOTHING
      `;
      practiceCount++;
      totalUploaded++;
    }
    console.log(`  ✓ ${controlId}: ${practiceCount}/${requiredSlots.length} slots`);
  }
  console.log(`  total artifacts: ${totalUploaded}`);

  console.log("Seeding practice conversations (all-covered + locked)...");
  for (const controlId of cmmcL1Practices) {
    const spec = practiceSpecs[controlId];
    if (!spec) continue;
    const verdicts: Record<string, { status: "covered"; reason: string }> = {};
    for (const obj of spec.objectives) {
      verdicts[obj.letter] = {
        status: "covered",
        reason: `Confirmed via the attached evidence artifacts for ${controlId} and the documented procedures on file.`,
      };
    }
    const opener = `[Guided walkthrough — ${controlId} ${spec.shortName}]\n\nCustodia is a 5-person remote-only software company building bidfedcmmc.com on Microsoft 365 + AWS + Vercel + Neon + Clerk. All five employees are authorized FCI handlers; all 5 endpoints are Intune-managed; MFA is enforced everywhere; evidence for every slot is attached.`;
    const body = `Demo seed — every objective letter for ${controlId} is satisfied by the attached evidence artifacts. See the slot list for ${spec.evidenceSlots.length} attached items covering objectives [${spec.objectives.map((o) => o.letter).join(", ")}].`;
    const messages = [
      { role: "assistant", text: opener, at: new Date().toISOString() },
      { role: "user", text: "Demo: please confirm everything is in place.", at: new Date().toISOString() },
      { role: "assistant", text: body, at: new Date().toISOString() },
    ];
    await sql`
      INSERT INTO practice_conversations
        (assessment_id, control_id, messages, objective_verdicts, verdict_updated_at, locked_at)
      VALUES
        (${assessmentId}, ${controlId},
         ${JSON.stringify(messages)}::jsonb,
         ${JSON.stringify(verdicts)}::jsonb,
         NOW(), NOW())
      ON CONFLICT (assessment_id, control_id) DO UPDATE SET
        messages = EXCLUDED.messages,
        objective_verdicts = EXCLUDED.objective_verdicts,
        verdict_updated_at = NOW(),
        locked_at = NOW(),
        updated_at = NOW()
    `;
  }
  console.log(`  ✓ ${cmmcL1Practices.length} practice conversations seeded`);
  console.log("");
  console.log("Done. Reload the workspace — scope step shows complete, every practice shows MET.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
