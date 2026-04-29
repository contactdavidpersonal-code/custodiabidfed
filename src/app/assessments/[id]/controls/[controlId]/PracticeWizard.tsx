"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ControlResponseRow,
  EvidenceArtifactRow,
  RemediationPlanRow,
} from "@/lib/assessment";
import type {
  ControlPlaybook,
  EvidenceProvider,
} from "@/lib/playbook";
import type { PracticeQuizQuestion } from "@/lib/practice-quiz";
import { EvidenceDropzone } from "./EvidenceDropzone";

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
  partial: "Partial",
  no: "Not met",
  not_applicable: "N/A",
};

type Props = {
  assessmentId: string;
  controlId: string;
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  response: ControlResponseRow;
  evidence: EvidenceArtifactRow[];
  remediationPlan: RemediationPlanRow | null;
  quiz: PracticeQuizQuestion[];
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  useSuggestedNarrativeAction: (formData: FormData) => Promise<void> | void;
  upsertRemediationPlanAction: (formData: FormData) => Promise<void> | void;
};

type QA = "yes" | "no" | "na" | null;

function parseQ(filename: string): { qid: string | null; display: string } {
  const m = /^\[q:([^\]]+)\]__(.*)$/.exec(filename);
  if (m) return { qid: m[1], display: m[2] };
  return { qid: null, display: filename };
}

const STORAGE_PREFIX = "cmmc:answers:";

/**
 * Single integrated checklist. Each quiz question is a card; answering "Yes"
 * reveals an inline upload slot tied to that question (filename prefix
 * `[q:<id>]__`). Uploading evidence auto-marks the question "Yes". Answering
 * "Not yet" feeds the remediation plan. When everything is resolved, one
 * lock-in click derives status, drafts the narrative, and saves.
 */
export function PracticeWizard(props: Props) {
  const router = useRouter();
  const storageKey = `${STORAGE_PREFIX}${props.assessmentId}:${props.controlId}`;

  // Group evidence by question id parsed from the stored filename.
  const grouped = useMemo(() => {
    const map = new Map<string, EvidenceArtifactRow[]>();
    const loose: EvidenceArtifactRow[] = [];
    for (const e of props.evidence) {
      const { qid } = parseQ(e.filename);
      if (qid) {
        const arr = map.get(qid) ?? [];
        arr.push(e);
        map.set(qid, arr);
      } else {
        loose.push(e);
      }
    }
    return { map, loose };
  }, [props.evidence]);

  const [answers, setAnswers] = useState<Record<string, QA>>(() =>
    Object.fromEntries(props.quiz.map((q) => [q.id, null])),
  );
  const [naReason, setNaReason] = useState("");
  const [wholeNa, setWholeNa] = useState(
    props.response.status === "not_applicable",
  );
  const [submitting, setSubmitting] = useState(false);

  // Restore previously-given answers from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          answers?: Record<string, QA>;
          naReason?: string;
        };
        if (saved.answers) {
          setAnswers((prev) => ({ ...prev, ...saved.answers }));
        }
        if (saved.naReason) setNaReason(saved.naReason);
      }
    } catch {
      // ignore corrupt storage
    }
  }, [storageKey]);

  // Auto-promote a question to "yes" when evidence shows up for it.
  useEffect(() => {
    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const q of props.quiz) {
        const has = (grouped.map.get(q.id)?.length ?? 0) > 0;
        if (has && next[q.id] !== "yes" && next[q.id] !== "no") {
          next[q.id] = "yes";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [grouped.map, props.quiz]);

  // Persist answers locally so they survive uploads / reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, naReason }),
      );
    } catch {
      // ignore quota errors
    }
  }, [answers, naReason, storageKey]);

  const setA = (qid: string, v: QA) => {
    setAnswers((p) => ({ ...p, [qid]: v }));
  };

  const total = props.quiz.length;
  const yesCount = props.quiz.filter((q) => answers[q.id] === "yes").length;
  const noCount = props.quiz.filter((q) => answers[q.id] === "no").length;
  const naCount = props.quiz.filter((q) => answers[q.id] === "na").length;
  const answered = yesCount + noCount + naCount;
  const yesWithEvidence = props.quiz.filter(
    (q) =>
      answers[q.id] === "yes" && (grouped.map.get(q.id)?.length ?? 0) > 0,
  ).length;

  const ready = wholeNa
    ? naReason.trim().length >= 10
    : answered === total && total > 0 && yesWithEvidence === yesCount;

  const derivedStatus: "yes" | "partial" | "no" | "not_applicable" = wholeNa
    ? "not_applicable"
    : naCount === total
      ? "not_applicable"
      : noCount === total - naCount && noCount > 0
        ? "no"
        : yesCount === total - naCount && yesCount > 0
          ? "yes"
          : "partial";

  const hiddenSaveRef = useRef<HTMLFormElement>(null);
  const hiddenSuggestRef = useRef<HTMLFormElement>(null);

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between gap-4 text-sm">
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

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-[#0e2a23] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#bdf2cf]">
            {props.practice.domain}
          </span>
          <span className="font-mono text-xs font-semibold text-[#5a7d70]">
            {props.practice.id}
          </span>
          <span className="text-[#cfe3d9]">&middot;</span>
          <span className="text-xs font-medium text-[#5a7d70]">
            {props.practice.farReference}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#10231d] md:text-[34px]">
          {props.practice.shortName}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-[#10231d]/85">
          {props.practice.plainEnglish}
        </p>
      </header>

      {props.practice.whyItMatters && (
        <div className="mb-6 rounded-sm border border-[#e5d6c2] bg-[#fdf8ef] px-4 py-3 text-sm leading-relaxed text-[#10231d]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
            Why this matters
          </p>
          <p className="mt-1">{props.practice.whyItMatters}</p>
        </div>
      )}

      {isLocked && !wholeNa && (
        <div className="mb-6 rounded-md border border-[#2f8f6d] bg-[#f7fcf9] p-4">
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
                className="rounded-sm bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
              >
                Next practice &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Whole-control N/A escape hatch */}
      <div className="mb-5 rounded-sm border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={wholeNa}
            onChange={(e) => setWholeNa(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none accent-[#0e2a23]"
          />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-[#10231d]">
              This whole practice doesn&rsquo;t apply to my business
            </span>
            <p className="mt-0.5 text-xs text-[#5a7d70]">
              Use sparingly. Briefly explain why &mdash; auditors will read it.
            </p>
            {wholeNa && (
              <textarea
                value={naReason}
                onChange={(e) => setNaReason(e.target.value)}
                rows={2}
                placeholder="E.g. We have no physical office; all staff work remotely on cloud-only systems."
                className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
              />
            )}
          </div>
        </label>
      </div>

      {/* Quiz cards */}
      {!wholeNa && (
        <ol className="space-y-4">
          {props.quiz.map((q, idx) => (
            <QuestionCard
              key={q.id}
              idx={idx}
              q={q}
              answer={answers[q.id]}
              onAnswer={(v) => setA(q.id, v)}
              practice={props.practice}
              evidence={grouped.map.get(q.id) ?? []}
              assessmentId={props.assessmentId}
              controlId={props.controlId}
              uploadEvidenceAction={props.uploadEvidenceAction}
              deleteEvidenceAction={props.deleteEvidenceAction}
              reReviewEvidenceAction={props.reReviewEvidenceAction}
            />
          ))}
        </ol>
      )}

      {/* Progress + lock-in */}
      {!wholeNa && total > 0 && (
        <div className="mt-6 rounded-md border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
                Progress
              </p>
              <p className="mt-1 text-sm font-semibold text-[#10231d]">
                {answered} of {total} answered &middot; {yesWithEvidence} of{" "}
                {yesCount} Yes-answers have evidence
              </p>
              {ready ? (
                <p className="mt-1 text-xs text-[#2f8f6d]">
                  Will be marked{" "}
                  <strong>{STATUS_LABELS[derivedStatus]}</strong> when you lock
                  it in. Narrative is drafted automatically.
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#5a7d70]">
                  Answer every question and attach evidence for each Yes to
                  continue.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!ready || submitting}
              onClick={lockIn}
              className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving\u2026" : "Mark N/A and continue \u2192"}
          </button>
        </div>
      )}

      {/* Loose evidence uploaded outside any question (e.g. legacy uploads) */}
      {grouped.loose.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
            Other uploaded evidence
          </h2>
          <ul className="mt-2 divide-y divide-[#e4eee8] rounded-sm border border-[#cfe3d9] bg-white">
            {grouped.loose.map((a) => (
              <EvidenceRow
                key={a.id}
                artifact={a}
                assessmentId={props.assessmentId}
                controlId={props.controlId}
                deleteEvidenceAction={props.deleteEvidenceAction}
                reReviewEvidenceAction={props.reReviewEvidenceAction}
              />
            ))}
          </ul>
        </section>
      )}

      {/* What passing evidence looks like (control-wide reference) */}
      {!wholeNa && props.practice.passingEvidence.length > 0 && (
        <section className="mt-8 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f8f6d]">
            What &ldquo;passing&rdquo; evidence looks like
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
            Make sure your uploads show every item below. The AI reviewer
            checks for these.
          </p>
          <ul className="mt-3 space-y-1.5">
            {props.practice.passingEvidence.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed text-[#10231d]"
              >
                <span className="mt-1 inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-[10px] font-bold text-[#bdf2cf]">
                  &#x2713;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Provider-specific quick guidance, kept as a reference panel */}
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

      {/* Hidden anchors kept for forward compat */}
      <form ref={hiddenSaveRef} className="hidden" />
      <form ref={hiddenSuggestRef} className="hidden" />
    </div>
  );
}

/* ============================ QUESTION CARD =============================== */

function QuestionCard({
  idx,
  q,
  answer,
  onAnswer,
  practice,
  evidence,
  assessmentId,
  controlId,
  uploadEvidenceAction,
  deleteEvidenceAction,
  reReviewEvidenceAction,
}: {
  idx: number;
  q: PracticeQuizQuestion;
  answer: QA;
  onAnswer: (v: QA) => void;
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  evidence: EvidenceArtifactRow[];
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const provingHints = practice.passingEvidence.slice(0, 3);

  return (
    <li className="rounded-md border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-sm bg-[#0e2a23] font-mono text-xs font-bold text-[#bdf2cf]">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-relaxed text-[#10231d]">
              {q.prompt}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAnswer("yes")}
                className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                  answer === "yes"
                    ? "bg-[#0e2a23] text-[#bdf2cf]"
                    : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onAnswer("no")}
                className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                  answer === "no"
                    ? "bg-[#b03a2e] text-white"
                    : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#b03a2e] hover:bg-[#fdf2f0]"
                }`}
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => onAnswer("na")}
                className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                  answer === "na"
                    ? "bg-[#5a7d70] text-white"
                    : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#5a7d70] hover:bg-[#f7fcf9]"
                }`}
              >
                N/A
              </button>
            </div>
          </div>
        </div>
      </div>

      {answer === "yes" && (
        <div className="border-t border-[#cfe3d9] bg-[#f7fcf9] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f8f6d]">
            {q.yesMeans}
          </p>
          {evidence.length === 0 && provingHints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {provingHints.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed text-[#10231d]"
                >
                  <span className="mt-0.5 inline-flex h-3 w-3 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-[9px] font-bold text-[#bdf2cf]">
                    &#x2713;
                  </span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {evidence.length === 0 ? (
            <div className="mt-3">
              <EvidenceDropzone
                action={uploadEvidenceAction}
                assessmentId={assessmentId}
                controlId={controlId}
                questionId={q.id}
                compact
              />
            </div>
          ) : (
            <div className="mt-3">
              <ul className="divide-y divide-[#e4eee8] rounded-sm border border-[#cfe3d9] bg-white">
                {evidence.map((a) => (
                  <EvidenceRow
                    key={a.id}
                    artifact={a}
                    assessmentId={assessmentId}
                    controlId={controlId}
                    deleteEvidenceAction={deleteEvidenceAction}
                    reReviewEvidenceAction={reReviewEvidenceAction}
                  />
                ))}
              </ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-[#5a7d70] hover:text-[#10231d]">
                  Add another file
                </summary>
                <div className="mt-2">
                  <EvidenceDropzone
                    action={uploadEvidenceAction}
                    assessmentId={assessmentId}
                    controlId={controlId}
                    questionId={q.id}
                    compact
                  />
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {answer === "no" && (
        <div className="border-t border-[#e5d6c2] bg-[#fdf8ef] px-5 py-3 text-xs leading-relaxed text-[#10231d]">
          <span className="font-semibold text-[#a06b1a]">Fix plan: </span>
          {q.gap}
        </div>
      )}

      {answer === "na" && (
        <div className="border-t border-[#cfe3d9] bg-[#f7fcf9] px-5 py-3 text-xs leading-relaxed text-[#5a7d70]">
          Skipping &mdash; this question doesn&rsquo;t apply.
        </div>
      )}
    </li>
  );
}

/* ============================ EVIDENCE ROW ================================ */

function EvidenceRow({
  artifact: a,
  assessmentId,
  controlId,
  deleteEvidenceAction,
  reReviewEvidenceAction,
}: {
  artifact: EvidenceArtifactRow;
  assessmentId: string;
  controlId: string;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
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
            : { pill: "bg-[#cfe3d9] text-[#10231d]", label: "Reviewing\u2026" };

  const display = parseQ(a.filename).display;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-sm bg-[#0e2a23] font-mono text-[10px] font-bold text-[#bdf2cf]">
            {a.mime_type?.startsWith("image/")
              ? "IMG"
              : a.mime_type?.includes("pdf")
                ? "PDF"
                : "DOC"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={a.blob_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold text-[#10231d] hover:text-[#2f8f6d]"
              >
                {display}
              </a>
              <span
                className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${verdictTone.pill}`}
              >
                {verdictTone.label}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-[#5a7d70]">
              {new Date(a.captured_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <form action={reReviewEvidenceAction}>
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="controlId" value={controlId} />
            <input type="hidden" name="artifactId" value={a.id} />
            <button
              type="submit"
              title="Re-run platform review"
              className="rounded-sm px-2 py-1 text-xs font-semibold text-[#5a7d70] transition-colors hover:bg-[#f7fcf9] hover:text-[#10231d]"
            >
              Re-review
            </button>
          </form>
          <form action={deleteEvidenceAction}>
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="controlId" value={controlId} />
            <input type="hidden" name="artifactId" value={a.id} />
            <button
              type="submit"
              className="rounded-sm px-2 py-1 text-xs font-semibold text-[#5a7d70] transition-colors hover:bg-[#fdf2f0] hover:text-[#b03a2e]"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
      {a.ai_review_summary && (
        <p className="mt-2 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-3 py-2 text-xs leading-relaxed text-[#10231d]">
          {a.ai_review_summary}
        </p>
      )}
    </li>
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
    <details className="mt-6 rounded-md border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04)]">
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
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
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
          <div className="mt-4 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] p-4">
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
                  className="rounded-sm bg-[#0e2a23] px-3 py-1.5 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  Open in {providerLabel[active.provider]} &#x2197;
                </a>
              )}
              {active.template && (
                <a
                  href={`/templates/${active.template.filename}`}
                  download
                  className="rounded-sm border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
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
      className="mt-5 rounded-sm border border-[#e5d6c2] bg-[#fdf8ef]"
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
              className="w-full rounded-sm border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
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
              className="w-full rounded-sm border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
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
                className="w-full rounded-sm border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#a06b1a]">
                Status
              </span>
              <select
                name="status"
                defaultValue={plan?.status ?? "open"}
                className="w-full rounded-sm border border-[#e5d6c2] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
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
            className="rounded-sm bg-[#0e2a23] px-4 py-2 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            {plan ? "Update plan" : "Save plan"}
          </button>
        </form>
      </div>
    </details>
  );
}
