/**
 * Per-practice grounding spec for the hybrid chat+evidence flow.
 *
 * Source: CMMC Self-Assessment Guide — Level 1, v2.0 (Dec 2021)
 * + NIST SP 800-171A assessment objectives.
 * Each entry embeds the official practice statement + every objective
 * letter VERBATIM. Charlie quotes from this file — he never paraphrases —
 * so users get assessor-grade accuracy.
 *
 * ── HOW TO ADD A NEW PRACTICE ─────────────────────────────────────────────
 *
 * 1. Open the SAG v2.0 PDF and find the practice's section.
 *    Copy `statement` and every "Determine if:" objective letter VERBATIM.
 *
 * 2. Pick the smallest set of `evidenceSlots` an assessor would actually
 *    accept. Each slot must have:
 *      - a stable `key` (snake_case; this becomes the artifact tag)
 *      - a `satisfies: ["a", "b", ...]` listing every objective letter the
 *        slot supports (the grader uses this to credit objectives)
 *      - a `kind` (roster_csv | procedure_doc | screenshot | config_export
 *        | policy_doc | narrative)
 *      - `required: true` for slots needed to reach MET; supplementary
 *        slots can be optional
 *
 * 3. For every slot, declare 1–3 `destinations` in PRIORITY ORDER. The
 *    first one is the highlighted "recommended" button. Pick from:
 *      - generate  → Charlie creates the artifact via tool call. Use this
 *                    when the artifact is composed from facts the user can
 *                    state in chat (rosters, procedures, narratives).
 *                    Skip this destination when the artifact MUST come
 *                    from a real system (you can't fake a screenshot).
 *      - connect   → an OAuth'd connector pulls live data. Use for live
 *                    rosters/inventories/policy exports. List every
 *                    `provider` that can satisfy the slot (m365, google_workspace).
 *      - upload    → user drags in their own file. ALWAYS include this as
 *                    a fallback. Use the `accept` array to gate MIME types
 *                    (CSV/PDF for rosters, PNG/JPEG/PDF for screenshots).
 *
 * 4. If the platform ships a CSV template under public/templates/, set
 *    `templatePath: "/templates/<name>.csv"`.
 *
 * 5. Set `keyReferences` to the FAR clause + NIST citation; users see this
 *    on demand for assessor traceability.
 *
 * 6. The middle pane, Charlie's system prompt, the per-practice progress
 *    bar, and the slot-tag inference all read from this spec — once the
 *    entry is added, the practice page works automatically.
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

/**
 * Per-practice intake ("TurboTax for the practice"): a short set of
 * fact-finding questions whose answers personalize the evidence slot list.
 *
 * Every question MUST be anchored in the official standard (NIST SP 800-171A
 * Rev 2, CMMC Self-Assessment Guide — Level 1 v2.13, or FAR 52.204-21). The
 * `regAnchor` + `regQuote` fields surface that traceability in the UI so a
 * user can always see *why* we're asking and which assessor objective it
 * maps to. This is a compliance product — no business-vibes questions.
 *
 * Critical invariant: intake NEVER excuses a NIST 800-171A objective.
 * Every objective letter still has to reach "covered" before MET. Intake
 * answers only personalize the *path* (which evidence slot, which
 * destination, what auto-narrative replaces a roster when none exists).
 * If an answer means a roster is genuinely N/A (e.g. "no processes act on
 * behalf of users"), the matching slot collapses into a signed-attestation
 * card that itself satisfies the objective — the objective is still
 * covered, by attestation rather than artifact.
 */
export type IntakeOption = {
  /** stable id stored in intake_answers JSON */
  value: string;
  /** what the user sees on the chip */
  label: string;
  /** optional one-liner under the chip for clarification */
  description?: string;
};

export type IntakeQuestion = {
  /** stable id (snake_case) — keys the `intake_answers` JSONB envelope */
  id: string;
  /** user-facing prompt */
  prompt: string;
  /** which 800-171A objective letter(s) this question shapes the path for */
  objectives: string[];
  /** plain-English citation, e.g. "NIST SP 800-171A §3.5.1 objective [a]" */
  regAnchor: string;
  /** verbatim passage from the standard that drives the question */
  regQuote: string;
  /** answer chips, exactly one selected per question */
  options: IntakeOption[];
  /** optional helper text shown above the options */
  helpText?: string;
  /** if true, the user can pick "Not sure" and Charlie will follow up */
  allowNotSure?: boolean;
};

/** A specific slot rewrite that a single intake answer can produce. */
export type SlotAnnotation = {
  /** which destination index (in slot.destinations) should be highlighted */
  recommendedDestinationIdx?: number;
  /** "Based on what you told us" callout shown above the slot's actions */
  contextNote?: string;
  /**
   * If set, replaces the slot's normal destinations with a one-click signed
   * attestation that itself satisfies the slot's objectives. Used when the
   * user's environment makes a roster-style artifact inapplicable (e.g. no
   * service accounts means objective [b] is satisfied by a written
   * attestation, not by a list).
   */
  attestation?: {
    /** Plain-English label for the attestation button */
    buttonLabel: string;
    /** The exact narrative line written into the SSP and audit trail */
    autoNarrative: string;
    /** Reason shown to the user for why a roster is not needed here */
    reason: string;
  };
};

export type PracticeIntakeSpec = {
  /** Lead copy shown above the first question. Cite the relevant guide. */
  preamble: string;
  questions: IntakeQuestion[];
  /**
   * Pure transform: given a complete answers map, return the per-slot
   * annotations + any extra dynamic slots the answers introduced (e.g. a
   * "shared-credential exception register" only required when the user
   * says shared logins exist).
   */
  personalize: (answers: IntakeAnswers) => IntakePersonalization;
  /**
   * Short markdown block injected into Charlie's system prompt so his
   * first message is grounded in the user's environment instead of
   * starting from zero.
   */
  charlieBrief: (answers: IntakeAnswers) => string;
};

export type IntakeAnswers = Record<string, string>;

export type IntakePersonalization = {
  /** Annotations keyed by evidenceSlot.key */
  slotAnnotations: Record<string, SlotAnnotation>;
  /** Extra slots added by the answers (rare; e.g. shared-account register) */
  dynamicSlots: EvidenceSlot[];
  /** Slot keys that should be hidden completely (rare; pre-attested elsewhere) */
  hiddenSlotKeys: string[];
  /**
   * One-line situation summary shown above the slot list and stamped into
   * the SSP. Plain English, no jargon.
   */
  situationSummary: string;
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
  /**
   * Optional intake gate ("TurboTax for the practice"). When set, the
   * practice page renders the intake before showing slots, then uses
   * `intake.personalize(answers)` to tailor the slot list. Practices
   * without an intake spec render slots immediately, unchanged.
   */
  intake?: PracticeIntakeSpec;
};

// ────────────────────────────────────────────────────────────────────────
// Intake spec — IA.L1-3.5.1 (Identification)
//
// Every question below is anchored to an assessor-facing primary source:
//   • NIST SP 800-171A Rev 2 §3.5.1 determination statements [a], [b], [c]
//   • CMMC Self-Assessment Guide — Level 1 v2.13, IA.L1-b.1.v ("Further
//     Discussion" + "Potential Assessment Considerations")
//   • FAR 52.204-21(b)(1)(v)
//
// Hard rule: intake answers NEVER drop an objective. They route the
// evidence path. For example, "no processes act on behalf of users" turns
// objective [b]'s slot into a signed attestation card — the objective is
// still satisfied, just by attestation rather than by a roster.
// ────────────────────────────────────────────────────────────────────────
const IA351_QUESTIONS: IntakeQuestion[] = [
  {
    id: "idp",
    objectives: ["a"],
    prompt:
      "Where do the people who touch Federal Contract Information sign in?",
    helpText:
      "Whichever system is the authoritative source for who can log in. We'll pull (or generate) the unique-ID roster from here.",
    regAnchor: "NIST SP 800-171A §3.5.1 [a]; CMMC L1 SAG (v2.13) Further Discussion",
    regQuote:
      "Determine if: [a] system users are identified. … Identify the users, processes, and devices that are allowed to use company computers and can log on to the company network.",
    options: [
      { value: "m365", label: "Microsoft 365 / Entra ID" },
      { value: "google", label: "Google Workspace" },
      { value: "hybrid", label: "Both M365 and Google" },
      { value: "ad_onprem", label: "On-prem Active Directory" },
      {
        value: "local_only",
        label: "Local accounts only",
        description: "No central IdP — accounts live on individual machines.",
      },
    ],
  },
  {
    id: "devices",
    objectives: ["c"],
    prompt:
      "How do you keep track of the laptops, desktops, and phones that can reach FCI?",
    helpText:
      "Pick whatever you actually use today. We're matching you to an evidence path, not grading you.",
    regAnchor:
      "NIST SP 800-171A §3.5.1 [c]; CMMC L1 SAG (v2.13) Further Discussion",
    regQuote:
      "Determine if: [c] devices accessing the system are identified. … any other device an employee may use to log on to the company network and conduct work tasks.",
    options: [
      { value: "intune", label: "Microsoft Intune / Entra-joined" },
      { value: "google_endpoint", label: "Google Endpoint Management" },
      { value: "other_mdm", label: "Another MDM (Jamf, Kandji, etc.)" },
      { value: "ad_domain", label: "On-prem Active Directory" },
      {
        value: "manual_csv",
        label: "A spreadsheet I keep by hand",
        description: "Inventory exists, but it's not pulled from a tool.",
      },
      {
        value: "none",
        label: "No inventory yet",
        description: "We'll help you draft one with Charlie.",
      },
    ],
  },
  {
    id: "processes",
    objectives: ["b"],
    prompt:
      "Are there any non-human accounts or automations that read or move FCI?",
    helpText:
      "Service accounts, scheduled tasks, integrations (Zapier/Power Automate), backup agents, RMM/PSA tools, and the like.",
    regAnchor:
      "NIST SP 800-171A §3.5.1 [b]; CMMC L1 SAG (v2.13) Further Discussion",
    regQuote:
      "Determine if: [b] processes acting on behalf of users are identified. … Automated updates and other automatic processes should be associated with the user who initiated (authorized) the process.",
    options: [
      {
        value: "idp_managed",
        label: "Yes — they live in our IdP as service accounts",
      },
      {
        value: "external",
        label: "Yes — but they live outside the IdP (RMM, app-level, scripts)",
      },
      {
        value: "none",
        label: "No — only people log in, nothing automated touches FCI",
        description: "We'll convert this slot into a signed attestation.",
      },
      {
        value: "unsure",
        label: "Not sure",
        description: "Charlie will help you figure it out.",
      },
    ],
  },
  {
    id: "shared_credentials",
    objectives: ["a"],
    prompt:
      "Does any login on an FCI system get shared between more than one person?",
    helpText:
      "Examples: an info@ mailbox someone else can read, a reception PC that everyone uses, an admin password kept in a vault and reused.",
    regAnchor:
      "NIST SP 800-171A §3.5.1 [a]; NIST SP 800-171 Rev 2 §3.5.1 Discussion",
    regQuote:
      "Identifying who is requesting access … is essential to authorize access. … Common device identifiers include … Authentication of user identities is accomplished through the use of passwords, tokens, biometrics …",
    options: [
      {
        value: "no",
        label: "No — every login belongs to one person",
      },
      {
        value: "yes",
        label: "Yes — one or more shared logins exist",
        description:
          "We'll add a register so each shared credential has a named owner and a plan to retire it.",
      },
    ],
  },
];

const IDP_LABEL: Record<string, string> = {
  m365: "Microsoft 365 / Entra ID",
  google: "Google Workspace",
  hybrid: "Microsoft 365 + Google Workspace",
  ad_onprem: "on-prem Active Directory",
  local_only: "local machine accounts only",
};

const DEVICE_LABEL: Record<string, string> = {
  intune: "Microsoft Intune",
  google_endpoint: "Google Endpoint Management",
  other_mdm: "an MDM (Jamf/Kandji/other)",
  ad_domain: "on-prem Active Directory",
  manual_csv: "a hand-maintained spreadsheet",
  none: "no device inventory yet",
};

const PROCESSES_LABEL: Record<string, string> = {
  idp_managed: "service accounts managed in the IdP",
  external: "automations that live outside the IdP",
  none: "no non-human processes that touch FCI",
  unsure: "unsure — to be confirmed with Charlie",
};

const ia351Intake: PracticeIntakeSpec = {
  preamble:
    "Three quick questions about your environment — every question maps to a specific NIST 800-171A determination statement for IA.L1-3.5.1. Your answers personalize the evidence list so you only get asked for what an assessor would actually check for *your* setup. None of the three objectives will be skipped — only the path to satisfying them changes.",
  questions: IA351_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    // ─── Objective [a] · user_identifiers_list ───
    // Route the roster path based on where users actually sign in.
    const idp = answers.idp;
    if (idp === "m365" || idp === "hybrid") {
      slotAnnotations.user_identifiers_list = {
        // destinations[1] is the M365/Google connector
        recommendedDestinationIdx: 1,
        contextNote:
          "You said your users sign in through Microsoft 365 / Entra ID — the fastest path is to connect M365 and let Charlie pull the unique-principal list. We'll fall back to a CSV if the connector isn't available.",
      };
    } else if (idp === "google") {
      slotAnnotations.user_identifiers_list = {
        recommendedDestinationIdx: 1,
        contextNote:
          "You said your users sign in through Google Workspace — the fastest path is to connect Google and pull the unique-account list.",
      };
    } else if (idp === "ad_onprem") {
      slotAnnotations.user_identifiers_list = {
        // destinations[2] is upload (Get-ADUser export)
        recommendedDestinationIdx: 2,
        contextNote:
          "On-prem AD: export your users with `Get-ADUser -Filter * | Select SamAccountName, UserPrincipalName, Enabled | Export-Csv` and upload that file. Charlie can guide you if you'd rather draft a roster manually.",
      };
    } else if (idp === "local_only") {
      slotAnnotations.user_identifiers_list = {
        // destinations[0] is generate-with-Charlie
        recommendedDestinationIdx: 0,
        contextNote:
          "Local accounts only — there's no IdP to pull from, so we'll draft the unique-IDs roster with Charlie. You'll list each machine's local account by user, then we'll save the roster as evidence.",
      };
    }

    // ─── Objective [b] · process_identifiers_list ───
    // The critical "no processes" case: collapse the slot into a signed
    // attestation. The objective is still satisfied — by attestation, not
    // by a roster. The verifier sees the attestation and credits [b].
    const processes = answers.processes;
    if (processes === "none") {
      slotAnnotations.process_identifiers_list = {
        attestation: {
          buttonLabel: "Attest: no non-human processes touch FCI",
          autoNarrative:
            "The organization attests that no automated processes, service accounts, scheduled tasks, integrations, or other non-human actors access Federal Contract Information systems. Only authenticated human users interact with FCI. This attestation satisfies NIST SP 800-171A §3.5.1 determination statement [b] for this environment; if a non-human process is introduced in the future the organization will create a unique service identity and re-open this objective.",
          reason:
            "You said no automated processes touch FCI — under NIST 800-171A this objective is satisfied by a signed attestation rather than a roster. The attestation is stamped with your account, the date, and is included verbatim in the SSP.",
        },
      };
    } else if (processes === "idp_managed") {
      slotAnnotations.process_identifiers_list = {
        recommendedDestinationIdx: 1, // M365 connector
        contextNote:
          "You said service accounts live in your IdP — connect M365 to pull every service principal and automation account in one click.",
      };
    } else if (processes === "external") {
      slotAnnotations.process_identifiers_list = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "Automations live outside your IdP — Charlie will walk you through listing each one (RMM agent, scheduled task, integration) with the human owner accountable for it.",
      };
    } else if (processes === "unsure") {
      slotAnnotations.process_identifiers_list = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Not sure yet — start by chatting with Charlie. He'll ask about RMM, backups, integrations, and scheduled tasks, and either draft the list with you or convert this into a signed attestation if it turns out nothing applies.",
      };
    }

    // ─── Objective [c] · device_identifiers_list ───
    const devices = answers.devices;
    if (devices === "intune") {
      slotAnnotations.device_identifiers_list = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Intune is connected to your evidence pipeline — pull the device list and we'll match it to objective [c] automatically.",
      };
    } else if (devices === "google_endpoint") {
      slotAnnotations.device_identifiers_list = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Connect Google Workspace and we'll pull the endpoint-management device list (hostname + serial + last-seen user).",
      };
    } else if (devices === "other_mdm" || devices === "ad_domain") {
      slotAnnotations.device_identifiers_list = {
        recommendedDestinationIdx: 2, // upload
        contextNote:
          devices === "other_mdm"
            ? "Export the device list from your MDM and upload the CSV — Charlie will check that it includes a unique identifier (hostname or serial) and an owner for every row."
            : "Export your AD computer objects (`Get-ADComputer -Filter * | Select Name, OperatingSystem, LastLogonDate | Export-Csv`) and upload the result.",
      };
    } else if (devices === "manual_csv") {
      slotAnnotations.device_identifiers_list = {
        recommendedDestinationIdx: 2,
        contextNote:
          "Upload the spreadsheet you already maintain — Charlie will review it against the assessor checklist (unique identifier + owner per device).",
      };
    } else if (devices === "none") {
      slotAnnotations.device_identifiers_list = {
        recommendedDestinationIdx: 0,
        contextNote:
          "No inventory yet — Charlie will draft one with you. We'll start with the laptops + phones that can open email or your file share.",
      };
    }

    // ─── Shared credentials: adds an exception register slot ───
    // Doesn't change objective [a]'s primary slot, but adds a register
    // documenting each shared credential's owner + retirement plan. CMMC
    // L1 SAG Further Discussion makes clear shared accounts undermine
    // accountability; the register documents the compensating control.
    if (answers.shared_credentials === "yes") {
      dynamicSlots.push({
        key: "shared_credential_register",
        label: "Shared-credential register",
        hint: "For every login that's shared between more than one person, record: the login, every human who knows the password, the named owner, the reason it can't be split yet, and the plan + target date to retire it.",
        kind: "roster_csv",
        satisfies: ["a"],
        required: true,
        templatePath: "/templates/role-matrix.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my shared-credential register with Charlie",
            filename: "shared-credential-register.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing register",
            describes: "CSV or PDF listing each shared login + named owner.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      });
    }

    const situationSummary = [
      `Users sign in through ${IDP_LABEL[idp] ?? "an unspecified system"}.`,
      `Device inventory comes from ${DEVICE_LABEL[devices] ?? "an unspecified source"}.`,
      `Non-human access: ${PROCESSES_LABEL[processes] ?? "unspecified"}.`,
      answers.shared_credentials === "yes"
        ? "One or more shared logins exist — a shared-credential register is included as a compensating control."
        : "No shared logins; every account has one named owner.",
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's environment",
      `- Identity provider: ${IDP_LABEL[answers.idp] ?? "(not specified)"}`,
      `- Device inventory source: ${DEVICE_LABEL[answers.devices] ?? "(not specified)"}`,
      `- Non-human processes that touch FCI: ${PROCESSES_LABEL[answers.processes] ?? "(not specified)"}`,
      `- Shared logins exist: ${answers.shared_credentials === "yes" ? "YES — at least one. Treat as compensating-control territory; require a register with owner + retirement plan." : "No — every login belongs to one person."}`,
      "",
      "Do NOT re-ask these facts. Skip generic intros. Open by acknowledging the environment in one sentence, then drive the next concrete step toward satisfying the objective letter that's still missing. If `processes = none`, objective [b] is satisfied by attestation — confirm the attestation is captured rather than chasing a roster.",
    ].join("\n");
  },
};

/**
 * Run a practice's intake personalization safely.
 *
 * - If the practice has no intake spec, returns the original spec unchanged.
 * - If the intake spec exists but answers are incomplete (or missing), returns
 *   the original spec unchanged. The page renders the intake UI in that case.
 * - If answers are complete, returns a new spec where evidenceSlots have been
 *   tailored, attestation-only slots are tagged, and any answer-driven
 *   dynamic slots are appended.
 */
export type PersonalizedSpec = PracticeSpec & {
  /** Per-slot annotations (recommended destination, attestation, etc.) */
  slotAnnotations: Record<string, SlotAnnotation>;
  /** Human-readable summary of the user's environment */
  situationSummary: string;
};

export function personalizeSpec(
  spec: PracticeSpec,
  answers: IntakeAnswers | null,
): PersonalizedSpec | null {
  if (!spec.intake) return null;
  if (!answers) return null;
  // Every question must be answered to apply personalization.
  for (const q of spec.intake.questions) {
    if (!answers[q.id]) return null;
  }
  const { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary } =
    spec.intake.personalize(answers);
  const evidenceSlots: EvidenceSlot[] = [
    ...spec.evidenceSlots.filter((s) => !hiddenSlotKeys.includes(s.key)),
    ...dynamicSlots,
  ];
  return { ...spec, evidenceSlots, slotAnnotations, situationSummary };
}

/**
 * True if the user has answered every required question in the practice's
 * intake. Used by both the page and the verifier to decide whether to apply
 * personalization or surface the intake UI.
 */
export function isIntakeComplete(
  spec: PracticeSpec,
  answers: IntakeAnswers | null,
): boolean {
  if (!spec.intake) return true; // no intake = always "complete"
  if (!answers) return false;
  return spec.intake.questions.every((q) => Boolean(answers[q.id]));
}

// ────────────────────────────────────────────────────────────────────────
// Client-safe shapes. RSC cannot serialize functions across the
// server→client boundary; the `personalize` / `charlieBrief` callbacks on
// `PracticeIntakeSpec` must be stripped before the spec is passed to a
// "use client" component. These helpers produce plain-data clones that
// keep every field the client UI actually reads.
// ────────────────────────────────────────────────────────────────────────
export type ClientPracticeIntakeSpec = {
  preamble: string;
  questions: IntakeQuestion[];
};

export type ClientPracticeSpec = Omit<PracticeSpec, "intake"> & {
  intake?: ClientPracticeIntakeSpec;
};

export type ClientPersonalizedSpec = ClientPracticeSpec & {
  slotAnnotations: Record<string, SlotAnnotation>;
  situationSummary: string;
};

export function toClientPracticeSpec(spec: PracticeSpec): ClientPracticeSpec {
  const { intake, ...rest } = spec;
  if (!intake) return { ...rest };
  return {
    ...rest,
    intake: { preamble: intake.preamble, questions: intake.questions },
  };
}

export function toClientPersonalizedSpec(
  personalized: PersonalizedSpec | null,
): ClientPersonalizedSpec | null {
  if (!personalized) return null;
  const base = toClientPracticeSpec(personalized);
  return {
    ...base,
    slotAnnotations: personalized.slotAnnotations,
    situationSummary: personalized.situationSummary,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// IA.L1-3.5.2 intake (Authentication)
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the 3.5.1 pattern — every question maps to one of the 800-171A
// determination statements ([a] user auth / [b] process auth / [c] device
// auth). The "no automations" answer collapses objective [b]'s slot into
// a signed attestation; every other answer simply re-routes the path
// (connector vs upload vs generate-with-Charlie) without skipping anything.

const IA352_QUESTIONS: IntakeQuestion[] = [
  {
    id: "mfa_method",
    objectives: ["a"],
    prompt:
      "How do the humans who touch FCI prove who they are when they sign in?",
    helpText:
      "Pick what's enforced today, not what's on the roadmap. We'll match you to the right evidence path.",
    regAnchor:
      "NIST SP 800-171A §3.5.2 [a]; CMMC L1 SAG (v2.13) Further Discussion",
    regQuote:
      "Determine if: [a] the identity of each user is authenticated or verified as a prerequisite to system access. … Authentication is achieved through the use of any one or combination of passwords, tokens (something you possess), biometrics, or, in the case of multi-factor authentication, some combination thereof.",
    options: [
      {
        value: "m365_ca",
        label: "Microsoft 365 Conditional Access enforces MFA",
        description:
          "Entra Conditional Access policy requires MFA for every user touching FCI.",
      },
      {
        value: "google_2sv",
        label: "Google Workspace 2-Step Verification (enforced)",
      },
      {
        value: "other_idp",
        label: "Another IdP enforces MFA (Okta, JumpCloud, Duo…)",
      },
      {
        value: "per_app",
        label: "MFA at the app level (per-app, not centrally enforced)",
        description:
          "Each SaaS app has its own MFA toggle and we rely on those.",
      },
      {
        value: "password_only",
        label: "Password only — no MFA today",
        description:
          "We'll still need MFA evidence eventually; Charlie will help you get there.",
      },
    ],
  },
  {
    id: "process_auth",
    objectives: ["b"],
    prompt:
      "How do non-human accounts (service accounts, scripts, integrations) authenticate?",
    helpText:
      "If you said 'no non-human accounts' on IA.L1-3.5.1, pick the matching option here — we'll collapse this into an attestation.",
    regAnchor:
      "NIST SP 800-171A §3.5.2 [b]; NIST SP 800-171 Rev 2 §3.5.2 Discussion",
    regQuote:
      "Determine if: [b] the identity of each process acting on behalf of a user is authenticated or verified as a prerequisite to system access. … Authenticators include passwords, cryptographic devices, biometrics, certificates, one-time password devices, and ID badges.",
    options: [
      {
        value: "managed_identity",
        label: "Managed identities / workload identities in our IdP",
        description:
          "Entra managed identity, Google service account, IAM role — no static secret in code.",
      },
      {
        value: "vaulted_secret",
        label: "Client secrets or API keys stored in a secrets vault",
        description:
          "Azure Key Vault, AWS Secrets Manager, 1Password, Doppler, etc.",
      },
      {
        value: "certificate",
        label: "Certificate-based authentication",
      },
      {
        value: "hardcoded",
        label: "Secrets are in config files / env vars on the host",
        description:
          "We'll flag this as a finding and Charlie will walk you to a vaulted path.",
      },
      {
        value: "none",
        label: "No automations touch FCI",
        description:
          "Objective [b] is satisfied by a signed attestation — no roster needed.",
      },
    ],
  },
  {
    id: "device_auth",
    objectives: ["c"],
    prompt:
      "How does a laptop or phone prove it's allowed to connect before it reaches FCI?",
    helpText:
      "Device authentication is separate from user authentication — the assessor wants both. Pick the strongest mechanism in place.",
    regAnchor:
      "NIST SP 800-171A §3.5.2 [c]; CMMC L1 SAG (v2.13) Further Discussion",
    regQuote:
      "Determine if: [c] the identity of each device accessing or connecting to the system is authenticated or verified as a prerequisite to system access. … Devices may be identified by MAC, IP address, or device certificate.",
    options: [
      {
        value: "intune_compliant",
        label: "Intune / Entra device compliance gates access",
        description:
          "Conditional Access requires a compliant, Entra-joined device.",
      },
      {
        value: "google_managed",
        label: "Google endpoint management with context-aware access",
      },
      {
        value: "domain_joined",
        label: "On-prem domain-joined machines only",
      },
      {
        value: "cert_based",
        label: "Device certificates (Wi-Fi 802.1x, VPN cert, mTLS)",
      },
      {
        value: "unmanaged",
        label: "Personal / unmanaged devices can connect",
        description:
          "We'll require a written narrative explaining how access is constrained.",
      },
    ],
  },
  {
    id: "password_policy",
    objectives: ["a"],
    prompt:
      "Do you have a written password / authentication policy today?",
    helpText:
      "Even a one-page version counts. The assessor will look for minimum length, complexity, rotation, lockout, and MFA scope.",
    regAnchor:
      "NIST SP 800-171A §3.5.2 [a]; NIST SP 800-171 Rev 2 §3.5.2 Discussion",
    regQuote:
      "Authenticators include … passwords … Authentication of user identities is accomplished through the use of passwords, tokens, biometrics, or some combination thereof.",
    options: [
      {
        value: "have_doc",
        label: "Yes — I have a policy I can upload",
      },
      {
        value: "informal",
        label: "We follow rules but nothing is written down",
        description: "Charlie will draft one based on what you tell him.",
      },
      {
        value: "none",
        label: "No policy yet",
        description: "Charlie will draft one from scratch.",
      },
    ],
  },
];

const MFA_LABEL: Record<string, string> = {
  m365_ca: "Microsoft 365 Conditional Access (MFA enforced)",
  google_2sv: "Google Workspace 2-Step Verification (enforced)",
  other_idp: "a third-party IdP (Okta/JumpCloud/Duo/…)",
  per_app: "per-app MFA toggles (no central enforcement)",
  password_only: "passwords only — no MFA enforced yet",
};

const PROCESS_AUTH_LABEL: Record<string, string> = {
  managed_identity: "managed / workload identities in the IdP",
  vaulted_secret: "client secrets in a secrets vault",
  certificate: "certificate-based authentication",
  hardcoded: "secrets in config files (FINDING — needs remediation)",
  none: "no automations touch FCI",
};

const DEVICE_AUTH_LABEL: Record<string, string> = {
  intune_compliant: "Intune compliance gating via Conditional Access",
  google_managed: "Google endpoint management + context-aware access",
  domain_joined: "on-prem domain-joined machines",
  cert_based: "device certificates (802.1x / VPN / mTLS)",
  unmanaged: "unmanaged / personal devices (narrative compensating control)",
};

const ia352Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about how people, processes, and devices prove who they are. Every question maps to a specific NIST 800-171A determination statement for IA.L1-3.5.2. Your answers route the evidence path — none of the three objectives are skipped.",
  questions: IA352_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    // ─── Objective [a] · mfa_enforcement slot ───
    const mfa = answers.mfa_method;
    if (mfa === "m365_ca" || mfa === "google_2sv") {
      slotAnnotations.mfa_enforcement = {
        recommendedDestinationIdx: 0, // connect
        contextNote:
          mfa === "m365_ca"
            ? "Connect Microsoft 365 — Charlie pulls your Conditional Access policy + MFA registration report and tags the artifact to objective [a]."
            : "Connect Google Workspace — Charlie pulls the 2SV enforcement report and tags it to objective [a].",
      };
    } else if (mfa === "other_idp") {
      slotAnnotations.mfa_enforcement = {
        recommendedDestinationIdx: 1, // upload
        contextNote:
          "You're on a third-party IdP — export the MFA enforcement / user MFA-status report from Okta/JumpCloud/Duo and upload the PDF or PNG.",
      };
    } else if (mfa === "per_app") {
      slotAnnotations.mfa_enforcement = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Per-app MFA: upload one screenshot from each material app (M365, Google, your file-share, your accounting system). Charlie will check that every app touching FCI has MFA shown ON.",
      };
    } else if (mfa === "password_only") {
      slotAnnotations.mfa_enforcement = {
        recommendedDestinationIdx: 1,
        contextNote:
          "No MFA today — this is the #1 finding on CMMC L1 assessments. Charlie will walk you through enabling MFA in M365 or Google in ~10 minutes, then come back here to upload the screenshot.",
      };
    }

    // ─── Objective [a] · password_policy slot ───
    const pwPolicy = answers.password_policy;
    if (pwPolicy === "have_doc") {
      slotAnnotations.password_policy = {
        recommendedDestinationIdx: 1, // upload
        contextNote:
          "You said you already have a written policy — upload it as-is. Charlie will check it covers minimum length, complexity, rotation, lockout, and MFA scope; if anything is missing, he'll patch the doc with you.",
      };
    } else if (pwPolicy === "informal" || pwPolicy === "none") {
      slotAnnotations.password_policy = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          pwPolicy === "informal"
            ? "Have Charlie draft the policy — he'll ask you the 5 questions assessors check (length, complexity, rotation, lockout, MFA scope) and produce a one-page authentication policy ready to sign."
            : "Charlie will draft an authentication policy from scratch matched to NIST SP 800-171 Rev 2 §3.5.x and your environment. Two minutes, signed evidence at the end.",
      };
    }

    // ─── Objective [b] · process_auth_method slot ───
    const procAuth = answers.process_auth;
    if (procAuth === "none") {
      slotAnnotations.process_auth_method = {
        attestation: {
          buttonLabel: "Attest: no non-human processes touch FCI",
          autoNarrative:
            "The organization attests that no automated processes, service accounts, scheduled tasks, or integrations authenticate to systems containing Federal Contract Information. Only authenticated human users perform actions on FCI. This attestation satisfies NIST SP 800-171A §3.5.2 determination statement [b] for this environment; if a non-human process is introduced in the future, the organization will document its authentication mechanism (managed identity, vaulted secret, or certificate) and re-open this objective.",
          reason:
            "You said no automations touch FCI — under NIST 800-171A this objective is satisfied by a signed attestation rather than a narrative. The attestation is stamped with your account and the date, and is included verbatim in the SSP.",
        },
      };
    } else if (procAuth === "managed_identity") {
      slotAnnotations.process_auth_method = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          "Managed identities — strongest path. Charlie will draft a short narrative listing each workload identity (Entra managed identity / Google service account / IAM role), the resource it accesses, and the human owner. No secrets to rotate, no vault to document.",
      };
    } else if (procAuth === "vaulted_secret") {
      slotAnnotations.process_auth_method = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Vaulted secrets — name your vault (Azure Key Vault / AWS Secrets Manager / 1Password / Doppler), the service accounts that pull from it, and the rotation cadence. Charlie will assemble the narrative; you'll add the vault name + rotation schedule.",
      };
    } else if (procAuth === "certificate") {
      slotAnnotations.process_auth_method = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Cert-based auth — Charlie will draft a narrative describing where the certificates are issued (internal CA / public CA / device cert), the renewal cadence, and what authenticates with them.",
      };
    } else if (procAuth === "hardcoded") {
      slotAnnotations.process_auth_method = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Secrets in config files is the most common L1 finding. Charlie will help you (1) inventory where the secrets live, (2) document a 30-day remediation plan to a vault, (3) produce both the current-state narrative and a Plan of Action & Milestones entry — both required artifacts.",
      };
    }

    // ─── Objective [c] · device_auth_evidence slot ───
    const devAuth = answers.device_auth;
    if (devAuth === "intune_compliant") {
      slotAnnotations.device_auth_evidence = {
        recommendedDestinationIdx: 0, // connect
        contextNote:
          "Connect Microsoft 365 — Charlie pulls the Intune compliance policy + the Conditional Access rule that requires a compliant device, and tags both to objective [c].",
      };
    } else if (devAuth === "google_managed") {
      slotAnnotations.device_auth_evidence = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Connect Google Workspace — Charlie pulls the endpoint management policy and any context-aware access rules tied to device posture.",
      };
    } else if (devAuth === "domain_joined") {
      slotAnnotations.device_auth_evidence = {
        recommendedDestinationIdx: 1, // upload
        contextNote:
          "Upload screenshots of (1) the domain-membership requirement in Group Policy, and (2) one client showing it's domain-joined (System Properties > Computer Name). Charlie will tag both.",
      };
    } else if (devAuth === "cert_based") {
      slotAnnotations.device_auth_evidence = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Upload screenshots of the cert-issuance config (CA template, MDM cert profile, VPN/Wi-Fi 802.1x policy). One image per layer is enough — Charlie will check coverage.",
      };
    } else if (devAuth === "unmanaged") {
      slotAnnotations.device_auth_evidence = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Unmanaged devices are allowed under L1 only if you have a written compensating-control narrative: how access is constrained (browser-only, no local FCI storage, app-level MFA on every login). Charlie will draft this narrative with you — upload it when ready.",
      };
    }

    const situationSummary = [
      `MFA: ${MFA_LABEL[mfa] ?? "(unspecified)"}.`,
      `Process authentication: ${PROCESS_AUTH_LABEL[procAuth] ?? "(unspecified)"}.`,
      `Device authentication: ${DEVICE_AUTH_LABEL[devAuth] ?? "(unspecified)"}.`,
      pwPolicy === "have_doc"
        ? "Authentication policy already documented."
        : "Authentication policy will be drafted with Charlie.",
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's authentication setup",
      `- MFA mechanism: ${MFA_LABEL[answers.mfa_method] ?? "(not specified)"}`,
      `- Process / service-account auth: ${PROCESS_AUTH_LABEL[answers.process_auth] ?? "(not specified)"}`,
      `- Device authentication: ${DEVICE_AUTH_LABEL[answers.device_auth] ?? "(not specified)"}`,
      `- Written auth policy: ${answers.password_policy === "have_doc" ? "YES — uploaded" : "NO — drafting with Charlie"}`,
      "",
      "Do NOT re-ask these facts. Open by acknowledging the environment in one sentence, then drive toward the missing objective letter. If `process_auth = none`, objective [b] is satisfied by attestation — confirm the attestation is captured rather than chasing a narrative. If `mfa_method = password_only`, treat enabling MFA as the highest-priority next step.",
    ].join("\n");
  },
};

// ────────────────────────────────────────────────────────────────────────
// Intake spec — AC.L1-3.1.1 (Authorized Access Control)
//
// Six objectives (a–f) that split into two halves:
//   • [a]/[b]/[c] = IDENTIFY users / processes / devices
//   • [d]/[e]/[f] = LIMIT access to those identified actors
//
// IA.L1-3.5.1 covers the IDENTIFY half from a unique-ID angle; this
// practice's intake therefore focuses on WHERE FCI lives, HOW access is
// granted/removed, and WHAT non-laptop actors (BYOD, vendors) can reach
// it — facts that drive the enforcement-proof and access-procedure slots.
//
// Every question is anchored to:
//   • NIST SP 800-171A Rev 2 §3.1.1 determination statements [a]–[f]
//   • CMMC Self-Assessment Guide — Level 1 v2.13, AC.L1-b.1.i
//   • FAR 52.204-21(b)(1)(i)
//
// Hard rule: intake answers NEVER drop an objective. They only route the
// evidence path. A BYOD answer ADDS a slot (acceptable-use ack) but does
// not skip the device inventory; an unmanaged-printers answer doesn't
// satisfy [c]/[f] without an explicit inventory of those devices.
// ────────────────────────────────────────────────────────────────────────
const AC311_QUESTIONS: IntakeQuestion[] = [
  {
    id: "fci_location",
    objectives: ["a", "d"],
    prompt:
      "Where does Federal Contract Information primarily live and get worked on today?",
    helpText:
      "Pick the system that holds the bulk of FCI documents and email. We'll route which roster / enforcement evidence to pull from this answer.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [a],[d]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: [a] authorized users are identified … [d] system access is limited to authorized users. … Identify users, processes, and devices that are allowed to use company computers and can log on to the company network.",
    options: [
      {
        value: "m365_sharepoint",
        label: "Microsoft 365 (SharePoint / OneDrive / Teams / Outlook)",
      },
      { value: "google_drive", label: "Google Workspace (Drive / Gmail)" },
      {
        value: "on_prem_share",
        label: "On-prem file share / NAS",
        description: "Windows file server, Synology, etc.",
      },
      {
        value: "saas_app",
        label: "A specific line-of-business SaaS",
        description: "Salesforce, NetSuite, Deltek, accounting system, etc.",
      },
      {
        value: "mixed",
        label: "Mixed across several of the above",
      },
    ],
  },
  {
    id: "provisioning_method",
    objectives: ["d", "e"],
    prompt:
      "How does an employee or contractor actually get access to those FCI systems on day 1?",
    helpText:
      "We're matching you to an evidence path — not grading. Whatever you do today is what we'll document.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [d],[e]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Potential Assessment Considerations",
    regQuote:
      "Determine if: [d] system access is limited to authorized users [and] [e] system access is limited to processes acting on behalf of authorized users. … Set up your system so that only authorized users, processes, and devices can access the company network.",
    options: [
      {
        value: "idp_groups",
        label: "IT adds them to the right IdP groups",
        description: "M365 / Google / Okta / Entra ID — group drives access.",
      },
      {
        value: "manual_ticket",
        label: "Manager files a ticket; IT clicks through each system",
      },
      {
        value: "self_service",
        label: "Self-service request portal",
        description: "Jira Service Mgmt, ServiceNow, SailPoint, etc.",
      },
      {
        value: "ad_hoc",
        label: "Ad hoc — whoever is around grants access via email/chat",
      },
      {
        value: "no_process",
        label: "No defined process yet",
      },
    ],
  },
  {
    id: "deprovisioning_speed",
    objectives: ["d", "e", "f"],
    prompt:
      "When someone leaves the company or changes role, how fast does their FCI access get removed?",
    helpText:
      "Assessors weight this heavily — stale access is the #2 finding behind missing MFA. Same-day automation is the gold standard.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [d],[e],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: … system access is limited to authorized users [d], processes acting on behalf of authorized users [e], and devices including other systems [f]. … Limit the devices (e.g., printers) that can be accessed by company computers.",
    options: [
      {
        value: "auto_idp",
        label: "Auto-deprovisioned via IdP or HRIS sync (same day)",
        description: "Entra ID lifecycle workflows, Okta off-boarding, etc.",
      },
      {
        value: "same_day_manual",
        label: "Manual same-day checklist (IT runs through it)",
      },
      {
        value: "within_week",
        label: "Manual, within a week",
      },
      {
        value: "eventual",
        label: "Eventually, when someone notices",
      },
      {
        value: "no_process",
        label: "No formal off-boarding process",
      },
    ],
  },
  {
    id: "external_actors",
    objectives: ["c", "f"],
    prompt:
      "Beyond your IT-managed laptops and phones, what else can connect to systems holding FCI?",
    helpText:
      "Pick the one closest match — we'll add an evidence slot if your answer changes what an assessor would ask for.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [c],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: [c] devices (and other systems) authorized to connect to the system are identified [and] [f] system access is limited to authorized devices (including other systems). … any other device an employee may use to log on to the company network and conduct work tasks.",
    options: [
      {
        value: "managed_only",
        label: "Only IT-managed laptops and phones",
      },
      {
        value: "plus_printers",
        label: "Plus office printers / MFPs",
      },
      {
        value: "plus_byod",
        label: "Plus contractors' or staff personal devices (BYOD)",
        description: "We'll add a BYOD acceptable-use acknowledgement slot.",
      },
      {
        value: "plus_vendor",
        label: "Plus vendor / partner systems",
        description:
          "Prime contractor SFTP, partner API, MSP RMM agent — we'll add an external-systems register slot.",
      },
      {
        value: "unsure",
        label: "Not sure yet — Charlie will help me figure it out",
      },
    ],
  },
];

const FCI_LOCATION_LABEL: Record<string, string> = {
  m365_sharepoint: "Microsoft 365 (SharePoint / OneDrive / Teams)",
  google_drive: "Google Workspace (Drive / Gmail)",
  on_prem_share: "on-prem file share / NAS",
  saas_app: "a specific line-of-business SaaS",
  mixed: "a mix of several systems",
};

const PROVISIONING_LABEL: Record<string, string> = {
  idp_groups: "IdP group membership (IT adds users to groups)",
  manual_ticket: "manual ticketed provisioning per system",
  self_service: "a self-service request portal",
  ad_hoc: "ad-hoc grants over email/chat",
  no_process: "no defined provisioning process",
};

const DEPROVISIONING_LABEL: Record<string, string> = {
  auto_idp: "auto-deprovisioned same-day via IdP / HRIS sync",
  same_day_manual: "a manual same-day off-boarding checklist",
  within_week: "manual off-boarding within a week",
  eventual: "ad-hoc, eventually when noticed",
  no_process: "no formal off-boarding process",
};

const EXTERNAL_ACTORS_LABEL: Record<string, string> = {
  managed_only: "IT-managed laptops and phones only",
  plus_printers: "managed devices plus office printers / MFPs",
  plus_byod: "managed devices plus BYOD (a register is required)",
  plus_vendor: "managed devices plus vendor / partner systems",
  unsure: "an inventory still to be built",
};

const ac311Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about how access actually works in your environment. Each one is anchored to a specific NIST 800-171A determination statement for AC.L1-3.1.1 — your answers route which evidence Charlie pulls or drafts, but none of the six objectives are ever skipped.",
  questions: AC311_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    // ─── Objective [a]/[d] · authorized_users_roster + enforcement_proof ───
    const where = answers.fci_location;
    if (where === "m365_sharepoint") {
      slotAnnotations.authorized_users_roster = {
        recommendedDestinationIdx: 1, // connect M365/Google
        contextNote:
          "FCI lives in Microsoft 365 — Charlie pulls the unique-principal list from Entra ID in one click. CSV fallback is available if the connector isn't authorized.",
      };
      slotAnnotations.enforcement_proof = {
        recommendedDestinationIdx: 0, // connect (M365 CA)
        contextNote:
          "Connect Microsoft 365 — Charlie pulls the active Conditional Access policy as your enforcement-proof artifact, tagged to objectives [d]/[e]/[f].",
      };
    } else if (where === "google_drive") {
      slotAnnotations.authorized_users_roster = {
        recommendedDestinationIdx: 1,
        contextNote:
          "FCI lives in Google Workspace — Charlie pulls the directory user list with names, roles, and emails.",
      };
      slotAnnotations.enforcement_proof = {
        recommendedDestinationIdx: 1, // upload (no Google CA connector for enforcement yet)
        contextNote:
          "Upload a screenshot of your Google Workspace context-aware access rule (or the org-unit access policy) showing who can sign in to FCI apps. Charlie tags it to [d]/[e]/[f].",
      };
    } else if (where === "on_prem_share") {
      slotAnnotations.authorized_users_roster = {
        recommendedDestinationIdx: 2, // upload (export from AD)
        contextNote:
          "Export your AD users (`Get-ADUser -Filter * | Select SamAccountName, UserPrincipalName, Enabled | Export-Csv users.csv`) and drop the file here. Charlie checks that every account has an owner and an enable status.",
      };
      slotAnnotations.enforcement_proof = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Upload a screenshot of the NTFS / share permissions on the FCI folder showing the authorized group, plus the group membership list. Two images is enough.",
      };
    } else if (where === "saas_app" || where === "mixed") {
      slotAnnotations.authorized_users_roster = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          where === "saas_app"
            ? "FCI lives in a line-of-business SaaS — Charlie will draft a per-app roster listing each authorized user, their role in the app, and the date they were granted access."
            : "FCI is spread across several systems — Charlie will draft a consolidated roster, one row per (user × system), so the assessor can audit the full footprint in one artifact.",
      };
      slotAnnotations.enforcement_proof = {
        recommendedDestinationIdx: 1,
        contextNote:
          where === "saas_app"
            ? "Upload one screenshot from the app's admin console showing the authorized user list (or the role assignment screen). Charlie will tag it to [d]/[e]/[f]."
            : "Upload one screenshot per system that holds FCI — Charlie checks that each artifact shows enforcement (group membership, role assignment, or ACL).",
      };
    }

    // ─── Objective [d]/[e]/[f] · access_procedure ───
    const prov = answers.provisioning_method;
    const deprov = answers.deprovisioning_speed;
    const noProcess =
      prov === "no_process" || prov === "ad_hoc" || deprov === "no_process" || deprov === "eventual";
    if (noProcess) {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "No formal provisioning or off-boarding process today — Charlie will draft one with you in 2 minutes (5 fields: who approves, who provisions, MFA requirement, off-boarding SLA, who audits quarterly). The draft is signed evidence the moment you lock the practice.",
      };
    } else if (prov === "idp_groups" && deprov === "auto_idp") {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "IdP-driven provisioning + auto-deprovisioning — Charlie will draft a one-paragraph procedure that names your IdP, the approver, the group-membership model, and the lifecycle workflow handling off-boarding. This is the strongest L1 evidence path.",
      };
    } else if (prov === "self_service") {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Self-service portal — Charlie will draft a procedure that names the portal, the auto-approver / manager-approval routing, and the deprovisioning trigger. Upload a screenshot of the access-request form when prompted.",
      };
    } else {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0,
        contextNote: `Provisioning is ${PROVISIONING_LABEL[prov] ?? "manual"} and off-boarding runs ${DEPROVISIONING_LABEL[deprov] ?? "manually"} — Charlie drafts the matching procedure with the responsible roles and SLAs documented.`,
      };
    }

    // ─── Objective [c]/[f] · authorized_devices_inventory + dynamic slot ───
    const ext = answers.external_actors;
    if (ext === "managed_only") {
      slotAnnotations.authorized_devices_inventory = {
        recommendedDestinationIdx: 1, // connect
        contextNote:
          "Managed devices only — Charlie pulls the device inventory directly from Intune or Google Endpoint Management.",
      };
    } else if (ext === "plus_printers") {
      slotAnnotations.authorized_devices_inventory = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Managed laptops + printers — Charlie pulls managed devices via connector, then adds a row for each printer/MFP that prints FCI. We'll prompt for printer model + serial.",
      };
    } else if (ext === "plus_byod") {
      slotAnnotations.authorized_devices_inventory = {
        recommendedDestinationIdx: 0, // generate w/ Charlie (BYOD requires composition)
        contextNote:
          "BYOD in scope — assessors expect a register that distinguishes corporate-managed vs personal devices. Charlie will compose the consolidated inventory with you.",
      };
      // Dynamic slot — BYOD acknowledgement register. Required for [c]/[f]
      // whenever personal devices can reach FCI. Not satisfied by the device
      // inventory alone — the acknowledgement is the compensating control.
      dynamicSlots.push({
        key: "byod_acknowledgement_register",
        label: "BYOD acceptable-use acknowledgement register",
        hint: "One row per BYOD user: name, device type, date the acceptable-use policy was acknowledged, and the named owner accountable for the device's posture (managed-app config, encryption, MFA scope).",
        kind: "roster_csv",
        satisfies: ["c", "f"],
        required: true,
        templatePath: "/templates/access-device-register.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my BYOD register with Charlie",
            filename: "byod-acknowledgement-register.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing BYOD register",
            describes:
              "CSV or PDF listing each BYOD user, their device, date of AUP acknowledgement, and the named owner.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      });
    } else if (ext === "plus_vendor") {
      slotAnnotations.authorized_devices_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Vendor / partner systems in scope — Charlie will compose the device inventory AND we'll add a separate external-systems register for the partner interconnections.",
      };
      // Dynamic slot — external systems register. CMMC L1 SAG calls these out
      // explicitly under AC.L1-b.1.i Further Discussion ("devices (including
      // other systems)"). The register documents what each connection is for,
      // the named owner, and the authorization boundary.
      dynamicSlots.push({
        key: "external_systems_register",
        label: "External systems / interconnections register",
        hint: "Every outside system that can authenticate to or read FCI: prime contractor SFTP, partner API, MSP RMM agent, etc. One row per connection — what it is, what it accesses, who owns it on both ends, and the auth method.",
        kind: "roster_csv",
        satisfies: ["c", "f"],
        required: true,
        templatePath: "/templates/external-systems-inventory.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my external-systems register with Charlie",
            filename: "external-systems-register.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing register",
            describes:
              "CSV or PDF listing each external system, its purpose, named owners, and auth method.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      });
    } else if (ext === "unsure") {
      slotAnnotations.authorized_devices_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "We'll figure it out with Charlie — start by listing the laptops and phones, then he'll probe for printers, BYOD, and vendor connections. Any uncovered category turns into a dynamic register so nothing slips through.",
      };
    }

    const situationSummary = [
      `FCI primarily lives in ${FCI_LOCATION_LABEL[where] ?? "an unspecified system"}.`,
      `Access is provisioned via ${PROVISIONING_LABEL[prov] ?? "an unspecified process"}.`,
      `Off-boarding runs on ${DEPROVISIONING_LABEL[deprov] ?? "an unspecified cadence"}.`,
      `Beyond managed laptops: ${EXTERNAL_ACTORS_LABEL[ext] ?? "unspecified"}.`,
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's access-control setup",
      `- FCI primary location: ${FCI_LOCATION_LABEL[answers.fci_location] ?? "(not specified)"}`,
      `- Provisioning method: ${PROVISIONING_LABEL[answers.provisioning_method] ?? "(not specified)"}`,
      `- Off-boarding speed: ${DEPROVISIONING_LABEL[answers.deprovisioning_speed] ?? "(not specified)"}`,
      `- Non-managed actors that touch FCI: ${EXTERNAL_ACTORS_LABEL[answers.external_actors] ?? "(not specified)"}`,
      "",
      "Do NOT re-ask these facts. Open by acknowledging the environment in one sentence, then drive toward the next missing objective letter. If `external_actors = plus_byod`, the BYOD register is a required artifact for [c]/[f]. If `external_actors = plus_vendor`, the external-systems register is required. If provisioning OR off-boarding is `no_process`/`ad_hoc`/`eventual`, the access-grant procedure is the highest-priority slot — propose drafting it first.",
    ].join("\n");
  },
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
            label: "Draft my roster with Charlie",
            filename: "authorized-users-roster.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull live roster from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the live tenant user list with names, roles, and emails — assessor-grade, dated, signed by your IdP.",
          },
          {
            type: "upload",
            label: "Upload an existing roster",
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
            label: "Draft my device inventory with Charlie",
            filename: "authorized-devices-inventory.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull managed devices from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the managed-device list directly from your IdP — make/model, owner, last check-in.",
          },
          {
            type: "upload",
            label: "Upload an existing inventory",
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
            label: "Draft my service-account list with Charlie",
            filename: "service-accounts-list.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull service principals from Microsoft 365",
            providers: ["m365"],
            describes:
              "Pulls every Entra ID service principal + automation account that can sign in.",
          },
          {
            type: "upload",
            label: "Upload an existing list",
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
            label: "Have Charlie write the procedure",
            filename: "access-grant-removal-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
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
            label: "Pull Conditional Access policy from Microsoft 365",
            providers: ["m365"],
            describes:
              "Pulls the active Conditional Access policy export — assessor-grade proof of enforcement.",
          },
          {
            type: "upload",
            label: "Upload a screenshot or ACL export",
            describes:
              "Drag in a PNG/JPEG of your Windows local-user settings, IdP group membership, or admin console showing the authorized list. PDFs of ACL exports work too.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(i)", "NIST SP 800-171 Rev 2 §3.1.1"],
    intake: ac311Intake,
  },

  // ───────────────────────────────────────────────────────────────────────
  // AC.L1-3.1.2 — Transaction & Function Control (least privilege)
  //
  // Only TWO objectives, but they're scope-defining: an assessor wants to
  // see (1) a written definition of who-can-do-what, and (2) live evidence
  // the system is actually enforcing it. The role matrix is the spine of
  // both — Charlie can compose it from chat, or the user can connect
  // M365/Google to pull real admin role assignments.
  // ───────────────────────────────────────────────────────────────────────
  "AC.L1-3.1.2": {
    controlId: "AC.L1-3.1.2",
    shortName: "Transaction & Function Control",
    oneLiner:
      "Even authorized users shouldn't have more access than their job requires — least privilege, written down and enforced.",
    statement:
      "Limit information system access to the types of transactions and functions that authorized users are permitted to execute.",
    objectives: [
      {
        letter: "a",
        text: "the types of transactions and functions that authorized users are permitted to execute are defined",
      },
      {
        letter: "b",
        text: "system access is limited to the defined types of transactions and functions for authorized users",
      },
    ],
    furtherDiscussion:
      "Limit users to only the information systems, roles, or applications they are permitted to use and that are needed for their job. Role-based access control is the typical mechanism: each role has a defined set of transactions/functions, and users are granted only the role(s) their job requires. Admin/privileged roles are the highest-risk findings — assessors expect to see them assigned by name, scoped tightly, and reviewed periodically. This practice (AC.L1-3.1.2) controls authorized uses of the system, while AC.L1-3.1.1 limits access to authorized users, processes, and devices.",
    evidenceSlots: [
      {
        key: "role_matrix",
        label: "Role / permission matrix",
        hint: "One row per user × system × permission level (admin/standard/read-only) with the business justification. This is the assessor's first ask — it answers objective (a) directly.",
        kind: "roster_csv",
        satisfies: ["a", "b"],
        required: true,
        templatePath: "/templates/role-matrix.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my role matrix with Charlie",
            filename: "role-matrix.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing matrix",
            describes:
              "Drag in a CSV or signed PDF mapping every user to each system + permission level + business justification.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "admin_users_screenshot",
        label: "Privileged / admin role assignments",
        hint: "Live evidence the system actually enforces the matrix: screenshots of every account holding an admin role (Global Admin, Super Admin, root, etc.) — by name. Plus one standard-user screenshot showing NO elevated role as a baseline.",
        kind: "screenshot",
        satisfies: ["b"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull admin role assignments from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls every account assigned a privileged role from your IdP — Global Admin, User Admin, Billing Admin (Entra) or Super Admin / role admins (Workspace) — with the user's name and email.",
          },
          {
            type: "upload",
            label: "Upload admin-role screenshots",
            describes:
              "Drag in a PNG/JPEG of your admin console showing the privileged role assignments. Include one regular-user screenshot showing they have no admin role.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "least_privilege_procedure",
        label: "Least-privilege procedure",
        hint: "A short written procedure (one paragraph is fine) that explains how privileges are scoped at hire, reviewed periodically, and revoked at termination or role change. This is what makes objective (a) durable.",
        kind: "procedure_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "least-privilege-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes:
              "If you already have a written least-privilege / role-assignment procedure, drag in the PDF or DOCX.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(ii)", "NIST SP 800-171 Rev 2 §3.1.2"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // AC.L1-3.1.20 — External Connections
  //
  // Scope-shaping practice. Most small primes have a long tail of SaaS apps
  // and contractor laptops that touch FCI; the assessor wants a written
  // boundary statement plus an inventory of every external system in scope,
  // and proof access to those externals is gated.
  // ────────────────────────────────────────────────────────────────────────
  "AC.L1-3.1.20": {
    controlId: "AC.L1-3.1.20",
    shortName: "External Connections",
    oneLiner:
      "Know every outside system that touches your FCI — and prove the connection is intentional and controlled.",
    statement:
      "Verify and control/limit connections to and use of external information systems.",
    objectives: [
      { letter: "a", text: "connections to external systems are identified" },
      { letter: "b", text: "the use of external systems is identified" },
      { letter: "c", text: "connections to external systems are verified" },
      { letter: "d", text: "the use of external systems is verified" },
      { letter: "e", text: "connections to external systems are controlled/limited" },
      { letter: "f", text: "the use of external systems are controlled/limited" },
    ],
    furtherDiscussion:
      "External information systems are systems outside your authorization boundary — cloud apps you subscribe to, contractor-owned laptops, shared kiosks, an employee's home computer. You don't have to ban them, but you do need to (a) know they exist and what they're used for, (b) verify the connection is appropriate (the SaaS vendor's terms, the contractor's MSA), and (c) limit what they can do (e.g. SSO with conditional access, restricted shared-link permissions). The most common evidence package is a written external-systems inventory + screenshots of how access is gated (SSO config, share permissions, conditional access).",
    evidenceSlots: [
      {
        key: "external_systems_inventory",
        label: "External systems inventory",
        hint: "One row per outside system that touches FCI: vendor, what it's used for, who can use it, how access is verified (SSO, contract, MSA), how use is limited.",
        kind: "roster_csv",
        satisfies: ["a", "b", "c", "d"],
        required: true,
        templatePath: "/templates/external-systems-inventory.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my external-systems inventory with Charlie",
            filename: "external-systems-inventory.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing inventory",
            describes:
              "Drag in a CSV/PDF listing every external SaaS, contractor system, or shared device that can touch FCI.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "external_access_controls",
        label: "Proof external access is gated",
        hint: "Live evidence each external system is reachable only by the right people: SSO/IdP screenshot, share-link permission settings, conditional-access policy, or vendor-side MFA configuration.",
        kind: "screenshot",
        satisfies: ["e", "f"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull SSO + Conditional Access from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the SSO app catalog and Conditional Access / Context-Aware Access rules — assessor-grade proof external use is gated.",
          },
          {
            type: "upload",
            label: "Upload screenshots or policy export",
            describes:
              "PNG/JPEG of admin console showing SSO/MFA/Conditional Access on every external SaaS, OR a PDF of a vendor SOC 2 / contract showing controlled access.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "external_use_policy",
        label: "External-use procedure",
        hint: "Short written procedure: which external systems are approved, who approves new ones, what's banned (personal Dropbox, etc.), how use is reviewed.",
        kind: "policy_doc",
        satisfies: ["b", "f"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "external-use-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes:
              "If you already have an acceptable-use / external-systems policy, drag in the PDF or DOCX.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(iii)", "NIST SP 800-171 Rev 2 §3.1.20"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // AC.L1-3.1.22 — Public Information Posting
  //
  // Narrow but easy-to-fail. Assessor wants a tiny ack-roster of who can
  // post to the website / LinkedIn, a one-paragraph review procedure, and
  // a sample reviewed-and-approved post.
  // ────────────────────────────────────────────────────────────────────────
  "AC.L1-3.1.22": {
    controlId: "AC.L1-3.1.22",
    shortName: "Control Public Information",
    oneLiner:
      "Don't accidentally post FCI on your website or social — name who's authorized to post and review every post first.",
    statement:
      "Control information posted or processed on publicly accessible information systems.",
    objectives: [
      {
        letter: "a",
        text: "individuals authorized to post information on publicly accessible systems are identified",
      },
      {
        letter: "b",
        text: "procedures to ensure FCI is not posted on publicly accessible systems are identified",
      },
      {
        letter: "c",
        text: "a review process is in place prior to posting of any content to publicly accessible systems",
      },
      {
        letter: "d",
        text: "content on publicly accessible information systems is reviewed to ensure it does not include FCI",
      },
      {
        letter: "e",
        text: "mechanisms are in place to remove and address improper posting of FCI",
      },
    ],
    furtherDiscussion:
      "Publicly accessible systems are your company website, blog, LinkedIn page, GitHub org, customer portal, etc. The risk is benign-looking content (case studies, project photos, marketing copy) that names a federal customer or quotes contract details. The expected evidence is small but specific: (1) a short list of named posters with a signed acknowledgement, (2) a written review procedure, and (3) one or two examples of posts that went through review.",
    evidenceSlots: [
      {
        key: "authorized_posters_ack",
        label: "Authorized posters + signed acknowledgement",
        hint: "Names of every person allowed to post publicly + a one-page signed acknowledgement that they understand FCI cannot appear in public content.",
        kind: "roster_csv",
        satisfies: ["a"],
        required: true,
        templatePath: "/templates/public-posting-acknowledgement.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my posters list with Charlie",
            filename: "authorized-posters-acknowledgement.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload signed acknowledgements",
            describes:
              "PDF or CSV listing each authorized poster with their signed FCI acknowledgement attached.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "public_posting_procedure",
        label: "Posting review procedure",
        hint: "Short written procedure: who drafts, who reviews for FCI, who approves, how a problematic post is removed and the incident addressed.",
        kind: "procedure_doc",
        satisfies: ["b", "c", "e"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "public-posting-review-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes: "Drag in your existing public-posting / marketing-review SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "review_evidence",
        label: "Sample reviewed post",
        hint: "Evidence the review actually happens: an email thread or screenshot showing a recent post being reviewed before going live, or a redlined draft.",
        kind: "screenshot",
        satisfies: ["d"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload a review email or screenshot",
            describes:
              "Email thread, redlined Word/Google doc, or PR screenshot showing a recent post being reviewed and approved before publication.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(iv)", "NIST SP 800-171 Rev 2 §3.1.22"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // IA.L1-3.5.1 — Identification
  //
  // Pairs tightly with 3.1.1 (same rosters answer most of it) but the
  // objectives focus on UNIQUE IDs. Assessor wants to see no shared
  // accounts and unique device identifiers.
  // ────────────────────────────────────────────────────────────────────────
  "IA.L1-3.5.1": {
    controlId: "IA.L1-3.5.1",
    shortName: "Identification",
    oneLiner:
      "Every user, automated process, and device that touches FCI has a unique ID — no shared accounts.",
    statement:
      "Identify information system users, processes acting on behalf of users, or devices.",
    objectives: [
      { letter: "a", text: "system users are identified" },
      { letter: "b", text: "processes acting on behalf of users are identified" },
      { letter: "c", text: "devices accessing the system are identified" },
    ],
    furtherDiscussion:
      "This is the foundation control for accountability — if you can't identify the actor, you can't audit them. The bar is unique IDs: each human gets one named account, each automation runs as a named service principal, each device has a unique hostname/serial. Shared accounts (info@, admin@, the receptionist's PC that everyone uses) are the most common finding. Evidence is a roster + screenshots showing the identifiers in the IdP / device manager.",
    evidenceSlots: [
      {
        key: "user_identifiers_list",
        label: "Unique user IDs",
        hint: "Roster showing each user's unique identifier (email, sAMAccountName, UPN). No shared accounts. If a shared account exists, document why and who has the password.",
        kind: "roster_csv",
        satisfies: ["a"],
        required: true,
        templatePath: "/templates/authorized-users-roster.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my unique-IDs roster with Charlie",
            filename: "unique-user-ids.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull user IDs from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls each user's unique principal name + display name straight from your IdP.",
          },
          {
            type: "upload",
            label: "Upload an existing roster",
            describes: "CSV/PDF showing each user's unique account ID.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "process_identifiers_list",
        label: "Unique process / service-account IDs",
        hint: "Each automation, scheduled task, or service principal has a unique account distinct from any human's account. List them with the human owner.",
        kind: "roster_csv",
        satisfies: ["b"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Draft my service-account list with Charlie",
            filename: "unique-process-ids.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull service principals from Microsoft 365",
            providers: ["m365"],
            describes:
              "Pulls every Entra ID service principal + automation account from your tenant.",
          },
          {
            type: "upload",
            label: "Upload an existing list",
            describes: "CSV/PDF listing every service account / automation by ID.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      },
      {
        key: "device_identifiers_list",
        label: "Unique device identifiers",
        hint: "Each device that connects has a unique hostname or serial. Pull the device list from your MDM/AD/Intune, or maintain a CSV with hostname + serial + owner.",
        kind: "roster_csv",
        satisfies: ["c"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Draft my device IDs list with Charlie",
            filename: "unique-device-ids.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull device IDs from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls each managed device's unique identifier (Intune device ID, Google endpoint ID).",
          },
          {
            type: "upload",
            label: "Upload an existing list",
            describes: "CSV/PDF with hostname + serial + owner per device.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(v)", "NIST SP 800-171 Rev 2 §3.5.1"],
    intake: ia351Intake,
  },

  // ────────────────────────────────────────────────────────────────────────
  // IA.L1-3.5.2 — Authentication
  //
  // The MFA practice. Assessor wants live proof every account that signs
  // in to FCI systems is authenticated — password alone is rarely enough
  // for cloud-hosted FCI; MFA screenshot + password policy is the norm.
  // ────────────────────────────────────────────────────────────────────────
  "IA.L1-3.5.2": {
    controlId: "IA.L1-3.5.2",
    shortName: "Authentication",
    oneLiner:
      "Make every user, process, and device prove who they are before they get in — MFA where it matters.",
    statement:
      "Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to allowing access to organizational information systems.",
    objectives: [
      { letter: "a", text: "the identity of each user is authenticated or verified as a prerequisite to system access" },
      { letter: "b", text: "the identity of each process acting on behalf of a user is authenticated or verified as a prerequisite to system access" },
      { letter: "c", text: "the identity of each device accessing or connecting to the system is authenticated or verified as a prerequisite to system access" },
    ],
    furtherDiscussion:
      "Authentication is the proof step (vs. identification, which is the claim step). A password is acceptable in principle, but with FCI in cloud apps the assessor will look hard for MFA on every internet-facing account, a documented password policy, and proof devices are authenticated (cert-based / domain-joined / Intune-compliant). Service accounts authenticate via secrets/keys vaulted somewhere — you must say where.",
    evidenceSlots: [
      {
        key: "mfa_enforcement",
        label: "MFA enforcement evidence",
        hint: "Screenshots/policy export showing MFA is required for every user that touches FCI — Conditional Access policy, IdP MFA report, or per-app MFA setting.",
        kind: "screenshot",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull MFA report from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the MFA registration / Conditional Access policy + per-user MFA status from your tenant.",
          },
          {
            type: "upload",
            label: "Upload MFA screenshots or policy export",
            describes:
              "PNG/JPEG of admin console MFA report, or PDF export of your Conditional Access policy.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "password_policy",
        label: "Password / authentication policy",
        hint: "Written policy: minimum length, complexity, rotation, lockout, MFA scope. Even a one-page version works.",
        kind: "policy_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the policy",
            filename: "authentication-policy.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing policy",
            describes:
              "Drag in your existing password / authentication / IAM policy.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "process_auth_method",
        label: "Process / service-account authentication",
        hint: "How each automation authenticates: managed identity, vaulted client secret, certificate. Name the vault.",
        kind: "narrative",
        satisfies: ["b"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie document this",
            filename: "process-authentication-narrative.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing description",
            describes:
              "Drag in any existing doc that explains how your service accounts authenticate (vault config export, runbook).",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "device_auth_evidence",
        label: "Device authentication evidence",
        hint: "Proof devices authenticate before connecting: domain-joined screenshot, Intune compliance policy, certificate auth, or a written narrative if your endpoints aren't centrally managed.",
        kind: "screenshot",
        satisfies: ["c"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull device compliance from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls device compliance + cert-auth posture from your endpoint manager.",
          },
          {
            type: "upload",
            label: "Upload device-auth screenshots",
            describes:
              "Screenshots of MDM compliance dashboard, domain-join state, or certificate-based authentication settings.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(vi)", "NIST SP 800-171 Rev 2 §3.5.2"],
    intake: ia352Intake,
  },

  // ────────────────────────────────────────────────────────────────────────
  // MP.L1-3.8.3 — Media Disposal
  //
  // One-objective practice in spirit — an assessor wants a disposal log +
  // a written sanitization procedure + (ideally) certificates of destruction
  // from a vendor.
  // ────────────────────────────────────────────────────────────────────────
  "MP.L1-3.8.3": {
    controlId: "MP.L1-3.8.3",
    shortName: "Media Disposal",
    oneLiner:
      "Wipe or shred any drive, USB, or printout that holds FCI before it leaves your control.",
    statement:
      "Sanitize or destroy information system media containing Federal Contract Information before disposal or release for reuse.",
    objectives: [
      { letter: "a", text: "system media containing FCI is sanitized or destroyed before disposal" },
      { letter: "b", text: "system media containing FCI is sanitized before it is released for reuse" },
    ],
    furtherDiscussion:
      "Media is anything that stores FCI: laptop SSDs, server drives, USB sticks, printed docs, even iPhones. The assessor expects a written sanitization procedure (NIST SP 800-88 cite), a log of every disposal/reuse event, and certificates of destruction for vendor-handled media. A small org that throws drives in a shredder once a year only needs a one-page log and a procedure — keep it simple, keep it dated.",
    evidenceSlots: [
      {
        key: "media_disposal_log",
        label: "Media disposal / reuse log",
        hint: "Date, asset/serial, what data was on it, sanitization method (DBAN, factory reset, shred, vendor), who performed it, certificate # if vendor-handled.",
        kind: "roster_csv",
        satisfies: ["a", "b"],
        required: true,
        templatePath: "/templates/media-disposal-log.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my disposal log with Charlie",
            filename: "media-disposal-log.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing log",
            describes:
              "CSV/PDF log of every drive, USB, phone, or stack of papers disposed of or wiped for reuse.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "sanitization_procedure",
        label: "Sanitization procedure",
        hint: "Short written procedure citing NIST SP 800-88: which methods you use for which media types (clear/purge/destroy), who's authorized to do it, who reviews.",
        kind: "procedure_doc",
        satisfies: ["a", "b"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "media-sanitization-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes: "Drag in your existing sanitization / data-destruction SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "destruction_certificates",
        label: "Certificates of destruction",
        hint: "If you use a vendor (Iron Mountain, Shred-it, etc.) for any disposal, attach the certificates. Optional if you self-destruct everything and the log is fully detailed.",
        kind: "screenshot",
        satisfies: ["a"],
        required: false,
        destinations: [
          {
            type: "upload",
            label: "Upload certificates of destruction",
            describes:
              "PDFs or photos of vendor certificates of destruction for any media disposed of through a service.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(vii)", "NIST SP 800-171 Rev 2 §3.8.3"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // PE.L1-3.10.1 — Physical Access Authorization
  //
  // The "who has a key/badge" practice. Roster + procedure + screenshot
  // of badge system if cloud-managed (Verkada, Kisi, Brivo, etc.).
  // ────────────────────────────────────────────────────────────────────────
  "PE.L1-3.10.1": {
    controlId: "PE.L1-3.10.1",
    shortName: "Limit Physical Access",
    oneLiner:
      "Only people you've named can walk into rooms where FCI lives — write the list and lock the door.",
    statement:
      "Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals.",
    objectives: [
      { letter: "a", text: "authorized individuals allowed physical access are identified" },
      { letter: "b", text: "physical access to organizational systems is limited to authorized individuals" },
      { letter: "c", text: "physical access to equipment is limited to authorized individuals" },
      { letter: "d", text: "physical access to operating environments is limited to authorized individuals" },
    ],
    furtherDiscussion:
      "Operating environments mean any room or space where FCI is processed, stored, or printed: your office server closet, your home office, even a hotel room you work from. The assessor expects a roster of who's authorized to physically enter, evidence of how you enforce it (locks, badge readers, alarm system), and a procedure for adding/removing access.",
    evidenceSlots: [
      {
        key: "physical_access_roster",
        label: "Physical access roster",
        hint: "Who has keys/badges/door codes for each FCI room. Name, role, what they can access, date issued, date revoked.",
        kind: "roster_csv",
        satisfies: ["a", "b", "c", "d"],
        required: true,
        templatePath: "/templates/physical-access-roster.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my physical-access roster with Charlie",
            filename: "physical-access-roster.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing roster",
            describes:
              "CSV/PDF listing everyone with physical access to FCI rooms + what they can access.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "physical_access_enforcement",
        label: "Enforcement evidence",
        hint: "Photo of a locked door / server closet, screenshot of cloud badge system (Verkada/Kisi/Brivo) showing the access list, or alarm-system zone configuration.",
        kind: "screenshot",
        satisfies: ["b", "c", "d"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload photos or badge-system screenshots",
            describes:
              "Photo of locked doors, screenshot of cloud-managed badge system access list, or alarm zone config showing who can enter.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "physical_access_procedure",
        label: "Physical access procedure",
        hint: "Short written procedure: how access is granted at hire, how it's revoked at termination/role change, who approves, how often the list is reviewed.",
        kind: "procedure_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "physical-access-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes: "Drag in your existing physical-access SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(viii)", "NIST SP 800-171 Rev 2 §3.10.1"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // PE.L1-3.10.3 — Escort Visitors
  // PE.L1-3.10.4 — Physical Access Logs
  // PE.L1-3.10.5 — Manage Physical Access Devices
  //
  // These three pair tightly. A single visitor log + key/fob register
  // typically satisfies all three. We still expose them as separate
  // practices so the assessor can grade each objective letter, but the
  // evidence pieces are shared in spirit.
  // ────────────────────────────────────────────────────────────────────────
  "PE.L1-3.10.3": {
    controlId: "PE.L1-3.10.3",
    shortName: "Escort Visitors",
    oneLiner:
      "Anyone who isn't on your roster gets escorted and watched while they're in FCI areas.",
    statement: "Escort visitors and monitor visitor activity.",
    objectives: [
      { letter: "a", text: "visitors are escorted" },
      { letter: "b", text: "visitor activity is monitored" },
    ],
    furtherDiscussion:
      "Anyone not on the authorized list is a visitor — including the IT contractor, the cleaning crew, and family who stop by your home office. The assessor wants a visitor sign-in log + a one-paragraph procedure that says who escorts and how visitor activity is observed (escort, camera, badge with limited access).",
    evidenceSlots: [
      {
        key: "visitor_log",
        label: "Visitor log",
        hint: "Sign-in log: visitor name, organization, host (escort), purpose, time in, time out, areas accessed.",
        kind: "roster_csv",
        satisfies: ["a", "b"],
        required: true,
        templatePath: "/templates/visitor-log.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my visitor log with Charlie",
            filename: "visitor-log.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing log",
            describes:
              "CSV/PDF or photo of paper sign-in book covering recent visits.",
            accept: [
              "text/csv",
              "application/pdf",
              "image/png",
              "image/jpeg",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "visitor_procedure",
        label: "Visitor escort & monitoring procedure",
        hint: "Short written procedure: how visitors are signed in, who escorts, what visitor activity is monitored (always-with-host, security camera, badge with limited access).",
        kind: "procedure_doc",
        satisfies: ["a", "b"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "visitor-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes: "Drag in your existing visitor-escort SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(ix)", "NIST SP 800-171 Rev 2 §3.10.3"],
  },

  "PE.L1-3.10.4": {
    controlId: "PE.L1-3.10.4",
    shortName: "Physical Access Logs",
    oneLiner:
      "Keep a record of who came in and when — paper sign-in book or cloud badge audit log both work.",
    statement: "Maintain audit logs of physical access.",
    objectives: [
      { letter: "a", text: "audit logs of physical access are maintained" },
    ],
    furtherDiscussion:
      "The assessor wants to see logs that survive — a sign-in book that's filed, or an export of badge-system events. For a home office, a simple log of any non-resident who enters works. Retention: at least one year is the common bar.",
    evidenceSlots: [
      {
        key: "physical_access_log",
        label: "Physical access audit log",
        hint: "A dated record of every physical entry to FCI areas — sign-in book, badge system export, or alarm system event log.",
        kind: "roster_csv",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Draft my physical access log with Charlie",
            filename: "physical-access-log.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload a log or badge-system export",
            describes:
              "CSV/PDF log, photo of sign-in book, or export from cloud badge system (Kisi, Verkada, Brivo).",
            accept: [
              "text/csv",
              "application/pdf",
              "image/png",
              "image/jpeg",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "log_retention_procedure",
        label: "Log retention procedure",
        hint: "One sentence per topic: where logs are stored, how long, who reviews, when they're destroyed.",
        kind: "procedure_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "physical-access-log-retention-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes:
              "Drag in your existing log-retention or physical-security SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(x)", "NIST SP 800-171 Rev 2 §3.10.4"],
  },

  "PE.L1-3.10.5": {
    controlId: "PE.L1-3.10.5",
    shortName: "Manage Physical Access Devices",
    oneLiner:
      "Inventory every key, fob, and badge — and revoke them when someone leaves.",
    statement: "Control and manage physical access devices.",
    objectives: [
      { letter: "a", text: "physical access devices are identified" },
      { letter: "b", text: "physical access devices are controlled" },
      { letter: "c", text: "physical access devices are managed" },
    ],
    furtherDiscussion:
      "Physical access devices = keys, fobs, prox cards, gate remotes, alarm codes. The assessor wants a register: device serial → assigned to whom → date issued → date returned/disabled. The control side is a procedure: how new devices are issued, how lost ones are reported, how leavers' devices are reclaimed.",
    evidenceSlots: [
      {
        key: "access_device_register",
        label: "Access device register",
        hint: "One row per key/fob/badge: device ID/serial, assigned to (name), date issued, status (active/lost/returned), date returned.",
        kind: "roster_csv",
        satisfies: ["a", "b", "c"],
        required: true,
        templatePath: "/templates/access-device-register.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my access-device register with Charlie",
            filename: "access-device-register.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing register",
            describes:
              "CSV/PDF register of every physical access device + assignee.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "access_device_procedure",
        label: "Issue / revoke procedure",
        hint: "Short written procedure: how a key/fob is issued, how a lost one is reported and replaced, how it's revoked at termination, how often the register is audited.",
        kind: "procedure_doc",
        satisfies: ["b", "c"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the procedure",
            filename: "access-device-procedure.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing procedure",
            describes: "Drag in your existing key-management / badge-issuance SOP.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xi)", "NIST SP 800-171 Rev 2 §3.10.5"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SC.L1-3.13.1 — Boundary Protection
  //
  // The "have a firewall" practice — but it has 8 objectives covering both
  // external and internal boundaries plus monitor/control/protect for
  // each. Network boundary inventory + firewall config export is the spine.
  // ────────────────────────────────────────────────────────────────────────
  "SC.L1-3.13.1": {
    controlId: "SC.L1-3.13.1",
    shortName: "Boundary Protection",
    oneLiner:
      "Draw a perimeter around your FCI systems and put a firewall on it — internal AND external.",
    statement:
      "Monitor, control, and protect organizational communications (i.e., information transmitted or received by organizational information systems) at the external boundaries and key internal boundaries of the information systems.",
    objectives: [
      { letter: "a", text: "the external system boundary is defined" },
      { letter: "b", text: "key internal system boundaries are defined" },
      { letter: "c", text: "communications are monitored at the external system boundary" },
      { letter: "d", text: "communications are monitored at key internal boundaries" },
      { letter: "e", text: "communications are controlled at the external system boundary" },
      { letter: "f", text: "communications are controlled at key internal boundaries" },
      { letter: "g", text: "communications are protected at the external system boundary" },
      { letter: "h", text: "communications are protected at key internal boundaries" },
    ],
    furtherDiscussion:
      "Boundary protection answers \"where does your FCI live, and what's between it and the open internet?\" For most small primes the answer is: a cloud-firewall on the office router (or a SaaS WAF), TLS everywhere, and segmentation between the guest WiFi and the trusted LAN. The assessor wants a network-boundary inventory + firewall configuration export + diagram. A simple network diagram drawn in Draw.io is fine.",
    evidenceSlots: [
      {
        key: "network_boundary_inventory",
        label: "Network boundary inventory",
        hint: "Each boundary: external (internet → office), internal (LAN ↔ guest WiFi, VLAN segmentation). What device enforces it, what rules are in place.",
        kind: "roster_csv",
        satisfies: ["a", "b"],
        required: true,
        templatePath: "/templates/network-boundary-inventory.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my boundary inventory with Charlie",
            filename: "network-boundary-inventory.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing inventory",
            describes:
              "CSV/PDF listing each external + internal boundary and the device/rules enforcing it.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "firewall_config",
        label: "Firewall / boundary device config",
        hint: "Configuration export, screenshot of the rules tab, or vendor-portal screenshot showing the active boundary rules. Cloud firewalls (Cloudflare, AWS Security Groups, Meraki) are fine.",
        kind: "config_export",
        satisfies: ["c", "d", "e", "f"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload firewall config or screenshots",
            describes:
              "Configuration export (PDF/CSV/text), or screenshots of your firewall/router admin showing the active rule set.",
            accept: [
              "image/png",
              "image/jpeg",
              "image/webp",
              "application/pdf",
              "text/plain",
              "text/csv",
            ],
          },
        ],
      },
      {
        key: "encryption_evidence",
        label: "Encryption-in-transit evidence",
        hint: "Proof traffic is encrypted at the boundary: TLS cert details, VPN config screenshot, SSL labs result, or vendor SOC 2 confirming TLS 1.2+.",
        kind: "screenshot",
        satisfies: ["g", "h"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload TLS / VPN screenshots",
            describes:
              "Screenshots of cert chain, SSL Labs A/A+ rating, or VPN configuration showing encrypted tunnels.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "network_diagram",
        label: "Network diagram",
        hint: "Simple diagram showing FCI systems, the trust boundaries, and the firewalls/routers between them. Draw.io, Lucidchart, even hand-sketch is fine.",
        kind: "narrative",
        satisfies: ["a", "b"],
        required: false,
        destinations: [
          {
            type: "upload",
            label: "Upload a network diagram",
            describes:
              "PDF, PNG, or SVG of your network diagram. One page is plenty for most small primes.",
            accept: [
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/svg+xml",
              "application/pdf",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xii)", "NIST SP 800-171 Rev 2 §3.13.1"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SC.L1-3.13.5 — Public-Access System Separation
  //
  // The DMZ practice. For most cloud-only primes, this is satisfied by
  // their public website running on a separate SaaS / cloud account from
  // the FCI systems. Just need a written attestation + diagram.
  // ────────────────────────────────────────────────────────────────────────
  "SC.L1-3.13.5": {
    controlId: "SC.L1-3.13.5",
    shortName: "Public-Access System Separation",
    oneLiner:
      "Your public website / customer portal lives on a separate network from your FCI systems.",
    statement:
      "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.",
    objectives: [
      { letter: "a", text: "publicly accessible system components are identified" },
      { letter: "b", text: "subnetworks for publicly accessible system components are physically or logically separated from internal networks" },
    ],
    furtherDiscussion:
      "Publicly accessible = anything someone on the open internet can reach: marketing website, customer portal, a public S3 bucket. The assessor wants the inventory + proof those systems live in a different segment from FCI (different subnet, different cloud account, different VPC). For most primes this is trivial — your WordPress site is on a SaaS host and your FCI data is in M365 — but you must say it explicitly.",
    evidenceSlots: [
      {
        key: "public_components_list",
        label: "Public-facing components list",
        hint: "Each public-facing system: domain, hosting provider, what's there, where it's hosted relative to FCI systems.",
        kind: "roster_csv",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Draft my public-components list with Charlie",
            filename: "public-facing-components.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing inventory",
            describes:
              "CSV/PDF listing each publicly accessible system + where it's hosted.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "separation_evidence",
        label: "Separation evidence",
        hint: "Screenshot or written attestation that the public components are physically/logically separated: different cloud account, different VPC/subnet, separate WordPress host, etc.",
        kind: "narrative",
        satisfies: ["b"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie draft the attestation",
            filename: "public-system-separation-attestation.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload screenshots or attestation",
            describes:
              "Cloud console screenshot showing separate VPCs / accounts, or a one-paragraph signed attestation describing the separation.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xiii)", "NIST SP 800-171 Rev 2 §3.13.5"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SI.L1-3.14.1 — Flaw Remediation
  //
  // The patching practice. Six objectives all about TIME (identify in X
  // days, report in Y, fix in Z). Patch log + cadence policy + sample
  // patch run is the standard package.
  // ────────────────────────────────────────────────────────────────────────
  "SI.L1-3.14.1": {
    controlId: "SI.L1-3.14.1",
    shortName: "Flaw Remediation",
    oneLiner:
      "Patch your systems on a clock — define the cadence, log the runs, fix critical issues fast.",
    statement: "Identify, report, and correct information and information system flaws in a timely manner.",
    objectives: [
      { letter: "a", text: "the time within which to identify system flaws is specified" },
      { letter: "b", text: "system flaws are identified within the specified time frame" },
      { letter: "c", text: "the time within which to report system flaws is specified" },
      { letter: "d", text: "system flaws are reported within the specified time frame" },
      { letter: "e", text: "the time within which to correct system flaws is specified" },
      { letter: "f", text: "system flaws are corrected within the specified time frame" },
    ],
    furtherDiscussion:
      "The trick with this practice is the word \"specified\" — you must commit to a written timeframe per severity (e.g. critical patches within 7 days). The default cadence most primes use: critical = 7 days, high = 30 days, medium = 90 days. Then you log every patch run + show the system patches actually went out within that window. Auto-update screenshots from Windows Update or Intune satisfy most of it.",
    evidenceSlots: [
      {
        key: "patch_policy",
        label: "Patch / flaw remediation policy",
        hint: "Written policy specifying timeframes per severity for identify, report, and correct. Cite a CVSS rubric (critical = 7d, high = 30d, etc.).",
        kind: "policy_doc",
        satisfies: ["a", "c", "e"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the policy",
            filename: "patch-policy.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing policy",
            describes: "Drag in your existing patch / vulnerability-management policy.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
      {
        key: "patch_log",
        label: "Patch log",
        hint: "Recent patch runs: date, system, what was patched, severity, time-to-deploy. Last 90 days is plenty.",
        kind: "roster_csv",
        satisfies: ["b", "d", "f"],
        required: true,
        templatePath: "/templates/patch-log.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my patch log with Charlie",
            filename: "patch-log.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull patch status from Microsoft 365 / Google",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls Intune update compliance / Google update report — assessor-grade time-to-deploy data per device.",
          },
          {
            type: "upload",
            label: "Upload an existing log",
            describes:
              "CSV/PDF of recent patch runs with date, system, severity, time-to-deploy.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "auto_update_evidence",
        label: "Auto-update evidence",
        hint: "Screenshot showing automatic updates are enabled: Windows Update, macOS Software Update, Intune update rings, or Google endpoint update policy.",
        kind: "screenshot",
        satisfies: ["b", "f"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull update policies from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls the update-ring / auto-update policy + per-device compliance from your endpoint manager.",
          },
          {
            type: "upload",
            label: "Upload screenshots",
            describes:
              "Screenshots of Windows/macOS auto-update settings or your MDM update policy.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xiv)", "NIST SP 800-171 Rev 2 §3.14.1"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SI.L1-3.14.2 — Malicious Code Protection
  //
  // The AV practice. Inventory of endpoints + AV product per endpoint +
  // policy. Defender screenshot covers most of it.
  // ────────────────────────────────────────────────────────────────────────
  "SI.L1-3.14.2": {
    controlId: "SI.L1-3.14.2",
    shortName: "Malicious Code Protection",
    oneLiner:
      "Run AV on every device that touches FCI — Defender, CrowdStrike, whatever, just have it.",
    statement:
      "Provide protection from malicious code at appropriate locations within organizational information systems.",
    objectives: [
      { letter: "a", text: "designated locations for malicious code protection are identified" },
      { letter: "b", text: "protection from malicious code at designated locations is provided" },
    ],
    furtherDiscussion:
      "Designated locations = every endpoint where FCI lives or transits. Modern Windows ships with Defender; macOS has XProtect. The assessor wants an inventory of endpoints + the AV product on each, plus a screenshot showing real-time protection is on. A short policy stating \"AV is required on every endpoint, no exceptions\" closes objective (a).",
    evidenceSlots: [
      {
        key: "endpoint_av_inventory",
        label: "Endpoint AV inventory",
        hint: "Each endpoint: device, OS, AV product (Defender / CrowdStrike / etc.), real-time protection on?, last definition update.",
        kind: "roster_csv",
        satisfies: ["a", "b"],
        required: true,
        templatePath: "/templates/endpoint-av-inventory.csv",
        destinations: [
          {
            type: "generate",
            label: "Draft my AV inventory with Charlie",
            filename: "endpoint-av-inventory.csv",
            format: "csv",
          },
          {
            type: "connect",
            label: "Pull AV state from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls Defender / endpoint AV state per managed device — assessor-grade attestation.",
          },
          {
            type: "upload",
            label: "Upload an existing inventory",
            describes:
              "CSV/PDF listing each endpoint + AV product + real-time protection state.",
            accept: [
              "text/csv",
              "application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          },
        ],
      },
      {
        key: "av_protection_screenshot",
        label: "AV protection screenshot",
        hint: "Screenshot of Defender / your AV showing real-time protection is on — at least one endpoint, ideally a laptop and a server.",
        kind: "screenshot",
        satisfies: ["b"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload AV screenshots",
            describes:
              "Screenshots from Windows Security / Defender / CrowdStrike showing real-time protection on.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "av_policy",
        label: "AV / endpoint protection policy",
        hint: "Short policy: AV is required on every endpoint, real-time protection must be on, exceptions require approval.",
        kind: "policy_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie write the policy",
            filename: "av-policy.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing policy",
            describes:
              "Drag in your existing endpoint protection / AV policy.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xv)", "NIST SP 800-171 Rev 2 §3.14.2"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SI.L1-3.14.4 — Update Malicious Code Protection
  //
  // One objective: AV definitions stay updated. Defender's auto-update
  // screenshot or Intune update ring covers this.
  // ────────────────────────────────────────────────────────────────────────
  "SI.L1-3.14.4": {
    controlId: "SI.L1-3.14.4",
    shortName: "Update Malicious Code Protection",
    oneLiner:
      "Keep your AV definitions auto-updating — outdated AV is the same as no AV.",
    statement:
      "Update malicious code protection mechanisms when new releases are available.",
    objectives: [
      { letter: "a", text: "malicious code protection mechanisms are updated when new releases are available" },
    ],
    furtherDiscussion:
      "Modern AV products auto-update by default. The assessor just wants to confirm: a screenshot of the AV showing recent definition updates + a one-line note in your AV policy that auto-updates are required and not disabled.",
    evidenceSlots: [
      {
        key: "av_update_screenshot",
        label: "AV update screenshot",
        hint: "Screenshot showing recent definition update timestamp on at least one endpoint — Defender's About page, CrowdStrike sensor health, etc.",
        kind: "screenshot",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "connect",
            label: "Pull AV update state from Intune / Google Endpoint",
            providers: ["m365", "google_workspace"],
            describes:
              "Pulls last-update timestamps for AV signatures across managed devices.",
          },
          {
            type: "upload",
            label: "Upload AV-update screenshots",
            describes:
              "PNG/JPEG of Windows Security / Defender / your AV showing recent definition update timestamps.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "av_update_policy_note",
        label: "Policy note: AV auto-updates required",
        hint: "One sentence in your AV policy: \"AV definition auto-updates must be enabled and not disabled by users.\" If your 3.14.2 policy already says this, point to it.",
        kind: "policy_doc",
        satisfies: ["a"],
        required: false,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie add the note",
            filename: "av-auto-update-note.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload existing policy excerpt",
            describes:
              "Drag in your existing AV policy or the relevant excerpt.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xvi)", "NIST SP 800-171 Rev 2 §3.14.4"],
  },

  // ────────────────────────────────────────────────────────────────────────
  // SI.L1-3.14.5 — Periodic & Real-Time Scans
  //
  // Three objectives: define scan frequency, run scans at that frequency,
  // and run real-time scans on download/open/execute. Defender's
  // scheduled scan + real-time protection screenshots satisfy this.
  // ────────────────────────────────────────────────────────────────────────
  "SI.L1-3.14.5": {
    controlId: "SI.L1-3.14.5",
    shortName: "Periodic & Real-Time Scans",
    oneLiner:
      "Run a full system scan on a schedule, and scan every download / opened file in real time.",
    statement:
      "Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened, or executed.",
    objectives: [
      { letter: "a", text: "the frequency for malicious code scans is defined" },
      { letter: "b", text: "malicious code scans are performed with the defined frequency" },
      { letter: "c", text: "real-time malicious code scans of files from external sources are performed as files are downloaded, opened, or executed" },
    ],
    furtherDiscussion:
      "Defender / modern AV does this automatically: weekly full scan + always-on real-time protection. The assessor wants two screenshots: the scheduled-scan settings page and the real-time protection page. Your AV policy should state the frequency (e.g. weekly) so objective (a) is documented.",
    evidenceSlots: [
      {
        key: "scan_schedule_screenshot",
        label: "Scheduled scan configuration",
        hint: "Screenshot of your AV's scheduled scan settings showing frequency (e.g. weekly full scan).",
        kind: "screenshot",
        satisfies: ["a", "b"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload scheduled-scan screenshot",
            describes:
              "PNG/JPEG of Defender / your AV showing the scan schedule + last completed scan.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "realtime_scan_screenshot",
        label: "Real-time scan configuration",
        hint: "Screenshot showing real-time protection / on-access scanning is enabled.",
        kind: "screenshot",
        satisfies: ["c"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload real-time scan screenshot",
            describes:
              "PNG/JPEG of Defender / your AV showing real-time protection / on-access scanning enabled.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
      {
        key: "scan_frequency_policy",
        label: "Scan frequency policy note",
        hint: "Policy line: \"Full system scans run weekly; real-time protection is enabled on every endpoint.\" If your 3.14.2 AV policy already says this, point to it.",
        kind: "policy_doc",
        satisfies: ["a"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie add the policy line",
            filename: "scan-frequency-policy.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload existing policy excerpt",
            describes:
              "Drag in your existing AV / endpoint protection policy.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(xvii)", "NIST SP 800-171 Rev 2 §3.14.5"],
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
export function inferSlotKey(
  filename: string,
  spec: Pick<PracticeSpec, "evidenceSlots">,
): string | null {
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
