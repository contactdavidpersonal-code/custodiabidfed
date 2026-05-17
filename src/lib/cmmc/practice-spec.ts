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
    "Four quick questions about your environment — every question maps to a specific NIST 800-171A determination statement for IA.L1-3.5.1. Your answers personalize the evidence list so you only get asked for what an assessor would actually check for *your* setup. None of the three objectives will be skipped — only the path to satisfying them changes.",
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
      "Where do you mostly send/receive emails and store working files for federal-contract work?",
    helpText:
      "Pick the closest match — Charlie routes which roster and enforcement evidence to pull. If you're a solo operator on a personal-style mailbox (Proton, iCloud, etc.) plus a laptop, the first option is for you.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [a],[d]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: [a] authorized users are identified … [d] system access is limited to authorized users. … Identify users, processes, and devices that are allowed to use company computers and can log on to the company network.",
    options: [
      {
        value: "solo_email_laptop",
        label: "Just my email + my laptop (no shared cloud drive)",
        description:
          "Most common for solo / micro contractors — Proton, iCloud, Fastmail, or another personal-style mailbox, plus one or two work laptops.",
      },
      {
        value: "m365_sharepoint",
        label: "Microsoft 365 (Outlook, SharePoint, OneDrive, Teams)",
        description: "You sign in with a work email like name@yourcompany.com that runs on Microsoft.",
      },
      {
        value: "google_drive",
        label: "Google Workspace (Gmail + Drive for work)",
        description: "You sign in with a work email like name@yourcompany.com that runs on Google.",
      },
      {
        value: "on_prem_share",
        label: "A shared drive in the office",
        description: "A Windows file server, Synology box, or other on-site shared storage.",
      },
      {
        value: "saas_app",
        label: "A specific business app",
        description: "Like Salesforce, NetSuite, Deltek, QuickBooks Online, or your accounting / project system.",
      },
      {
        value: "mixed",
        label: "A mix of the above",
      },
    ],
  },
  {
    id: "provisioning_method",
    objectives: ["d", "e"],
    prompt:
      "When a new person needs access to your federal-contract files or email, how do they get it?",
    helpText:
      "We're matching you to an evidence path — not grading. Whatever you do today is what Charlie documents.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [d],[e]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Potential Assessment Considerations",
    regQuote:
      "Determine if: [d] system access is limited to authorized users [and] [e] system access is limited to processes acting on behalf of authorized users. … Set up your system so that only authorized users, processes, and devices can access the company network.",
    options: [
      {
        value: "solo_only_me",
        label: "It's just me — no employees or contractors with access",
        description:
          "You're the only person who logs in. Charlie will write a one-person attestation in place of a multi-step procedure.",
      },
      {
        value: "owner_grants",
        label: "I (or another owner) personally grant access when someone joins",
        description: "You add them to the mailbox, share the folder, hand them the password manager invite — no IT department involved.",
      },
      {
        value: "idp_groups",
        label: "IT adds them to the right groups in our work account",
        description: "Someone manages your Microsoft / Google / Okta tenant and adds new hires to security groups.",
      },
      {
        value: "manual_ticket",
        label: "A manager files a ticket and IT clicks through each system",
      },
      {
        value: "self_service",
        label: "Self-service request portal",
        description: "Like Jira Service Management, ServiceNow, or SailPoint — the requester picks what they need.",
      },
      {
        value: "ad_hoc",
        label: "It happens ad-hoc over email or chat — no fixed process",
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
      "When someone leaves or no longer needs access, how fast does it get shut off?",
    helpText:
      "Assessors weight this heavily — stale access is the #2 finding behind missing MFA. Same-day is the gold standard. If it's just you with no one else, pick the first option.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [d],[e],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: … system access is limited to authorized users [d], processes acting on behalf of authorized users [e], and devices including other systems [f]. … Limit the devices (e.g., printers) that can be accessed by company computers.",
    options: [
      {
        value: "solo_only_me",
        label: "Doesn't apply — it's just me",
        description: "No one else has access today. Charlie notes this so the assessor sees a clear, dated attestation.",
      },
      {
        value: "auto_idp",
        label: "It happens automatically the same day",
        description: "Your work account or HR system auto-removes them — e.g. Entra ID lifecycle workflows, Okta off-boarding.",
      },
      {
        value: "same_day_manual",
        label: "Someone manually runs through a same-day off-boarding checklist",
      },
      {
        value: "within_week",
        label: "Manually, within a week",
      },
      {
        value: "eventual",
        label: "Eventually — whenever someone notices",
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
      "Besides your own work laptops/phones, what else ever connects to your email or files for federal-contract work?",
    helpText:
      "Pick the closest match — we'll add an evidence slot if your answer changes what an assessor would ask for.",
    regAnchor:
      "NIST SP 800-171A §3.1.1 [c],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.i Further Discussion",
    regQuote:
      "Determine if: [c] devices (and other systems) authorized to connect to the system are identified [and] [f] system access is limited to authorized devices (including other systems). … any other device an employee may use to log on to the company network and conduct work tasks.",
    options: [
      {
        value: "managed_only",
        label: "Just my own work laptop(s) and phone(s) — nothing else",
      },
      {
        value: "plus_printers",
        label: "Plus the office printer or all-in-one",
      },
      {
        value: "plus_byod",
        label: "Plus personal devices (mine or a contractor's)",
        description: "We'll add a short \"personal device signed off\" register.",
      },
      {
        value: "plus_vendor",
        label: "Plus an outside system (prime contractor, partner, MSP)",
        description:
          "Like a prime contractor's SFTP, a partner API, or your IT provider's remote-management agent. We'll add a one-row register of those connections.",
      },
      {
        value: "unsure",
        label: "Not sure yet — Charlie will help me figure it out",
      },
    ],
  },
];

const FCI_LOCATION_LABEL: Record<string, string> = {
  solo_email_laptop: "a personal-style mailbox (Proton, iCloud, Fastmail) plus a work laptop",
  m365_sharepoint: "Microsoft 365 (SharePoint / OneDrive / Teams)",
  google_drive: "Google Workspace (Drive / Gmail)",
  on_prem_share: "an on-prem file share / NAS",
  saas_app: "a specific line-of-business SaaS",
  mixed: "a mix of several systems",
};

const PROVISIONING_LABEL: Record<string, string> = {
  solo_only_me: "a one-person operation — only the owner has access",
  owner_grants: "an owner who personally grants access without an IT department",
  idp_groups: "IdP group membership (IT adds users to groups)",
  manual_ticket: "manual ticketed provisioning per system",
  self_service: "a self-service request portal",
  ad_hoc: "ad-hoc grants over email/chat",
  no_process: "no defined provisioning process",
};

const DEPROVISIONING_LABEL: Record<string, string> = {
  solo_only_me: "not applicable — only the owner has access today",
  auto_idp: "auto-deprovisioned same-day via IdP / HRIS sync",
  same_day_manual: "a manual same-day off-boarding checklist",
  within_week: "manual off-boarding within a week",
  eventual: "ad-hoc, eventually when noticed",
  no_process: "no formal off-boarding process",
};

const EXTERNAL_ACTORS_LABEL: Record<string, string> = {
  managed_only: "just the owner's own work laptops and phones",
  plus_printers: "work devices plus the office printer / all-in-one",
  plus_byod: "work devices plus personal devices (a short BYOD register is required)",
  plus_vendor: "work devices plus an outside system (prime, partner, or IT-provider)",
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
    if (where === "solo_email_laptop") {
      slotAnnotations.authorized_users_roster = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "Solo operator on a personal-style mailbox plus a laptop — Charlie drafts a one-row roster (you) listing the mailbox account, the laptop user account, and the date authorized. That single row is the complete, dated artifact an assessor expects.",
      };
      slotAnnotations.enforcement_proof = {
        recommendedDestinationIdx: 1, // upload
        contextNote:
          "Two screenshots are enough: (1) your mailbox provider's Sessions or Authentication-Logs page showing only your account is signed in, and (2) your laptop's Users / Accounts panel showing only your account exists. Charlie tags both to [d]/[e]/[f].",
      };
    } else if (where === "m365_sharepoint") {
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
    const isSolo = prov === "solo_only_me" || deprov === "solo_only_me";
    const noProcess =
      prov === "no_process" || prov === "ad_hoc" || deprov === "no_process" || deprov === "eventual";
    if (isSolo) {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "Solo operator — Charlie drafts a one-paragraph attestation: only the owner has access today, and if/when anyone else is added (employee, contractor, family member helping out), the steps Charlie names will be followed before they get the mailbox or laptop credentials. That attestation is the dated procedure for [d]/[e]/[f].",
      };
    } else if (prov === "owner_grants") {
      slotAnnotations.access_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Owner grants access directly — Charlie drafts a short procedure that names you as the approver, lists the four steps you take to give a new person access (mailbox invite, folder share, password-manager invite, MFA enrollment), and the matching steps you take to remove it. No IT department required.",
      };
    } else if (noProcess) {
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

// ────────────────────────────────────────────────────────────────────────
// Intake spec — AC.L1-3.1.2 (Transaction & Function Control · least privilege)
//
// Only two objectives — [a] define the transactions/functions each role is
// permitted, and [b] limit access to those definitions. The four questions
// below tease apart the two findings an L1 assessor cares most about:
// (1) is there a written role model at all, and (2) is privilege actually
// scoped (admin sprawl, shared admin accounts, and stale privilege are the
// canonical L1 fails). Answers route which slot is generated vs. connected
// vs. uploaded, and inject a dynamic shared-credential register when one
// is needed.
//
// Every regAnchor + regQuote is sourced from NIST SP 800-171A Rev 2 §3.1.2
// determination statements [a]/[b] and the CMMC L1 Self-Assessment Guide
// v2.13 AC.L1-b.1.ii Further Discussion + Potential Assessment
// Considerations.
// ────────────────────────────────────────────────────────────────────────

const ROLE_MODEL_LABEL: Record<string, string> = {
  solo_only_me: "no role model needed — you are the only user",
  off_the_shelf: "off-the-shelf roles from Microsoft 365 / Google / SaaS admin consoles",
  custom_per_system: "custom roles defined per system",
  everyone_admin: "no role separation — everyone effectively has admin",
  unsure: "an undocumented role model still to be inferred",
};

const ADMIN_COUNT_LABEL: Record<string, string> = {
  solo_admin: "only the owner holds an admin role",
  small_named: "two or three named admins",
  several_admins: "four or more named admins",
  most_users_admin: "most users hold an admin role",
  unsure: "an unknown count of admin accounts",
};

const PRIV_REVIEW_LABEL: Record<string, string> = {
  never: "no periodic privilege review has been run",
  on_offboard_only: "privilege is only re-checked when someone leaves",
  annual: "privilege is reviewed annually",
  quarterly: "privilege is reviewed quarterly or more frequently",
  automated: "privilege review is automated on every role change",
};

const SHARED_ACCOUNT_LABEL: Record<string, string> = {
  none: "no shared / generic accounts are in use",
  one_admin: "one shared admin or service account is in use",
  multiple: "multiple shared / generic accounts are in use",
  unsure: "shared-account usage is unknown",
};

const AC312_QUESTIONS: IntakeQuestion[] = [
  {
    id: "role_model",
    objectives: ["a"],
    prompt:
      "How do you decide who in your company gets admin vs. standard access today?",
    helpText:
      "Objective [a] is satisfied when the transactions and functions a role can perform are written down. We're matching you to the right evidence path — Charlie composes a role matrix that fits whatever model you actually use.",
    regAnchor:
      "NIST SP 800-171A §3.1.2 [a]; CMMC L1 SAG (v2.13) AC.L1-b.1.ii Further Discussion",
    regQuote:
      "Determine if: [a] the types of transactions and functions that authorized users are permitted to execute are defined. … Limit users to only the information systems, roles, or applications they are permitted to use and that are needed for their job.",
    options: [
      {
        value: "solo_only_me",
        label: "It's just me — no other users",
        description:
          "You're the only person who signs in. Charlie writes a one-row matrix with you as the sole privileged user and the business justification.",
      },
      {
        value: "off_the_shelf",
        label: "Off-the-shelf roles in our work account",
        description:
          "Microsoft 365, Google Workspace, or SaaS admin consoles ship with named roles (Global Admin, User Admin, Editor, etc.) — you use those.",
      },
      {
        value: "custom_per_system",
        label: "Custom roles defined per system",
        description:
          "Each system has its own role set with custom permission bundles you maintain.",
      },
      {
        value: "everyone_admin",
        label: "Everyone has full / admin access",
        description:
          "There's no real separation today — most users can do anything. This is a top-of-list L1 finding; Charlie helps fix it.",
      },
      {
        value: "unsure",
        label: "Not sure — Charlie will help me figure it out",
      },
    ],
  },
  {
    id: "admin_count",
    objectives: ["b"],
    prompt:
      "How many people currently hold an admin / privileged role across the systems that touch federal-contract work?",
    helpText:
      "Privileged-role sprawl is the #1 L1 finding under AC.L1-3.1.2. Whatever the number is today is what Charlie documents — we're not grading.",
    regAnchor:
      "NIST SP 800-171A §3.1.2 [b]; CMMC L1 SAG (v2.13) AC.L1-b.1.ii Potential Assessment Considerations",
    regQuote:
      "Determine if: [b] system access is limited to the defined types of transactions and functions for authorized users. … Admin/privileged roles are the highest-risk findings — assessors expect to see them assigned by name, scoped tightly, and reviewed periodically.",
    options: [
      { value: "solo_admin", label: "Just me — sole admin" },
      { value: "small_named", label: "2 or 3 named admins" },
      { value: "several_admins", label: "4 or more named admins" },
      {
        value: "most_users_admin",
        label: "Most users have an admin role",
        description:
          "Critical finding for an L1 assessor — Charlie will prioritize the procedure draft and walk you through tightening the role assignments.",
      },
      { value: "unsure", label: "Not sure / haven't counted" },
    ],
  },
  {
    id: "priv_review",
    objectives: ["a", "b"],
    prompt:
      "How often is admin / privileged access reviewed and pruned?",
    helpText:
      "Stale privilege is the second most common L1 fail. Same-day off-boarding doesn't replace a periodic admin review — assessors want both.",
    regAnchor:
      "NIST SP 800-171A §3.1.2 [a],[b]; CMMC L1 SAG (v2.13) AC.L1-b.1.ii Further Discussion",
    regQuote:
      "… each role has a defined set of transactions/functions, and users are granted only the role(s) their job requires. Admin/privileged roles … assigned by name, scoped tightly, and reviewed periodically.",
    options: [
      {
        value: "never",
        label: "Never — once it's granted it stays",
      },
      {
        value: "on_offboard_only",
        label: "Only when someone leaves",
      },
      { value: "annual", label: "Annually" },
      { value: "quarterly", label: "Quarterly or more often" },
      {
        value: "automated",
        label: "Automated on every role change",
        description:
          "Lifecycle workflows (Entra ID, Okta) or HRIS-driven role recalc.",
      },
    ],
  },
  {
    id: "shared_accounts",
    objectives: ["b"],
    prompt:
      "Are there any shared / generic admin accounts (one login multiple people use) in any of the systems that touch federal-contract work?",
    helpText:
      "Shared admin logins are an L1 finding because they break the “limited to authorized users” chain. If any exist, we'll add a one-row exception register so the assessor sees the compensating control instead of a finding.",
    regAnchor:
      "NIST SP 800-171A §3.1.2 [b]; CMMC L1 SAG (v2.13) AC.L1-b.1.ii Further Discussion",
    regQuote:
      "Determine if: [b] system access is limited to the defined types of transactions and functions for authorized users. … Role-based access control is the typical mechanism … users are granted only the role(s) their job requires.",
    options: [
      {
        value: "none",
        label: "No — every login is tied to one named person",
      },
      {
        value: "one_admin",
        label: "Yes — one shared admin / service account",
        description:
          "Charlie will add a shared-credential exception register listing the account, who can sign in, why it exists, and the rotation cadence.",
      },
      {
        value: "multiple",
        label: "Yes — multiple shared accounts in use",
        description:
          "Charlie will add the same register and prioritize a remediation note for each account.",
      },
      { value: "unsure", label: "Not sure — Charlie will probe" },
    ],
  },
];

const ac312Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about how privileges actually work in your environment. Each one is anchored to a specific NIST 800-171A determination statement for AC.L1-3.1.2 — your answers route which evidence Charlie pulls or drafts, but neither objective [a] nor [b] is ever skipped.",
  questions: AC312_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    const model = answers.role_model;
    const adminCount = answers.admin_count;
    const review = answers.priv_review;
    const shared = answers.shared_accounts;

    // ─── Objective [a]/[b] · role_matrix ───
    if (model === "solo_only_me" || adminCount === "solo_admin") {
      slotAnnotations.role_matrix = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "Solo operator — Charlie drafts a one-row matrix (you, sole admin, every in-scope system, business justification = sole owner). That single row is the complete artifact for both objective [a] and [b].",
      };
    } else if (model === "off_the_shelf") {
      slotAnnotations.role_matrix = {
        recommendedDestinationIdx: 0, // generate (then assessor pairs with admin connect screenshot)
        contextNote:
          "You use built-in roles — Charlie composes a matrix that names every user, the off-the-shelf role they hold (Global Admin, User Admin, Editor, etc.), and the business justification. Then the admin-role connect button pulls the live assignments as the matching enforcement evidence for [b].",
      };
    } else if (model === "custom_per_system") {
      slotAnnotations.role_matrix = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          "Custom per-system roles — Charlie walks system-by-system to compose the matrix (each system × role × permitted functions × users in that role). Upload an existing matrix if you already maintain one.",
      };
    } else if (model === "everyone_admin") {
      slotAnnotations.role_matrix = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          "Top-of-list L1 finding — Charlie drafts the target-state matrix first (what each role SHOULD be allowed to do), then a remediation list of which existing users need to be demoted. Both land as evidence: the matrix satisfies [a], the remediation note documents the path to [b].",
      };
    } else {
      slotAnnotations.role_matrix = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie will compose the matrix with you starting from the assessor's expectation: one row per user × system × permission level, with the business justification. The template is also available if you'd rather fill it offline.",
      };
    }

    // ─── Objective [b] · admin_users_screenshot ───
    if (adminCount === "solo_admin") {
      slotAnnotations.admin_users_screenshot = {
        recommendedDestinationIdx: 1, // upload (or connect — both fine)
        contextNote:
          "Sole admin — one screenshot of your admin console showing only your account holds the privileged role is enough. The connect button auto-pulls it if your tenant is linked.",
      };
    } else if (adminCount === "small_named") {
      slotAnnotations.admin_users_screenshot = {
        recommendedDestinationIdx: 0, // connect
        contextNote:
          "2–3 named admins — the cleanest evidence is the live admin-role list straight from your IdP. Click the connect button and Charlie tags the export to objective [b].",
      };
    } else if (adminCount === "several_admins" || adminCount === "most_users_admin") {
      slotAnnotations.admin_users_screenshot = {
        recommendedDestinationIdx: 0, // connect
        contextNote:
          adminCount === "most_users_admin"
            ? "Most users have admin — the connect button pulls the full list so the assessor sees the same number you see. Charlie will then walk a tightening pass: which accounts can be safely demoted to standard."
            : "Several named admins — connect to pull the live list (Global Admin, User Admin, Billing Admin in Entra; Super Admin and role admins in Workspace). Upload a screenshot if you'd rather not link the tenant.",
      };
    } else {
      slotAnnotations.admin_users_screenshot = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Connect your tenant and the admin-role list comes back in seconds — that's also the answer to your own “how many admins do we have?” question. Upload a screenshot if connecting isn't available.",
      };
    }

    // ─── Objective [a] · least_privilege_procedure ───
    if (review === "never" || review === "on_offboard_only") {
      slotAnnotations.least_privilege_procedure = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          review === "never"
            ? "No periodic review today — Charlie drafts a one-paragraph procedure that names the approver, the cadence (we recommend quarterly), and the prune step. The draft is signed evidence the moment you lock the practice."
            : "Off-boarding-only review — Charlie drafts a procedure that ADDS a quarterly admin-role review on top of the off-boarding step, since assessors want both.",
      };
    } else if (review === "automated") {
      slotAnnotations.least_privilege_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Automated role recalc — Charlie drafts a procedure that names the lifecycle workflow / HRIS trigger, the approver of role changes, and the audit cadence on the automation itself. This is the strongest L1 path.",
      };
    } else {
      slotAnnotations.least_privilege_procedure = {
        recommendedDestinationIdx: 0,
        contextNote: `Privilege reviewed ${PRIV_REVIEW_LABEL[review] ?? "manually"} — Charlie drafts a matching procedure with the named approver, cadence, and the action taken on findings.`,
      };
    }

    // ─── Objective [b] · dynamic shared-credential register ───
    if (shared === "one_admin" || shared === "multiple") {
      dynamicSlots.push({
        key: "shared_credential_register",
        label: "Shared / generic account exception register",
        hint: "One row per shared login: account name, the named humans who can use it, what it's for, the rotation/password-change cadence, and the named owner accountable for it.",
        kind: "roster_csv",
        satisfies: ["b"],
        required: true,
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
            describes:
              "CSV or PDF listing each shared account, the named humans who use it, purpose, rotation cadence, and the named owner.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      });
    }

    const situationSummary = [
      `Role model: ${ROLE_MODEL_LABEL[model] ?? "unspecified"}.`,
      `Admin/privileged headcount: ${ADMIN_COUNT_LABEL[adminCount] ?? "unspecified"}.`,
      `Privilege-review cadence: ${PRIV_REVIEW_LABEL[review] ?? "unspecified"}.`,
      `Shared-account posture: ${SHARED_ACCOUNT_LABEL[shared] ?? "unspecified"}.`,
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's least-privilege posture",
      `- Role model: ${ROLE_MODEL_LABEL[answers.role_model] ?? "(not specified)"}`,
      `- Admin headcount: ${ADMIN_COUNT_LABEL[answers.admin_count] ?? "(not specified)"}`,
      `- Privilege review cadence: ${PRIV_REVIEW_LABEL[answers.priv_review] ?? "(not specified)"}`,
      `- Shared accounts: ${SHARED_ACCOUNT_LABEL[answers.shared_accounts] ?? "(not specified)"}`,
      "",
      "Do NOT re-ask these facts. Open by naming the role model in one sentence, then drive toward the next missing objective letter. If `role_model = everyone_admin` OR `admin_count = most_users_admin`, treat tightening admin roles as the priority finding — Charlie names which accounts could be demoted and proposes the role matrix first. If `shared_accounts = one_admin` or `multiple`, the shared-credential exception register is a required artifact for [b] — propose drafting it alongside the matrix. If `priv_review = never`, the least-privilege procedure is the second priority after the matrix.",
    ].join("\n");
  },
};

// ────────────────────────────────────────────────────────────────────────
// Intake spec — AC.L1-3.1.20 (External Connections · scope-shaping)
//
// Six objectives that pair off cleanly:
//   [a]/[b] — identify external connections / use      → inventory artifact
//   [c]/[d] — verify the connection / use is appropriate → contracts + SSO
//             linkage (proves the external relationship is intentional)
//   [e]/[f] — control/limit the connection / use         → SSO,
//             Conditional Access, share-link permissions, vendor MFA
//
// Four questions: scope (how many externals), gating (how access is
// enforced), verification basis (contracts vs. click-through), and
// BYOD/contractor exposure. Answers route Charlie to the right
// generate-vs-connect-vs-upload destination on each slot and inject a
// contractor-attestation register when non-corporate devices touch FCI.
//
// Every regAnchor + regQuote is sourced from NIST SP 800-171A Rev 2
// §3.1.20 determination statements [a]–[f] and the CMMC L1
// Self-Assessment Guide v2.13 AC.L1-b.1.iii Further Discussion +
// Potential Assessment Considerations.
// ────────────────────────────────────────────────────────────────────────

const EXTERNALS_SCOPE_LABEL: Record<string, string> = {
  solo_minimal: "a single owner using just Microsoft 365 / Google Workspace + a couple SaaS apps",
  small_named: "a small, named list (≤10) of approved external SaaS / services",
  many_saas: "many SaaS apps in regular use (10+), most known but not formally catalogued",
  sprawling_unknown: "sprawl — no one has a current list of every external system that can touch FCI",
};

const ACCESS_GATING_LABEL: Record<string, string> = {
  central_sso: "centralized SSO / IdP with Conditional Access (Entra ID, Google, Okta)",
  vendor_mfa: "per-vendor MFA configured on each external system, no central SSO",
  passwords_only: "vendor passwords only — no MFA on most externals",
  share_links: "external collaboration via share links (Drive, OneDrive, Box) with permission controls",
  nothing_formal: "no formal access gating today",
};

const VERIFICATION_BASIS_LABEL: Record<string, string> = {
  signed_contracts: "signed MSA / DPA on file for every external system that touches FCI",
  vendor_diligence: "vendor security review (SOC 2 / questionnaire) before onboarding",
  click_through: "click-through Terms of Service — no negotiated contract",
  mixed: "mixed — contracts for some, click-through for others",
  none_documented: "nothing documented today",
};

const BYOD_CONTRACTORS_LABEL: Record<string, string> = {
  none: "no — only corporate-owned devices touch FCI",
  one_or_two: "one or two contractor / personal devices in scope",
  team_wide: "team-wide — contractors and BYOD devices regularly touch FCI",
  unsure: "unsure — Charlie will help confirm",
};

const AC3120_QUESTIONS: IntakeQuestion[] = [
  {
    id: "externals_scope",
    objectives: ["a", "b"],
    prompt:
      "How many outside systems (SaaS apps, vendor portals, shared services, contractor-owned tools) can touch federal-contract information today?",
    helpText:
      "Objectives [a] and [b] are satisfied when every external connection and its business use is named on a list. We're sizing the inventory, not grading — even sprawl gets an artifact.",
    regAnchor:
      "NIST SP 800-171A §3.1.20 [a],[b]; CMMC L1 SAG (v2.13) AC.L1-b.1.iii Further Discussion",
    regQuote:
      "Determine if: [a] connections to external systems are identified; [b] the use of external systems is identified. … External information systems are systems or components of systems for which organizations typically have no direct supervision and authority.",
    options: [
      {
        value: "solo_minimal",
        label: "It's just me on M365/Google + a few SaaS tools",
        description:
          "Charlie writes a one-page inventory naming each external (M365, Google, a couple SaaS apps) with the business use and how access is gated.",
      },
      {
        value: "small_named",
        label: "Small named list — fewer than ten external systems",
        description:
          "You already roughly know what's in scope. Charlie builds the inventory row-by-row from your list (or imports it).",
      },
      {
        value: "many_saas",
        label: "Many SaaS apps in use (10+), most known but not catalogued",
        description:
          "Charlie pulls the SSO app catalog if you connect M365/Google — that becomes the seed list, and you confirm which actually touch FCI.",
      },
      {
        value: "sprawling_unknown",
        label: "Sprawl — no one has a current list",
        description:
          "Most common L1 finding. Charlie walks a discovery pass (connect tenant → pull SSO app catalog → pull recent share-link audit) before drafting the inventory.",
      },
    ],
  },
  {
    id: "access_gating",
    objectives: ["e", "f"],
    prompt:
      "How is access to those external systems actually enforced today?",
    helpText:
      "Objectives [e] and [f] are satisfied when you can show external use is controlled / limited. Centralized SSO is the strongest evidence; vendor-side MFA also works; passwords-only is a finding.",
    regAnchor:
      "NIST SP 800-171A §3.1.20 [e],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.iii Potential Assessment Considerations",
    regQuote:
      "Determine if: [e] connections to external systems are controlled/limited; [f] the use of external systems is controlled/limited. … Methods include identification of users, authentication mechanisms, … and limits on the type and amount of data that can be transferred.",
    options: [
      {
        value: "central_sso",
        label: "Centralized SSO + Conditional Access",
        description:
          "Entra ID, Google Workspace, or Okta brokers sign-in to most externals. Strongest evidence — the connect button pulls the live Conditional Access policy as proof.",
      },
      {
        value: "vendor_mfa",
        label: "Per-vendor MFA, no central SSO",
        description:
          "Each external has its own MFA configured. Charlie captures one screenshot per system into the access-controls slot.",
      },
      {
        value: "passwords_only",
        label: "Mostly vendor passwords — no MFA on most",
        description:
          "Top-priority finding. Charlie drafts a remediation plan and identifies the two or three highest-risk externals to MFA first.",
      },
      {
        value: "share_links",
        label: "External collaboration mostly via share links",
        description:
          "Charlie pulls Drive/OneDrive share-link permission settings and audits anyone-with-link exposure.",
      },
      {
        value: "nothing_formal",
        label: "No formal access gating today",
        description:
          "Highest-priority L1 fail. Charlie drafts the procedure and starts a remediation roadmap.",
      },
    ],
  },
  {
    id: "verification_basis",
    objectives: ["c", "d"],
    prompt:
      "How is each external relationship verified before it's allowed to touch federal-contract information?",
    helpText:
      "Objectives [c] and [d] are about whether the connection is intentional and appropriate — signed contracts, security reviews, or at minimum a documented decision.",
    regAnchor:
      "NIST SP 800-171A §3.1.20 [c],[d]; CMMC L1 SAG (v2.13) AC.L1-b.1.iii Further Discussion",
    regQuote:
      "Determine if: [c] connections to external systems are verified; [d] the use of external systems is verified. … Verification can be accomplished by interconnection security agreements, contracts, MOUs, or other agreements.",
    options: [
      {
        value: "signed_contracts",
        label: "Signed MSA / DPA on file for every external",
        description:
          "Cleanest evidence. Upload the contract bundle (one PDF or a folder) and Charlie tags each one to its row in the inventory.",
      },
      {
        value: "vendor_diligence",
        label: "Vendor security review (SOC 2, questionnaire) before onboarding",
        description:
          "Charlie captures the diligence artifacts (SOC 2 letter, completed questionnaire) and links them in the inventory's verification column.",
      },
      {
        value: "click_through",
        label: "Click-through ToS — no negotiated contract",
        description:
          "Acceptable for low-risk externals at L1. Charlie documents the decision rationale per system and flags any that should be upgraded to a signed agreement.",
      },
      {
        value: "mixed",
        label: "Mixed — contracts for some, ToS for others",
        description:
          "Charlie distinguishes them in the inventory and adds a remediation list of which click-throughs should be upgraded next.",
      },
      {
        value: "none_documented",
        label: "Nothing documented today",
        description:
          "L1 finding. Charlie drafts the verification procedure and identifies the top three vendors to formalize first.",
      },
    ],
  },
  {
    id: "byod_contractors",
    objectives: ["b", "d", "f"],
    prompt:
      "Are any contractor-owned laptops, personal devices, or shared/kiosk machines used to touch federal-contract information?",
    helpText:
      "Non-corporate devices are an external system under §3.1.20. If any exist, we add a one-row attestation register so the assessor sees the compensating control instead of a finding.",
    regAnchor:
      "NIST SP 800-171A §3.1.20 [b],[d],[f]; CMMC L1 SAG (v2.13) AC.L1-b.1.iii Potential Assessment Considerations",
    regQuote:
      "External information systems include … personally owned systems, components, or devices and privately owned computing and communications devices resident in commercial or public facilities. … Limits on the use of organization-controlled portable storage devices in external information systems are typically enforced.",
    options: [
      {
        value: "none",
        label: "No — only corporate-owned devices touch FCI",
      },
      {
        value: "one_or_two",
        label: "One or two contractor / personal devices",
        description:
          "Charlie adds a contractor attestation register naming each person, the device, and the signed-attestation-on-file status.",
      },
      {
        value: "team_wide",
        label: "Team-wide — contractors and BYOD regularly touch FCI",
        description:
          "Common in small primes with subcontractors. Charlie drafts the full attestation register and the matching external-use procedure clauses.",
      },
      {
        value: "unsure",
        label: "Not sure — Charlie will help confirm",
      },
    ],
  },
];

const ac3120Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about every system outside your authorization boundary that can touch federal-contract information. Each one is anchored to a specific NIST 800-171A determination statement for AC.L1-3.1.20 — your answers route which evidence Charlie pulls, drafts, or asks you to upload, but no objective [a]–[f] is ever skipped.",
  questions: AC3120_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    const scope = answers.externals_scope;
    const gating = answers.access_gating;
    const verify = answers.verification_basis;
    const byod = answers.byod_contractors;

    // ─── Objective [a]/[b]/[c]/[d] · external_systems_inventory ───
    if (scope === "solo_minimal") {
      slotAnnotations.external_systems_inventory = {
        recommendedDestinationIdx: 0, // generate w/ Charlie
        contextNote:
          "Solo operator on M365/Google + a couple SaaS — Charlie drafts a compact inventory (5–8 rows max) naming each external, the business use, the gating method, and the verification basis. That single artifact covers [a], [b], [c], and [d].",
      };
    } else if (scope === "small_named") {
      slotAnnotations.external_systems_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Small named list — Charlie composes the inventory row-by-row from the names you give. If you already maintain one in a spreadsheet, the upload path imports it and Charlie validates each row against the six objectives.",
      };
    } else if (scope === "many_saas") {
      slotAnnotations.external_systems_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Many SaaS apps known but not catalogued — recommended path is to connect your M365 / Google tenant first; the SSO app catalog seeds the inventory, then Charlie walks you row-by-row to mark which apps actually touch FCI.",
      };
    } else if (scope === "sprawling_unknown") {
      slotAnnotations.external_systems_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "No current list — top-of-list L1 finding. Charlie runs a discovery pass: pull SSO app catalog + share-link audit + recent OAuth grants, then drafts the inventory in priority order so the assessor sees the highest-risk externals first.",
      };
    } else {
      slotAnnotations.external_systems_inventory = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie composes the inventory with you, one row per outside system that can touch FCI: vendor, business use, access method, verification basis, and how use is limited.",
      };
    }

    // ─── Objective [e]/[f] · external_access_controls ───
    if (gating === "central_sso") {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 0, // connect
        contextNote:
          "Centralized SSO — the strongest evidence for [e]/[f]. The connect button pulls the live Conditional Access (Entra) / Context-Aware Access (Google) policy plus the SSO app assignments as a single artifact.",
      };
    } else if (gating === "vendor_mfa") {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 1, // upload
        contextNote:
          "Per-vendor MFA — Charlie collects one screenshot per external (vendor admin console showing MFA required). Bundle them in a single PDF or upload individually; Charlie tags each to the inventory row.",
      };
    } else if (gating === "passwords_only") {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 1,
        contextNote:
          "Passwords-only — top finding. Charlie names the two or three highest-risk externals to MFA first and drafts a remediation note. Upload whatever access-control evidence does exist (vendor security pages, password-policy screenshots) and Charlie marks the gap.",
      };
    } else if (gating === "share_links") {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 0,
        contextNote:
          "External collaboration via share links — the connect button pulls Drive/OneDrive share-link permission settings, lists every anyone-with-link exposure, and flags the highest-risk ones. That's assessor-grade [e]/[f] evidence when combined with the inventory.",
      };
    } else if (gating === "nothing_formal") {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 1,
        contextNote:
          "No formal gating today — highest-priority L1 fail. Charlie drafts the access-control procedure first (covered in the external-use slot), then guides the smallest set of changes (turn on MFA on the top 3 externals) to get to a passable [e]/[f] posture.",
      };
    } else {
      slotAnnotations.external_access_controls = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie pulls SSO + Conditional Access (or share-link permissions) directly from your tenant. Upload screenshots if connecting isn't available.",
      };
    }

    // ─── Objective [b]/[f] · external_use_policy ───
    if (verify === "signed_contracts") {
      slotAnnotations.external_use_policy = {
        recommendedDestinationIdx: 0, // generate
        contextNote:
          "Signed MSA/DPA on file — Charlie drafts a tight one-page procedure that names the approver, the diligence step (contract review), and the prohibited tools (personal Dropbox, free file-share, etc.).",
      };
    } else if (verify === "vendor_diligence") {
      slotAnnotations.external_use_policy = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Vendor security review process exists — Charlie drafts the procedure naming the diligence checklist (SOC 2, questionnaire), the approver, and the cadence for re-reviewing existing vendors.",
      };
    } else if (verify === "click_through" || verify === "mixed") {
      slotAnnotations.external_use_policy = {
        recommendedDestinationIdx: 0,
        contextNote: `${verify === "mixed" ? "Mixed verification" : "Click-through ToS today"} — Charlie drafts a procedure that explicitly classifies externals by risk and names which ones must be upgraded to a signed agreement. Documenting the decision IS the verification at L1.`,
      };
    } else if (verify === "none_documented") {
      slotAnnotations.external_use_policy = {
        recommendedDestinationIdx: 0,
        contextNote:
          "No verification documented — Charlie drafts the procedure first (defining how new externals will be approved going forward) and a short remediation list of the top three existing vendors to formalize.",
      };
    } else {
      slotAnnotations.external_use_policy = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie drafts the external-use procedure naming the approver, the approved/banned external systems, and the review cadence.",
      };
    }

    // ─── Objective [b]/[d]/[f] · dynamic contractor / BYOD attestation register ───
    if (byod === "one_or_two" || byod === "team_wide") {
      dynamicSlots.push({
        key: "contractor_byod_register",
        label: "Contractor / BYOD attestation register",
        hint: "One row per non-corporate device that can touch FCI: person, device, owning party, signed attestation on file (Y/N + date), expiry, and the named owner accountable for it.",
        kind: "roster_csv",
        satisfies: ["b", "d", "f"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Draft my contractor/BYOD register with Charlie",
            filename: "contractor-byod-register.csv",
            format: "csv",
          },
          {
            type: "upload",
            label: "Upload an existing register",
            describes:
              "CSV or PDF listing each contractor / BYOD device, the user, attestation status, and expiry.",
            accept: ["text/csv", "application/pdf"],
          },
        ],
      });
    }

    const situationSummary = [
      `External-systems scope: ${EXTERNALS_SCOPE_LABEL[scope] ?? "unspecified"}.`,
      `Access gating posture: ${ACCESS_GATING_LABEL[gating] ?? "unspecified"}.`,
      `Verification basis: ${VERIFICATION_BASIS_LABEL[verify] ?? "unspecified"}.`,
      `BYOD/contractor exposure: ${BYOD_CONTRACTORS_LABEL[byod] ?? "unspecified"}.`,
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's external-systems posture",
      `- Scope: ${EXTERNALS_SCOPE_LABEL[answers.externals_scope] ?? "(not specified)"}`,
      `- Access gating: ${ACCESS_GATING_LABEL[answers.access_gating] ?? "(not specified)"}`,
      `- Verification basis: ${VERIFICATION_BASIS_LABEL[answers.verification_basis] ?? "(not specified)"}`,
      `- BYOD / contractor devices: ${BYOD_CONTRACTORS_LABEL[answers.byod_contractors] ?? "(not specified)"}`,
      "",
      "Do NOT re-ask these facts. Open by naming the scope posture in one sentence, then drive toward the next missing objective letter. If `externals_scope = sprawling_unknown` OR `access_gating = nothing_formal` OR `verification_basis = none_documented`, treat the inventory + procedure as the priority L1 findings — Charlie names them as findings, then walks the smallest remediation path. If `access_gating = central_sso` or `share_links`, propose the connect path first ([e]/[f] evidence is one click away). If `byod_contractors = one_or_two` or `team_wide`, the contractor/BYOD attestation register is a required artifact for [b],[d],[f] — propose drafting it alongside the inventory.",
    ].join("\n");
  },
};

// ────────────────────────────────────────────────────────────────────────
// AC.L1-3.1.22 — Public Information Posting · intake quiz
// ────────────────────────────────────────────────────────────────────────

const PUBLIC_SURFACES_LABEL: Record<string, string> = {
  website_only: "company website only",
  website_social: "company website + social (LinkedIn, X, etc.)",
  many_channels: "website + social + a GitHub org / blog / customer portal / press releases",
  none_active: "no active public-facing channels right now",
};

const POSTERS_SCOPE_LABEL: Record<string, string> = {
  solo_owner: "solo — only the owner posts",
  small_named_team: "a small named team (2–5 people) can post",
  many_can_post: "many people can post — no formal restriction",
  contractor_partner: "a contractor / marketing partner does the posting",
};

const POSTING_REVIEW_STATE_LABEL: Record<string, string> = {
  formal_signoff: "every public post gets a formal review/sign-off before publishing",
  informal_review: "informal — usually a quick read-over by another person",
  publish_freely: "posters publish freely, no review step",
  unclear: "unclear / inconsistent across channels",
};

const FCI_EXPOSURE_RISK_LABEL: Record<string, string> = {
  never_named: "no — federal customers and contract details have never appeared publicly",
  customers_named: "yes — federal customers or projects have been named on public channels",
  unsure_legacy: "unsure — legacy content has never been audited",
};

const AC3122_QUESTIONS: IntakeQuestion[] = [
  {
    id: "public_surfaces",
    objectives: ["a", "d"],
    prompt:
      "Which public-facing channels does your company actually publish to today?",
    helpText:
      "We're scoping which surfaces the assessor will look at. Anything the public can read counts — website, LinkedIn page, GitHub org, customer-facing portal, press releases.",
    regAnchor:
      "NIST SP 800-171A §3.1.22 [a],[d]; CMMC L1 SAG (v2.13) AC.L1-b.1.iv Further Discussion",
    regQuote:
      "Determine if: [a] individuals authorized to post information on publicly accessible systems are identified; [d] content on publicly accessible information systems is reviewed to ensure that it does not include FCI. … Publicly accessible information systems include … public websites, blogs, and social media.",
    options: [
      {
        value: "website_only",
        label: "Just the company website",
        description: "Smallest surface — one posters list, one procedure, one sample review.",
      },
      {
        value: "website_social",
        label: "Website + social (LinkedIn, X, Facebook)",
        description:
          "Most common setup. Charlie writes the procedure to cover all channels with one review workflow.",
      },
      {
        value: "many_channels",
        label: "Website + social + GitHub org / blog / customer portal / press",
        description:
          "Bigger public surface. Charlie names each channel in the procedure and assigns a reviewer per channel.",
      },
      {
        value: "none_active",
        label: "No active public-facing channels right now",
        description:
          "Still required at L1 — the procedure must exist before the first post. Charlie drafts a 'before we launch any public channel' procedure plus a stub posters list (owner only).",
      },
    ],
  },
  {
    id: "posters_scope",
    objectives: ["a"],
    prompt:
      "Who in your company is actually allowed to post to those public channels today?",
    helpText:
      "Objective [a] is satisfied when there's a named list of authorized posters with a signed acknowledgement that FCI cannot appear in public content.",
    regAnchor:
      "NIST SP 800-171A §3.1.22 [a]; CMMC L1 SAG (v2.13) AC.L1-b.1.iv Further Discussion",
    regQuote:
      "Determine if: [a] individuals authorized to post information on publicly accessible systems are identified. … Organizations should ensure that the content on publicly accessible information systems is approved by authorized individuals.",
    options: [
      {
        value: "solo_owner",
        label: "Just me / the owner",
        description: "Single-row roster + signed acknowledgement. Charlie drafts both.",
      },
      {
        value: "small_named_team",
        label: "A small named team (2–5 people)",
        description:
          "Charlie composes the roster from the names you give and generates the acknowledgement form for each person to sign.",
      },
      {
        value: "many_can_post",
        label: "Many people can post — no formal restriction",
        description:
          "L1 finding. Charlie names this as the priority gap and drafts a tightened poster list (the smallest reasonable team) plus the acknowledgement.",
      },
      {
        value: "contractor_partner",
        label: "A contractor or marketing partner posts on our behalf",
        description:
          "Common for small companies. Charlie names the contractor on the roster and adds an external-attestation row (acknowledgement signed by the contractor).",
      },
    ],
  },
  {
    id: "posting_review_state",
    objectives: ["b", "c", "e"],
    prompt:
      "What's the current pre-publish review state for public content?",
    helpText:
      "Objectives [b]/[c]/[e] are satisfied by a written procedure: how content is reviewed before posting, and how a problematic post is taken down. We're sizing how much Charlie needs to write vs. document.",
    regAnchor:
      "NIST SP 800-171A §3.1.22 [b],[c],[e]; CMMC L1 SAG (v2.13) AC.L1-b.1.iv Potential Assessment Considerations",
    regQuote:
      "Determine if: [b] procedures to ensure FCI is not posted on publicly accessible information systems are identified; [c] a review process is in place prior to posting of any content to publicly accessible information systems; [e] mechanisms are in place to remove and address improper posting of FCI.",
    options: [
      {
        value: "formal_signoff",
        label: "Every public post gets a formal review/sign-off before publishing",
        description:
          "Strongest evidence. Charlie documents the existing workflow into a one-page procedure and pairs it with a real recent example.",
      },
      {
        value: "informal_review",
        label: "Informal — usually a quick read-over by another person",
        description:
          "Charlie writes the procedure to formalize what already happens (named approver, FCI check, removal step) — minimal change to actual behavior.",
      },
      {
        value: "publish_freely",
        label: "Posters publish freely — no review step today",
        description:
          "L1 finding. Charlie drafts the procedure that introduces the smallest possible review step (named approver, async approval channel) so the workflow is documented and adoptable.",
      },
      {
        value: "unclear",
        label: "Unclear — inconsistent across channels",
        description:
          "Charlie writes one procedure that applies uniformly to every channel from the first question.",
      },
    ],
  },
  {
    id: "fci_exposure_risk",
    objectives: ["d", "e"],
    prompt:
      "Have federal customers, project names, or contract details ever appeared on any of your public channels?",
    helpText:
      "Objectives [d]/[e] require a content review for FCI exposure and a removal mechanism. If anything sensitive may have been posted, we add a one-pass content-audit log so the assessor sees the cleanup was done.",
    regAnchor:
      "NIST SP 800-171A §3.1.22 [d],[e]; CMMC L1 SAG (v2.13) AC.L1-b.1.iv Further Discussion",
    regQuote:
      "Determine if: [d] content on publicly accessible information systems is reviewed to ensure that it does not include FCI; [e] mechanisms are in place to remove and address improper posting of FCI. … Even seemingly innocuous information can, when combined, become sensitive.",
    options: [
      {
        value: "never_named",
        label: "No — federal customers / contract details have never appeared publicly",
        description:
          "Cleanest path. Charlie documents the sample review (one recent reviewed post) and the procedure covers ongoing checks.",
      },
      {
        value: "customers_named",
        label: "Yes — federal customers or projects have been named publicly",
        description:
          "Required: a content-audit log showing each public surface was reviewed for FCI and any exposures resolved. Charlie drafts the audit log and adds it as an artifact.",
      },
      {
        value: "unsure_legacy",
        label: "Unsure — legacy content has never been audited",
        description:
          "Same path — Charlie drafts the content-audit log so the assessor sees a first pass was completed even if nothing was found.",
      },
    ],
  },
];

const ac3122Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about what's already public and who can post. Each one maps to a specific NIST 800-171A determination statement for AC.L1-3.1.22 — Charlie uses the answers to draft the posters roster, the review procedure, and (when needed) a content-audit log. No objective [a]–[e] is skipped.",
  questions: AC3122_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    const surfaces = answers.public_surfaces;
    const posters = answers.posters_scope;
    const reviewState = answers.posting_review_state;
    const exposure = answers.fci_exposure_risk;

    // ─── Objective [a] · authorized_posters_ack ───
    if (posters === "solo_owner") {
      slotAnnotations.authorized_posters_ack = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Solo poster — Charlie drafts a one-row roster (owner only) plus the matching one-page signed acknowledgement. Sign, scan, upload — that's all [a] needs.",
      };
    } else if (posters === "small_named_team") {
      slotAnnotations.authorized_posters_ack = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Small named team — give Charlie the names and he composes the roster + acknowledgement form. Each named person signs once; the bundle covers [a] in full.",
      };
    } else if (posters === "many_can_post") {
      slotAnnotations.authorized_posters_ack = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Top L1 finding — too many posters and no acknowledgements. Charlie drafts a tightened roster (the smallest reasonable team that can still do marketing) plus the acknowledgement, then names this as the remediation priority.",
      };
    } else if (posters === "contractor_partner") {
      slotAnnotations.authorized_posters_ack = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Contractor / marketing partner posts on your behalf — Charlie adds the contractor name to the roster with an external-attestation column and drafts the acknowledgement they should sign.",
      };
    } else {
      slotAnnotations.authorized_posters_ack = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie drafts the authorized-posters roster and the matching FCI acknowledgement form.",
      };
    }

    // ─── Objective [b]/[c]/[e] · public_posting_procedure ───
    if (reviewState === "formal_signoff") {
      slotAnnotations.public_posting_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "You already have a formal review workflow — Charlie writes a one-page procedure that documents what already happens (named approver, FCI check, removal step). Minimal behavior change, full [b]/[c]/[e] coverage.",
      };
    } else if (reviewState === "informal_review") {
      slotAnnotations.public_posting_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Informal review today — Charlie formalizes it into a written procedure that mirrors current practice and adds the one missing piece (a documented removal step) so [e] is covered.",
      };
    } else if (reviewState === "publish_freely") {
      slotAnnotations.public_posting_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "No review step today — L1 finding. Charlie drafts the smallest viable procedure: a named approver, an async approval channel (Slack/email), the FCI check, and the removal mechanism. Adoptable in a week.",
      };
    } else if (reviewState === "unclear") {
      slotAnnotations.public_posting_procedure = {
        recommendedDestinationIdx: 0,
        contextNote: `Inconsistent across channels — Charlie writes one procedure that applies to every surface (${PUBLIC_SURFACES_LABEL[surfaces] ?? "your public surfaces"}) so the assessor sees uniform coverage.`,
      };
    } else {
      slotAnnotations.public_posting_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Charlie drafts the posting-review procedure: who drafts, who reviews for FCI, who approves, and how a problematic post is removed.",
      };
    }

    // ─── Objective [d] · review_evidence ───
    if (surfaces === "none_active") {
      slotAnnotations.review_evidence = {
        recommendedDestinationIdx: 0,
        contextNote:
          "No active public channels yet — the sample review will be a stub: the procedure pre-approved by leadership, ready for the first real post. Charlie captures the sign-off email as the evidence.",
      };
    } else if (reviewState === "formal_signoff") {
      slotAnnotations.review_evidence = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Forward a recent approval email or screenshot of the review thread — Charlie tags it to the procedure and the right objective.",
      };
    } else {
      slotAnnotations.review_evidence = {
        recommendedDestinationIdx: 0,
        contextNote:
          "The simplest sample: the next time you publish anything, take a screenshot of the approval message (or run one through Charlie's review prompt) and upload it here.",
      };
    }

    // ─── Objective [d]/[e] · dynamic content-audit log ───
    if (exposure === "customers_named" || exposure === "unsure_legacy") {
      dynamicSlots.push({
        key: "public_content_audit_log",
        label: "Public content audit log",
        hint: "One pass across each public surface noting what was reviewed, what was found, and what was removed or kept. Two columns is enough: surface + finding/action. Required when legacy content may include FCI.",
        kind: "procedure_doc",
        satisfies: ["d", "e"],
        required: true,
        destinations: [
          {
            type: "generate",
            label: "Have Charlie draft the audit log",
            filename: "public-content-audit-log.md",
            format: "markdown",
          },
          {
            type: "upload",
            label: "Upload an existing audit log",
            describes:
              "PDF, Markdown, or DOCX listing each public surface, what was reviewed, and what action was taken.",
            accept: [
              "application/pdf",
              "text/markdown",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          },
        ],
      });
    }

    const situationSummary = [
      `Public surfaces: ${PUBLIC_SURFACES_LABEL[surfaces] ?? "unspecified"}.`,
      `Posters scope: ${POSTERS_SCOPE_LABEL[posters] ?? "unspecified"}.`,
      `Review state: ${POSTING_REVIEW_STATE_LABEL[reviewState] ?? "unspecified"}.`,
      `FCI-exposure risk: ${FCI_EXPOSURE_RISK_LABEL[exposure] ?? "unspecified"}.`,
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's public-posting posture",
      `- Public surfaces: ${PUBLIC_SURFACES_LABEL[answers.public_surfaces] ?? "(not specified)"}`,
      `- Authorized posters: ${POSTERS_SCOPE_LABEL[answers.posters_scope] ?? "(not specified)"}`,
      `- Current review state: ${POSTING_REVIEW_STATE_LABEL[answers.posting_review_state] ?? "(not specified)"}`,
      `- FCI-exposure risk: ${FCI_EXPOSURE_RISK_LABEL[answers.fci_exposure_risk] ?? "(not specified)"}`,
      "",
      "Do NOT re-ask these facts. Open by naming the surface scope in one sentence, then drive toward the next missing objective letter. If `posters_scope = many_can_post` OR `posting_review_state = publish_freely`, name those as the priority L1 findings and walk the smallest remediation path (tightened roster + minimal review workflow). If `fci_exposure_risk = customers_named` or `unsure_legacy`, the content-audit log is required for [d]/[e] — propose drafting it alongside the procedure. If `public_surfaces = none_active`, the procedure must still exist before the first post; treat the leadership pre-approval email as the sample review.",
    ].join("\n");
  },
};

// ────────────────────────────────────────────────────────────────────────
// Intake spec — MP.L1-3.8.3 (Media Disposal)
//
// Two objectives:
//   • [a] media containing FCI is sanitized or destroyed BEFORE DISPOSAL
//   • [b] media containing FCI is sanitized BEFORE REUSE
//
// Anchored to:
//   • NIST SP 800-171A Rev 2 §3.8.3 determination statements [a], [b]
//   • CMMC Self-Assessment Guide — Level 1 v2.13, MP.L1-b.1.vii
//     ("Further Discussion" + "Potential Assessment Considerations")
//   • FAR 52.204-21(b)(1)(vii)
//   • NIST SP 800-88 Rev 1 (Clear / Purge / Destroy categories)
//
// The cloud-only and never-reuse paths are explicitly attestable — the
// objective is still satisfied, just by signed attestation rather than
// a multi-row log. NEVER drop an objective.
// ────────────────────────────────────────────────────────────────────────
const MP383_QUESTIONS: IntakeQuestion[] = [
  {
    id: "media_types",
    objectives: ["a", "b"],
    prompt:
      "What kinds of media does Federal Contract Information actually live on today?",
    helpText:
      "Pick the option that best matches your real setup. If FCI only lives in M365 or Google Drive and nothing is ever printed or saved to a drive, choose cloud-only.",
    regAnchor:
      "NIST SP 800-171A §3.8.3 [a]/[b]; CMMC L1 SAG (v2.13) MP.L1-b.1.vii Further Discussion",
    regQuote:
      "Determine if: [a] system media containing CUI is sanitized or destroyed before disposal; [b] system media containing CUI is sanitized before it is released for reuse. … Media is the physical and electronic items that store information including hard drives, CDs, USB devices, and paper.",
    options: [
      {
        value: "laptops_and_usb",
        label: "Laptops / desktops, plus the occasional USB or external drive",
      },
      {
        value: "laptops_only",
        label: "Laptop or desktop SSDs only — no removable drives",
      },
      {
        value: "mobile_too",
        label: "Laptops + phones / tablets",
        description: "iOS, Android, or company-issued mobile devices touch FCI.",
      },
      {
        value: "paper_too",
        label: "All of the above + we sometimes print FCI",
      },
      {
        value: "cloud_only",
        label: "Cloud-only — nothing physical stores FCI",
        description:
          "FCI lives in M365 / Google Drive / a SaaS app, nothing is ever printed or saved locally. We'll convert the disposal log into a signed attestation.",
      },
    ],
  },
  {
    id: "disposal_method",
    objectives: ["a"],
    prompt:
      "When a device or drive that touched FCI is retired or replaced, what happens to it today?",
    helpText:
      "An assessor wants to see one consistent method. \"It depends\" is fine — pick whichever method you'd use most often.",
    regAnchor:
      "NIST SP 800-171A §3.8.3 [a]; CMMC L1 SAG (v2.13) MP.L1-b.1.vii Further Discussion",
    regQuote:
      "Determine if: [a] system media containing CUI is sanitized or destroyed before disposal. … Sanitization is the process by which data is irreversibly removed from media or the media is permanently destroyed. … Methods include … overwriting, degaussing, and physical destruction.",
    options: [
      {
        value: "vendor_certified",
        label: "Vendor with a certificate of destruction",
        description:
          "Iron Mountain, Shred-it, or a similar service. We'll require their certificates as evidence.",
      },
      {
        value: "self_destroy",
        label: "We physically destroy it ourselves",
        description:
          "Hammer, drill, shredder, degausser — the drive is unrecoverable when we're done.",
      },
      {
        value: "self_wipe",
        label: "We wipe it with software (DBAN, factory reset, manufacturer tool)",
      },
      {
        value: "leased_return",
        label: "It goes back to the leasing company / OEM",
        description:
          "We need a clause or MOU showing they sanitize the device on return.",
      },
      {
        value: "none_yet",
        label: "No retirements have happened yet",
        description:
          "We'll attest to that with a one-row log and lean on the written procedure for now.",
      },
    ],
  },
  {
    id: "reuse_method",
    objectives: ["b"],
    prompt:
      "When you hand an old laptop, phone, or USB to a different employee, what do you do first?",
    helpText:
      "\"Reuse\" means the device is going from one person to another, not retired. If you've never reassigned a device, say so.",
    regAnchor:
      "NIST SP 800-171A §3.8.3 [b]; NIST SP 800-88 Rev 1 §4 (Clear / Purge / Destroy)",
    regQuote:
      "Determine if: [b] system media containing CUI is sanitized before it is released for reuse. … Sanitization techniques (e.g., clearing, purging, cryptographic erase, and destruction) prevent the disclosure of information to unauthorized individuals when such media is reused or released for disposal.",
    options: [
      {
        value: "full_wipe",
        label: "Full wipe / factory reset before handoff",
        description:
          "The device is reset to factory state, then re-imaged or set up fresh for the new user.",
      },
      {
        value: "delete_files",
        label: "Just delete the previous user's files and reassign",
        description:
          "This is NOT sufficient under 800-88 — we'll bring this up in the procedure.",
      },
      {
        value: "never_reuse",
        label: "We never reuse devices — each retired device is destroyed",
        description:
          "Objective [b] is satisfied by a signed attestation: \"no media is released for reuse.\"",
      },
      {
        value: "unsure",
        label: "Not sure / no policy yet",
        description: "Charlie will walk you through the right method.",
      },
    ],
  },
  {
    id: "disposal_log_state",
    objectives: ["a", "b"],
    prompt:
      "Do you have any kind of list — spreadsheet, paper sheet, anything — of devices or drives you've disposed of or reassigned?",
    helpText:
      "Even a one-line note in OneNote counts. The assessor just needs proof you track these events.",
    regAnchor:
      "NIST SP 800-171A §3.8.3 [a]/[b]; CMMC L1 SAG (v2.13) MP.L1-b.1.vii Potential Assessment Considerations",
    regQuote:
      "Examine: media protection records; system audit logs and records; … Are the actions of sanitizing media documented somewhere (e.g., log of activities, certificate of destruction)?",
    options: [
      {
        value: "yes_csv",
        label: "Yes — a spreadsheet I can export",
      },
      {
        value: "yes_paper",
        label: "Yes — but it's on paper or in a doc",
        description: "We'll have you upload a scan or transcribe it into the template.",
      },
      {
        value: "none",
        label: "No — nothing tracked yet",
        description: "Charlie will draft one from your real disposal history.",
      },
    ],
  },
];

const MP_MEDIA_TYPES_LABEL: Record<string, string> = {
  laptops_and_usb: "laptops/desktops + occasional removable drives",
  laptops_only: "laptop or desktop SSDs only",
  mobile_too: "laptops + phones/tablets",
  paper_too: "laptops, drives, phones, and printed paper",
  cloud_only: "cloud-only — no physical media stores FCI",
};

const MP_DISPOSAL_METHOD_LABEL: Record<string, string> = {
  vendor_certified: "certified-destruction vendor (Iron Mountain / Shred-it / similar)",
  self_destroy: "self-performed physical destruction (drill / shred / hammer)",
  self_wipe: "self-performed software wipe (DBAN / factory reset / vendor tool)",
  leased_return: "returned to leasing company or OEM under their sanitization clause",
  none_yet: "no disposal events have occurred yet",
};

const MP_REUSE_METHOD_LABEL: Record<string, string> = {
  full_wipe: "full factory wipe before handoff",
  delete_files: "only files are deleted before handoff — NOT 800-88 compliant",
  never_reuse: "media is never reused — every retired device is destroyed",
  unsure: "no reuse policy yet",
};

const MP_LOG_STATE_LABEL: Record<string, string> = {
  yes_csv: "existing spreadsheet log",
  yes_paper: "paper or doc log (will be uploaded as scan)",
  none: "no log yet — will be drafted with Charlie",
};

const mp383Intake: PracticeIntakeSpec = {
  preamble:
    "Four quick questions about how you handle drives, USBs, phones, and paper that touch Federal Contract Information. Every question maps to a specific NIST 800-171A determination statement for MP.L1-3.8.3. Your answers personalize the evidence list — both objectives are always satisfied, only the path changes (a full log, a signed attestation, or a mix).",
  questions: MP383_QUESTIONS,
  personalize: (answers) => {
    const slotAnnotations: Record<string, SlotAnnotation> = {};
    const dynamicSlots: EvidenceSlot[] = [];
    const hiddenSlotKeys: string[] = [];

    // ─── Cloud-only special case: log collapses to an attestation ───
    // No physical media ever stores FCI → objective [a]/[b] for the log
    // is satisfied by a signed attestation. The procedure still applies
    // (for the day they print a single sheet, things change), but it
    // becomes a one-page "what we'll do if media is ever introduced".
    if (answers.media_types === "cloud_only") {
      slotAnnotations.media_disposal_log = {
        attestation: {
          buttonLabel: "Attest: no physical media touches FCI",
          autoNarrative:
            "The organization attests that Federal Contract Information is stored exclusively in cloud services (Microsoft 365 / Google Workspace / approved SaaS) and is never printed, downloaded, or saved to laptop drives, USB drives, mobile devices, or any other physical media. Because no media containing FCI exists, no disposal or reuse events occur. This attestation satisfies NIST SP 800-171A §3.8.3 determination statements [a] and [b] for this environment. If physical media is introduced in the future, the organization will create a disposal log entry and apply the documented sanitization procedure.",
          reason:
            "You said FCI lives only in cloud apps and never touches physical media — under NIST 800-171A this objective is satisfied by a signed attestation rather than a log. The attestation is stamped with your account, the date, and is included verbatim in the SSP.",
        },
      };
      slotAnnotations.sanitization_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "Cloud-only setup — Charlie will draft a one-page procedure that covers the unlikely future case (someone prints FCI, someone saves to USB) and points at the cloud-app data-deletion workflow as the primary control.",
      };
      hiddenSlotKeys.push("destruction_certificates");
    } else {
      // ─── Disposal method drives the log + certificate paths ───
      const dm = answers.disposal_method;
      // Certificates of destruction are only required when the user uses
      // a certified-destruction vendor. Hide the slot otherwise — objective
      // [a] is still doubly covered by media_disposal_log + sanitization_procedure.
      if (dm !== "vendor_certified") {
        hiddenSlotKeys.push("destruction_certificates");
      }
      if (dm === "vendor_certified") {
        slotAnnotations.media_disposal_log = {
          recommendedDestinationIdx:
            answers.disposal_log_state === "yes_csv" ? 1 : 0,
          contextNote:
            "Vendor-handled destruction — Charlie will draft the log with placeholder columns for vendor name, certificate number, and pickup date. Pair every row with the corresponding certificate of destruction.",
        };
        slotAnnotations.destruction_certificates = {
          recommendedDestinationIdx: 0,
          contextNote:
            "Upload every certificate of destruction your vendor has issued — even one is enough to satisfy [a]. The cert is the assessor's proof that drives left your control sanitized.",
        };
      } else if (dm === "self_destroy") {
        slotAnnotations.media_disposal_log = {
          recommendedDestinationIdx:
            answers.disposal_log_state === "yes_csv" ? 1 : 0,
          contextNote:
            "Self-performed physical destruction — log each event with date, asset/serial, who destroyed it, and the method (drill / shred / hammer). A photo of the destroyed drive next to the asset tag is the strongest evidence.",
        };
        slotAnnotations.sanitization_procedure = {
          recommendedDestinationIdx: 0,
          contextNote:
            "Charlie will write a procedure citing NIST SP 800-88 Rev 1 §4 (Destroy category) — naming who's authorized to perform destruction, what tool is used, and how each event is logged.",
        };
      } else if (dm === "self_wipe") {
        slotAnnotations.media_disposal_log = {
          recommendedDestinationIdx:
            answers.disposal_log_state === "yes_csv" ? 1 : 0,
          contextNote:
            "Software wipe — log each event with date, asset/serial, tool used (DBAN / manufacturer reset / vendor utility), and verification step. NIST SP 800-88 §4 considers most modern SSD factory resets adequate \"Purge\" for non-classified data.",
        };
        slotAnnotations.sanitization_procedure = {
          recommendedDestinationIdx: 0,
          contextNote:
            "Charlie will write a procedure citing NIST SP 800-88 Rev 1 §4 (Clear / Purge) — name the tool you use, the verification step, and who's authorized to run it.",
        };
      } else if (dm === "leased_return") {
        slotAnnotations.media_disposal_log = {
          recommendedDestinationIdx:
            answers.disposal_log_state === "yes_csv" ? 1 : 0,
          contextNote:
            "Leased devices — log every return event with date, asset/serial, leasing-company contact, and the contractual sanitization clause. The MOU/clause below is what an assessor checks for [a].",
        };
        // Add a dynamic slot for the lease/return sanitization clause.
        dynamicSlots.push({
          key: "leased_return_clause",
          label: "Leased-device sanitization clause / MOU",
          hint: "Snippet of the lease, MSA, or MOU stating the leasing company sanitizes the device on return — or a separate signed MOU committing them to do so.",
          kind: "procedure_doc",
          satisfies: ["a"],
          required: true,
          destinations: [
            {
              type: "upload",
              label: "Upload the lease clause or MOU",
              describes:
                "PDF/screenshot of the contract clause or signed MOU that puts sanitization on the leasing company.",
              accept: [
                "application/pdf",
                "image/png",
                "image/jpeg",
                "image/webp",
              ],
            },
            {
              type: "generate",
              label: "Draft a sanitization MOU with Charlie",
              filename: "leased-return-sanitization-mou.md",
              format: "markdown",
            },
          ],
        });
      } else if (dm === "none_yet") {
        slotAnnotations.media_disposal_log = {
          attestation: {
            buttonLabel: "Attest: no disposal events yet",
            autoNarrative:
              "The organization attests that as of the assessment date, no media containing Federal Contract Information has been disposed of or released for reuse. The documented sanitization procedure (attached) governs every future disposal and reuse event; the first such event will be logged with date, asset identifier, sanitization method, and operator. This attestation satisfies NIST SP 800-171A §3.8.3 determination statements [a] and [b] until the first disposal event occurs.",
            reason:
              "You said no media has been retired or reassigned yet — under NIST 800-171A the historical log is satisfied by a signed attestation, while the written procedure carries the weight going forward.",
          },
        };
        slotAnnotations.sanitization_procedure = {
          recommendedDestinationIdx: 0,
          contextNote:
            "No history yet — the procedure is now the primary evidence. Charlie will write one that picks one consistent method per media type and names who'll execute it.",
        };
      }
    }

    // ─── Reuse method ───
    // never_reuse → [b] is covered by the disposal log's destruction
    // rows (each retired-and-destroyed device); the procedure just needs
    // to state "no reuse" explicitly. No separate slot needed.
    if (
      answers.reuse_method === "never_reuse" &&
      answers.media_types !== "cloud_only"
    ) {
      slotAnnotations.sanitization_procedure = {
        ...(slotAnnotations.sanitization_procedure ?? {}),
        recommendedDestinationIdx: 0,
        contextNote:
          (slotAnnotations.sanitization_procedure?.contextNote ?? "") +
          " You said media is never reused — Charlie will state that explicitly in the procedure (\"all retired media is destroyed; nothing is released for reuse\") so an assessor can see how objective [b] is satisfied without a reuse log.",
      };
    } else if (answers.reuse_method === "delete_files") {
      // Highest-priority finding: deleting files is not sanitization.
      slotAnnotations.sanitization_procedure = {
        recommendedDestinationIdx: 0,
        contextNote:
          "You mentioned just deleting files before reassigning a device — NIST SP 800-88 explicitly does NOT consider that sanitization. Charlie's procedure will replace that with a factory reset / Clear-level wipe step before any reuse.",
      };
    } else if (answers.reuse_method === "full_wipe") {
      slotAnnotations.media_disposal_log = {
        contextNote:
          "Good — full wipe before handoff matches NIST 800-88 §4 Clear/Purge for SSDs. The disposal log should include a row per reuse event (date, asset, old/new user, tool used).",
      };
    }

    // ─── Log state ───
    // If they already have a spreadsheet, recommend the upload destination
    // on the disposal log; if paper, point at the template + scan path.
    if (answers.disposal_log_state === "yes_csv") {
      slotAnnotations.media_disposal_log = {
        ...(slotAnnotations.media_disposal_log ?? {}),
        recommendedDestinationIdx: 1,
        contextNote:
          (slotAnnotations.media_disposal_log?.contextNote ?? "") +
          " You already have a spreadsheet — upload it and Charlie will check that it includes date, asset/serial, method, and operator.",
      };
    } else if (answers.disposal_log_state === "yes_paper") {
      slotAnnotations.media_disposal_log = {
        ...(slotAnnotations.media_disposal_log ?? {}),
        recommendedDestinationIdx: 1,
        contextNote:
          (slotAnnotations.media_disposal_log?.contextNote ?? "") +
          " Your log is on paper — scan it as one PDF and upload, or transcribe the rows into the template if you'd rather keep it digital.",
      };
    }

    const situationSummary = [
      `FCI lives on: ${MP_MEDIA_TYPES_LABEL[answers.media_types] ?? "unspecified"}.`,
      `Disposal method: ${MP_DISPOSAL_METHOD_LABEL[answers.disposal_method] ?? "unspecified"}.`,
      `Reuse method: ${MP_REUSE_METHOD_LABEL[answers.reuse_method] ?? "unspecified"}.`,
      `Existing log: ${MP_LOG_STATE_LABEL[answers.disposal_log_state] ?? "unspecified"}.`,
    ].join(" ");

    return { slotAnnotations, dynamicSlots, hiddenSlotKeys, situationSummary };
  },
  charlieBrief: (answers) => {
    return [
      "## What we already know about this user's media-disposal posture",
      `- Media types in scope: ${MP_MEDIA_TYPES_LABEL[answers.media_types] ?? "(not specified)"}`,
      `- Disposal method: ${MP_DISPOSAL_METHOD_LABEL[answers.disposal_method] ?? "(not specified)"}`,
      `- Reuse method: ${MP_REUSE_METHOD_LABEL[answers.reuse_method] ?? "(not specified)"}`,
      `- Existing log state: ${MP_LOG_STATE_LABEL[answers.disposal_log_state] ?? "(not specified)"}`,
      "",
      "Do NOT re-ask these facts. Open by naming the disposal posture in one sentence, then drive toward the missing objective. If `media_types = cloud_only`, both objectives are satisfied by a single attestation — confirm it's signed rather than chasing a log. If `disposal_method = none_yet`, the procedure is the primary evidence — focus the conversation on which sanitization method they'll commit to per media type. If `reuse_method = delete_files`, name that as a finding and walk the smallest fix (factory reset before any handoff). If `disposal_method = vendor_certified`, the certificates of destruction are required, not optional.",
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
    intake: ac312Intake,
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
    intake: ac3120Intake,
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
        label: "Proof someone reviewed a recent post before it went public",
        hint: "Pick any one thing your company posted publicly in the last few months — a LinkedIn update, a website page, a press release, a GitHub README. Show the assessor that someone checked it before it went live. The easiest proof is a screenshot of an email or Slack thread where a teammate says \"looks good, ship it.\" A Word/Google doc with tracked-changes or comments works just as well. You only need one example — not every post.",
        kind: "screenshot",
        satisfies: ["d"],
        required: true,
        destinations: [
          {
            type: "upload",
            label: "Upload one approval email, Slack screenshot, or redlined draft",
            describes:
              "Drag in a screenshot of an email/Slack thread approving a post, or a Word/Google doc with review comments. One recent example is enough — the assessor just wants to see the review actually happened.",
            accept: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
          },
        ],
      },
    ],
    keyReferences: ["FAR 52.204-21(b)(1)(iv)", "NIST SP 800-171 Rev 2 §3.1.22"],
    intake: ac3122Intake,
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
        hint: "If you use a vendor (Iron Mountain, Shred-it, etc.) for any disposal, attach the certificates. Hidden by intake if you self-destruct everything in-house.",
        kind: "screenshot",
        satisfies: ["a"],
        required: true,
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
    intake: mp383Intake,
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
