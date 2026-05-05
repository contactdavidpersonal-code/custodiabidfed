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
