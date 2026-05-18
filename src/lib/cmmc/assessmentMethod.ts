/**
 * Heuristic auto-inference of CMMC Assessment Guide L1 v2.13 §§ 5–7
 * "assessment method" from upload metadata.
 *
 *   Examine   — review of documents, records, mechanisms (the default).
 *               Policies, procedures, screenshots, config exports, inventories,
 *               logs, training records. Anything you'd hand an assessor and
 *               say "here's the evidence."
 *   Interview — discussions with personnel. Interview notes, Q&A transcripts,
 *               recorded conversations, attestation memos signed by a person.
 *   Test      — exercising a mechanism and observing the result. Vulnerability
 *               scan output, penetration test reports, control-demo videos,
 *               packet captures, audit-tool exports.
 *
 * The assessor still owns the final determination — this is just a sane
 * default so a user uploading a Nessus report doesn't have to remember to
 * click "Test" before the SSP tally is right. The UI surfaces the inferred
 * method and lets the user override.
 */

export type AssessmentMethod = "examine" | "interview" | "test";

export type AssessmentMethodInference = {
  method: AssessmentMethod;
  /** Plain-English reason the heuristic picked this method. */
  rationale: string;
  /**
   * `true` when the heuristic matched on a strong signal (specific keyword
   * or filetype). `false` when we fell through to the "examine" default —
   * the UI should still show the picker prominently so the user confirms.
   */
  confident: boolean;
};

const TEST_KEYWORDS = [
  "nessus",
  "scan",
  "scanner",
  "vuln",
  "vulnerability",
  "pentest",
  "pen-test",
  "pen_test",
  "penetration",
  "test-result",
  "test_result",
  "audit-result",
  "demo",
  "demonstration",
  "tcpdump",
  "wireshark",
];

const INTERVIEW_KEYWORDS = [
  "interview",
  "transcript",
  "q&a",
  "qa-notes",
  "meeting-notes",
  "attestation",
  "discussion",
  "kickoff-notes",
];

const TEST_EXTENSIONS = new Set([
  "pcap",
  "pcapng",
  "nessus",
  "sarif",
  "xml", // common scanner output — weak signal, still hint "test"
]);

/**
 * Best-effort inference. Pure function — no DB, no network. Safe to call at
 * upload time or in a list view to label legacy rows.
 */
export function inferAssessmentMethod(input: {
  filename: string;
  mimeType: string | null;
}): AssessmentMethodInference {
  const name = input.filename.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";

  // Audio + video typically capture a person speaking (interview) or a
  // recorded control demo (test). We pick interview when the filename hints
  // at conversation, test when it hints at a demo, and default audio/video
  // to interview (the more common evidence pattern for solo SMBs).
  if (mime.startsWith("video/") || mime.startsWith("audio/")) {
    if (TEST_KEYWORDS.some((k) => name.includes(k))) {
      return {
        method: "test",
        rationale: `Audio/video file named like a control demonstration (${mime || ext}).`,
        confident: true,
      };
    }
    return {
      method: "interview",
      rationale: `Audio/video file (${mime || ext}) — most often an interview or attestation recording.`,
      confident: true,
    };
  }

  // Keyword match on filename — strong signals win regardless of extension.
  if (TEST_KEYWORDS.some((k) => name.includes(k))) {
    return {
      method: "test",
      rationale: "Filename suggests a scan, pen-test, or control demonstration.",
      confident: true,
    };
  }
  if (INTERVIEW_KEYWORDS.some((k) => name.includes(k))) {
    return {
      method: "interview",
      rationale: "Filename suggests notes from a conversation with personnel.",
      confident: true,
    };
  }

  // Extension-only signal — weaker, but still better than the default for
  // formats that are almost always tooling output.
  if (TEST_EXTENSIONS.has(ext)) {
    return {
      method: "test",
      rationale: `\u201C.${ext}\u201D files are almost always scanner or tool output.`,
      confident: true,
    };
  }

  // Default: examine. Docs, PDFs, CSVs, screenshots, configs, logs — the
  // overwhelming majority of CMMC L1 evidence.
  return {
    method: "examine",
    rationale:
      "Documents, screenshots, configs, and exports default to Examine. Override if this artifact came from a scan (Test) or a conversation (Interview).",
    confident: false,
  };
}
