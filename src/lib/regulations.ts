/**
 * CMMC Level 1 regulatory citation corpus. Hardcoded lookup table, not RAG —
 * CMMC L1 is a finite, stable set (15 FAR subparagraphs / 17 NIST 800-171 r2
 * controls), so vectors are overkill. This file is the authoritative source
 * the `cite_regulation` tool reads when the officer needs to quote a reg.
 *
 * Sources (all publicly available, current as of 2026-04):
 * - FAR 52.204-21 (May 2024 amendment) — "Basic Safeguarding of Covered
 *   Contractor Information Systems"
 * - NIST SP 800-171 Revision 2 (Feb 2020) — control statements verbatim
 * - 32 CFR § 170 (CMMC Program, final rule effective Dec 16, 2024) —
 *   specifically §§ 170.15 (Level 1 self-assessment) and 170.22 (affirmation)
 * - DFARS 252.204-7020 — NIST SP 800-171 DoD Assessment Requirements
 * - SPRS (Supplier Performance Risk System) User's Guide for Cyber Reports,
 *   NIST SP 800-171 Assessments module
 *
 * Every citation includes an inline Source: tag so downstream UI or agent
 * answers can tell the user where the text came from.
 */

export type ControlCitation = {
  /** Matches the playbook control id, e.g. "AC.L1-3.1.1". */
  controlId: string;
  /** CMMC v2.0 Assessment Guide practice ID, e.g. "AC.L1-b.1.i". */
  cmmcPracticeId: string;
  /** FAR subparagraph reference. */
  farClause: string;
  /** Verbatim FAR text for this safeguarding requirement. */
  farText: string;
  /** NIST SP 800-171 r2 control family and number. */
  nistControl: string;
  /** Verbatim NIST 800-171 r2 control statement. */
  nistText: string;
  /** Short note on how DoD assesses this practice under CMMC L1 (MET / NOT MET / N/A). */
  cmmcAssessmentNote: string;
};

export const controlCitations: Record<string, ControlCitation> = {
  "AC.L1-3.1.1": {
    controlId: "AC.L1-3.1.1",
    cmmcPracticeId: "AC.L1-b.1.i",
    farClause: "FAR 52.204-21(b)(1)(i)",
    farText:
      "Limit information system access to authorized users, processes acting on behalf of authorized users, or devices (including other information systems).",
    nistControl: "NIST SP 800-171 r2 — 3.1.1",
    nistText:
      "Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).",
    cmmcAssessmentNote:
      "MET when the OSC can demonstrate a maintained list of authorized users, the systems they can access, and a process for adding/removing access. A roster that is clearly out of date (e.g., names of known-departed personnel) is NOT MET.",
  },
  "AC.L1-3.1.2": {
    controlId: "AC.L1-3.1.2",
    cmmcPracticeId: "AC.L1-b.1.ii",
    farClause: "FAR 52.204-21(b)(1)(ii)",
    farText:
      "Limit information system access to the types of transactions and functions that authorized users are permitted to execute.",
    nistControl: "NIST SP 800-171 r2 — 3.1.2",
    nistText:
      "Limit system access to the types of transactions and functions that authorized users are permitted to execute.",
    cmmcAssessmentNote:
      "MET when users are restricted by role/privilege — e.g., regular users cannot perform admin functions. Everyone-is-admin is NOT MET.",
  },
  "AC.L1-3.1.20": {
    controlId: "AC.L1-3.1.20",
    cmmcPracticeId: "AC.L1-b.1.iii",
    farClause: "FAR 52.204-21(b)(1)(iii)",
    farText:
      "Verify and control/limit connections to and use of external information systems.",
    nistControl: "NIST SP 800-171 r2 — 3.1.20",
    nistText:
      "Verify and control/limit connections to and use of external systems.",
    cmmcAssessmentNote:
      "MET when the OSC identifies external systems that connect (VPN, partner APIs, personal devices) and has rules for what they can and cannot do. A written BYOD/remote-access policy suffices for most small businesses.",
  },
  "AC.L1-3.1.22": {
    controlId: "AC.L1-3.1.22",
    cmmcPracticeId: "AC.L1-b.1.iv",
    farClause: "FAR 52.204-21(b)(1)(iv)",
    farText:
      "Control information posted or processed on publicly accessible information systems.",
    nistControl: "NIST SP 800-171 r2 — 3.1.22",
    nistText:
      "Control information posted or processed on publicly accessible systems.",
    cmmcAssessmentNote:
      "MET when the OSC has a policy and practice for preventing FCI from ending up on public-facing systems (company website, public GitHub, marketing channels). Review-before-publish workflow is the common evidence.",
  },
  "IA.L1-3.5.1": {
    controlId: "IA.L1-3.5.1",
    cmmcPracticeId: "IA.L1-b.1.v",
    farClause: "FAR 52.204-21(b)(1)(v)",
    farText:
      "Identify information system users, processes acting on behalf of users, or devices.",
    nistControl: "NIST SP 800-171 r2 — 3.5.1",
    nistText:
      "Identify system users, processes acting on behalf of users, and devices.",
    cmmcAssessmentNote:
      "MET when every account is tied to a named individual, service, or device. Shared logins (one username everyone uses) are NOT MET.",
  },
  "IA.L1-3.5.2": {
    controlId: "IA.L1-3.5.2",
    cmmcPracticeId: "IA.L1-b.1.vi",
    farClause: "FAR 52.204-21(b)(1)(vi)",
    farText:
      "Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to allowing access to organizational information systems.",
    nistControl: "NIST SP 800-171 r2 — 3.5.2",
    nistText:
      "Authenticate (or verify) the identities of users, processes, or devices, as a prerequisite to allowing access to organizational systems.",
    cmmcAssessmentNote:
      "MET when authentication is enforced — passwords that meet a documented policy, or better, MFA. No-password shares or systems with default credentials still in place are NOT MET.",
  },
  "MP.L1-3.8.3": {
    controlId: "MP.L1-3.8.3",
    cmmcPracticeId: "MP.L1-b.1.vii",
    farClause: "FAR 52.204-21(b)(1)(vii)",
    farText:
      "Sanitize or destroy information system media containing Federal Contract Information before disposal or release for reuse.",
    nistControl: "NIST SP 800-171 r2 — 3.8.3",
    nistText:
      "Sanitize or destroy system media containing Federal Contract Information (FCI) before disposal or release for reuse.",
    cmmcAssessmentNote:
      "MET with documented procedure for wiping/destroying drives, USBs, printed documents before disposal. NIST SP 800-88 is the reference standard but not required — a logged shredding vendor or documented wipe procedure is sufficient.",
  },
  "PE.L1-3.10.1": {
    controlId: "PE.L1-3.10.1",
    cmmcPracticeId: "PE.L1-b.1.viii",
    farClause: "FAR 52.204-21(b)(1)(viii)",
    farText:
      "Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals.",
    nistControl: "NIST SP 800-171 r2 — 3.10.1",
    nistText:
      "Limit physical access to organizational systems, equipment, and the respective operating environments to authorized individuals.",
    cmmcAssessmentNote:
      "MET when the office/rack/closet is locked and only authorized personnel have a key/badge/code. Home offices: a locked room or locked cabinet that stores the work device qualifies.",
  },
  "PE.L1-3.10.3": {
    controlId: "PE.L1-3.10.3",
    cmmcPracticeId: "PE.L1-b.1.ix",
    farClause: "FAR 52.204-21(b)(1)(ix)",
    farText:
      "Escort visitors and monitor visitor activity.",
    nistControl: "NIST SP 800-171 r2 — 3.10.3",
    nistText:
      "Escort visitors and monitor visitor activity.",
    cmmcAssessmentNote:
      "MET when visitors are not left alone in spaces where FCI is accessible. A sign-in log and a rule that visitors stay with an employee is sufficient for most small businesses.",
  },
  "PE.L1-3.10.4": {
    controlId: "PE.L1-3.10.4",
    cmmcPracticeId: "PE.L1-b.1.ix",
    farClause: "FAR 52.204-21(b)(1)(ix)",
    farText:
      "Maintain audit logs of physical access.",
    nistControl: "NIST SP 800-171 r2 — 3.10.4",
    nistText:
      "Maintain audit logs of physical access.",
    cmmcAssessmentNote:
      "MET with a visitor sign-in log (paper is fine) or electronic badge logs. Must be retained — scrap-paper sign-ins that get thrown out daily are NOT MET.",
  },
  "PE.L1-3.10.5": {
    controlId: "PE.L1-3.10.5",
    cmmcPracticeId: "PE.L1-b.1.ix",
    farClause: "FAR 52.204-21(b)(1)(ix)",
    farText:
      "Control and manage physical access devices.",
    nistControl: "NIST SP 800-171 r2 — 3.10.5",
    nistText:
      "Control and manage physical access devices.",
    cmmcAssessmentNote:
      "MET when the org tracks who has keys/badges/codes, rotates them when people leave, and retrieves devices from departing personnel. A key-issuance log meets this.",
  },
  "SC.L1-3.13.1": {
    controlId: "SC.L1-3.13.1",
    cmmcPracticeId: "SC.L1-b.1.x",
    farClause: "FAR 52.204-21(b)(1)(x)",
    farText:
      "Monitor, control, and protect organizational communications (i.e., information transmitted or received by organizational information systems) at the external boundaries and key internal boundaries of the information systems.",
    nistControl: "NIST SP 800-171 r2 — 3.13.1",
    nistText:
      "Monitor, control, and protect communications (i.e., information transmitted or received by organizational systems) at the external boundaries and key internal boundaries of organizational systems.",
    cmmcAssessmentNote:
      "MET when a firewall (commercial router/UTM, cloud security group, Windows Defender Firewall) is in place at the network boundary and there is evidence it is actively configured. 'Default-allow-all' firewall is NOT MET.",
  },
  "SC.L1-3.13.5": {
    controlId: "SC.L1-3.13.5",
    cmmcPracticeId: "SC.L1-b.1.xi",
    farClause: "FAR 52.204-21(b)(1)(xi)",
    farText:
      "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.",
    nistControl: "NIST SP 800-171 r2 — 3.13.5",
    nistText:
      "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.",
    cmmcAssessmentNote:
      "MET when any publicly reachable system (web server, guest wifi) sits on a separate subnet/VLAN from internal systems holding FCI. For most small businesses using cloud SaaS this is satisfied by the SaaS provider's network isolation.",
  },
  "SI.L1-3.14.1": {
    controlId: "SI.L1-3.14.1",
    cmmcPracticeId: "SI.L1-b.1.xii",
    farClause: "FAR 52.204-21(b)(1)(xii)",
    farText:
      "Identify, report, and correct information and information system flaws in a timely manner.",
    nistControl: "NIST SP 800-171 r2 — 3.14.1",
    nistText:
      "Identify, report, and correct system flaws in a timely manner.",
    cmmcAssessmentNote:
      "MET with a documented patching practice — OS auto-updates enabled, monthly patch cadence, or equivalent. Evidence is update logs or a dated screenshot showing last-updated timestamps.",
  },
  "SI.L1-3.14.2": {
    controlId: "SI.L1-3.14.2",
    cmmcPracticeId: "SI.L1-b.1.xiii",
    farClause: "FAR 52.204-21(b)(1)(xiii)",
    farText:
      "Provide protection from malicious code at appropriate locations within organizational information systems.",
    nistControl: "NIST SP 800-171 r2 — 3.14.2",
    nistText:
      "Provide protection from malicious code at designated locations within organizational systems.",
    cmmcAssessmentNote:
      "MET when every endpoint that touches FCI runs anti-malware (Microsoft Defender, ClamAV, a commercial EDR). 'We don't get viruses' is NOT MET.",
  },
  "SI.L1-3.14.4": {
    controlId: "SI.L1-3.14.4",
    cmmcPracticeId: "SI.L1-b.1.xiv",
    farClause: "FAR 52.204-21(b)(1)(xiv)",
    farText:
      "Update malicious code protection mechanisms when new releases are available.",
    nistControl: "NIST SP 800-171 r2 — 3.14.4",
    nistText:
      "Update malicious code protection mechanisms when new releases are available.",
    cmmcAssessmentNote:
      "MET when the anti-malware auto-updates or is on a documented manual-update cadence. Default-on auto-update (the vendor default for Defender, CrowdStrike, etc.) satisfies this.",
  },
  "SI.L1-3.14.5": {
    controlId: "SI.L1-3.14.5",
    cmmcPracticeId: "SI.L1-b.1.xv",
    farClause: "FAR 52.204-21(b)(1)(xv)",
    farText:
      "Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened, or executed.",
    nistControl: "NIST SP 800-171 r2 — 3.14.5",
    nistText:
      "Perform periodic scans of organizational systems and real-time scans of files from external sources as files are downloaded, opened, or executed.",
    cmmcAssessmentNote:
      "MET when the anti-malware tool performs scheduled full scans (weekly is a common cadence) and real-time file scanning is enabled. Defender defaults satisfy this; proof is a screenshot of the scan schedule.",
  },
};

/**
 * Program-level citations that the officer reaches for when the user asks
 * "what IS CMMC Level 1?" or "what am I actually signing?". Keyed by a stable
 * slug so the `cite_regulation` tool can look them up.
 */
export type FrameworkCitation = {
  slug: string;
  title: string;
  source: string;
  text: string;
};

export const frameworkCitations: Record<string, FrameworkCitation> = {
  "cmmc-l1-scope": {
    slug: "cmmc-l1-scope",
    title: "CMMC Level 1 scope and assessment method",
    source: "32 CFR § 170.15 (CMMC Program final rule, effective Dec 16, 2024)",
    text:
      "Level 1 (Self): Information systems that process, store, or transmit FCI are required to meet the 15 basic safeguarding requirements specified in FAR clause 52.204-21. The OSC must annually conduct a self-assessment against the Level 1 security requirements and its Affirming Official must annually affirm continuing compliance with those requirements. Results of the Level 1 self-assessment, and the associated affirmation, must be entered in SPRS.",
  },
  "fci-definition": {
    slug: "fci-definition",
    title: "What counts as Federal Contract Information (FCI)",
    source: "FAR 52.204-21(a) — definitions",
    text:
      "Federal contract information means information, not intended for public release, that is provided by or generated for the Government under a contract to develop or deliver a product or service to the Government, but not including information provided by the Government to the public (such as on public websites) or simple transactional information, such as necessary to process payments.",
  },
  "affirmation-liability": {
    slug: "affirmation-liability",
    title: "Legal liability of a false affirmation",
    source: "32 CFR § 170.22 and 18 U.S.C. § 1001; False Claims Act (31 U.S.C. §§ 3729–3733)",
    text:
      "A CMMC affirmation is a written statement signed by an Affirming Official attesting that the OSC has implemented and is maintaining compliance with the applicable CMMC requirements. A materially false, fictitious, or fraudulent statement or entry is subject to criminal penalties under 18 U.S.C. § 1001 and civil liability under the False Claims Act. The Affirming Official must be an officer of the OSC with authority to bind the organization.",
  },
  "sprs-submission": {
    slug: "sprs-submission",
    title: "How the SPRS affirmation is submitted",
    source:
      "DFARS 252.204-7020 and the SPRS User's Guide (NIST SP 800-171 Assessments module)",
    text:
      "The Affirming Official submits the Level 1 self-assessment result and annual affirmation through the Supplier Performance Risk System (SPRS) at https://www.sprs.csd.disa.mil. SPRS login requires a Procurement Integrated Enterprise Environment (PIEE) account tied to the contractor's CAGE code. The submission records the assessment date, the Affirming Official's name and title, and the compliance status. Primes verify the posting before award.",
  },
  "sam-registration": {
    slug: "sam-registration",
    title: "SAM.gov registration prerequisites",
    source: "FAR 4.1102 / FAR 52.204-7",
    text:
      "Active SAM.gov registration is required to be eligible for award of federal contracts. Registration requires a Unique Entity Identifier (UEI) issued at SAM.gov and a Commercial And Government Entity (CAGE) code, which DLA assigns during SAM registration. The CAGE code is the key that links the CMMC affirmation in SPRS to the contractor's identity. Without an active SAM registration with matching CAGE, a SPRS submission cannot be associated with a bidder.",
  },
  "annual-cadence": {
    slug: "annual-cadence",
    title: "Annual affirmation cadence",
    source: "32 CFR § 170.15(c)(2); 32 CFR § 170.22",
    text:
      "The Level 1 self-assessment and affirmation must be performed annually. The affirmation date in SPRS defines the 12-month validity window. An affirmation that has lapsed renders the contractor ineligible for new awards subject to the clause until it is re-submitted.",
  },
};

/** Resolves a practice id OR framework slug to a citation payload. */
export function lookupCitation(
  key: string,
): ControlCitation | FrameworkCitation | null {
  if (key in controlCitations) return controlCitations[key];
  if (key in frameworkCitations) return frameworkCitations[key];
  return null;
}

export function isControlCitation(
  c: ControlCitation | FrameworkCitation,
): c is ControlCitation {
  return "controlId" in c;
}
