/**
 * Per-practice guided-flow content. This is the data layer that powers the
 * 4-stage TurboTax-style walkthrough (Orient → Confirm → Prove → Lock in).
 *
 * Source of truth: CMMC Level 1 Self-Assessment Guide v2.0 — every objective
 * letter, examine/interview/test method, and the FAR / NIST language is
 * pulled directly from the official guide. The `prompt` and `helpText`
 * fields are the only "voice" we add — they translate the assessor-speak
 * into questions a small-business owner can actually answer.
 *
 * A practice with NO entry in `practiceGuides` falls back to the legacy
 * `PracticeWizard` so we can roll this out one practice at a time.
 */

export type ObjectiveQuestion = {
  letter: string;
  /** assessor-speak from NIST 800-171A — kept verbatim for SSP traceability */
  formalAsk: string;
  /** plain-English question we actually show the user */
  prompt: string;
  /** one-sentence explanation that opens when they click "What does this mean?" */
  helpText: string;
  /** what it looks like when the user is doing this right (concrete example) */
  example: string;
};

export type EvidenceMethod = {
  /** Examine = look at a document; Test = observe behavior; Interview = attest */
  method: "examine" | "test" | "interview";
  title: string;
  /** the 1-line summary shown on the slot card */
  ask: string;
  /** bulleted detail of what an artifact must show to count */
  acceptedShape: string[];
  /** typical filenames / formats that satisfy this slot */
  formats: string;
};

export type PracticeGuide = {
  controlId: string;
  /** What is FCI in plain English, contextualized for THIS practice. */
  fciFraming: {
    headline: string;
    body: string;
  };
  /** One concrete day-in-the-life example, taken from the official guide. */
  realWorldExample: {
    setup: string;
    action: string;
    soWhat: string;
  };
  /** When does this practice NOT apply? Helps users mark N/A correctly. */
  applicabilityNotes: string;
  objectives: ObjectiveQuestion[];
  evidenceMethods: EvidenceMethod[];
};

export const practiceGuides: Record<string, PracticeGuide> = {
  "AC.L1-3.1.1": {
    controlId: "AC.L1-3.1.1",
    fciFraming: {
      headline: "Only people you've approved can sign in.",
      body:
        "FCI (Federal Contract Information) is anything the government has shared with you, or that you create for them, that isn't meant for the public — proposals, drawings, statements of work, internal emails about the contract. This practice makes sure that only people YOU have approved can log into the systems where that information lives. Former employees, random vendors, or someone borrowing a laptop should not be able to get in.",
    },
    realWorldExample: {
      setup:
        "A small machine shop wins a DoD subcontract. The project SOW lives in a SharePoint folder and email threads with the prime contractor.",
      action:
        "The owner keeps a one-page roster: who has a Microsoft 365 account, what role they play, and the date they were authorized. When a machinist quits, the owner disables the account that day and updates the roster.",
      soWhat:
        "If a 3PAO walks in tomorrow, the owner can show: the roster, the M365 admin console matching the roster, and the offboarding entry from last month. That's a MET finding.",
    },
    applicabilityNotes:
      "This practice applies to every business that handles FCI — there is no scenario where it is N/A. Even a one-person company is the 'authorized user' and must document it.",
    objectives: [
      {
        letter: "a",
        formalAsk: "Authorized users are identified.",
        prompt: "Do you have a current list of every person allowed to sign in to systems that touch FCI?",
        helpText:
          "Every user with an account counts: full-time staff, part-time contractors, the owner, even auditors with guest access. Service accounts and shared mailboxes count too. If you can't name them, you can't authorize them.",
        example:
          "An Excel file or M365 admin export listing 7 employees, 2 contractors, and 1 service account — each with email, role, and date authorized.",
      },
      {
        letter: "b",
        formalAsk: "Processes acting on behalf of authorized users are identified.",
        prompt: "Do you know what automated processes (backup jobs, sync clients, integrations) run as one of your users?",
        helpText:
          "When OneDrive syncs files in the background, when Power Automate sends an email, when a backup tool reads your file server — those are 'processes acting on behalf of a user.' For most small businesses this is a short list (OneDrive, the antivirus agent, maybe one or two integrations).",
        example:
          "A note on the roster: 'OneDrive sync runs under each user's M365 account. Backup runs under svc-backup. Power Automate flows run under owner@company.com.'",
      },
      {
        letter: "c",
        formalAsk: "Devices (and other systems) authorized to connect are identified.",
        prompt: "Do you have a list of every laptop, phone, and other device allowed to access company systems?",
        helpText:
          "Company-issued laptops, BYOD phones that pull email, the office printer if it has cloud access — anything that connects. Microsoft Intune and similar tools list this automatically. Otherwise, an inventory spreadsheet works.",
        example:
          "Intune device list export, or a spreadsheet with 9 laptops + 4 phones + 1 NAS, each tied to a user.",
      },
      {
        letter: "d",
        formalAsk: "System access is limited to authorized users.",
        prompt: "Are accounts disabled the day a person leaves or stops needing access?",
        helpText:
          "Identifying users isn't enough — the system has to enforce it. If a former employee's M365 account is still active 3 months after they quit, this objective fails even if they're crossed off the roster.",
        example:
          "A short offboarding checklist that ends with: 'Disabled M365 account, removed from groups, signed by owner on date.'",
      },
      {
        letter: "e",
        formalAsk: "System access is limited to processes acting on behalf of authorized users.",
        prompt: "Do automated processes (backup, sync, integrations) run with their own credentials, not a shared admin password?",
        helpText:
          "Service accounts should be specific to the job (e.g., svc-backup, not 'admin'). Disabled when retired. Documented like a user.",
        example:
          "Roster entry: 'svc-backup — used by Veeam to read \\\\fileserver. Created 2024-03. Disabled when Veeam is retired.'",
      },
      {
        letter: "f",
        formalAsk: "System access is limited to authorized devices (including other systems).",
        prompt: "Can a personal laptop or random device sign in to your company systems with just a username and password?",
        helpText:
          "Conditional Access in M365, Google's Context-Aware Access, or a VPN with device certificates all enforce this. If anyone with the password can sign in from any device, this objective fails.",
        example:
          "A screenshot of a Conditional Access policy: 'Require compliant or hybrid-joined device for all users accessing Office 365.'",
      },
    ],
    evidenceMethods: [
      {
        method: "examine",
        title: "Examine — show the policy",
        ask: "Upload your authorized-users roster (the document the assessor reads).",
        acceptedShape: [
          "Lists every user with name, email/username, role, and date authorized",
          "Includes service accounts and guest/contractor accounts",
          "Signed and dated by the owner or a senior person",
          "Reviewed at least annually (note the last review date)",
        ],
        formats: "CSV, Excel, PDF, or signed image",
      },
      {
        method: "test",
        title: "Test — show that it's enforced",
        ask: "Upload a screenshot from your M365 / Google Workspace admin console showing the live user list.",
        acceptedShape: [
          "Full window — not cropped to hide accounts",
          "Status column visible (Active / Disabled)",
          "Account count and date are visible",
          "The accounts shown match your roster",
        ],
        formats: "PNG / JPG screenshot, or admin-console CSV export",
      },
      {
        method: "interview",
        title: "Interview — attest to the practice",
        ask: "Sign a one-line statement that you actively maintain the roster.",
        acceptedShape: [
          "Names the person responsible (usually the owner)",
          "States the review cadence (annual minimum, plus on every personnel change)",
          "Dated within the last 12 months",
        ],
        formats: "Charlie can draft this for you in one click",
      },
    ],
  },
};

export function getPracticeGuide(controlId: string): PracticeGuide | null {
  return practiceGuides[controlId] ?? null;
}
