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
  steps: QuizStep[];
  /** named vault forms referenced by evidence_picker steps */
  vaultForms: Record<string, VaultForm>;
};

export const practiceQuizzes: Record<string, PracticeQuiz> = {
  "AC.L1-3.1.1": {
    controlId: "AC.L1-3.1.1",
    estimatedMinutes: 8,
    oneLiner:
      "Only people you've approved should be able to sign in to systems that touch FCI.",
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
            options: ["Microsoft 365", "Google Workspace", "On-prem AD", "File server", "Other"],
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
          "Hi — I'm Charlie. Let's walk through **AC.L1-3.1.1: Authorized Access Control** together. About 8 minutes. I'll ask plain-English questions; you pick the answer that fits your business and we'll collect proof as we go. Anything I gather goes into your evidence vault for the assessor.\n\nThe goal of this practice: only people **you've approved** can sign in to systems where FCI lives. That means a current list of users, devices, and automated processes — and the system actually enforcing it.",
        ctaLabel: "Let's go \u2192",
      },
      {
        id: "systems",
        kind: "multiple_choice",
        charlieSays:
          "First, where does your team work with FCI today? (Email, contract docs, drawings, internal threads about the contract.) Pick the closest match.",
        saveKey: "systems",
        choices: [
          {
            value: "m365",
            label: "Microsoft 365 (email, SharePoint, OneDrive, Teams)",
            hint: "Most common for small DoD primes / subs.",
            tone: "neutral",
            charlieReaction: "Nice — M365 makes the next steps easy. I can pull most of this directly if you connect your tenant.",
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
            label: "On-prem only — file server / Active Directory",
            hint: "No cloud. We'll generate the documentation.",
            tone: "neutral",
            charlieReaction: "OK — we can't auto-pull on-prem, but we'll build proper documentation in the Vault.",
          },
          {
            value: "mix",
            label: "Mix of cloud and on-prem",
            hint: "Common for shops with cloud email + a local file server.",
            tone: "neutral",
            charlieReaction: "Mix it is. We'll need to cover both surfaces.",
          },
        ],
      },
      {
        id: "users_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now let's get your **authorized users list**. This is *the* document a 3PAO will look at first. Pick whichever path is fastest for you — they all produce a roster the assessor will accept.",
        stem: "Authorized users (objective [a] + [d])",
        satisfies: ["a", "d"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Microsoft 365",
            hint: "Charlie auto-collects every active M365 user. ~30 seconds if your tenant is connected.",
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
            hint: "Type each user once and we generate a clean, signed CSV stored in your evidence vault.",
            formId: "authorized_users",
          },
          {
            kind: "template",
            filename: "authorized-users-roster.csv",
            label: "Download CSV template",
            hint: "Open in Excel / Sheets, fill it in, drop it back here.",
          },
          {
            kind: "upload",
            label: "I already have a roster — upload it",
            hint: "PNG / JPG / PDF / CSV / Excel all work.",
          },
        ],
      },
      {
        id: "service_accounts_q",
        kind: "multiple_choice",
        charlieSays:
          "Do you use any **service accounts or automated processes** that sign in to your systems? (Things like a backup tool, a Power Automate flow, OneDrive sync, or an integration that uses its own credentials.)",
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
            hint: "Quick form — typical small-business list is 3–5 rows.",
            formId: "service_accounts",
          },
          {
            kind: "upload",
            label: "Upload an existing list",
            hint: "Spreadsheet, doc, or screenshot is fine.",
          },
        ],
        allowSkip: true,
        skipLabel: "Skip — we said no service accounts",
      },
      {
        id: "devices_evidence",
        kind: "evidence_picker",
        charlieSays:
          "Now devices. CMMC wants to know which **laptops, phones, and other devices** are allowed to access company systems. Same options as before — pick what's fastest.",
        stem: "Authorized devices (objective [c] + [f])",
        satisfies: ["c", "f"],
        paths: [
          {
            kind: "connector",
            provider: "m365",
            label: "Pull from Intune / M365",
            hint: "If you use Intune or Conditional Access, Charlie can pull the device list.",
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
            label: "Download CSV template",
            hint: "For larger fleets — fill offline and upload.",
          },
          {
            kind: "upload",
            label: "Upload an existing inventory",
            hint: "Asset list, MDM export, or screenshot.",
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
              "Action: build a 1-page offboarding procedure. Disable account, remove from groups, collect device, sign and date. Charlie can draft this.",
          },
        ],
      },
      {
        id: "device_enforcement",
        kind: "multiple_choice",
        charlieSays:
          "Last question. Can someone sign in to your company systems from a **personal / random device** with just username + password? Or do you require a managed device (Conditional Access, MDM, VPN cert)?",
        saveKey: "device_enforcement",
        choices: [
          {
            value: "managed_only",
            label: "Managed devices only — Conditional Access / MDM / VPN cert",
            tone: "ok",
            satisfies: ["f"],
            charlieReaction: "That's the gold standard. A screenshot of your CA policy will lock objective [f] in.",
          },
          {
            value: "mfa_only",
            label: "MFA on every login, but personal devices are allowed",
            tone: "warn",
            charlieReaction: "MFA is great for [a] but not [f]. We'll note this and add device enforcement to your roadmap.",
            remediationHint:
              "Action: turn on Conditional Access (M365) or Context-Aware Access (Workspace) requiring a compliant or hybrid-joined device.",
          },
          {
            value: "open",
            label: "Just username + password from anywhere",
            tone: "danger",
            failsObjectives: ["f"],
            charlieReaction: "We'll flag this as NOT MET for [f]. Big-impact fix though — turning on MFA + device-required policies takes about an hour.",
            remediationHint:
              "Action: enable MFA + Conditional Access / Context-Aware Access this week. Charlie can write the policy and walk through the admin steps.",
          },
          {
            value: "not_sure",
            label: "I'm not sure",
            tone: "neutral",
            charlieReaction: "No problem. Open me in chat (right rail) and I'll check your tenant settings with you.",
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
};

export function getPracticeQuiz(controlId: string): PracticeQuiz | null {
  return practiceQuizzes[controlId] ?? null;
}
