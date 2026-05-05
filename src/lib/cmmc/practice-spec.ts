/**
 * Per-practice grounding spec for the hybrid chat+evidence flow.
 *
 * Source: CMMC Self-Assessment Guide — Level 1, v2.0 (Dec 2021).
 * Each entry embeds the official practice statement + every NIST SP 800-171A
 * assessment objective letter. Charlie uses this verbatim — never paraphrases —
 * so users get assessor-grade accuracy.
 *
 * To add a new practice, follow the AC.L1-3.1.1 shape: copy the official
 * statement, list every objective, list the evidence slot kinds an assessor
 * would actually accept under the SAG's "Examine / Interview / Test" methods.
 */

export type EvidenceSlotKind =
  | "roster_csv"
  | "procedure_doc"
  | "screenshot"
  | "config_export"
  | "policy_doc"
  | "narrative";

/**
 * Each slot can be satisfied via up to three rails. The order of `destinations`
 * is the order Charlie + the UI recommend them — first one is the highlighted
 * "default" action, the rest are alternates.
 */
export type EvidenceDestination =
  | {
      type: "generate";
      /** human label for the button */
      label: string;
      /** filename Charlie should use when calling generate_evidence_artifact */
      filename: string;
      /** format the artifact will be produced in */
      format: "csv" | "markdown" | "text";
    }
  | {
      type: "connect";
      label: string;
      /** which connector providers can satisfy this slot */
      providers: Array<"m365" | "google_workspace">;
      /** what the connector will pull, in plain English */
      describes: string;
    }
  | {
      type: "upload";
      label: string;
      /** plain-English description of what the user should drag in */
      describes: string;
      /** mime hints for the dropzone accept attribute */
      accept?: string[];
    };

export type EvidenceSlot = {
  /** stable key for the slot, used as the evidence tag */
  key: string;
  label: string;
  /** plain-English explanation of what this slot is for */
  hint: string;
  kind: EvidenceSlotKind;
  /** which 800-171A objective letters this slot helps satisfy */
  satisfies: string[];
  /** is the slot required for MET, or supplementary? */
  required: boolean;
  /** if a CSV template ships with the platform, the public path */
  templatePath?: string;
  /** ordered list of how this slot can be filled (default first) */
  destinations: EvidenceDestination[];
};

export type PracticeSpec = {
  controlId: string;
  shortName: string;
  /** one-line plain-English summary shown in the header */
  oneLiner: string;
  /** the verbatim FAR/NIST control statement */
  statement: string;
  /** "Determine if:" objective letters from NIST 800-171A */
  objectives: Array<{ letter: string; text: string }>;
  /** the SAG "Further Discussion" copy, lightly adapted for chat use */
  furtherDiscussion: string;
  /** evidence slots an assessor would accept */
  evidenceSlots: EvidenceSlot[];
  /** key references (FAR, NIST) shown to the user on demand */
  keyReferences: string[];
};

export const practiceSpecs: Record<string, PracticeSpec> = {
  "AC.L1-3.1.1": {
    controlId: "AC.L1-3.1.1",
    shortName: "Authorized Access Control",
    oneLiner:
      "Only people, processes, and devices you've approved can sign in to systems that touch Federal Contract Information.",
    statement:
      "Limit information system access to authorized users, processes acting on behalf of authorized users, or devices (including other information systems).",
    objectives: [
      { letter: "a", text: "authorized users are identified" },
      { letter: "b", text: "processes acting on behalf of authorized users are identified" },
      { letter: "c", text: "devices (and other systems) authorized to connect to the system are identified" },
      { letter: "d", text: "system access is limited to authorized users" },
      { letter: "e", text: "system access is limited to processes acting on behalf of authorized users" },
      { letter: "f", text: "system access is limited to authorized devices (including other systems)" },
    ],
    furtherDiscussion:
      "Identify users, processes, and devices that are allowed to use company computers and can log on to the company network. Automated updates and other automatic processes should be associated with the user who initiated (authorized) the process. Limit the devices (e.g., printers) that can be accessed by company computers. Set up your system so that only authorized users, processes, and devices can access the company network. This practice (AC.L1-3.1.1) controls system access based on user, process, or device identity, and leverages IA.L1-3.5.1 which provides a vetted and trusted identity for access control.",
    evidenceSlots: [
      {
        key: "authorized_users_roster",
        label: "Authorized users roster",
        hint: "A current list of every person allowed to access systems that touch FCI: name, role, account/email, system, date authorized, date deauthorized.",
        kind: "roster_csv",
        satisfies: ["a", "d"],
        required: true,
        templatePath: "/templates/authorized-users-roster.csv",
        destinations: [
          {
            type: "generate",
            label: "Charlie generates from chat",
            filename: "authorized-users-roster.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Auto-collect from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the live tenant user list with names, roles, and emails — assessor-grade, dated, signed by your IdP.",
          },
          {
            type: "upload",
            label: "Upload your own",
            describes:
              "Drag in a CSV or PDF roster with name, role, account/email, system, date authorized.",
            accept: ["text/csv", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
          },
        ],
      },
      {
        key: "authorized_devices_inventory",
        label: "Authorized devices inventory",
        hint: "Every laptop, desktop, phone, server, and printer that can reach FCI: device name, type, owner, managed?, issued date.",
        kind: "roster_csv",
        satisfies: ["c", "f"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Charlie generates from chat",
            filename: "authorized-devices-inventory.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Auto-collect from Microsoft Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the managed-device list directly from your IdP — make/model, owner, last check-in.",
          },
          {
            type: "upload",
            label: "Upload your own",
            describes:
              "Drag in a CSV listing each device that can reach FCI.",
            accept: ["text/csv", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
          },
        ],
      },
      {
        key: "service_accounts_list",
        label: "Service accounts / automated processes",
        hint: "Every script, scheduled task, or service account that acts on a person's behalf: name, what it does, where it runs, the human owner.",
        kind: "roster_csv",
        satisfies: ["b", "e"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Charlie generates from chat",
            filename: "service-accounts-list.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Auto-collect service principals from Microsoft 365",
            providers: ["m365"],
            describes:
              "Pulls every Entra ID service principal + automation account that can sign in.",
          },
          {
            type: "upload",
            label: "Upload your own",
            describes:
              "Drag in a CSV/PDF listing each service account or automation that touches FCI.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      },
      {
        key: "access_procedure",
        label: "Access grant / removal procedure",
        hint: "A short written procedure (one paragraph is fine) that explains how access is granted, who approves it, and how access is removed when someone leaves or changes role.",
        kind: "procedure_doc",
        satisfies: ["d", "e", "f"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Charlie writes it from chat",
            filename: "access-grant-removal-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload your own procedure",
            describes:
              "If you already have a written procedure, drag in the PDF or DOCX.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "enforcement_proof",
        label: "Enforcement proof (screenshot or config)",
        hint: "Evidence the system actually enforces the list — e.g. an IdP group membership screenshot, an admin console screenshot showing the user list, or a file-share ACL export.",
        kind: "screenshot",
        satisfies: ["d", "e", "f"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Auto-collect from Microsoft 365 Conditional Access",
            providers: ["m365"],
            describes:
              "Pulls the active Conditional Access policy export — assessor-grade proof of enforcement.",
          },
          {
            type: "upload",
            label: "Upload a screenshot",
            describes:
              "Drag in a PNG/JPEG of your Windows local-user settings, IdP group membership, or admin console showing the authorized list. PDFs of ACL exports work too.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(i)", "NIST SP 800-171 Rev 2 §3.1.1"],
  },
};

export function getPracticeSpec(controlId: string): PracticeSpec | null {
  return practiceSpecs[controlId] ?? null;
}

/**
 * Best-effort: figure out which evidence slot an artifact belongs to.
 *
 * Charlie's `generate_evidence_artifact` tool emits filenames that match
 * `slot.key` with hyphens (e.g. `authorized-users-roster.csv` for slot
 * `authorized_users_roster`). User uploads tagged via the per-slot upload
 * form get an `[slot:KEY]__` prefix injected by the upload action. This
 * helper handles both, returning null when no slot can be inferred (legacy
 * pre-hybrid uploads).
 */
export function inferSlotKey(filename: string, spec: PracticeSpec): string | null {
  const lower = filename.toLowerCase();
  // Explicit prefix from per-slot upload form / Charlie's tool handler.
  const prefix = lower.match(/^\[slot:([a-z0-9_]+)\]__/);
  if (prefix) {
    const key = prefix[1];
    if (spec.evidenceSlots.some((s) => s.key === key)) return key;
  }
  // Charlie-generated filename heuristic — exact hyphenated key.
  for (const slot of spec.evidenceSlots) {
    const slotHyphen = slot.key.replace(/_/g, "-");
    if (lower.includes(slotHyphen)) return slot.key;
  }
  // Fuzzy fallback: every word of the slot key appears somewhere in the
  // filename. Catches "access-grant-removal-procedure.md" → access_procedure.
  // Pick the slot whose words have the highest combined match length.
  let best: { key: string; score: number } | null = null;
  for (const slot of spec.evidenceSlots) {
    const words = slot.key.split("_").filter((w) => w.length >= 4);
    if (words.length === 0) continue;
    if (!words.every((w) => lower.includes(w))) continue;
    const score = words.reduce((acc, w) => acc + w.length, 0);
    if (!best || score > best.score) best = { key: slot.key, score };
  }
  return best?.key ?? null;
}
