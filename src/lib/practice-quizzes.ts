/**
 * Per-practice interactive quiz. Charlie walks the user through one
 * question at a time, branching based on their answers. Each step
 * either records a free-form answer OR collects evidence through one
 * of four paths:
 *
 *   1. Connect a provider (M365 / Google Workspace) — Charlie auto-pulls
 *   2. Download a CSV template — fill, re-upload
 *   3. Fill in the Vault — structured form, server generates a CSV artifact
 *   4. Upload an existing file
 *
 * Each step maps to one or more NIST 800-171A objective letters so the
 * final SSP can show formal traceability.
 *
 * Source of truth for content: CMMC L1 v2.0 Self-Assessment Guide.
 */

import type { ConnectorProvider } from "@/lib/connectors/types";

export type ChoiceTone = "ok" | "warn" | "danger" | "neutral";

export type Choice = {
  value: string;
  label: string;
  /** sub-line explaining the choice in plain English */
  hint?: string;
  tone?: ChoiceTone;
  /** which objective(s) this answer satisfies */
  satisfies?: string[];
  /** which objective(s) this answer puts at risk (NOT MET) */
  failsObjectives?: string[];
  /** Charlie's reaction shown after the user picks this */
  charlieReaction?: string;
  /** if set, the user is shown an inline note (e.g. remediation hint) */
  remediationHint?: string;
};

export type EvidencePath =
  | {
      kind: "connector";
      provider: ConnectorProvider;
      label: string;
      hint: string;
    }
  | {
      kind: "template";
      filename: string;
      label: string;
      hint: string;
    }
  | {
      kind: "vault";
      label: string;
      hint: string;
      /** schema for the inline form */
      formId: string;
    }
  | {
      kind: "upload";
      label: string;
      hint: string;
    };

export type VaultFieldType = "text" | "email" | "date" | "select";

export type VaultField = {
  key: string;
  label: string;
  type: VaultFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type VaultForm = {
  id: string;
  /** title shown above the form (e.g. "Authorized Users") */
  title: string;
  /** filename to use when generating the CSV (without extension) */
  filenameStem: string;
  /** column order for the CSV header */
  fields: VaultField[];
  /** allow adding multiple rows? */
  repeating: boolean;
  /** after submit, what objectives does this satisfy? */
  satisfies: string[];
};

export type QuizStep =
  | {
      id: string;
      kind: "intro";
      charlieSays: string;
      ctaLabel: string;
    }
  | {
      id: string;
      kind: "multiple_choice";
      charlieSays: string;
      stem?: string;
      choices: Choice[];
      /** persist the chosen value under this key on the quiz state */
      saveKey: string;
    }
  | {
      id: string;
      kind: "evidence_picker";
      charlieSays: string;
      stem?: string;
      paths: EvidencePath[];
      /** which objective(s) get marked as satisfied once at least one
       *  path produces an artifact. */
      satisfies: string[];
      /** allow user to skip with reason (recorded as objective at risk) */
      allowSkip?: boolean;
      skipLabel?: string;
    }
  | {
      id: string;
      kind: "summary";
      charlieSays: string;
    };

export type PracticeQuiz = {
  controlId: string;
  /** total estimated minutes — shown at the top */
  estimatedMinutes: number;
  /** the "what is this practice protecting" 1-liner shown in header */
  oneLiner: string;
  /** which connector providers (if connected) can auto-pull evidence
   *  for this practice on the free tier. Drives the ConnectorPill next
   *  to the MET/NOT MET badge in the sticky header. */
  connectors?: ConnectorProvider[];
  steps: QuizStep[];
  /** named vault forms referenced by evidence_picker steps */
  vaultForms: Record<string, VaultForm>;
};

export const practiceQuizzes: Record<string, PracticeQuiz> = {
  "AC.L1-3.1.1": {
    controlId: "AC.L1-3.1.1",
    estimatedMinutes: 8,
    oneLiner:
      "Only people you've approved should be able to sign in to systems that touch Federal Contract Information.",
    connectors: ["m365", "google_workspace"],
    vaultForms: {
      authorized_users: {
        id: "authorized_users",
        title: "Authorized Users Roster",
        filenameStem: "authorized-users-roster",
        repeating: true,
        satisfies: ["a", "d"],
        fields: [
          { key: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith" },
          { key: "email", label: "Email / username", type: "email", required: true, placeholder: "jane@company.com" },
          { key: "role", label: "Role", type: "text", required: true, placeholder: "Project Manager" },
          {
            key: "system",
            label: "System",
            type: "select",
            required: true,
            options: ["Microsoft 365", "Google Workspace", "On-premises Active Directory", "File server", "Other"],
          },
          { key: "authorized_on", label: "Authorized on", type: "date", required: true },
        ],
      },
      service_accounts: {
        id: "service_accounts",
        title: "Service Accounts & Automated Processes",
        filenameStem: "service-accounts-roster",
        repeating: true,
        satisfies: ["b", "e"],
        fields: [
          { key: "name", label: "Account / process name", type: "text", required: true, placeholder: "svc-backup" },
          { key: "purpose", label: "What it does", type: "text", required: true, placeholder: "Nightly Veeam backup of file server" },
          { key: "runs_on", label: "Runs on", type: "text", required: true, placeholder: "Backup server / Power Automate / OneDrive" },
          { key: "owner", label: "Owner / responsible person", type: "text", required: true, placeholder: "IT lead — Mark Lee" },
        ],
      },
      authorized_devices: {
        id: "authorized_devices",
        title: "Authorized Devices Inventory",
        filenameStem: "authorized-devices-inventory",
        repeating: true,
        satisfies: ["c", "f"],
        fields: [
          { key: "device_name", label: "Device name / asset tag", type: "text", required: true, placeholder: "LAPTOP-JS-001" },
          {
            key: "type",
            label: "Type",
            type: "select",
            required: true,
            options: ["Laptop", "Desktop", "Phone", "Tablet", "Server", "Printer", "Other"],
          },
          { key: "owner", label: "Assigned to", type: "text", required: true, placeholder: "Jane Smith" },
          {
            key: "managed",
            label: "Company-managed?",
            type: "select",
            required: true,
            options: ["Yes — Intune/MDM enrolled", "Yes — domain joined", "BYOD — policy enforced", "No"],
          },
          { key: "issued_on", label: "Issued on", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "Hi — I'm Charlie. Let's walk through **AC.L1-3.1.1: Authorized Access Control** together. About 8 minutes. I'll ask plain-English questions; you pick the answer that fits your business and we'll collect proof as we go. Anything I gather goes into your evidence vault for the assessor.\n\nThe goal of this practice: only people **you've approved** can sign in to systems where Federal Contract Information lives. That means a current list of users, devices, and automated processes — and the system actually enforcing it.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "systems",
        kind: "multiple_choice",
        charlieSays:
          "First, where does your team work with Federal Contract Information today? (Email, contract documents, drawings, internal threads about the contract.) Pick the closest match.",
        saveKey: "systems",
        choices: [
          {
            value: "m365",
            label: "Microsoft 365 (email, SharePoint, OneDrive, Teams)",
            hint: "Most common for small Department of Defense primes and subcontractors.",
            tone: "neutral",
            charlieReaction: "Nice — Microsoft 365 makes the next steps easy. I can pull most of this directly if you connect your tenant.",
          },
          {
            value: "google_workspace",
            label: "Google Workspace (Gmail, Drive, Docs)",
            hint: "Same idea — we'll pull from your Workspace admin.",
            tone: "neutral",
            charlieReaction: "Got it. Workspace is fully supported — you can connect it for auto-pull.",
          },
          {
            value: "both",
            label: "Both — different teams use different tools",
            hint: "We'll cover both; you'll need a roster from each.",
            tone: "neutral",
            charlieReaction: "OK, we'll collect from both. Common for acquired companies or split teams.",
          },
          {
            value: "on_prem",
            label: "On-premises only — file server or Active Directory",
            hint: "No cloud. We'll generate the documentation.",
            tone: "neutral",
            charlieReaction: "OK — we can't auto-pull on-premises systems, but we'll build proper documentation in the Vault.",
          },
          {
            value: "mix",
            label: "Mix of cloud and on-premises",
            hint: "Common for shops with cloud email plus a local file server.",
            tone: "neutral",
            charlieReaction: "Mix it is. We'll need to cover both surfaces.",
          },
        ],
      },
      {
        id: "users_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now let's get your **authorized users list**. This is the first document a Third-Party Assessment Organization will look at. Pick whichever path is fastest for you — they all produce a roster the assessor will accept.",
        stem: "Authorized users (objective [a] + [d])",
        satisfies: ["a", "d"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365",
            hint: "Charlie auto-collects every active Microsoft 365 user. About 30 seconds if your tenant is connected.",
          },
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Pull from Google Workspace",
            hint: "Same idea — Charlie pulls your Workspace directory.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Type each user once and we generate a clean, signed spreadsheet stored in your evidence vault.",
            formId: "authorized_users",
          },
          {
            kind: "template",
            filename: "authorized-users-roster.csv",
            label: "Download spreadsheet template",
            hint: "Open in Excel or Google Sheets, fill it in, drop it back here.",
          },
          {
            kind: "upload",
            label: "I already have a roster — upload it",
            hint: "Image, PDF, spreadsheet, or Word document — all work.",
          },
        ],
      },
      {
        id: "service_accounts_q",
        kind: "multiple_choice",
        charlieSays:
          "Do you use any **service accounts or automated processes** that sign in to your systems? (Things like a backup tool, a Microsoft Power Automate flow, OneDrive sync, or an integration that uses its own credentials.)",
        saveKey: "service_accounts",
        choices: [
          {
            value: "yes_documented",
            label: "Yes — and we know what they are",
            tone: "ok",
            charlieReaction: "Good. Let's record them so they're in the vault next to your user roster.",
          },
          {
            value: "yes_unsure",
            label: "Yes, but I'm not sure exactly what's running",
            tone: "warn",
            charlieReaction: "That's normal. Let's list the obvious ones (backup, antivirus, sync) and I'll help you add others later.",
          },
          {
            value: "no",
            label: "No — only people sign in",
            hint: "Pretty rare. Even OneDrive sync counts.",
            tone: "neutral",
            charlieReaction: "OK — we'll attest to that. If something turns up later you can add it.",
          },
        ],
      },
      {
        id: "service_accounts_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Let's record those. One row per service account or automated process — name, what it does, who owns it.",
        stem: "Service accounts & automated processes (objective [b] + [e])",
        satisfies: ["b", "e"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Quick form — typical small-business list is 3 to 5 rows.",
            formId: "service_accounts",
          },
          {
            kind: "upload",
            label: "Upload an existing list",
            hint: "Spreadsheet, document, or screenshot is fine.",
          },
        ],
        allowSkip: true,
        skipLabel: "Skip — we said no service accounts",
      },
      {
        id: "devices_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now devices. The Cybersecurity Maturity Model Certification wants to know which **laptops, phones, and other devices** are allowed to access company systems. Same options as before — pick what's fastest.",
        stem: "Authorized devices (objective [c] + [f])",
        satisfies: ["c", "f"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft Intune or Microsoft 365",
            hint: "If you use Microsoft Intune or Conditional Access, Charlie can pull the device list.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Quick inventory — 1 row per device, who has it, whether it's company-managed.",
            formId: "authorized_devices",
          },
          {
            kind: "template",
            filename: "access-device-register.csv",
            label: "Download spreadsheet template",
            hint: "For larger fleets — fill offline and upload.",
          },
          {
            kind: "upload",
            label: "Upload an existing inventory",
            hint: "Asset list, mobile device management export, or screenshot.",
          },
        ],
      },
      {
        id: "offboarding",
        kind: "multiple_choice",
        charlieSays:
          "When someone **leaves your company** (or stops needing access), what happens to their account?",
        saveKey: "offboarding",
        choices: [
          {
            value: "same_day",
            label: "Disabled the same day — we have a checklist",
            tone: "ok",
            satisfies: ["d"],
            charlieReaction: "That's exactly what CMMC wants. We'll record this in your attestation.",
          },
          {
            value: "within_week",
            label: "Within a week — informal but it gets done",
            tone: "warn",
            charlieReaction: "Acceptable — but write it down. I'll help you draft a 5-line offboarding checklist for the vault.",
            remediationHint:
              "We'll add a quick offboarding checklist to your evidence vault so this is a documented procedure.",
          },
          {
            value: "eventually",
            label: "Eventually — no formal process",
            tone: "danger",
            failsObjectives: ["d"],
            charlieReaction: "That's a finding waiting to happen. We'll mark this NOT MET for now and put a fix on your remediation list.",
            remediationHint:
              "Action: build a one-page offboarding procedure. Disable account, remove from groups, collect device, sign and date. Charlie can draft this.",
          },
        ],
      },
      {
        id: "device_enforcement",
        kind: "multiple_choice",
        charlieSays:
          "Last question. Can someone sign in to your company systems from a **personal or random device** with just a username and password? Or do you require a managed device (Conditional Access, mobile device management, virtual private network certificate)?",
        saveKey: "device_enforcement",
        choices: [
          {
            value: "managed_only",
            label: "Managed devices only — Conditional Access, mobile device management, or virtual private network certificate",
            tone: "ok",
            satisfies: ["f"],
            charlieReaction: "That's the gold standard. A screenshot of your Conditional Access policy will lock objective [f] in.",
          },
          {
            value: "mfa_only",
            label: "Multi-factor authentication on every login, but personal devices are allowed",
            tone: "warn",
            charlieReaction: "Multi-factor authentication is great for objective [a] but not for [f]. We'll note this and add device enforcement to your roadmap.",
            remediationHint:
              "Action: turn on Conditional Access (Microsoft 365) or Context-Aware Access (Google Workspace) requiring a compliant or hybrid-joined device.",
          },
          {
            value: "open",
            label: "Just username and password from anywhere",
            tone: "danger",
            failsObjectives: ["f"],
            charlieReaction: "We'll flag this as NOT MET for objective [f]. Big-impact fix though — turning on multi-factor authentication and device-required policies takes about an hour.",
            remediationHint:
              "Action: enable multi-factor authentication plus Conditional Access (Microsoft 365) or Context-Aware Access (Google Workspace) this week. Charlie can write the policy and walk through the admin steps.",
          },
          {
            value: "not_sure",
            label: "I'm not sure",
            tone: "neutral",
            charlieReaction: "No problem. Open me in the chat panel on the right and I'll check your tenant settings with you.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Here's where we landed. Lock it in and we'll move to the next practice.",
      },
    ],
  },

  // ===================================================================
  // AC.L1-3.1.2  Transaction & Function Control
  // Limit system access to the types of transactions and functions
  // authorized users are permitted to execute.
  // ===================================================================
  "AC.L1-3.1.2": {
    controlId: "AC.L1-3.1.2",
    estimatedMinutes: 6,
    oneLiner:
      "Each role in your company should only be able to do what their job actually requires.",
    connectors: ["m365", "google_workspace"],
    vaultForms: {
      role_matrix: {
        id: "role_matrix",
        title: "Role and Permission Matrix",
        filenameStem: "role-permission-matrix",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "role", label: "Role / job title", type: "text", required: true, placeholder: "Project Manager" },
          { key: "system", label: "System", type: "text", required: true, placeholder: "Microsoft 365 / SharePoint" },
          { key: "permitted", label: "Allowed actions", type: "text", required: true, placeholder: "Read and edit contract folder; cannot delete" },
          { key: "owner", label: "Approved by", type: "text", required: true, placeholder: "IT lead — Mark Lee" },
          { key: "reviewed_on", label: "Last reviewed", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "Quick one. **AC.L1-3.1.2** is about making sure each role only has the permissions they actually need. A junior engineer shouldn't be able to delete the entire contract folder, for example. We'll capture who can do what and call it done.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "permissions_model",
        kind: "multiple_choice",
        charlieSays:
          "How are permissions assigned in your systems today?",
        saveKey: "permissions_model",
        choices: [
          {
            value: "groups",
            label: "Group-based — people inherit permissions from their team or role",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Group-based is exactly what an assessor wants to see.",
          },
          {
            value: "per_user",
            label: "Per user — we add permissions one person at a time",
            tone: "warn",
            charlieReaction: "Workable but harder to defend. We'll record what you have today.",
          },
          {
            value: "informal",
            label: "Honestly, no formal model — admins just have access",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "That's a finding. We'll mark this NOT MET and put a fix on your roadmap.",
            remediationHint:
              "Action: define 3 to 5 standard roles (admin, editor, viewer) and move users into groups that match. Charlie can draft the role definitions for you.",
          },
        ],
      },
      {
        id: "matrix_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now let's get the matrix down — one row per role, what systems they touch, what they're allowed to do.",
        stem: "Role and Permission Matrix (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365",
            hint: "Charlie pulls every group, its members, and assigned roles. Auto-formats into a matrix.",
          },
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Pull from Google Workspace",
            hint: "Charlie pulls Workspace groups, organizational units, and admin role assignments.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Type each role once. Five rows usually covers a small business.",
            formId: "role_matrix",
          },
          {
            kind: "template",
            filename: "role-matrix.csv",
            label: "Download spreadsheet template",
            hint: "Open in Excel or Google Sheets, fill it in, drop it back here.",
          },
          {
            kind: "upload",
            label: "Upload an existing matrix",
            hint: "Spreadsheet, document, or screenshot is fine.",
          },
        ],
      },
      {
        id: "review_cadence",
        kind: "multiple_choice",
        charlieSays:
          "Last question. How often do you review these permissions to catch people who don't need them anymore?",
        saveKey: "review_cadence",
        choices: [
          {
            value: "quarterly",
            label: "Quarterly or more often",
            tone: "ok",
            charlieReaction: "Excellent. Quarterly is the recommended cadence.",
          },
          {
            value: "annually",
            label: "Once a year",
            tone: "ok",
            charlieReaction: "Acceptable for Cybersecurity Maturity Model Certification Level 1.",
          },
          {
            value: "never",
            label: "We don't do formal reviews",
            tone: "warn",
            charlieReaction: "Not a fail by itself, but worth scheduling. I'll add an annual reminder to your calendar.",
            remediationHint:
              "Charlie can email a quarterly access-review reminder to your IT lead and ask for a sign-off in the Vault.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Your role matrix is now in your evidence vault and ready for the assessor.",
      },
    ],
  },

  // ===================================================================
  // AC.L1-3.1.20  External Connections
  // Verify and control connections to and use of external systems.
  // ===================================================================
  "AC.L1-3.1.20": {
    controlId: "AC.L1-3.1.20",
    estimatedMinutes: 5,
    oneLiner:
      "Every outside system that connects into yours should be on a list and approved.",
    connectors: ["m365", "google_workspace"],
    vaultForms: {
      external_systems: {
        id: "external_systems",
        title: "External Systems and Connections Inventory",
        filenameStem: "external-systems-inventory",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "vendor", label: "Vendor / partner name", type: "text", required: true, placeholder: "Acme Logistics" },
          { key: "system", label: "External system", type: "text", required: true, placeholder: "Acme Carrier Portal" },
          { key: "data_shared", label: "Data shared", type: "text", required: true, placeholder: "Shipping addresses, tracking" },
          { key: "method", label: "Connection method", type: "text", required: true, placeholder: "REST API key / OAuth / VPN tunnel" },
          { key: "approved_by", label: "Approved by", type: "text", required: true, placeholder: "IT lead — Mark Lee" },
          { key: "approved_on", label: "Approved on", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**AC.L1-3.1.20** asks: what other companies' systems connect into yours, and did you approve each one? Think vendor portals, API integrations, partner shared folders. We'll inventory them.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "have_externals",
        kind: "multiple_choice",
        charlieSays:
          "Do any external systems (vendors, partners, integrations) connect to your systems today?",
        saveKey: "have_externals",
        choices: [
          {
            value: "yes",
            label: "Yes — we use vendor portals or integrations",
            tone: "neutral",
            charlieReaction: "Common. Let's get them on paper.",
          },
          {
            value: "no",
            label: "No — we don't share systems with anyone",
            hint: "Rare. Even an OAuth connection to a third-party app counts.",
            tone: "neutral",
            satisfies: ["a", "b"],
            charlieReaction: "Then we'll attest to that. If something gets added later you can update the inventory.",
          },
        ],
      },
      {
        id: "externals_evidence",
        kind: "evidence_picker",
        charlieSays:
          "List every outside system that connects into yours. Vendor portals, OAuth-connected apps, partner shared folders, anything with its own credentials.",
        stem: "External systems and connections (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365",
            hint: "Charlie pulls every third-party app you've granted access to via OAuth.",
          },
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Pull from Google Workspace",
            hint: "Charlie pulls connected third-party apps from your Workspace token report.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per vendor or system that connects in.",
            formId: "external_systems",
          },
          {
            kind: "template",
            filename: "external-systems-inventory.csv",
            label: "Download spreadsheet template",
            hint: "Fill it offline and drop it back.",
          },
          {
            kind: "upload",
            label: "Upload an existing list",
            hint: "Vendor management list, contract list, or screenshot.",
          },
        ],
        allowSkip: true,
        skipLabel: "Skip — we said no external systems",
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Your external systems inventory is ready for the assessor.",
      },
    ],
  },

  // ===================================================================
  // AC.L1-3.1.22  Public Information
  // Control information posted or processed on publicly accessible systems.
  // ===================================================================
  "AC.L1-3.1.22": {
    controlId: "AC.L1-3.1.22",
    estimatedMinutes: 6,
    oneLiner:
      "Only authorized people should be able to publish to your website, social media, or other public places — and never publish anything that should be controlled.",
    connectors: ["google_workspace"],
    vaultForms: {
      public_publishers: {
        id: "public_publishers",
        title: "Authorized Public Publishers Roster",
        filenameStem: "public-posting-acknowledgement",
        repeating: true,
        satisfies: ["b", "c"],
        fields: [
          { key: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith" },
          { key: "role", label: "Role", type: "text", required: true, placeholder: "Marketing manager" },
          {
            key: "channel",
            label: "Channel",
            type: "select",
            required: true,
            options: ["Company website", "LinkedIn", "Other social", "Press / media", "Blog", "Other"],
          },
          { key: "ack_date", label: "Acknowledgement signed on", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**AC.L1-3.1.22** is about controlling what gets posted publicly. The risk is someone accidentally publishing Federal Contract Information on your website or LinkedIn. We need a list of who's allowed to publish, and a quick acknowledgement they understand the rules.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "publishes",
        kind: "multiple_choice",
        charlieSays:
          "Do you publish content publicly (company website, social media, press releases)?",
        saveKey: "publishes",
        choices: [
          {
            value: "yes",
            label: "Yes",
            tone: "neutral",
            charlieReaction: "OK — we'll list who's allowed to publish.",
          },
          {
            value: "no",
            label: "No public-facing publishing",
            tone: "neutral",
            satisfies: ["a", "b", "c"],
            charlieReaction: "Then we'll attest to that. The control still applies if you ever start publishing.",
          },
        ],
      },
      {
        id: "review_process",
        kind: "multiple_choice",
        charlieSays:
          "Before something goes public, who reviews it for sensitive content?",
        saveKey: "review_process",
        choices: [
          {
            value: "owner_review",
            label: "An owner / manager reviews every post",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Good. That's the review step the assessor wants to see.",
          },
          {
            value: "self_review",
            label: "The publisher reviews their own content",
            tone: "warn",
            charlieReaction: "Acceptable but weaker. We'll record this and note an improvement.",
          },
          {
            value: "no_review",
            label: "No formal review",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "That's a finding. Charlie can draft a one-paragraph review process for you.",
            remediationHint:
              "Action: name one person (usually a manager or you) who signs off on public content before it goes out. One-line policy is fine.",
          },
        ],
      },
      {
        id: "publishers_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Last piece — list everyone who's authorized to publish, on which channels.",
        stem: "Authorized publishers (objective [b] + [c])",
        satisfies: ["b", "c"],
        paths: [
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Scan Google Drive for public shares",
            hint: "Charlie scans your Workspace for files shared with anonymous links and flags them.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "List each authorized publisher with the channels they own.",
            formId: "public_publishers",
          },
          {
            kind: "template",
            filename: "public-posting-acknowledgement.csv",
            label: "Download spreadsheet template",
            hint: "Includes a signature column for offline acknowledgements.",
          },
          {
            kind: "upload",
            label: "Upload signed acknowledgements",
            hint: "Scanned signatures or DocuSign export work.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Your public-publishing controls are documented.",
      },
    ],
  },

  // ===================================================================
  // IA.L1-3.5.1  Identification
  // Identify system users, processes acting on behalf of users, and devices.
  // ===================================================================
  "IA.L1-3.5.1": {
    controlId: "IA.L1-3.5.1",
    estimatedMinutes: 4,
    oneLiner:
      "Every person, automated process, and device that signs in needs its own unique identifier — no shared accounts.",
    connectors: ["m365", "google_workspace"],
    vaultForms: {
      identified_users: {
        id: "identified_users",
        title: "Identified Users and Processes",
        filenameStem: "authorized-users-roster",
        repeating: true,
        satisfies: ["a", "b", "c"],
        fields: [
          { key: "identifier", label: "Unique identifier (username / email)", type: "text", required: true, placeholder: "jane@company.com" },
          { key: "kind", label: "Type", type: "select", required: true, options: ["Person", "Service account", "Device"] },
          { key: "owner", label: "Owner / responsible person", type: "text", required: true, placeholder: "Jane Smith" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**IA.L1-3.5.1** is the fastest practice on the list. The rule: every account on every system needs to belong to a specific person, process, or device. **No shared logins.** If you already have your authorized users roster from the access-control practice, this one's almost free.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "shared_accounts",
        kind: "multiple_choice",
        charlieSays:
          "Are there any **shared accounts** in use (multiple people using the same login)?",
        saveKey: "shared_accounts",
        choices: [
          {
            value: "no",
            label: "No — every account belongs to one person or process",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Perfect. That's the bar.",
          },
          {
            value: "yes_planned",
            label: "Yes, but we're working on phasing them out",
            tone: "warn",
            charlieReaction: "Acceptable for now. Charlie will add a remediation item.",
            remediationHint:
              "Action: list the shared accounts in your roster and assign an owner who's responsible for the credential.",
          },
          {
            value: "yes_many",
            label: "Yes — we have several shared logins (front desk, ops mailbox, etc.)",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "This will be a finding. The fix is straightforward — give each person their own account and use a shared mailbox or alias for the team address.",
            remediationHint:
              "Action: convert each shared login to a shared mailbox / group with individual logins. Charlie can write the migration plan.",
          },
        ],
      },
      {
        id: "users_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now let's prove every active identifier belongs to someone or something.",
        stem: "Identified users, processes, and devices (objective [a] + [b] + [c])",
        satisfies: ["a", "b", "c"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365",
            hint: "Pulls every user and service principal with its unique identifier.",
          },
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Pull from Google Workspace",
            hint: "Pulls every Workspace user and service account.",
          },
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Reuse the same list from the access-control practice.",
            formId: "identified_users",
          },
          {
            kind: "template",
            filename: "authorized-users-roster.csv",
            label: "Download spreadsheet template",
            hint: "Same roster format as the access-control practice.",
          },
          {
            kind: "upload",
            label: "Upload existing roster",
            hint: "Reuse the artifact from the access-control practice.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Identification is locked in.",
      },
    ],
  },

  // ===================================================================
  // IA.L1-3.5.2  Authentication
  // Authenticate (or verify) the identities of users, processes, or
  // devices, as a prerequisite to allowing access.
  // ===================================================================
  "IA.L1-3.5.2": {
    controlId: "IA.L1-3.5.2",
    estimatedMinutes: 6,
    oneLiner:
      "Before someone gets in, they have to prove who they are — passwords plus ideally a second factor.",
    connectors: ["m365", "google_workspace"],
    vaultForms: {
      auth_attestation: {
        id: "auth_attestation",
        title: "Authentication Policy Attestation",
        filenameStem: "authentication-attestation",
        repeating: false,
        satisfies: ["a", "b"],
        fields: [
          { key: "system", label: "System covered", type: "text", required: true, placeholder: "Microsoft 365, Google Workspace, file server" },
          {
            key: "mfa",
            label: "Multi-factor authentication enforced?",
            type: "select",
            required: true,
            options: ["Yes — required for all users", "Yes — required for admins only", "No"],
          },
          { key: "min_pw_length", label: "Minimum password length", type: "text", required: true, placeholder: "12" },
          { key: "complexity", label: "Complexity requirements", type: "text", required: true, placeholder: "Uppercase + lowercase + number" },
          { key: "attested_by", label: "Attested by (your name)", type: "text", required: true },
          { key: "attested_on", label: "Date", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**IA.L1-3.5.2** is one of the practices an assessor really wants to see real proof for. **The strongest path is to connect Microsoft 365 or Google Workspace** so I can pull the actual multi-factor authentication enforcement report. Manual works, but you'll need a screenshot of your policy and a signed attestation.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "mfa_state",
        kind: "multiple_choice",
        charlieSays:
          "Is multi-factor authentication turned on for everyone who signs in to systems with Federal Contract Information?",
        saveKey: "mfa_state",
        choices: [
          {
            value: "all",
            label: "Yes — required for everyone, every time",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "That's the bar. Connect your tenant if you can — one-click proof.",
          },
          {
            value: "admins_only",
            label: "Required for admins, optional for everyone else",
            tone: "warn",
            charlieReaction: "Cybersecurity Maturity Model Certification Level 1 expects everyone covered. Strong push to extend to all users this week.",
            remediationHint:
              "Action: turn on Conditional Access (Microsoft 365) or Context-Aware Access (Google Workspace) requiring multi-factor authentication for all users. Charlie can write the policy.",
          },
          {
            value: "off",
            label: "No multi-factor authentication enforced",
            tone: "danger",
            failsObjectives: ["a", "b"],
            charlieReaction: "This will fail the assessment. Multi-factor authentication is a Level 1 expectation. Good news: turning it on takes about an hour.",
            remediationHint:
              "Action: enable multi-factor authentication on Microsoft 365 or Google Workspace this week. Free in both. Charlie walks you through the admin steps.",
          },
        ],
      },
      {
        id: "auth_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Pick how you want to prove it. **Connector is the assessor-preferred path** — one click, real data.",
        stem: "Authentication enforcement (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365 (recommended)",
            hint: "Pulls the multi-factor authentication report from Entra ID. Strongest evidence.",
          },
          {
            kind: "connector",
            provider: "google_workspace",
            label: "Pull from Google Workspace (recommended)",
            hint: "Pulls the 2-Step Verification status report.",
          },
          {
            kind: "vault",
            label: "Sign an attestation (manual fallback)",
            hint: "Charlie generates a signed attestation. Assessor will likely also ask for a screenshot.",
            formId: "auth_attestation",
          },
          {
            kind: "upload",
            label: "Upload a screenshot",
            hint: "Microsoft 365 multi-factor authentication report or Workspace 2-Step Verification report screenshot.",
          },
        ],
      },
      {
        id: "password_policy",
        kind: "multiple_choice",
        charlieSays:
          "What's your minimum password length?",
        saveKey: "password_policy",
        choices: [
          {
            value: "twelve_plus",
            label: "12 characters or more, with complexity",
            tone: "ok",
            charlieReaction: "Strong. That's NIST-aligned.",
          },
          {
            value: "eight_to_eleven",
            label: "8 to 11 characters",
            tone: "warn",
            charlieReaction: "Acceptable for Level 1, but consider raising to 12 when you can.",
          },
          {
            value: "shorter",
            label: "Shorter than 8, or no policy",
            tone: "danger",
            failsObjectives: ["b"],
            charlieReaction: "This will be flagged. Set a 12-character minimum in Microsoft 365 / Workspace admin — it's free.",
            remediationHint:
              "Action: set password policy to 12+ characters in your identity provider. Charlie can walk you through the admin pages.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "All set. Authentication is documented.",
      },
    ],
  },

  // ===================================================================
  // MP.L1-3.8.3  Media Disposal
  // Sanitize or destroy system media containing FCI before disposal or
  // release for reuse.
  // ===================================================================
  "MP.L1-3.8.3": {
    controlId: "MP.L1-3.8.3",
    estimatedMinutes: 5,
    oneLiner:
      "Old hard drives, USB sticks, and printed documents need to be wiped or destroyed before they leave your hands.",
    vaultForms: {
      disposal_log: {
        id: "disposal_log",
        title: "Media Disposal Log",
        filenameStem: "media-disposal-log",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "date", label: "Disposal date", type: "date", required: true },
          {
            key: "media_type",
            label: "Media type",
            type: "select",
            required: true,
            options: ["Hard drive", "Solid-state drive", "USB stick", "Phone / tablet", "Paper", "Optical disc", "Other"],
          },
          { key: "serial", label: "Serial / asset tag", type: "text", required: true, placeholder: "LAPTOP-JS-001 / 0123456789" },
          {
            key: "method",
            label: "Method used",
            type: "select",
            required: true,
            options: ["Software wipe (DBAN / Microsoft)", "Cryptographic erase", "Physical destruction (shred)", "Degaussing", "Cross-cut shred (paper)"],
          },
          { key: "witness", label: "Witness / performed by", type: "text", required: true, placeholder: "Mark Lee" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**MP.L1-3.8.3** is a paper-trail practice. When a laptop, drive, or printed document gets retired, you need a record showing it was wiped or destroyed, not just thrown in the trash. We'll capture a disposal log.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "method",
        kind: "multiple_choice",
        charlieSays:
          "When you retire a device or paper file with company information, what happens to it?",
        saveKey: "method",
        choices: [
          {
            value: "wipe_or_shred",
            label: "Wiped (drives) or shredded (paper) before disposal",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "That's the standard. We'll record your method.",
          },
          {
            value: "third_party",
            label: "We use a certified destruction vendor",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Even better — vendor certificates make great evidence.",
          },
          {
            value: "informal",
            label: "Honestly, we just throw old equipment away",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "That's a finding. The fix is cheap — a $30 USB-C drive wiper or a cross-cut shredder solves it.",
            remediationHint:
              "Action: pick a method (wipe / shred / vendor) and write a 5-line disposal procedure. Charlie can draft it.",
          },
        ],
      },
      {
        id: "disposal_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now let's capture your disposal records. One row per device or batch you've disposed of.",
        stem: "Media disposal log (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Add rows as devices retire. Most small businesses have 5 to 10 entries per year.",
            formId: "disposal_log",
          },
          {
            kind: "template",
            filename: "media-disposal-log.csv",
            label: "Download spreadsheet template",
            hint: "Open in Excel or Google Sheets, fill it in, drop it back here.",
          },
          {
            kind: "upload",
            label: "Upload an existing log",
            hint: "Vendor certificates of destruction also work.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Your disposal log is in the vault.",
      },
    ],
  },

  // ===================================================================
  // PE.L1-3.10.1  Limit Physical Access
  // Limit physical access to organizational systems, equipment, and the
  // respective operating environments to authorized individuals.
  // ===================================================================
  "PE.L1-3.10.1": {
    controlId: "PE.L1-3.10.1",
    estimatedMinutes: 5,
    oneLiner:
      "Only authorized people should be able to physically reach the computers and rooms where company information is kept.",
    vaultForms: {
      physical_roster: {
        id: "physical_roster",
        title: "Physical Access Roster",
        filenameStem: "physical-access-roster",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith" },
          {
            key: "space",
            label: "Space / area",
            type: "select",
            required: true,
            options: ["Main office", "Server room / closet", "Storage room", "Loading area", "Other"],
          },
          {
            key: "access_type",
            label: "Access type",
            type: "select",
            required: true,
            options: ["Physical key", "Badge / fob", "Door code", "Biometric", "Escorted only"],
          },
          { key: "issued_on", label: "Issued on", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**PE.L1-3.10.1**. Even if everything's in the cloud, if you have a physical office, a desk, or a closet with a router, this practice applies. We'll capture who can physically access company spaces.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "premises",
        kind: "multiple_choice",
        charlieSays:
          "What's your physical setup?",
        saveKey: "premises",
        choices: [
          {
            value: "office",
            label: "We have a physical office with company equipment",
            tone: "neutral",
            charlieReaction: "OK — let's list who has access.",
          },
          {
            value: "remote",
            label: "Remote-only — every employee works from home",
            tone: "neutral",
            satisfies: ["a", "b"],
            charlieReaction: "Then your home offices are the relevant 'spaces'. We'll capture a short attestation per person.",
          },
          {
            value: "hybrid",
            label: "Hybrid — small office plus remote workers",
            tone: "neutral",
            charlieReaction: "Common. We'll cover both.",
          },
        ],
      },
      {
        id: "physical_evidence",
        kind: "evidence_picker",
        charlieSays:
          "List who has physical access — keys, badges, codes, or biometrics — to each company space.",
        stem: "Physical access roster (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per person and space they can access.",
            formId: "physical_roster",
          },
          {
            kind: "template",
            filename: "physical-access-roster.csv",
            label: "Download spreadsheet template",
            hint: "Fill in offline and upload.",
          },
          {
            kind: "upload",
            label: "Upload an existing list",
            hint: "Badge system export, key log, or office sign-in roster.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Physical access is documented.",
      },
    ],
  },

  // ===================================================================
  // PE.L1-3.10.3  Escort Visitors
  // Escort visitors and monitor visitor activity.
  // ===================================================================
  "PE.L1-3.10.3": {
    controlId: "PE.L1-3.10.3",
    estimatedMinutes: 4,
    oneLiner:
      "Anyone who isn't an employee should sign in, be escorted, and have their visit recorded.",
    vaultForms: {
      visitor_log: {
        id: "visitor_log",
        title: "Visitor Log",
        filenameStem: "visitor-log",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "date", label: "Visit date", type: "date", required: true },
          { key: "visitor", label: "Visitor name", type: "text", required: true, placeholder: "John Doe" },
          { key: "company", label: "Company / affiliation", type: "text", required: true, placeholder: "Acme Logistics" },
          { key: "purpose", label: "Purpose of visit", type: "text", required: true, placeholder: "Equipment delivery" },
          { key: "escort", label: "Escort (employee name)", type: "text", required: true, placeholder: "Jane Smith" },
          { key: "arrival", label: "Arrival time", type: "text", required: true, placeholder: "09:30" },
          { key: "departure", label: "Departure time", type: "text", required: true, placeholder: "10:15" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**PE.L1-3.10.3**. If anyone visits your office — clients, vendors, contractors, even family — they should sign in, be escorted, and the visit should be logged.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "have_visitors",
        kind: "multiple_choice",
        charlieSays:
          "Do you have visitors come on-site?",
        saveKey: "have_visitors",
        choices: [
          {
            value: "yes_logged",
            label: "Yes, and we sign them in and escort them",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Perfect. Let's grab the log.",
          },
          {
            value: "yes_informal",
            label: "Yes, but informally — no sign-in",
            tone: "warn",
            charlieReaction: "We'll start the log now. Charlie can email a one-page sign-in sheet you can print.",
          },
          {
            value: "no",
            label: "No visitors — remote-only or no public access",
            tone: "neutral",
            satisfies: ["a", "b"],
            charlieReaction: "Then we'll attest to that. Update if it changes.",
          },
        ],
      },
      {
        id: "visitor_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Capture your visitor log — last few months is plenty for the assessor to see the practice in action.",
        stem: "Visitor log (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Add a few recent visits. Going forward, log visits as they happen.",
            formId: "visitor_log",
          },
          {
            kind: "template",
            filename: "visitor-log.csv",
            label: "Download spreadsheet template",
            hint: "Print or fill digitally.",
          },
          {
            kind: "upload",
            label: "Upload existing visitor log",
            hint: "Photo of paper sign-in sheet or digital export.",
          },
        ],
        allowSkip: true,
        skipLabel: "Skip — no visitors come on-site",
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Your visitor practice is documented.",
      },
    ],
  },

  // ===================================================================
  // PE.L1-3.10.4  Physical Access Logs
  // Maintain audit logs of physical access.
  // ===================================================================
  "PE.L1-3.10.4": {
    controlId: "PE.L1-3.10.4",
    estimatedMinutes: 4,
    oneLiner:
      "Physical entries and exits should be recorded and the records kept long enough for review.",
    vaultForms: {
      retention_attestation: {
        id: "retention_attestation",
        title: "Physical Access Log Retention Attestation",
        filenameStem: "physical-log-retention",
        repeating: false,
        satisfies: ["a", "b"],
        fields: [
          {
            key: "log_type",
            label: "How are entries logged?",
            type: "select",
            required: true,
            options: ["Paper sign-in sheet", "Digital visitor system", "Badge system audit log", "Mix of paper and digital"],
          },
          { key: "retention", label: "How long are logs kept?", type: "text", required: true, placeholder: "12 months" },
          { key: "stored_at", label: "Where stored?", type: "text", required: true, placeholder: "Locked file cabinet in front office" },
          { key: "attested_by", label: "Attested by (your name)", type: "text", required: true },
          { key: "attested_on", label: "Date", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**PE.L1-3.10.4**. Same idea as the visitor log, but specifically about keeping the records long enough that you can show them to an assessor. Most small businesses keep 12 months.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "retention",
        kind: "multiple_choice",
        charlieSays:
          "How long do you keep physical entry / visitor logs?",
        saveKey: "retention",
        choices: [
          {
            value: "twelve_plus",
            label: "12 months or more",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Solid. That's well above the floor.",
          },
          {
            value: "few_months",
            label: "A few months",
            tone: "warn",
            charlieReaction: "Acceptable but tight. Aim for 12 months.",
            remediationHint:
              "Action: extend retention to 12 months. A bigger binder or a folder in your file system covers it.",
          },
          {
            value: "none",
            label: "We don't keep them",
            tone: "danger",
            failsObjectives: ["a", "b"],
            charlieReaction: "Finding. Start keeping them now — even a folder of photos works.",
            remediationHint:
              "Action: start retaining visitor logs in a binder or folder. Charlie can email a monthly reminder to file last month's pages.",
          },
        ],
      },
      {
        id: "retention_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Quick attestation locks this in.",
        stem: "Retention attestation (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Sign attestation in Vault",
            hint: "One-page form: how you log, where you store, how long you keep.",
            formId: "retention_attestation",
          },
          {
            kind: "upload",
            label: "Upload signed retention policy",
            hint: "If you already have a written policy, upload it.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Retention attestation is on file.",
      },
    ],
  },

  // ===================================================================
  // PE.L1-3.10.5  Manage Physical Access
  // Control and manage physical access devices.
  // ===================================================================
  "PE.L1-3.10.5": {
    controlId: "PE.L1-3.10.5",
    estimatedMinutes: 5,
    oneLiner:
      "Keys, badges, and door codes should be tracked, recovered when someone leaves, and changed if compromised.",
    vaultForms: {
      access_devices: {
        id: "access_devices",
        title: "Access Device Register",
        filenameStem: "access-device-register",
        repeating: true,
        satisfies: ["a", "b", "c"],
        fields: [
          {
            key: "device_type",
            label: "Type",
            type: "select",
            required: true,
            options: ["Physical key", "Badge / fob", "Door code", "Garage opener", "Other"],
          },
          { key: "identifier", label: "Identifier / serial", type: "text", required: true, placeholder: "Key #4 / Badge 0123" },
          { key: "issued_to", label: "Issued to", type: "text", required: true, placeholder: "Jane Smith" },
          { key: "issued_on", label: "Issued on", type: "date", required: true },
          { key: "returned_on", label: "Returned on (if applicable)", type: "date" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**PE.L1-3.10.5** is about tracking your keys, badges, and door codes — and making sure when someone leaves, you actually get the key back or change the code.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "offboarding",
        kind: "multiple_choice",
        charlieSays:
          "When someone leaves your company, what happens to their key, badge, or code?",
        saveKey: "offboarding",
        choices: [
          {
            value: "recovered",
            label: "We collect the key/badge and rotate codes if needed",
            tone: "ok",
            satisfies: ["b", "c"],
            charlieReaction: "Exactly what an assessor wants to see.",
          },
          {
            value: "informal",
            label: "Informal — sometimes we forget",
            tone: "warn",
            charlieReaction: "We'll record this and add an offboarding checklist to your evidence.",
            remediationHint:
              "Action: add 'collect key + change codes' to your offboarding checklist. Charlie can draft a one-page checklist.",
          },
          {
            value: "never",
            label: "We don't track keys / codes",
            tone: "danger",
            failsObjectives: ["b", "c"],
            charlieReaction: "Finding. Start a register now — even a notepad is enough to begin.",
            remediationHint:
              "Action: start an access device register today. Charlie helps you populate it from memory.",
          },
        ],
      },
      {
        id: "device_evidence",
        kind: "evidence_picker",
        charlieSays:
          "List your access devices — keys, badges, codes — and who has them.",
        stem: "Access device register (objective [a] + [b] + [c])",
        satisfies: ["a", "b", "c"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per key, badge, or code currently issued.",
            formId: "access_devices",
          },
          {
            kind: "template",
            filename: "access-device-register.csv",
            label: "Download spreadsheet template",
            hint: "Same template the access-control practice uses.",
          },
          {
            kind: "upload",
            label: "Upload existing register",
            hint: "Badge system export or paper log.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Your physical access devices are tracked.",
      },
    ],
  },

  // ===================================================================
  // SC.L1-3.13.1  Boundary Protection
  // Monitor, control, and protect organizational communications at
  // external boundaries and key internal boundaries.
  // ===================================================================
  "SC.L1-3.13.1": {
    controlId: "SC.L1-3.13.1",
    estimatedMinutes: 6,
    oneLiner:
      "Your network needs a firewall — at minimum at the connection between your office and the internet.",
    vaultForms: {
      boundary_inventory: {
        id: "boundary_inventory",
        title: "Network Boundary Inventory",
        filenameStem: "network-boundary-inventory",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          {
            key: "device_type",
            label: "Device type",
            type: "select",
            required: true,
            options: ["Firewall", "Router with firewall", "Cloud firewall (AWS / Azure)", "Software firewall (Windows / macOS)", "Other"],
          },
          { key: "make_model", label: "Make and model", type: "text", required: true, placeholder: "Cisco Meraki MX67" },
          { key: "location", label: "Where it sits", type: "text", required: true, placeholder: "Office WAN edge / Cloud VPC" },
          { key: "rule_summary", label: "Rule summary", type: "text", required: true, placeholder: "Default deny inbound; allow internal-out" },
          { key: "managed_by", label: "Managed by", type: "text", required: true, placeholder: "IT lead — Mark Lee / Vendor: ACME IT" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SC.L1-3.13.1** is the network practice. You need a firewall — physical, cloud, or software — between your systems and the internet, and you need to know how it's configured.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "have_firewall",
        kind: "multiple_choice",
        charlieSays:
          "Where does the firewall live for your business?",
        saveKey: "have_firewall",
        choices: [
          {
            value: "appliance",
            label: "We have a firewall appliance (Meraki, Fortinet, SonicWall, pfSense, etc.)",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Good. Let's get its details on paper.",
          },
          {
            value: "cloud",
            label: "Cloud-only — Microsoft 365 + AWS / Azure security groups",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Cloud-only is fine. We'll capture your VPC / security group setup.",
          },
          {
            value: "software",
            label: "Software firewalls on each laptop only",
            tone: "warn",
            charlieReaction: "Acceptable for fully remote teams, weaker for offices. Note for the assessor.",
          },
          {
            value: "none",
            label: "Honestly, no formal firewall",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "Finding. A consumer router with built-in firewall is the cheapest fix.",
            remediationHint:
              "Action: get a small business firewall ($150 to $500). Charlie suggests Meraki MX, UniFi, or Firewalla for small shops.",
          },
        ],
      },
      {
        id: "boundary_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Capture your boundary devices — what they are, where they sit, and a one-line rule summary.",
        stem: "Network boundary inventory (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per firewall or boundary device. Most small businesses have 1 to 2.",
            formId: "boundary_inventory",
          },
          {
            kind: "template",
            filename: "network-boundary-inventory.csv",
            label: "Download spreadsheet template",
            hint: "Includes example rows for common setups.",
          },
          {
            kind: "upload",
            label: "Upload firewall config screenshot",
            hint: "Pair with an inventory entry. Many assessors want both.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Boundary protection is documented.",
      },
    ],
  },

  // ===================================================================
  // SC.L1-3.13.5  Public-Access System Separation
  // Implement subnetworks for publicly accessible system components
  // that are physically or logically separated from internal networks.
  // ===================================================================
  "SC.L1-3.13.5": {
    controlId: "SC.L1-3.13.5",
    estimatedMinutes: 5,
    oneLiner:
      "Anything the public can reach (your website, a kiosk, a customer portal) must live separately from your internal network.",
    vaultForms: {},
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SC.L1-3.13.5** is the only practice on the list that needs a network diagram if it applies to you. **The good news**: most small businesses don't have public-facing systems and can attest 'not applicable'. Let's check.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "have_public",
        kind: "multiple_choice",
        charlieSays:
          "Do you operate any public-facing systems? (Company website hosted on your infrastructure, a customer portal, a kiosk, an in-store WiFi network.)",
        saveKey: "have_public",
        choices: [
          {
            value: "no",
            label: "No — our website is hosted by a third party (Squarespace, WordPress.com, etc.) and we don't run any public systems",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Then this practice is satisfied by attestation. The third-party host is responsible for separation on their side.",
          },
          {
            value: "yes_simple",
            label: "Yes — we host our own website / portal / kiosk",
            tone: "neutral",
            charlieReaction: "Then we need a network diagram showing the public side is separated from your internal side.",
          },
          {
            value: "not_sure",
            label: "I'm not sure",
            tone: "neutral",
            charlieReaction: "No problem — open me in chat and I'll walk through what counts as public-facing for your business.",
          },
        ],
      },
      {
        id: "diagram_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Upload a network diagram showing your public systems on a separate subnet, virtual private cloud, or DMZ from your internal network. **Charlie can help** — open the chat panel and I'll walk you through drawing one in draw.io or Excalidraw (both free) and what to label.",
        stem: "Network separation diagram (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "upload",
            label: "Upload network diagram",
            hint: "Image, PDF, or screenshot from draw.io / Lucidchart / Visio. Show public systems separated from internal.",
          },
        ],
        allowSkip: true,
        skipLabel: "Skip — no public-facing systems (we said no above)",
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Public-system separation is recorded.",
      },
    ],
  },

  // ===================================================================
  // SI.L1-3.14.1  Flaw Remediation
  // Identify, report, and correct system flaws in a timely manner.
  // ===================================================================
  "SI.L1-3.14.1": {
    controlId: "SI.L1-3.14.1",
    estimatedMinutes: 5,
    oneLiner:
      "Operating systems and apps need regular security updates — and you need to be able to show it's happening.",
    vaultForms: {
      patch_log: {
        id: "patch_log",
        title: "Patch and Update Log",
        filenameStem: "patch-log",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "date", label: "Date applied", type: "date", required: true },
          { key: "system", label: "System / device", type: "text", required: true, placeholder: "All Windows laptops / Microsoft 365 tenant" },
          { key: "patch", label: "Patch / update", type: "text", required: true, placeholder: "Windows monthly cumulative / Microsoft 365 client update" },
          { key: "verified_by", label: "Verified by", type: "text", required: true, placeholder: "Mark Lee" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SI.L1-3.14.1**. Every operating system and major app needs to receive security updates. We need to show updates are actually applied — usually a short patch log is enough.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "patch_method",
        kind: "multiple_choice",
        charlieSays:
          "How do laptops, servers, and apps in your business get patched?",
        saveKey: "patch_method",
        choices: [
          {
            value: "auto",
            label: "Automatic updates are on (Windows Update / Apple / browsers)",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Good. We'll capture a quarterly verification log.",
          },
          {
            value: "manual_scheduled",
            label: "Manually, on a schedule (monthly or quarterly)",
            tone: "ok",
            satisfies: ["a"],
            charlieReaction: "Acceptable. Let's record the cadence.",
          },
          {
            value: "ad_hoc",
            label: "When we get around to it",
            tone: "warn",
            charlieReaction: "Risky. Turn auto-updates on — it's free and instant.",
            remediationHint:
              "Action: enable Windows Update / macOS automatic updates on every laptop today. Charlie can list the toggle locations.",
          },
          {
            value: "never",
            label: "Honestly, we don't patch",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "Big finding. Turn on automatic updates this week.",
            remediationHint:
              "Action: turn on automatic OS and browser updates on every device. Free, takes 2 minutes per laptop.",
          },
        ],
      },
      {
        id: "patch_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now capture proof. Even 3 to 5 recent patch entries is enough to show the practice is real.",
        stem: "Patch log (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "Add a few recent patch entries. Going forward, log monthly.",
            formId: "patch_log",
          },
          {
            kind: "template",
            filename: "patch-log.csv",
            label: "Download spreadsheet template",
            hint: "Fill it offline, drop it back.",
          },
          {
            kind: "upload",
            label: "Upload patch screenshots",
            hint: "Windows Update history screenshots / Microsoft 365 admin center patch report.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Patching is documented.",
      },
    ],
  },

  // ===================================================================
  // SI.L1-3.14.2  Malicious Code Protection
  // Provide protection from malicious code at appropriate locations
  // within organizational systems.
  // ===================================================================
  "SI.L1-3.14.2": {
    controlId: "SI.L1-3.14.2",
    estimatedMinutes: 5,
    oneLiner:
      "Every laptop and server needs antivirus or endpoint protection installed and running.",
    vaultForms: {
      av_inventory: {
        id: "av_inventory",
        title: "Endpoint Antivirus Inventory",
        filenameStem: "endpoint-av-inventory",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "device", label: "Device name / asset tag", type: "text", required: true, placeholder: "LAPTOP-JS-001" },
          { key: "owner", label: "Assigned to", type: "text", required: true, placeholder: "Jane Smith" },
          {
            key: "product",
            label: "Antivirus product",
            type: "select",
            required: true,
            options: ["Microsoft Defender", "Malwarebytes", "CrowdStrike", "Sophos", "ESET", "Bitdefender", "Other"],
          },
          { key: "version", label: "Version", type: "text", required: true, placeholder: "Latest" },
          {
            key: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ["Running with real-time protection on", "Installed but disabled", "Not installed"],
          },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SI.L1-3.14.2** is straightforward: every device needs antivirus or endpoint protection. Microsoft Defender (free, built-in to Windows 10/11) counts. macOS XProtect counts. We'll inventory what's running where.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "av_coverage",
        kind: "multiple_choice",
        charlieSays:
          "Does every laptop and server have antivirus or endpoint protection running?",
        saveKey: "av_coverage",
        choices: [
          {
            value: "all",
            label: "Yes, every device",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Solid. Let's capture the inventory.",
          },
          {
            value: "most",
            label: "Most devices, but not 100%",
            tone: "warn",
            charlieReaction: "Close it up — Microsoft Defender is free and built in.",
            remediationHint:
              "Action: turn on Microsoft Defender (Windows) or install Malwarebytes (Mac). Both free.",
          },
          {
            value: "none",
            label: "No formal antivirus deployed",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "Big finding. Microsoft Defender is built into Windows — turn it on this week.",
            remediationHint:
              "Action: ensure Windows Defender is on for every laptop. macOS users install Malwarebytes free tier.",
          },
        ],
      },
      {
        id: "av_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Inventory each device, what antivirus it's running, and that real-time protection is on.",
        stem: "Endpoint antivirus inventory (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per laptop and server.",
            formId: "av_inventory",
          },
          {
            kind: "template",
            filename: "endpoint-av-inventory.csv",
            label: "Download spreadsheet template",
            hint: "Fill offline and drop back.",
          },
          {
            kind: "upload",
            label: "Upload antivirus dashboard screenshot",
            hint: "Microsoft Defender Security Center, CrowdStrike, or whatever you use.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Endpoint protection is documented.",
      },
    ],
  },

  // ===================================================================
  // SI.L1-3.14.4  Update Malicious Code Protection
  // Update malicious code protection mechanisms when new releases are
  // available.
  // ===================================================================
  "SI.L1-3.14.4": {
    controlId: "SI.L1-3.14.4",
    estimatedMinutes: 4,
    oneLiner:
      "Antivirus signatures need to update automatically — running last year's signatures means you're not protected against new threats.",
    vaultForms: {
      av_updates: {
        id: "av_updates",
        title: "Antivirus Update Verification",
        filenameStem: "endpoint-av-inventory",
        repeating: true,
        satisfies: ["a", "b"],
        fields: [
          { key: "device", label: "Device name", type: "text", required: true, placeholder: "LAPTOP-JS-001" },
          { key: "product", label: "Antivirus product", type: "text", required: true, placeholder: "Microsoft Defender" },
          { key: "last_update", label: "Last signature update", type: "date", required: true },
          { key: "auto_update", label: "Auto-update enabled?", type: "select", required: true, options: ["Yes", "No"] },
          { key: "verified_by", label: "Verified by", type: "text", required: true, placeholder: "Mark Lee" },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SI.L1-3.14.4**. The follow-up to the antivirus practice. Definitions need to update — usually daily, automatically. Most products do this by default. We just need a snapshot showing it's actually happening.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "auto_updates",
        kind: "multiple_choice",
        charlieSays:
          "Are antivirus definitions set to update automatically?",
        saveKey: "auto_updates",
        choices: [
          {
            value: "auto_all",
            label: "Yes — all devices auto-update",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "Default for most products. Let's verify.",
          },
          {
            value: "manual",
            label: "Manual updates only",
            tone: "warn",
            charlieReaction: "Risky. Turn on auto-update — it's a single setting per product.",
            remediationHint:
              "Action: enable automatic signature updates in your antivirus settings. Microsoft Defender does this by default.",
          },
          {
            value: "not_sure",
            label: "Not sure",
            tone: "warn",
            charlieReaction: "Open me in chat and I'll walk through how to verify on Windows / macOS.",
          },
        ],
      },
      {
        id: "update_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Snapshot when each device last updated. Reuse the antivirus inventory if you've done it.",
        stem: "Antivirus update verification (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "vault",
            label: "Fill it in here (Vault)",
            hint: "One row per device. Add the last update date and confirm auto-update is on.",
            formId: "av_updates",
          },
          {
            kind: "template",
            filename: "endpoint-av-inventory.csv",
            label: "Download spreadsheet template",
            hint: "Same template as the antivirus practice — add an update column.",
          },
          {
            kind: "upload",
            label: "Upload update screenshots",
            hint: "Microsoft Defender Settings page showing signature date works.",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Locked. Definition updates are verified.",
      },
    ],
  },

  // ===================================================================
  // SI.L1-3.14.5  System and File Scanning
  // Perform periodic scans of the system and real-time scans of files
  // from external sources as files are downloaded, opened, or executed.
  // ===================================================================
  "SI.L1-3.14.5": {
    controlId: "SI.L1-3.14.5",
    estimatedMinutes: 5,
    oneLiner:
      "Antivirus needs to scan files in real-time when they arrive, and run a full scheduled scan periodically.",
    vaultForms: {
      scan_attestation: {
        id: "scan_attestation",
        title: "Scanning Configuration Attestation",
        filenameStem: "scan-attestation",
        repeating: false,
        satisfies: ["a", "b"],
        fields: [
          { key: "product", label: "Antivirus product", type: "text", required: true, placeholder: "Microsoft Defender" },
          {
            key: "real_time",
            label: "Real-time scanning enabled?",
            type: "select",
            required: true,
            options: ["Yes", "No"],
          },
          {
            key: "scheduled",
            label: "Scheduled full scan cadence",
            type: "select",
            required: true,
            options: ["Daily", "Weekly", "Monthly", "Not scheduled"],
          },
          { key: "verified_by", label: "Verified by (your name)", type: "text", required: true },
          { key: "verified_on", label: "Date", type: "date", required: true },
        ],
      },
    },
    steps: [
      {
        id: "intro",
        kind: "intro",
        charlieSays:
          "**SI.L1-3.14.5** is one of the practices the assessor will likely want to see a screenshot for, since most free antivirus tools don't expose an API. Best evidence: a screenshot of your antivirus settings showing real-time and scheduled scanning are on.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "scan_state",
        kind: "multiple_choice",
        charlieSays:
          "Is real-time file scanning on, and is a scheduled full scan running at least weekly?",
        saveKey: "scan_state",
        choices: [
          {
            value: "both",
            label: "Yes — real-time on, weekly or daily full scan scheduled",
            tone: "ok",
            satisfies: ["a", "b"],
            charlieReaction: "That's the bar. Capture a screenshot and we're done.",
          },
          {
            value: "real_time_only",
            label: "Real-time only — no scheduled scans",
            tone: "warn",
            charlieReaction: "Schedule a weekly scan — one toggle in most products.",
            remediationHint:
              "Action: in Microsoft Defender, set 'Scheduled scan' to weekly. Charlie walks through it.",
          },
          {
            value: "scheduled_only",
            label: "Scheduled only — real-time off",
            tone: "danger",
            failsObjectives: ["a"],
            charlieReaction: "Real-time is the more important one. Turn it on now.",
            remediationHint:
              "Action: turn on real-time scanning in your antivirus product. Charlie can locate the setting.",
          },
          {
            value: "neither",
            label: "Neither",
            tone: "danger",
            failsObjectives: ["a", "b"],
            charlieReaction: "Big finding. Microsoft Defender does both by default — turn it on.",
            remediationHint:
              "Action: enable real-time and weekly scheduled scans in your antivirus today.",
          },
        ],
      },
      {
        id: "scan_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Capture proof. Screenshot is preferred — assessors want to see the actual setting.",
        stem: "Scanning configuration (objective [a] + [b])",
        satisfies: ["a", "b"],
        paths: [
          {
            kind: "upload",
            label: "Upload antivirus settings screenshot (recommended)",
            hint: "Microsoft Defender 'Virus & threat protection settings' page is ideal.",
          },
          {
            kind: "vault",
            label: "Sign attestation in Vault (manual fallback)",
            hint: "Charlie generates a signed attestation. Pair with a screenshot if possible.",
            formId: "scan_attestation",
          },
        ],
      },
      {
        id: "summary",
        kind: "summary",
        charlieSays:
          "Done. Scanning is documented.",
      },
    ],
  },
};

export function getPracticeQuiz(controlId: string): PracticeQuiz | null {
  return practiceQuizzes[controlId] ?? null;
}
