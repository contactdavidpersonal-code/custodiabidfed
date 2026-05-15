"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ControlResponseRow,
  EvidenceArtifactRow,
  RemediationPlanRow,
  ReuseCandidate,
} from "@/lib/assessment";
import type {
  AssessmentObjective,
  ControlPlaybook,
  EvidenceProvider,
  ProviderTemplate,
} from "@/lib/playbook";
import { EvidenceDropzone } from "./EvidenceDropzone";

/**
 * Client-side evidence shape: identical to EvidenceArtifactRow minus
 * `blob_url`, which never crosses the server/client boundary. The browser
 * loads bytes through the authenticated `/api/evidence/{id}` proxy.
 */
type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;
type ClientReuseCandidate = Omit<ReuseCandidate, "blob_url">;

const providerLabel: Record<EvidenceProvider, string> = {
  m365: "Microsoft 365",
  google_workspace: "Google Workspace",
  okta: "Okta",
  on_prem_ad: "On-prem Active Directory",
  aws: "AWS",
  manual: "Manual / any business",
};

const STATUS_LABELS: Record<string, string> = {
  yes: "Met",
  no: "Not met",
  not_applicable: "N/A",
};

type Props = {
  assessmentId: string;
  controlId: string;
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  objectives: AssessmentObjective[];
  response: ControlResponseRow;
  evidence: ClientEvidenceRow[];
  remediationPlan: RemediationPlanRow | null;
  /**
   * Pre-filled N/A justification when the requirement has a well-known
   * blanket reason (e.g. SC.L1-b.1.xi → "no publicly accessible systems";
   * PE.L1-b.1.ix → "100% remote, no facility"). Null when no canonical
   * pattern exists for this control. CMMC AG L1 v2.13 p. 8.
   */
  suggestedNa: string | null;
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
  reuseCandidates: ClientReuseCandidate[];
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  tagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  untagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  markEvidenceAsFinalAction: (
    formData: FormData,
  ) => Promise<{ error: string } | void> | { error: string } | void;
  setEvidenceMethodAction: (formData: FormData) => Promise<void> | void;
  useSuggestedNarrativeAction: (formData: FormData) => Promise<void> | void;
  upsertRemediationPlanAction: (formData: FormData) => Promise<void> | void;
};

function parseQ(filename: string): { qid: string | null; display: string } {
  const m = /^\[q:([^\]]+)\]__(.*)$/.exec(filename);
  if (m) return { qid: m[1], display: m[2] };
  return { qid: null, display: filename };
}

/**
 * One-liner that tells the user what to upload for a given practice. Every
 * L1 practice has a downloadable CSV/template; bigger orgs running M365 /
 * Workspace / AWS / Okta typically have a screenshot from their admin
 * console that proves the same thing. We point to both so they pick
 * whichever is faster.
 */
function evidenceRecommendation(
  practice: Omit<ControlPlaybook, "suggestedNarrative">,
): string | null {
  const seen = new Set<string>();
  const templates: ProviderTemplate[] = [];
  for (const g of practice.providerGuidance) {
    if (g.template && !seen.has(g.template.filename)) {
      seen.add(g.template.filename);
      templates.push(g.template);
    }
  }
  if (templates.length === 0) return null;
  const labels = templates.map((t) => t.label).join(" or ");
  return `Fill out the ${labels} template below and upload it — or, if you run M365 / Workspace / AWS / Okta, upload screenshots from your admin console showing the same configuration.`;
}

/**
 * Practice page — single top-to-bottom flow per CMMC L1 practice:
 *   1. What the assessor needs to see (NIST 800-171A objectives)
 *   2. Templates to download (if any)
 *   3. Evidence area: upload / Charlie-draft / reuse from another practice
 *   4. Lock in → next practice
 *
 * The practice is MET as soon as at least one artifact has been reviewed
 * as sufficient. No self-check quiz, no answered/total gating — the
 * 800-171A objectives ARE the requirement, the AI evidence review IS the
 * confirmation. Whole-practice N/A is preserved as an escape hatch.
 */
export function PracticeWizard(props: Props) {
  const router = useRouter();

  const allEvidence = props.evidence;
  const sufficientCount = allEvidence.filter(
    (e) => e.ai_review_verdict === "sufficient",
  ).length;

  const [naReason, setNaReason] = useState(props.response.narrative ?? "");
  const [wholeNa, setWholeNa] = useState(
    props.response.status === "not_applicable",
  );
  const [submitting, setSubmitting] = useState(false);

  const ready = wholeNa
    ? naReason.trim().length >= 10
    : sufficientCount > 0;

  const derivedStatus: "yes" | "not_applicable" = wholeNa
    ? "not_applicable"
    : "yes";

  const lockIn = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("assessmentId", props.assessmentId);
      fd.set("controlId", props.controlId);
      fd.set("status", derivedStatus);
      fd.set(
        "narrative",
        wholeNa ? naReason.trim() : props.response.narrative ?? "",
      );
      await Promise.resolve(props.saveResponseAction(fd));

      if (!wholeNa && !(props.response.narrative ?? "").trim()) {
        const fd2 = new FormData();
        fd2.set("assessmentId", props.assessmentId);
        fd2.set("controlId", props.controlId);
        await Promise.resolve(props.useSuggestedNarrativeAction(fd2));
      }

      if (props.nextId) {
        router.push(
          `/assessments/${props.assessmentId}/controls/${props.nextId}`,
        );
      } else {
        router.push(`/assessments/${props.assessmentId}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked =
    props.response.status !== "unanswered" &&
    (props.response.narrative ?? "").trim().length >= 20;

  const stickyStatusLabel = isLocked
    ? STATUS_LABELS[props.response.status] ?? "In progress"
    : "In progress";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      {/* Sticky practice header: stays pinned just below the workspace nav
          as the user scrolls into the evidence section so they always know
          which practice they're working on. Includes the back link, title,
          plain-English description, progress, and current status. */}
      <div
        className="sticky z-20 -mx-4 mb-6 border-b border-[#cfe3d9] bg-[#e9efea]/95 px-4 pt-6 pb-4 shadow-[0_8px_24px_-18px_rgba(14,42,35,0.4)] backdrop-blur md:-mx-6 md:px-6 md:pt-7"
        style={{ top: "calc(var(--safe-top, 0px) + 64px)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
          <Link
            href={`/assessments/${props.assessmentId}`}
            className="font-medium text-[#5a7d70] transition-colors hover:text-[#10231d]"
          >
            &larr; Back to overview
          </Link>
          <span className="font-medium text-[#5a7d70]">
            Practice {props.currentIdx + 1} of {props.total}
          </span>
        </div>

        <header>
          <div className="flex flex-wrap items-center gap-2">
            <span className=" bg-[#0e2a23] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#bdf2cf]">
              {props.practice.domain}
            </span>
            <span className="font-mono text-xs font-semibold text-[#5a7d70]">
              {props.practice.id}
            </span>
            <span className="text-[#cfe3d9]">&middot;</span>
            <span className="text-xs font-medium text-[#5a7d70]">
              {props.practice.farReference}
            </span>
            <span className="ml-auto shrink-0 rounded-full border border-[#cfe3d9] bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#10231d]">
              {stickyStatusLabel}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
            {props.practice.shortName}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#10231d]/85 md:text-base">
            {props.practice.plainEnglish}
          </p>
          {props.practice.whyItMatters && (
            <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
              <span className="font-semibold text-[#a06b1a]">Why: </span>
              {props.practice.whyItMatters}
            </p>
          )}
        </header>
      </div>

      {isLocked && !wholeNa && (
        <div className="mb-6  border border-[#2f8f6d] bg-[#f7fcf9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Locked in &middot; {STATUS_LABELS[props.response.status]}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#10231d]">
                {(props.response.narrative ?? "").slice(0, 220)}
                {(props.response.narrative ?? "").length > 220 ? "\u2026" : ""}
              </p>
            </div>
            {props.nextId && (
              <Link
                href={`/assessments/${props.assessmentId}/controls/${props.nextId}`}
                className=" bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
              >
                Next practice &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Step 1 — what the assessor needs to see (NIST 800-171A objectives). */}
      {!wholeNa && props.objectives.length > 0 && (
        <ObjectivesPanel
          objectives={props.objectives}
          satisfied={sufficientCount > 0}
        />
      )}

      {/* Step 2 — templates to download (if any). */}
      {!wholeNa && <TemplatesStrip practice={props.practice} />}

      {/* Step 3 — evidence: upload, draft with Charlie, or reuse. */}
      {!wholeNa && (
        <EvidenceArea
          assessmentId={props.assessmentId}
          controlId={props.controlId}
          evidence={allEvidence}
          passingEvidence={props.practice.passingEvidence}
          reuseCandidates={props.reuseCandidates}
          uploadEvidenceAction={props.uploadEvidenceAction}
          deleteEvidenceAction={props.deleteEvidenceAction}
          reReviewEvidenceAction={props.reReviewEvidenceAction}
          tagArtifactPracticeAction={props.tagArtifactPracticeAction}
          untagArtifactPracticeAction={props.untagArtifactPracticeAction}
          markEvidenceAsFinalAction={props.markEvidenceAsFinalAction}
          setEvidenceMethodAction={props.setEvidenceMethodAction}
          recommendation={evidenceRecommendation(props.practice)}
        />
      )}

      {/* Whole-control N/A escape hatch — small, near the bottom. */}
      {!isLocked && (
        <div className="mb-5  border border-[#cfe3d9] bg-white p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={wholeNa}
              onChange={(e) => setWholeNa(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-[#0e2a23]"
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-[#10231d]">
                This whole practice doesn&rsquo;t apply to my business
              </span>
              <p className="mt-0.5 text-[11px] text-[#5a7d70]">
                Use sparingly. Briefly explain why &mdash; auditors will read it.
              </p>
              {wholeNa && (
                <>
                  <textarea
                    value={naReason}
                    onChange={(e) => setNaReason(e.target.value)}
                    rows={4}
                    placeholder="E.g. We have no physical office; all staff work remotely on cloud-only systems."
                    className="mt-2 w-full  border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
                  />
                  {props.suggestedNa && naReason.trim().length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setNaReason(props.suggestedNa ?? "")}
                      className="mt-2 border border-[#cfe3d9] bg-[#f5f8f6] px-3 py-1.5 text-[11px] font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#eaf3ed]"
                    >
                      Use suggested justification for {props.controlId}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </label>
        </div>
      )}

      {/* Step 4 — lock in and move on. */}
      {!wholeNa && (
        <div className="mt-6  border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-[#10231d]">
                {sufficientCount} sufficient artifact
                {sufficientCount === 1 ? "" : "s"} on file
              </p>
              {ready ? (
                <p className="mt-1 text-xs text-[#2f8f6d]">
                  Charlie has confirmed your evidence. Lock it in to draft the
                  narrative and move to the next practice.
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#5a7d70]">
                  Upload one artifact (or draft one with Charlie) and wait for
                  the review verdict to turn green.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!ready || submitting}
              onClick={lockIn}
              className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? "Saving\u2026"
                : props.nextId
                  ? "Lock it in \u2192 next practice"
                  : "Lock it in \u2192 finish"}
            </button>
          </div>
        </div>
      )}

      {wholeNa && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={lockIn}
            className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving\u2026" : "Mark N/A and continue \u2192"}
          </button>
        </div>
      )}

      {/* Optional reference: how to capture this in your tools */}
      {!wholeNa && props.practice.providerGuidance.length > 0 && (
        <ProviderReference practice={props.practice} />
      )}

      {/* Remediation plan when status is no/partial */}
      {(props.response.status === "no" ||
        props.response.status === "partial") && (
        <RemediationInline
          assessmentId={props.assessmentId}
          controlId={props.controlId}
          plan={props.remediationPlan}
          status={props.response.status}
          upsertRemediationPlanAction={props.upsertRemediationPlanAction}
        />
      )}
    </div>
  );
}

/* ============================ OBJECTIVES PANEL ============================ */

/**
 * The NIST 800-171A objectives for the current practice. This is the formal
 * checklist a 3PAO would walk through. We auto-mark every objective as
 * satisfied as soon as the practice has at least one artifact the platform
 * has reviewed as sufficient — that mirrors how the existing evidence-gating
 * pipeline works today. Per-objective tagging is a planned follow-up that
 * will let a single artifact cover only some of [a]/[b]/[c]/...
 */
function ObjectivesPanel({
  objectives,
  satisfied,
}: {
  objectives: AssessmentObjective[];
  satisfied: boolean;
}) {
  return (
    <section className="mb-5  border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          What the assessor needs to see
        </p>
        <p className="text-[11px] text-[#5a7d70]">
          NIST 800-171A objectives
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {objectives.map((o) => (
          <li
            key={o.letter}
            className="flex items-start gap-3 text-sm leading-relaxed text-[#10231d]"
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center  font-mono text-[10px] font-bold ${
                satisfied
                  ? "bg-[#0e2a23] text-[#bdf2cf]"
                  : "border border-[#cfe3d9] bg-white text-[#5a7d70]"
              }`}
            >
              {satisfied ? "\u2713" : `[${o.letter}]`}
            </span>
            <span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5a7d70]">
                [{o.letter}]
              </span>
              <span className="ml-2">{o.ask}</span>
            </span>
          </li>
        ))}
      </ul>
      {!satisfied && (
        <p className="mt-3  bg-[#f7fcf9] px-3 py-2 text-xs leading-relaxed text-[#5a7d70]">
          Upload one piece of evidence below that demonstrates these
          objectives. A single artifact (a screenshot, a signed roster, a
          policy excerpt) typically covers all of them for a CMMC L1
          practice.
        </p>
      )}
    </section>
  );
}

/* ============================ EVIDENCE AREA =============================== */

/**
 * One evidence area per practice. Replaces the old per-question dropzones.
 * Shows the practice-wide passing-evidence checklist exactly once at the
 * top, then the artifacts already on file, then a single upload zone.
 */
function EvidenceArea({
  assessmentId,
  controlId,
  evidence,
  passingEvidence,
  reuseCandidates,
  uploadEvidenceAction,
  deleteEvidenceAction,
  reReviewEvidenceAction,
  tagArtifactPracticeAction,
  untagArtifactPracticeAction,
  markEvidenceAsFinalAction,
  setEvidenceMethodAction,
  recommendation,
}: {
  assessmentId: string;
  controlId: string;
  evidence: ClientEvidenceRow[];
  passingEvidence: string[];
  reuseCandidates: ClientReuseCandidate[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  tagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  untagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  markEvidenceAsFinalAction: (
    formData: FormData,
  ) => Promise<{ error: string } | void> | { error: string } | void;
  setEvidenceMethodAction: (formData: FormData) => Promise<void> | void;
  recommendation: string | null;
}) {
  return (
    <section className="mb-5  border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <div className="border-b border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          Evidence for this practice
        </p>
        {recommendation && (
          <p className="mt-1 text-xs leading-relaxed text-[#10231d]">
            <span className="font-semibold text-[#0e2a23]">Upload: </span>
            {recommendation}
          </p>
        )}
        {passingEvidence.length > 0 && (
          <ul className="mt-2 space-y-1">
            {passingEvidence.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-[#10231d]"
              >
                <span className="mt-0.5 inline-flex h-3 w-3 flex-none items-center justify-center  bg-[#0e2a23] text-[9px] font-bold text-[#bdf2cf]">
                  &#x2713;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {evidence.length > 0 && (
        <ul className="divide-y divide-[#e4eee8]">
          {evidence.map((a) => (
            <EvidenceRow
              key={a.id}
              artifact={a}
              assessmentId={assessmentId}
              controlId={controlId}
              deleteEvidenceAction={deleteEvidenceAction}
              reReviewEvidenceAction={reReviewEvidenceAction}
              untagArtifactPracticeAction={untagArtifactPracticeAction}
              markEvidenceAsFinalAction={markEvidenceAsFinalAction}
              setEvidenceMethodAction={setEvidenceMethodAction}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-[#cfe3d9] p-4">
        <EvidenceDropzone
          action={uploadEvidenceAction}
          assessmentId={assessmentId}
          controlId={controlId}
        />
      </div>

      {reuseCandidates.length > 0 && (
        <ReusePicker
          assessmentId={assessmentId}
          controlId={controlId}
          candidates={reuseCandidates}
          tagArtifactPracticeAction={tagArtifactPracticeAction}
        />
      )}
    </section>
  );
}

/* ============================ REUSE PICKER ================================ */

/**
 * Lets the user attach an artifact already uploaded under another practice
 * to THIS practice. CMMC L1 frequently overlaps — one screenshot of MFA
 * settings, one screen-lock policy doc — and this avoids forcing the user
 * to re-upload the same file 6 times. "Suggested" candidates are ones the
 * AI vision review already mapped to this control.
 */
function ReusePicker({
  assessmentId,
  controlId,
  candidates,
  tagArtifactPracticeAction,
}: {
  assessmentId: string;
  controlId: string;
  candidates: ClientReuseCandidate[];
  tagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
}) {
  // Suggested first, then most recent.
  const sorted = [...candidates].sort((a, b) => {
    if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
    return b.captured_at.localeCompare(a.captured_at);
  });
  const [open, setOpen] = useState(false);
  const suggestedCount = sorted.filter((c) => c.suggested).length;

  return (
    <details
      className="border-t border-[#cfe3d9] bg-[#fbfdfb]"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#2f8f6d]">
        Reuse evidence from another practice ({sorted.length}
        {suggestedCount > 0 ? ` · ${suggestedCount} suggested` : ""})
      </summary>
      <ul className="divide-y divide-[#e4eee8]">
        {sorted.map((c) => {
          const display = parseQ(c.filename).display;
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/evidence/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-semibold text-[#10231d] hover:text-[#2f8f6d]"
                  >
                    {display}
                  </a>
                  <span className=" bg-[#e4eee8] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#5a7d70]">
                    From {c.source_control_id}
                  </span>
                  {c.suggested && (
                    <span className=" bg-[#0e2a23] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#bdf2cf]">
                      Suggested
                    </span>
                  )}
                </div>
                {c.ai_review_summary && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#5a7d70]">
                    {c.ai_review_summary}
                  </p>
                )}
              </div>
              <form action={tagArtifactPracticeAction}>
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="controlId" value={controlId} />
                <input type="hidden" name="artifactId" value={c.id} />
                <button
                  type="submit"
                  className=" border border-[#0e2a23] bg-[#0e2a23] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  Use here
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ============================ EVIDENCE ROW ================================ */

function EvidenceRow({
  artifact: a,
  assessmentId,
  controlId,
  deleteEvidenceAction,
  reReviewEvidenceAction,
  untagArtifactPracticeAction,
  markEvidenceAsFinalAction,
  setEvidenceMethodAction,
}: {
  artifact: ClientEvidenceRow;
  assessmentId: string;
  controlId: string;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  untagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  markEvidenceAsFinalAction: (
    formData: FormData,
  ) => Promise<{ error: string } | void> | { error: string } | void;
  setEvidenceMethodAction: (formData: FormData) => Promise<void> | void;
}) {
  const verdictTone =
    a.ai_review_verdict === "sufficient"
      ? { pill: "bg-[#0e2a23] text-[#bdf2cf]", label: "Sufficient" }
      : a.ai_review_verdict === "insufficient"
        ? { pill: "bg-[#b03a2e] text-white", label: "Insufficient" }
        : a.ai_review_verdict === "unclear"
          ? { pill: "bg-[#a06b1a] text-white", label: "Unclear" }
          : a.ai_review_verdict === "not_relevant"
            ? { pill: "bg-[#5a7d70] text-white", label: "Not relevant" }
            : {
                pill:
                  "bg-[#e4eee8] text-[#5a7d70] border border-[#cfe3d9]",
                label: "Not reviewed",
              };
  const hasVerdict = a.ai_review_verdict !== null;
  const [isReviewing, startReviewTransition] = useTransition();

  const display = parseQ(a.filename).display;
  const crossTagged = a.control_id !== controlId;

  const triggerReview = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("custodia:review-started", {
          detail: { artifactId: a.id, filename: display, controlId },
        }),
      );
    }
    const fd = new FormData();
    fd.set("assessmentId", assessmentId);
    fd.set("controlId", controlId);
    fd.set("artifactId", a.id);
    startReviewTransition(async () => {
      try {
        await reReviewEvidenceAction(fd);
      } finally {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("custodia:review-finished", {
              detail: { artifactId: a.id },
            }),
          );
        }
      }
    });
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center  bg-[#0e2a23] font-mono text-[10px] font-bold text-[#bdf2cf]">
            {a.mime_type?.startsWith("image/")
              ? "IMG"
              : a.mime_type?.includes("pdf")
                ? "PDF"
                : "DOC"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/evidence/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold text-[#10231d] hover:text-[#2f8f6d]"
              >
                {display}
              </a>
              <span
                className={`inline-flex items-center  px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${verdictTone.pill}`}
              >
                {verdictTone.label}
              </span>
              {crossTagged && (
                <span
                  title={`Originally uploaded for ${a.control_id}`}
                  className=" bg-[#e4eee8] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#5a7d70]"
                >
                  Reused from {a.control_id}
                </span>
              )}
              {a.source_provider && (
                <span
                  title={
                    a.data_hash
                      ? `Pulled from ${a.source_provider}\nSHA-256: ${a.data_hash}\nSynced: ${a.synced_at ?? "—"}`
                      : `Pulled from ${a.source_provider}`
                  }
                  className=" bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-900 ring-1 ring-emerald-200"
                >
                  Auto · {a.source_provider}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-[#5a7d70]">
              {new Date(a.captured_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {a.data_hash && (
                <span className="ml-2 font-mono text-[10px] opacity-75">
                  sha256:{a.data_hash.slice(0, 12)}…
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={triggerReview}
            disabled={isReviewing}
            title={
              hasVerdict
                ? "Re-run Charlie's review on this artifact"
                : "Have Charlie review this against the practice"
            }
            className={
              hasVerdict
                ? " px-2 py-1 text-xs font-semibold text-[#5a7d70] transition-colors hover:bg-[#f7fcf9] hover:text-[#10231d] disabled:cursor-wait disabled:opacity-60"
                : " border border-[#0e2a23] bg-[#0e2a23] px-2.5 py-1 text-xs font-semibold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-wait disabled:opacity-60"
            }
          >
            {isReviewing
              ? "Reviewing\u2026"
              : hasVerdict
                ? "Re-review"
                : "Ask Charlie to review"}
          </button>
          {crossTagged ? (
            <form action={untagArtifactPracticeAction}>
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <input type="hidden" name="controlId" value={controlId} />
              <input type="hidden" name="artifactId" value={a.id} />
              <button
                type="submit"
                title="Untag from this practice (the artifact stays on its home practice)"
                className=" px-2 py-1 text-xs font-semibold text-[#5a7d70] transition-colors hover:bg-[#f7fcf9] hover:text-[#10231d]"
              >
                Untag
              </button>
            </form>
          ) : (
            <form action={deleteEvidenceAction}>
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <input type="hidden" name="controlId" value={controlId} />
              <input type="hidden" name="artifactId" value={a.id} />
              <button
                type="submit"
                className=" px-2 py-1 text-xs font-semibold text-[#5a7d70] transition-colors hover:bg-[#fdf2f0] hover:text-[#b03a2e]"
              >
                Remove
              </button>
            </form>
          )}
        </div>
      </div>
      {a.ai_review_summary && (
        <p className="mt-2  border border-[#cfe3d9] bg-[#f7fcf9] px-3 py-2 text-xs leading-relaxed text-[#10231d]">
          {a.ai_review_summary}
        </p>
      )}
      <FinalPolicyOverride
        artifact={a}
        assessmentId={assessmentId}
        controlId={controlId}
        markEvidenceAsFinalAction={markEvidenceAsFinalAction}
      />
      <MethodPicker
        artifact={a}
        assessmentId={assessmentId}
        controlId={controlId}
        setEvidenceMethodAction={setEvidenceMethodAction}
      />
    </li>
  );
}

function FinalPolicyOverride({
  artifact: a,
  assessmentId,
  controlId,
  markEvidenceAsFinalAction,
}: {
  artifact: ClientEvidenceRow;
  assessmentId: string;
  controlId: string;
  markEvidenceAsFinalAction: (
    formData: FormData,
  ) => Promise<{ error: string } | void> | { error: string } | void;
}) {
  const [open, setOpen] = useState(false);
  const [adoptedBy, setAdoptedBy] = useState("");
  const [adoptedAt, setAdoptedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (a.is_final_policy) {
    const adoptedDate = a.final_adopted_at
      ? new Date(a.final_adopted_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
    return (
      <div className="mt-2  border border-[#bdf2cf] bg-[#f3fbf6] px-3 py-2 text-xs leading-relaxed text-[#10231d]">
        <span className="mr-2 inline-flex items-center  bg-[#0e2a23] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#bdf2cf]">
          Final policy
        </span>
        Adopted {adoptedDate}
        {a.final_adopted_by ? ` by ${a.final_adopted_by}` : ""}.
      </div>
    );
  }

  // Only offer the override when the AI couldn't actually evaluate the
  // artifact (text/markdown formats → unclear+none, or never reviewed at
  // all). Suppress when the AI actively flagged it bad — those need a
  // replacement, not a stamp.
  const overrideEligible =
    a.ai_review_verdict === null ||
    (a.ai_review_verdict === "unclear" &&
      (a.ai_review_model === null || a.ai_review_model === "none"));

  if (!overrideEligible) return null;

  const submit = async () => {
    setError(null);
    if (adoptedBy.trim().length < 2) {
      setError("Adopter name is required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adoptedAt)) {
      setError("Adoption date must be YYYY-MM-DD.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("assessmentId", assessmentId);
      fd.set("controlId", controlId);
      fd.set("artifactId", a.id);
      fd.set("adoptedBy", adoptedBy.trim());
      fd.set("adoptedAt", adoptedAt);
      const result = await Promise.resolve(markEvidenceAsFinalAction(fd));
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2  border border-[#cfe3d9] bg-[#fbfdfb] px-3 py-2">
        <p className="text-[11px] leading-snug text-[#5a7d70]">
          This format isn&rsquo;t auto-reviewable. If this is your final
          adopted policy, stamp it so it counts as MET in your SSP.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-none border border-[#0e2a23] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0e2a23] transition-colors hover:bg-[#f7fcf9]"
        >
          Mark as final
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2  border border-[#cfe3d9] bg-[#fbfdfb] px-3 py-3">
      <p className="mb-2 text-[11px] leading-snug text-[#5a7d70]">
        Per CMMC AG L1 v2.13 p. 7, evidence must be in final form. Naming
        the senior official who adopted this policy and the adoption date
        creates the audit trail your SSP needs.
      </p>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <input
          type="text"
          value={adoptedBy}
          onChange={(e) => setAdoptedBy(e.target.value)}
          placeholder="Adopter (e.g. Jane Doe, AO)"
          className=" border border-[#cfe3d9] bg-white px-2 py-1 text-xs text-[#10231d] focus:border-[#0e2a23] focus:outline-none"
        />
        <input
          type="date"
          value={adoptedAt}
          onChange={(e) => setAdoptedAt(e.target.value)}
          className=" border border-[#cfe3d9] bg-white px-2 py-1 text-xs text-[#10231d] focus:border-[#0e2a23] focus:outline-none"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className=" border border-[#0e2a23] bg-[#0e2a23] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Saving\u2026" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className=" px-2 py-1 text-[11px] font-semibold text-[#5a7d70] hover:text-[#10231d]"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-[11px] font-semibold text-[#b03a2e]">
          {error}
        </p>
      )}
    </div>
  );
}

/* ====================== METHOD PICKER (Examine/Interview/Test) =========== */

/**
 * Per-artifact assessment method tag — CMMC AG L1 v2.13 §§ 5–7.
 * Examine = read the artifact (most policies, screenshots).
 * Interview = talked to the responsible person (rare for L1).
 * Test = operated the control (e.g. ran an MFA login).
 * Optional metadata; rendered in the SSP per artifact so a prime can see
 * the method mix at a glance.
 */
function MethodPicker({
  artifact: a,
  assessmentId,
  controlId,
  setEvidenceMethodAction,
}: {
  artifact: ClientEvidenceRow;
  assessmentId: string;
  controlId: string;
  setEvidenceMethodAction: (formData: FormData) => Promise<void> | void;
}) {
  const [pending, startTransition] = useTransition();
  const current = a.assessment_method ?? null;

  const choose = (method: "examine" | "interview" | "test" | "") => {
    const fd = new FormData();
    fd.set("assessmentId", assessmentId);
    fd.set("controlId", controlId);
    fd.set("artifactId", a.id);
    fd.set("method", method);
    startTransition(async () => {
      await setEvidenceMethodAction(fd);
    });
  };

  const opts: Array<{
    key: "examine" | "interview" | "test";
    label: string;
    title: string;
  }> = [
    {
      key: "examine",
      label: "Examine",
      title: "Examine: assessor read this artifact (CMMC AG L1 v2.13 §§ 5–7).",
    },
    {
      key: "interview",
      label: "Interview",
      title: "Interview: assessor confirmed by talking to the responsible person.",
    },
    {
      key: "test",
      label: "Test",
      title: "Test: assessor operated the control (e.g. attempted login).",
    },
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#5a7d70]">
      <span className="font-semibold uppercase tracking-wider">Method:</span>
      {opts.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            type="button"
            disabled={pending}
            title={o.title}
            onClick={() => choose(active ? "" : o.key)}
            className={
              active
                ? " border border-[#0e2a23] bg-[#0e2a23] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#bdf2cf] transition-colors disabled:opacity-60"
                : " border border-[#cfe3d9] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5a7d70] transition-colors hover:border-[#0e2a23] hover:text-[#0e2a23] disabled:opacity-60"
            }
          >
            {o.label}
          </button>
        );
      })}
      {current && (
        <span className="ml-1 text-[10px] italic text-[#5a7d70]">
          Click again to clear
        </span>
      )}
    </div>
  );
}

/* ============================ PROVIDER REFERENCE ========================== */

function ProviderReference({
  practice,
}: {
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
}) {
  const [open, setOpen] = useState<EvidenceProvider | null>(null);
  const providers = practice.providerGuidance;
  const active = open ? providers.find((p) => p.provider === open) : null;
  return (
    <details className="mt-6  border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#10231d]">
        How to capture this in your tools (M365, Workspace, AWS&hellip;)
      </summary>
      <div className="border-t border-[#cfe3d9] p-4">
        <div className="flex flex-wrap gap-1.5">
          {providers.map((p) => (
            <button
              key={p.provider}
              type="button"
              onClick={() => setOpen(open === p.provider ? null : p.provider)}
              className={` px-3 py-1.5 text-xs font-semibold transition-colors ${
                open === p.provider
                  ? "bg-[#0e2a23] text-[#bdf2cf]"
                  : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
              }`}
            >
              {providerLabel[p.provider]}
            </button>
          ))}
        </div>
        {active && (
          <div className="mt-4  border border-[#cfe3d9] bg-[#f7fcf9] p-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[#10231d]">
              {active.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-[#5a7d70]">
              <span className="font-semibold text-[#10231d]">Capture: </span>
              {active.capture}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {active.adminUrl && (
                <a
                  href={active.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className=" bg-[#0e2a23] px-3 py-1.5 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  Open in {providerLabel[active.provider]} &#x2197;
                </a>
              )}
              {active.template && (
                <a
                  href={`/templates/${active.template.filename}`}
                  download
                  className=" border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
                >
                  Download template &middot; {active.template.label}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

/* ============================ TEMPLATES STRIP ============================= */

function TemplatesStrip({
  practice,
}: {
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
}) {
  // Dedupe templates across providerGuidance by filename — same template often
  // appears on multiple provider tabs.
  const templates: ProviderTemplate[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ProviderTemplate[] = [];
    for (const g of practice.providerGuidance) {
      if (g.template && !seen.has(g.template.filename)) {
        seen.add(g.template.filename);
        out.push(g.template);
      }
    }
    return out;
  }, [practice.providerGuidance]);

  if (templates.length === 0) return null;

  return (
    <section className="mb-5  border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          Templates &mdash; download, fill out, then upload as evidence
        </p>
        <p className="text-[11px] text-[#5a7d70]">
          {templates.length === 1
            ? "1 template"
            : `${templates.length} templates`}
        </p>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.filename}>
            <a
              href={`/templates/${t.filename}`}
              download
              className="group relative flex items-start gap-3  border border-[#cfe3d9] bg-[#f7fcf9] p-3 transition-colors hover:border-[#2f8f6d] hover:bg-white"
              title={`Download ${t.label}`}
            >
              {/* File icon with download badge overlay */}
              <span className="relative flex-none">
                <svg
                  aria-hidden="true"
                  width="36"
                  height="44"
                  viewBox="0 0 36 44"
                  fill="none"
                  className="text-[#0e2a23]"
                >
                  <path
                    d="M4 2h18l10 10v28a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
                    fill="#fff"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M22 2v10h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0e2a23] text-[#bdf2cf] shadow-[0_2px_6px_rgba(14,48,37,0.35)] transition-transform group-hover:scale-110"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 2v9" />
                    <path d="M3.5 7l4.5 4.5L12.5 7" />
                    <path d="M2.5 13.5h11" />
                  </svg>
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[#10231d]">
                  {t.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
                  {t.description}
                </p>
                <p className="mt-1.5 text-[11px] font-mono text-[#5a7d70]">
                  {t.filename}
                </p>
              </div>
              <span className="sr-only">Download {t.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================ REMEDIATION ================================= */

const REMEDIATION_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "closed", label: "Closed" },
];

function RemediationInline({
  assessmentId,
  controlId,
  plan,
  status,
  upsertRemediationPlanAction,
}: {
  assessmentId: string;
  controlId: string;
  plan: RemediationPlanRow | null;
  status: string;
  upsertRemediationPlanAction: (formData: FormData) => Promise<void> | void;
}) {
  const today = new Date();
  const defaultTarget = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const note =
    status === "no"
      ? "This practice is Not met. Document a remediation plan with a target close date."
      : status === "partial"
        ? "This practice is Partial. CMMC L1 has no half-credit \u2014 close the gap to Met before signing."
        : "Plan retained for the record.";

  return (
    <details
      className="mt-5  border border-[#e5d6c2] bg-[#fdf8ef]"
      open={!plan}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#10231d]">
        Remediation plan
        {plan && (
          <span className="ml-2 text-xs font-medium text-[#a06b1a]">
            &middot; {plan.status.replace("_", " ")} &middot; target{" "}
            {plan.target_close_date}
          </span>
        )}
      </summary>
      <div className="border-t border-[#e5d6c2] px-4 pb-4 pt-3">
        <p className="text-xs text-[#a06b1a]">{note}</p>
        <form action={upsertRemediationPlanAction} className="mt-3 space-y-3">
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="controlId" value={controlId} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#a06b1a]">
              Gap summary
            </span>
            <textarea
              name="gapSummary"
              rows={2}
              required
              defaultValue={plan?.gap_summary ?? ""}
              placeholder="What's missing today?"
              className="w-full  border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#a06b1a]">
              Planned actions
            </span>
            <textarea
              name="plannedActions"
              rows={3}
              required
              defaultValue={plan?.planned_actions ?? ""}
              placeholder="Concrete steps and dates."
              className="w-full  border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#a06b1a]">
                Target close date
              </span>
              <input
                type="date"
                name="targetCloseDate"
                required
                defaultValue={plan?.target_close_date ?? defaultTarget}
                className="w-full  border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#a06b1a]">
                Status
              </span>
              <select
                name="status"
                defaultValue={plan?.status ?? "open"}
                className="w-full  border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
              >
                {REMEDIATION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            className=" bg-[#0e2a23] px-4 py-2 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            {plan ? "Update plan" : "Save plan"}
          </button>
        </form>
      </div>
    </details>
  );
}
