import type { Framework } from "@/lib/db";

export const controlDomains = ["AC", "IA", "MP", "PE", "SC", "SI"] as const;
export type ControlDomain = (typeof controlDomains)[number];

export const evidenceProviders = [
  "m365",
  "google_workspace",
  "okta",
  "on_prem_ad",
  "aws",
  "manual",
] as const;
export type EvidenceProvider = (typeof evidenceProviders)[number];

export type ProviderTemplate = {
  filename: string;
  label: string;
  description: string;
};

export type ProviderGuidance = {
  provider: EvidenceProvider;
  label: string;
  steps: string[];
  capture: string;
  template?: ProviderTemplate;
};

export type NarrativeContext = {
  companyName: string;
  scopedSystems: string;
  capturedAt: string;
  artifactFilename: string;
};

export type ControlPlaybook = {
  id: string;
  framework: Framework;
  domain: ControlDomain;
  shortName: string;
  title: string;
  farReference: string;
  nistReference: string;
  plainEnglish: string;
  whyItMatters: string;
  providerGuidance: ProviderGuidance[];
  suggestedNarrative: (ctx: NarrativeContext) => string;
  commonGotchas: string[];
};

export const playbook: ControlPlaybook[] = [
  {
    id: "AC.L1-3.1.1",
    framework: "cmmc_l1",
    domain: "AC",
    shortName: "Authorized Access Control",
    title:
      "Limit information system access to authorized users, processes acting on behalf of authorized users, or devices (including other information systems)",
    farReference: "FAR 52.204-21 (b)(1)(i)",
    nistReference: "NIST SP 800-171 3.1.1",
    plainEnglish:
      "Only people you've approved can log in to systems that handle government contract information.",
    whyItMatters:
      "If a former employee still has a login, or a vendor has access they no longer need, that's a finding. Primes will ask you to prove you actively manage who has access.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365",
        steps: [
          "Go to admin.microsoft.com (Microsoft 365 admin center)",
          "Click Users → Active users",
          "Make sure the visible columns include Display Name, Username, and Status",
          "Take a full-window screenshot",
        ],
        capture:
          "Screenshot of the Active users list showing every account on your tenant. If you have more than 20 users, also export as CSV and upload both files.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace",
        steps: [
          "Go to admin.google.com",
          "Click Directory → Users",
          "Ensure the Status column is visible",
          "Take a full-window screenshot",
        ],
        capture:
          "Screenshot of the Users list with Status column visible. Export to CSV if >20 users.",
      },
      {
        provider: "manual",
        label: "No central identity system",
        steps: [
          "List every system that stores or processes federal contract information (email, file server, cloud drive, CRM, accounting software)",
          "For each system, list the currently authorized users with their role",
          "Have the company owner or a senior person sign and date the list",
        ],
        capture:
          "Signed user roster per system. A clear photo or scanned PDF of the signed page is acceptable.",
        template: {
          filename: "authorized-users-roster.csv",
          label: "Authorized Users Roster (CSV)",
          description: "Fill in every system that handles contract info, every authorized user, and have the owner sign and date. Open in Excel, Google Sheets, or Numbers.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} reviewed the authorized user roster for ${ctx.scopedSystems}. All accounts listed were verified to belong to current personnel with a documented business need for access. Evidence of this review is captured in artifact ${ctx.artifactFilename}. This review is performed at least annually and whenever personnel changes occur.`,
    commonGotchas: [
      "Service accounts and shared mailboxes are often missed — list them explicitly",
      "Former employees whose accounts are 'disabled but not deleted' still need to be documented",
      "External collaborators (contractors, auditors) with guest access count as users",
    ],
  },
  {
    id: "AC.L1-3.1.2",
    framework: "cmmc_l1",
    domain: "AC",
    shortName: "Transaction & Function Control",
    title:
      "Limit information system access to the types of transactions and functions that authorized users are permitted to execute",
    farReference: "FAR 52.204-21 (b)(1)(ii)",
    nistReference: "NIST SP 800-171 3.1.2",
    plainEnglish:
      "Even authorized users shouldn't have more access than their job requires — a bookkeeper shouldn't be able to change IT settings.",
    whyItMatters:
      "Admin sprawl is the most common finding. If a bookkeeper or intern is a Global Admin or has root, expect questions. Least-privilege role assignment, documented, is what primes want to see.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365",
        steps: [
          "Go to admin.microsoft.com → Users → Active users",
          "Filter by Roles = any admin role (Global Admin, Billing Admin, User Admin, etc.)",
          "Screenshot the filtered list showing every admin-level account",
          "Separately, screenshot a regular (non-admin) user's role page to show baseline",
        ],
        capture:
          "Two screenshots: (1) admin role assignments, (2) a standard user showing no elevated roles.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace",
        steps: [
          "Go to admin.google.com → Account → Admin roles",
          "Open each privileged role and screenshot the assignees",
          "Screenshot the 'Super Admin' role assignment list specifically",
        ],
        capture:
          "Screenshot of each admin role with its assigned users, emphasizing Super Admin membership.",
      },
      {
        provider: "manual",
        label: "No central identity system",
        steps: [
          "Write a one-page role matrix: each system × each user × permission level × business justification",
          "Have the owner sign and date the matrix",
          "Review at hire/termination and at least annually",
        ],
        capture:
          "Signed role matrix (PDF or photo of signed page).",
        template: {
          filename: "role-matrix.csv",
          label: "Role Matrix (CSV)",
          description: "One row per system × user × permission level. Document business justification, then sign and date.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} reviewed role and permission assignments across ${ctx.scopedSystems}. Privileges are granted on a least-privilege basis aligned to each user's documented job function; administrative roles are restricted to named personnel with a continuing operational need. The current role assignment evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Granting Global Admin 'to make things work' and forgetting to revoke",
      "Shared 'admin' accounts hide who did what — assign roles to named users",
      "Third-party app integrations and service principals often have over-broad scopes",
    ],
  },
  {
    id: "AC.L1-3.1.20",
    framework: "cmmc_l1",
    domain: "AC",
    shortName: "External Connections",
    title:
      "Verify and control/limit connections to and use of external information systems",
    farReference: "FAR 52.204-21 (b)(1)(iii)",
    nistReference: "NIST SP 800-171 3.1.20",
    plainEnglish:
      "Control what outside systems (personal laptops, vendor tools, random cloud apps) can connect to yours.",
    whyItMatters:
      "For small contractors this usually means personal devices and SaaS tools touching contract info. A written list of external connections plus a short use policy is the control — not a zero-trust deployment.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365",
        steps: [
          "Go to entra.microsoft.com → External Identities → External collaboration settings",
          "Screenshot the guest access and sharing settings",
          "Go to Users → Guest users and screenshot the list of current guests",
        ],
        capture:
          "Screenshot of external collaboration settings plus the guest-user list.",
      },
      {
        provider: "aws",
        label: "AWS",
        steps: [
          "Go to IAM → Roles; filter for roles with external (cross-account) trust",
          "Screenshot the list and the trust relationships",
          "Go to VPC → Peering / Transit Gateway and screenshot any external connections",
        ],
        capture:
          "IAM cross-account roles plus any external network connections.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "List every external system used for contract work (prime's file share, vendor CRM, subcontractor VPN, BYOD phones/laptops)",
          "For each, note: purpose, data it can access, who authorized the connection",
          "Write a one-page 'External System Use' policy — no new connections without owner approval",
          "Owner signs both the list and the policy",
        ],
        capture:
          "Signed external-systems list + external-use policy (PDF or photo).",
        template: {
          filename: "external-systems-inventory.csv",
          label: "External Systems Inventory (CSV)",
          description: "List every outside system, BYOD device, vendor tool, and subcontractor connection that touches contract info. Owner signs.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} inventoried all external systems and personal devices that connect to or interact with ${ctx.scopedSystems}. Each connection is documented with its purpose, the data it can access, and the authorization granted. The accompanying external-system use policy restricts new connections to those approved by the company owner. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "BYOD — personal phones checking work email count as external connections",
      "Dropbox/Google Drive accounts used to exchange files with a prime must be listed",
      "Subcontractor laptops that connect to your VPN count; include them in the inventory",
    ],
  },
  {
    id: "AC.L1-3.1.22",
    framework: "cmmc_l1",
    domain: "AC",
    shortName: "Control Public Information",
    title:
      "Control information posted or processed on publicly accessible information systems",
    farReference: "FAR 52.204-21 (b)(1)(iv)",
    nistReference: "NIST SP 800-171 3.1.22",
    plainEnglish:
      "Make sure nobody posts federal contract info on your public website, a public blog, or social media.",
    whyItMatters:
      "FCI posted publicly is a direct contract breach and an automatic rejection. One careless social-media post by a junior employee is the usual failure mode — policy plus review is the control.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Write a one-page 'Public Posting' policy: FCI may not appear on the company website, social media, blog, or external forums without owner review",
          "Have all personnel acknowledge the policy in writing",
          "Run a quarterly review: open every public surface (website, LinkedIn, X, case-studies page) and scan for FCI; log the review in a short memo",
        ],
        capture:
          "Signed policy + acknowledgements + most-recent quarterly review memo.",
        template: {
          filename: "public-posting-acknowledgement.csv",
          label: "Public Posting Policy + Acknowledgement (CSV)",
          description: "Includes the policy text, an acknowledgement table for every employee, and a quarterly review log. Sign once everyone has acknowledged.",
        },
      },
      {
        provider: "m365",
        label: "Microsoft 365 (SharePoint / OneDrive)",
        steps: [
          "Go to admin.microsoft.com → SharePoint admin center → Policies → Sharing",
          "Confirm external sharing is restricted (or off for sites containing FCI)",
          "Screenshot the sharing policy",
        ],
        capture:
          "Screenshot of external sharing settings showing FCI sites are not publicly accessible.",
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that no federal contract information appears on publicly accessible systems. A written policy prohibits the posting of FCI to public channels without owner review and has been acknowledged by all personnel; a quarterly scan of company-owned public surfaces was performed and documented. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Marketing case studies that name a DoD prime and the contract are the most common leak",
      "'About our customers' logo walls can cross the line depending on the contract clause",
      "Employee LinkedIn posts announcing contract wins need a review step before they go live",
    ],
  },
  {
    id: "IA.L1-3.5.1",
    framework: "cmmc_l1",
    domain: "IA",
    shortName: "Identification",
    title:
      "Identify information system users, processes acting on behalf of users, or devices",
    farReference: "FAR 52.204-21 (b)(1)(v)",
    nistReference: "NIST SP 800-171 3.5.1",
    plainEnglish:
      "Every login is tied to a specific, identifiable user — no generic 'office@company.com' shared accounts.",
    whyItMatters:
      "Shared accounts make it impossible to say who did what, which voids the rest of your compliance story. One login per person is the floor; cleaning this up usually takes an afternoon.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365",
        steps: [
          "Go to admin.microsoft.com → Users → Active users",
          "Confirm every account has an individual display name and UPN (no 'office', 'reception', 'shared')",
          "If shared mailboxes exist, confirm they are configured as shared mailboxes, not user accounts",
          "Screenshot the user list",
        ],
        capture:
          "Screenshot of the user list showing individual accounts only.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace",
        steps: [
          "Go to admin.google.com → Directory → Users",
          "Confirm every account is tied to a named individual",
          "Screenshot the list; if group aliases exist, screenshot the group settings to show they aren't used as logins",
        ],
        capture:
          "Screenshot of individual user accounts with names visible.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Walk every system in scope and confirm each login is tied to one specific person",
          "For any system that cannot support per-user accounts (legacy), document the exception and a compensating control",
          "Owner signs a short memo affirming per-user identification is enforced",
        ],
        capture:
          "Signed memo + list of any documented exceptions.",
        template: {
          filename: "authorized-users-roster.csv",
          label: "Authorized Users Roster (CSV)",
          description: "Use the same roster from the access-control practice — confirm every login is tied to one named person and note any documented exceptions.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that every user, process, and device with access to ${ctx.scopedSystems} is uniquely identified by an account tied to a named individual or a documented service function. Shared or generic accounts are prohibited; where legacy exceptions exist, they are documented with a compensating control. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "The front-desk computer where everyone logs in as 'reception' is a classic finding",
      "Service/integration accounts still need a documented human owner",
      "Contractors or subs sharing one login is the oldest violation in the book",
    ],
  },
  {
    id: "IA.L1-3.5.2",
    framework: "cmmc_l1",
    domain: "IA",
    shortName: "Authentication",
    title:
      "Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to allowing access to organizational information systems",
    farReference: "FAR 52.204-21 (b)(1)(vi)",
    nistReference: "NIST SP 800-171 3.5.2",
    plainEnglish:
      "Before letting anyone into your systems, verify they are who they say they are — typically a password plus a second factor (MFA).",
    whyItMatters:
      "This is the control primes scrutinize most. Password-only access is a near-automatic rejection in 2026. MFA on all admin accounts is the floor.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365",
        steps: [
          "Go to admin.microsoft.com → Security & compliance (or entra.microsoft.com → Protection → Conditional Access)",
          "Open the policy that enforces MFA (often 'Require MFA for all users' or Security Defaults)",
          "Screenshot the policy showing it is enabled and applies to all users",
          "Also capture Users → Active users → filter 'MFA status: Enforced' to show coverage",
        ],
        capture:
          "Two screenshots: (1) the Conditional Access policy or Security Defaults page showing MFA is on, (2) the user list showing MFA enforced per account.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace",
        steps: [
          "Go to admin.google.com → Security → Authentication → 2-Step Verification",
          "Confirm 2-Step Verification is set to 'On (Enforced)' for the relevant org unit",
          "Screenshot the enforcement setting",
          "Go to Reports → 2-Step Verification to screenshot the enrollment status per user",
        ],
        capture:
          "Screenshot of the enforcement setting plus the per-user enrollment report.",
      },
      {
        provider: "manual",
        label: "No central identity system",
        steps: [
          "For each system handling contract info, turn on that system's built-in MFA option",
          "For each account, take a screenshot or photo showing MFA is enabled on the user profile",
          "Document your authentication policy in a one-page memo signed by the owner",
        ],
        capture:
          "Screenshots or photos showing MFA enabled per account, plus the signed authentication policy page.",
        template: {
          filename: "authorized-users-roster.csv",
          label: "Authorized Users Roster (CSV) — fill MFA column",
          description: "Mark Y/N in the MFA Enabled column for each user, attach screenshots showing MFA on, and have the owner sign.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} verified that multifactor authentication is enforced across all user accounts with access to ${ctx.scopedSystems}. Enforcement is applied via tenant-level policy and reviewed during personnel onboarding and the annual compliance review. Evidence of enforcement is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Security Defaults covers users but not every admin scenario — verify legacy auth is blocked",
      "Break-glass / emergency admin accounts are sometimes exempted from MFA — document the exception and the compensating control",
      "Service accounts typically can't use MFA — document them separately with app passwords or managed identities",
    ],
  },
  {
    id: "MP.L1-3.8.3",
    framework: "cmmc_l1",
    domain: "MP",
    shortName: "Media Disposal",
    title:
      "Sanitize or destroy information system media containing Federal Contract Information before disposal or release for reuse",
    farReference: "FAR 52.204-21 (b)(1)(vii)",
    nistReference: "NIST SP 800-171 3.8.3",
    plainEnglish:
      "When you throw out or reuse a computer, phone, USB drive, or paper file, wipe it or destroy it so the next person can't read what was on it.",
    whyItMatters:
      "Selling an old laptop on eBay without wiping it is the textbook CMMC failure. A written disposal procedure plus a running log is one of the cheapest controls to get right.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Write a one-page 'Media Sanitization Procedure' covering laptops (factory reset or disk wipe tool), phones (factory reset), USB drives (physical destruction), and paper FCI (shredding)",
          "Maintain a disposal log: date, item, serial, sanitization method, person performing, signature",
          "Owner signs the procedure",
        ],
        capture:
          "Signed procedure + the current disposal log (photo of page, or PDF export).",
        template: {
          filename: "media-disposal-log.csv",
          label: "Media Disposal Log (CSV)",
          description: "Log every laptop, phone, USB, drive, or paper file you destroy or sanitize. Include sanitization method and a witness signature.",
        },
      },
      {
        provider: "m365",
        label: "Microsoft 365 / Intune",
        steps: [
          "Go to Intune / Endpoint Manager → Devices → retired or wiped devices",
          "Screenshot the wipe history for any retired device that handled FCI",
        ],
        capture:
          "Screenshot of Intune retire/wipe history for decommissioned devices.",
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} affirmed that all information system media containing federal contract information is sanitized or destroyed before disposal or release for reuse. Storage devices are wiped to a documented standard, paper containing FCI is shredded, and each action is recorded in the media disposal log. The current procedure and a representative set of log entries are captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Dumpstering old laptops 'because they were broken anyway' is an automatic finding",
      "Printer and copier hard drives cache documents — include them in the procedure",
      "Personal devices that stored work email count when the person leaves",
    ],
  },
  {
    id: "PE.L1-3.10.1",
    framework: "cmmc_l1",
    domain: "PE",
    shortName: "Limit Physical Access",
    title:
      "Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals",
    farReference: "FAR 52.204-21 (b)(1)(viii)",
    nistReference: "NIST SP 800-171 3.10.1",
    plainEnglish:
      "Only approved people can walk up to the computer, server, or file cabinet that holds contract info. Locked doors, keycards, or a locked office count.",
    whyItMatters:
      "For service-trade contractors this is usually the easiest control — a locked office plus a written list of who has keys is often all that's needed. Don't overthink it.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Walk through every space where contract info is handled — offices, vehicles, storage rooms",
          "Confirm the space can be locked (door lock, keycard, locked cabinet)",
          "Write a one-page list: who has a key or code, when they got it, when they last returned it",
          "Take a clear photo of the locked door or cabinet, and upload the signed key-holder list",
        ],
        capture:
          "Photo of the locked space (door closed, lock visible) + signed key/access list (PDF or photo).",
        template: {
          filename: "physical-access-roster.csv",
          label: "Physical Access Roster (CSV)",
          description: "List every locked space and every person authorized to enter. Pair the completed roster with a photo of the locked door or cabinet.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that physical access to areas containing federal contract information is limited to authorized personnel. Access is controlled via locked entry points; the current list of individuals authorized to hold keys or access credentials is maintained and signed by the owner. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Home offices count — a contractor working from a garage still needs to show the garage locks",
      "Shared office spaces (WeWork, coworking) require a locked cabinet inside the suite",
      "Vehicles used to transport printed contract info need to be listed",
    ],
  },
  {
    id: "PE.L1-3.10.3",
    framework: "cmmc_l1",
    domain: "PE",
    shortName: "Escort Visitors",
    title: "Escort visitors and monitor visitor activity",
    farReference: "FAR 52.204-21 (b)(1)(ix) — escort clause",
    nistReference: "NIST SP 800-171 3.10.3",
    plainEnglish:
      "When a non-employee visits, someone keeps an eye on them the whole time they're near contract info.",
    whyItMatters:
      "This is the most common-sense control and usually the easiest: don't leave a visitor alone near contract info. A short written rule plus a visitor log is enough.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Write a one-page Visitor Escort Policy: non-employees must sign in, be escorted at all times in spaces where FCI is handled, and sign out on departure",
          "Post the policy at the entry to covered spaces",
          "Maintain a visitor log capturing at minimum: date, visitor name, company, purpose, escort, time-in, time-out",
          "Owner signs the policy",
        ],
        capture:
          "Signed policy + a representative recent page of the visitor log.",
        template: {
          filename: "visitor-log.csv",
          label: "Visitor Log (CSV)",
          description: "Print and keep at the entry, or fill digitally — date, name, company, purpose, escort, time-in, time-out.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed a visitor escort policy is in force and acknowledged by all personnel: non-employees are signed in, escorted at all times in spaces where federal contract information is processed or stored, and signed out upon departure. The current policy and a representative sample of recent visitor-log entries are captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "'Just this once' unescorted vendor visits are the usual failure",
      "Cleaning crews and maintenance staff are visitors — include them",
      "Home-office visitors (contractors coming to your house) need the same treatment",
    ],
  },
  {
    id: "PE.L1-3.10.4",
    framework: "cmmc_l1",
    domain: "PE",
    shortName: "Physical Access Logs",
    title: "Maintain audit logs of physical access",
    farReference: "FAR 52.204-21 (b)(1)(ix) — audit log clause",
    nistReference: "NIST SP 800-171 3.10.4",
    plainEnglish:
      "Keep a record (sign-in sheet, keycard log, or camera clips) of who came in and when.",
    whyItMatters:
      "You don't need an enterprise badge system — a notebook at the front door works. What matters is that a record exists and is retained long enough to investigate if something walks off.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Use a visitor sign-in sheet or notebook at each entry to covered spaces",
          "Capture per entry: date, name, company, time-in, time-out, escort",
          "Retain completed sheets for at least one year; scan periodically so the record survives a lost notebook",
          "Photo or scan the current log page as evidence",
        ],
        capture:
          "Photo/scan of the current and a recent prior page of the visitor log.",
        template: {
          filename: "visitor-log.csv",
          label: "Visitor Log (CSV)",
          description: "Same template used for visitor escorts — retain at least one year of entries.",
        },
      },
      {
        provider: "m365",
        label: "Keycard / badge system with tenant integration",
        steps: [
          "If your physical access system is integrated with Entra/AD, export the last 30 days of access events",
          "Screenshot the export and store it with the evidence pack",
        ],
        capture:
          "Exported access-event report (CSV or PDF) plus a screenshot confirming origin.",
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that physical access to spaces containing federal contract information is logged. Visitor sign-in records and, where available, electronic access logs are retained for at least one year. A representative current page of the log is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "A sign-in sheet that never fills up usually means staff stopped using it — the control has to be real",
      "Retention too short (a week or two) doesn't meet the spirit of the control",
      "Paper-only logs can be lost; periodic scans protect the evidence trail",
    ],
  },
  {
    id: "PE.L1-3.10.5",
    framework: "cmmc_l1",
    domain: "PE",
    shortName: "Manage Physical Access",
    title: "Control and manage physical access devices",
    farReference: "FAR 52.204-21 (b)(1)(ix) — access device clause",
    nistReference: "NIST SP 800-171 3.10.5",
    plainEnglish:
      "Know where every key, keycard, fob, and access code is, who has it, and take it back when someone leaves.",
    whyItMatters:
      "Keys, fobs, and door codes need to come back when someone leaves. A spreadsheet of who has what, reviewed at termination, is the control — no hardware investment required.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Maintain an Access Device Register: device ID (key #, fob serial, door code label), holder name, issued date, returned date",
          "Add key/fob/code recovery to your personnel offboarding checklist",
          "Rotate door codes immediately when a holder departs",
          "Owner signs the register and the offboarding checklist",
        ],
        capture:
          "Signed register + signed offboarding checklist (photo or PDF).",
        template: {
          filename: "access-device-register.csv",
          label: "Access Device Register (CSV)",
          description: "Every key, fob, keycard, and door code — who holds it, when issued, when returned. Rotate codes when a holder departs.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} reviewed the access-device register covering keys, keycards, fobs, and door codes for spaces containing federal contract information. Devices are issued against a named individual, logged at issuance and return, and recovered as part of personnel offboarding. The current register and offboarding checklist are captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Door codes that never rotate after a holder departs",
      "'Spare' keys under the mat or shared among staff break the control",
      "Contractor or vendor access devices get missed — include them in the register",
    ],
  },
  {
    id: "SC.L1-3.13.1",
    framework: "cmmc_l1",
    domain: "SC",
    shortName: "Boundary Protection",
    title:
      "Monitor, control, and protect organizational communications (i.e., information transmitted or received by organizational information systems) at the external boundaries and key internal boundaries of the information systems",
    farReference: "FAR 52.204-21 (b)(1)(x)",
    nistReference: "NIST SP 800-171 3.13.1",
    plainEnglish:
      "Put a firewall (or equivalent) between your network and the internet, and between sensitive and non-sensitive parts of your network.",
    whyItMatters:
      "The router your ISP gave you usually has a firewall — the question is whether it's configured and documented. Primes want to see that you know where your boundary is and that traffic is controlled at it.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft Defender for Endpoint / Windows Firewall",
        steps: [
          "Go to Microsoft Defender portal → Endpoint security → Firewall",
          "Screenshot the firewall policy showing it is applied to all in-scope devices",
          "For a representative device, screenshot Windows Security → Firewall & network protection showing Domain/Private/Public profiles all enabled",
        ],
        capture:
          "Policy screenshot plus per-device firewall status.",
      },
      {
        provider: "aws",
        label: "AWS",
        steps: [
          "Go to VPC → Security Groups attached to the VPC containing FCI",
          "Screenshot the inbound and outbound rule tables",
          "If Network ACLs or AWS Network Firewall are in use, screenshot those too",
        ],
        capture:
          "Screenshots of security group / NACL rule sets governing the FCI VPC.",
      },
      {
        provider: "manual",
        label: "Small office / home office",
        steps: [
          "Draw a simple network diagram: internet → firewall/router → internal devices",
          "Photograph the firewall/router appliance with its status LEDs visible",
          "Log into the router admin page and screenshot the firewall settings showing it is enabled and the default admin password has been changed",
        ],
        capture:
          "Network diagram + router admin screenshot + device photo.",
        template: {
          filename: "network-boundary-inventory.csv",
          label: "Network Boundary Inventory (CSV)",
          description: "List every router, firewall, VPN, and Wi-Fi network. Confirm default admin passwords are changed and firewalls are enabled. Includes a small ASCII network diagram you can adapt.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that network boundary protection is in place between ${ctx.scopedSystems} and external networks. A firewall (or equivalent boundary control) is configured to monitor and restrict inbound and outbound traffic, with its current rule set documented. A network diagram together with a screenshot of the current boundary configuration is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Default ISP router with the factory admin password unchanged is the most common fail",
      "A VPN alone is not a boundary control — document both the boundary and the VPN",
      "Home-office networks need the same treatment if work happens there",
    ],
  },
  {
    id: "SC.L1-3.13.5",
    framework: "cmmc_l1",
    domain: "SC",
    shortName: "Public-Access System Separation",
    title:
      "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks",
    farReference: "FAR 52.204-21 (b)(1)(xi)",
    nistReference: "NIST SP 800-171 3.13.5",
    plainEnglish:
      "If you run public-facing systems (a website, customer portal), keep them on a separate network segment from your internal/contract systems.",
    whyItMatters:
      "Small contractors usually don't run their own public systems — the marketing site lives at Squarespace, Wix, or GoDaddy. If that's true, say so explicitly; the separation is already met by the hosting architecture.",
    providerGuidance: [
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "List every public-facing system your company operates (website, contact form, customer portal)",
          "For each, note where it is hosted and confirm it is on infrastructure separate from internal FCI systems",
          "If all public systems are externally hosted SaaS (Squarespace, Wix, Shopify, etc.), state that plainly in a one-page memo",
          "Owner signs the inventory and separation memo",
        ],
        capture:
          "Signed inventory + separation memo (PDF or photo).",
        template: {
          filename: "external-systems-inventory.csv",
          label: "External Systems Inventory (CSV) — public column",
          description: "Fill the Public-Facing column for each system. If all public systems are vendor-hosted SaaS (Squarespace, Wix, etc.), say so explicitly.",
        },
      },
      {
        provider: "aws",
        label: "AWS",
        steps: [
          "Produce a VPC diagram showing public subnets separate from private subnets that hold FCI",
          "Screenshot the Route Tables and Security Groups showing private subnets are not directly reachable from the internet",
        ],
        capture:
          "VPC diagram + routing/security-group evidence of separation.",
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that any publicly accessible system components are logically or physically separated from internal networks and systems that handle federal contract information. Where public services are relied upon, they run on vendor-hosted infrastructure entirely separate from the internal systems in scope. The current inventory and separation statement is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Running your company website on the same server as your file share is an immediate finding",
      "WordPress on shared hosting alongside a file store — separate them",
      "If truly separate because of SaaS, document it explicitly rather than leaving it implied",
    ],
  },
  {
    id: "SI.L1-3.14.1",
    framework: "cmmc_l1",
    domain: "SI",
    shortName: "Flaw Remediation",
    title:
      "Identify, report, and correct information and information system flaws in a timely manner",
    farReference: "FAR 52.204-21 (b)(1)(xii)",
    nistReference: "NIST SP 800-171 3.14.1",
    plainEnglish:
      "When your software or computers have security updates available, install them — and keep a log showing you did.",
    whyItMatters:
      "'I installed updates' without proof isn't enough. A screenshot of update history, a patch log, or an endpoint-management dashboard showing patched devices all work — pick one and be consistent.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365 / Intune",
        steps: [
          "Go to Intune / Endpoint Manager → Reports → Device compliance or Update compliance",
          "Screenshot the dashboard showing devices patched within policy",
          "Also screenshot the Update rings / policies page showing the patch cadence",
        ],
        capture:
          "Dashboard screenshot plus update-policy screenshot.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace",
        steps: [
          "Go to admin.google.com → Devices → Endpoints or Chrome devices",
          "Screenshot the OS / browser version report",
          "For managed ChromeOS, screenshot the auto-update policy",
        ],
        capture:
          "Device version report + auto-update policy.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "Maintain a patch log: date / device / update installed / performed by",
          "For each endpoint in scope, periodically screenshot Windows Update history (or macOS equivalent) and attach to the log",
          "Write a short patching policy: critical updates within 30 days, others at least monthly; owner signs",
        ],
        capture:
          "Signed patching policy + patch log + recent update-history screenshots.",
        template: {
          filename: "patch-log.csv",
          label: "Patch Log (CSV)",
          description: "Date, device, update installed, who installed it. Includes the policy line: critical within 30 days, others at least monthly.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that information and information-system flaws are identified, reported, and corrected on a defined cadence. Operating systems, browsers, and applications on scoped systems receive security updates at least monthly, with critical updates applied sooner, and the status of patched devices is recorded. The current patch-status evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "'Windows auto-updates' with no dashboard or log leaves you with nothing to show",
      "End-of-life software (Windows 7, old Office versions) on any in-scope device is an automatic finding",
      "Mobile devices with work access often get forgotten — include them",
    ],
  },
  {
    id: "SI.L1-3.14.2",
    framework: "cmmc_l1",
    domain: "SI",
    shortName: "Malicious Code Protection",
    title:
      "Provide protection from malicious code at appropriate locations within organizational information systems",
    farReference: "FAR 52.204-21 (b)(1)(xiii)",
    nistReference: "NIST SP 800-171 3.14.2",
    plainEnglish:
      "Run antivirus / anti-malware on your computers and email server.",
    whyItMatters:
      "Defender is built into Windows and is sufficient for L1 if it's actually on. macOS has XProtect. The question primes ask: show me it's running on every covered device.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365 / Defender",
        steps: [
          "Go to security.microsoft.com → Assets → Devices",
          "Screenshot the inventory showing antivirus status per device",
          "For a representative device, screenshot Windows Security → Virus & threat protection showing it is active",
        ],
        capture:
          "Device-inventory screenshot plus per-device protection status.",
      },
      {
        provider: "google_workspace",
        label: "Google Workspace (ChromeOS)",
        steps: [
          "Go to admin.google.com → Devices → Chrome → Settings → Users & browsers",
          "Screenshot Safe Browsing enforcement and download-protection settings",
        ],
        capture:
          "Screenshot of Safe Browsing and download-protection enforcement.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "For every endpoint in scope, take a screenshot of the antivirus product showing real-time protection is on",
          "Maintain a short device inventory that names the AV product installed on each device",
          "If email is hosted by a provider with built-in scanning (e.g., Microsoft 365, Google Workspace), capture a screenshot of that setting too",
        ],
        capture:
          "Signed device/AV inventory + per-device AV screenshots + email-scanning evidence.",
        template: {
          filename: "endpoint-av-inventory.csv",
          label: "Endpoint AV Inventory (CSV)",
          description: "Every device in scope, the AV product, and whether real-time protection is on. Pair with per-device screenshots.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that malicious-code protection is installed and active at appropriate locations within ${ctx.scopedSystems}, including endpoints and email. Per-device evidence or a centralized protection dashboard confirms that antivirus/anti-malware is running on every device in scope. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Defender silently disables when a third-party AV is installed then uninstalled without cleanup — verify",
      "Personal devices used for work email need AV coverage if they are in scope",
      "Servers often have no AV installed; desktop coverage doesn't extend to them by default",
    ],
  },
  {
    id: "SI.L1-3.14.4",
    framework: "cmmc_l1",
    domain: "SI",
    shortName: "Update Malicious Code Protection",
    title:
      "Update malicious code protection mechanisms when new releases are available",
    farReference: "FAR 52.204-21 (b)(1)(xiv)",
    nistReference: "NIST SP 800-171 3.14.4",
    plainEnglish:
      "Keep your antivirus current — turn on automatic updates so it downloads new definitions.",
    whyItMatters:
      "Definitions from 2023 are the same as having no AV. Show automatic updates are enabled and that the latest definition date is recent.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365 / Defender",
        steps: [
          "Go to security.microsoft.com → Assets → Devices",
          "Screenshot the device inventory showing 'Security intelligence version' and last-update timestamp per device",
          "Open the Defender antivirus policy and screenshot the automatic-update setting",
        ],
        capture:
          "Per-device definition-version report + policy screenshot showing auto-update.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "On each endpoint, open the AV product and screenshot the 'definitions up to date' page showing a current timestamp",
          "Add a short line to your AV policy memo: 'Automatic updates are enabled on all endpoints.' Owner signs",
        ],
        capture:
          "Per-device screenshots with current timestamps + signed policy memo.",
        template: {
          filename: "endpoint-av-inventory.csv",
          label: "Endpoint AV Inventory (CSV) — definition date column",
          description: "Same inventory used for AV protection — fill the Definition Date column to show definitions are current.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that malicious-code protection mechanisms update their definitions automatically as new releases become available. Each device in scope shows a current definition version and a recent update timestamp. Evidence is captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "AV showing 'definitions 14 days old' on an always-on machine means auto-update is broken",
      "Offline / field laptops are the common gap — document how they update when reconnected",
      "Expired AV licenses silently stop updates — check license status as well as the auto-update toggle",
    ],
  },
  {
    id: "SI.L1-3.14.5",
    framework: "cmmc_l1",
    domain: "SI",
    shortName: "System & File Scanning",
    title:
      "Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened, or executed",
    farReference: "FAR 52.204-21 (b)(1)(xv)",
    nistReference: "NIST SP 800-171 3.14.5",
    plainEnglish:
      "Run full scans regularly, and have antivirus inspect files the moment they're downloaded or opened.",
    whyItMatters:
      "Real-time protection on plus a scheduled full scan at least weekly is the industry-standard baseline. Screenshot both settings and a recent successful scan.",
    providerGuidance: [
      {
        provider: "m365",
        label: "Microsoft 365 / Defender",
        steps: [
          "Go to Defender antivirus policy and screenshot the real-time protection and scheduled-scan settings",
          "For a representative device, screenshot Windows Security → Virus & threat protection → Scan options / scan history showing a recent full scan completed",
        ],
        capture:
          "Policy screenshot + recent scan-history screenshot.",
      },
      {
        provider: "manual",
        label: "Any business",
        steps: [
          "On each endpoint, open the AV product settings and screenshot: real-time protection enabled, scheduled scan configured at least weekly",
          "Screenshot the latest completed scan (date + result)",
          "Ensure scheduled scans fall when devices are powered on (don't schedule at 2am if laptops are asleep)",
        ],
        capture:
          "Per-device settings screenshots + last-scan screenshots.",
        template: {
          filename: "endpoint-av-inventory.csv",
          label: "Endpoint AV Inventory (CSV) — last-scan column",
          description: "Same inventory — fill the Last Full Scan Date and Scan Frequency columns to show scheduled scanning is in place.",
        },
      },
    ],
    suggestedNarrative: (ctx) =>
      `On ${ctx.capturedAt}, ${ctx.companyName} confirmed that scoped systems perform real-time scanning of files from external sources at the moment they are downloaded, opened, or executed, and that periodic full-system scans run on at least a weekly basis. Settings screenshots together with a recent scan-history record are captured in artifact ${ctx.artifactFilename}.`,
    commonGotchas: [
      "Real-time protection turned off 'because it was slowing the machine down' is a classic failure",
      "Scheduled scans that never run because the device is asleep — pick a time devices are on",
      "Quarantine/review is often skipped for months — document who reviews detections",
    ],
  },
];

export const playbookById: Record<string, ControlPlaybook> = Object.fromEntries(
  playbook.map((p) => [p.id, p]),
);

export const practiceCount = playbook.length;

// Framework-aware helpers. Today we only ship CMMC L1 practices; when L2 lands,
// add entries with framework: "cmmc_l2" above and these helpers automatically
// filter correctly. Do NOT special-case L2 anywhere else in the codebase.
export function getPlaybookForFramework(
  framework: Framework,
): ControlPlaybook[] {
  return playbook.filter((p) => p.framework === framework);
}

export function getPracticeCount(framework: Framework): number {
  return getPlaybookForFramework(framework).length;
}

export function getControlDomainsForFramework(
  framework: Framework,
): readonly ControlDomain[] {
  const entries = getPlaybookForFramework(framework);
  const seen = new Set<ControlDomain>();
  for (const p of entries) seen.add(p.domain);
  return controlDomains.filter((d) => seen.has(d));
}
