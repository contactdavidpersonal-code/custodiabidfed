"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EvidenceArtifactRow } from "@/lib/assessment";
import type { PracticeSpec } from "@/lib/cmmc/practice-spec";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
import { EvidenceDropzone } from "./EvidenceDropzone";
import { lockPracticeAction } from "./practice-chat-actions";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;

type Props = {
  assessmentId: string;
  controlId: string;
  spec: PracticeSpec;
  initialVerdicts: Record<string, ObjectiveVerdict>;
  initiallyLocked: boolean;
  evidence: ClientEvidenceRow[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
};

const STATUS_COLOR: Record<ObjectiveVerdict["status"], string> = {
  covered: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  partial: "text-amber-700 bg-amber-50 ring-amber-200",
  missing: "text-rose-700 bg-rose-50 ring-rose-200",
};

const STATUS_LABEL: Record<ObjectiveVerdict["status"], string> = {
  covered: "COVERED",
  partial: "PARTIAL",
  missing: "MISSING",
};

/**
 * Hybrid practice workspace. The middle pane on a /controls/:controlId page
 * for any practice that has a CMMC spec entry. The CHAT itself lives in the
 * Charlie rail (right side) — Charlie is grounded in this practice's NIST
 * 800-171A objectives via the system prompt. After every Charlie turn, the
 * rail POSTs to /sync and dispatches a 'practice-graded' window event with
 * the fresh objective verdicts; this component listens and re-renders.
 */
export function PracticeChat(props: Props) {
  const router = useRouter();
  const [verdicts, setVerdicts] = useState<Record<string, ObjectiveVerdict>>(
    props.initialVerdicts,
  );
  const [locked, setLocked] = useState(props.initiallyLocked);
  const [lockError, setLockError] = useState<string | null>(null);
  const [reverifying, setReverifying] = useState(false);
  const [, startTransition] = useTransition();

  // Listen for practice-graded events from the Charlie rail. The rail emits
  // one after every turn while the user is on this control's page.
  useEffect(() => {
    type Detail = {
      controlId: string;
      objectiveVerdicts: Record<string, ObjectiveVerdict>;
    };
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Detail>).detail;
      if (!detail || detail.controlId !== props.controlId) return;
      if (detail.objectiveVerdicts) setVerdicts(detail.objectiveVerdicts);
    };
    window.addEventListener("practice-graded", handler as EventListener);
    return () =>
      window.removeEventListener("practice-graded", handler as EventListener);
  }, [props.controlId]);

  const allCovered = props.spec.objectives.every(
    (o) => verdicts[o.letter]?.status === "covered",
  );

  const onReverify = async () => {
    if (reverifying) return;
    setReverifying(true);
    try {
      const res = await fetch(
        `/api/assessments/${props.assessmentId}/practice-chat/${encodeURIComponent(props.controlId)}/verify`,
        { method: "POST" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        objectiveVerdicts: Record<string, ObjectiveVerdict>;
      };
      setVerdicts(data.objectiveVerdicts ?? {});
    } finally {
      setReverifying(false);
    }
  };

  const onLock = async () => {
    setLockError(null);
    const result = await lockPracticeAction({
      assessmentId: props.assessmentId,
      controlId: props.controlId,
    });
    if (result.objectiveVerdicts) setVerdicts(result.objectiveVerdicts);
    if (!result.ok) {
      setLockError(result.reason ?? "Could not lock yet.");
      return;
    }
    setLocked(true);
    startTransition(() => router.refresh());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/assessments/${props.assessmentId}`}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            ← Back to overview
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            {props.spec.controlId} — {props.spec.shortName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            {props.spec.oneLiner}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">
            Practice {props.currentIdx + 1} of {props.total}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${
              locked
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : allCovered
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-stone-100 text-stone-700 ring-stone-200"
            }`}
          >
            {locked ? "MET" : allCovered ? "READY TO LOCK" : "IN PROGRESS"}
          </span>
        </div>
      </header>

      <CharliePrompt locked={locked} controlId={props.controlId} />

      <div className="mt-4 space-y-4">
        <ObjectivesPanel
          spec={props.spec}
          verdicts={verdicts}
          onReverify={onReverify}
          reverifying={reverifying}
        />
        <EvidencePanel
          spec={props.spec}
          evidence={props.evidence}
          assessmentId={props.assessmentId}
          controlId={props.controlId}
          uploadEvidenceAction={props.uploadEvidenceAction}
          reReviewEvidenceAction={props.reReviewEvidenceAction}
          disabled={locked}
        />
        <LockPanel
          allCovered={allCovered}
          locked={locked}
          lockError={lockError}
          onLock={onLock}
        />
      </div>

      <NavRow
        assessmentId={props.assessmentId}
        prevId={props.prevId}
        nextId={props.nextId}
      />
    </div>
  );
}

function CharliePrompt({ locked, controlId }: { locked: boolean; controlId: string }) {
  if (locked) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        This practice is locked as MET. The conversation transcript and
        evidence below are a frozen snapshot the assessor can read end-to-end.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3 text-sm text-[#10231d]">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#0e2a23] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]">
          vCO
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          Talk to Charlie on the right →
        </span>
      </div>
      <p className="text-stone-700">
        Charlie is loaded with the official CMMC requirement for{" "}
        <strong>{controlId}</strong>. As you chat, the assessment objectives
        below light up green. When all six are covered and your evidence is
        attached, the lock button unlocks.
      </p>
    </div>
  );
}

function ObjectivesPanel({
  spec,
  verdicts,
  onReverify,
  reverifying,
}: {
  spec: PracticeSpec;
  verdicts: Record<string, ObjectiveVerdict>;
  onReverify: () => void;
  reverifying: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">
          Assessment objectives — what an auditor checks
        </h2>
        <button
          type="button"
          onClick={onReverify}
          disabled={reverifying}
          className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline disabled:opacity-50"
        >
          {reverifying ? "Re-grading…" : "Re-grade"}
        </button>
      </div>
      <ul className="space-y-2">
        {spec.objectives.map((o) => {
          const v = verdicts[o.letter] ?? {
            status: "missing" as const,
            reason: "",
          };
          return (
            <li key={o.letter} className="text-xs">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${STATUS_COLOR[v.status]}`}
                >
                  [{o.letter}] {STATUS_LABEL[v.status]}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-stone-800">{o.text}</div>
                  {v.reason && (
                    <div className="mt-0.5 text-stone-500">{v.reason}</div>
                  )}
                  {v.status === "partial" && "missing" in v && v.missing && (
                    <div className="mt-0.5 italic text-amber-700">
                      Missing: {v.missing}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EvidencePanel({
  spec,
  evidence,
  assessmentId,
  controlId,
  uploadEvidenceAction,
  reReviewEvidenceAction,
  disabled,
}: {
  spec: PracticeSpec;
  evidence: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Evidence</h2>
      <p className="mb-3 text-xs text-stone-500">
        Drop in the artifacts below. Charlie reviews each upload and re-grades
        the objectives above.
      </p>

      <div className="mb-3 grid gap-2 md:grid-cols-2">
        {spec.evidenceSlots.map((slot) => (
          <div
            key={slot.key}
            className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-stone-800">{slot.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-stone-500">
                {slot.required ? "required" : "optional"} · [{slot.satisfies.join(",")}]
              </span>
            </div>
            <p className="mt-1 text-stone-600">{slot.hint}</p>
            {slot.templatePath && (
              <a
                href={slot.templatePath}
                className="mt-1 inline-block text-stone-700 underline-offset-2 hover:underline"
                download
              >
                Download template
              </a>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <EvidenceDropzone
          action={uploadEvidenceAction}
          assessmentId={assessmentId}
          controlId={controlId}
          compact
        />
      )}

      <div className="mt-3 space-y-2">
        {evidence.length === 0 ? (
          <p className="text-xs italic text-stone-500">
            No evidence attached yet.
          </p>
        ) : (
          evidence.map((e) => (
            <EvidenceRow
              key={e.id}
              evidence={e}
              reReviewEvidenceAction={reReviewEvidenceAction}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EvidenceRow({
  evidence,
  reReviewEvidenceAction,
  disabled,
}: {
  evidence: ClientEvidenceRow;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  const verdict = evidence.ai_review_verdict;
  const verdictTone =
    verdict === "sufficient"
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : verdict === "insufficient"
        ? "text-rose-700 bg-rose-50 ring-rose-200"
        : verdict === "not_relevant"
          ? "text-rose-700 bg-rose-50 ring-rose-200"
          : "text-stone-700 bg-stone-50 ring-stone-200";
  return (
    <div className="rounded-lg border border-stone-200 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/evidence/${evidence.id}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-stone-800 hover:underline"
        >
          {evidence.filename}
        </a>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${verdictTone}`}
        >
          {verdict ?? "pending"}
        </span>
      </div>
      {evidence.ai_review_summary && (
        <p className="mt-1 text-stone-600">{evidence.ai_review_summary}</p>
      )}
      {!disabled && verdict && (
        <form action={reReviewEvidenceAction} className="mt-1">
          <input type="hidden" name="artifactId" value={evidence.id} />
          <button
            type="submit"
            className="text-[11px] text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
          >
            Re-review
          </button>
        </form>
      )}
    </div>
  );
}

function LockPanel({
  allCovered,
  locked,
  lockError,
  onLock,
}: {
  allCovered: boolean;
  locked: boolean;
  lockError: string | null;
  onLock: () => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="font-semibold">Practice locked as MET</div>
        <p className="mt-1 text-emerald-800">
          The chat transcript and evidence are a frozen snapshot. The assessor
          can read this end-to-end as proof of how each objective was satisfied.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onLock}
        disabled={!allCovered}
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {allCovered ? "Lock as MET" : "Locked until every objective is covered"}
      </button>
      {lockError && (
        <p className="mt-2 text-xs text-rose-600">{lockError}</p>
      )}
    </div>
  );
}

function NavRow({
  assessmentId,
  prevId,
  nextId,
}: {
  assessmentId: string;
  prevId: string | null;
  nextId: string | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
      {prevId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${prevId}`}
          className="hover:text-stone-800"
        >
          ← Previous practice
        </Link>
      ) : (
        <span />
      )}
      {nextId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${nextId}`}
          className="hover:text-stone-800"
        >
          Next practice →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
