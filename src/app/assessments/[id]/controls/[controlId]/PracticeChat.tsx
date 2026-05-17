"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EvidenceArtifactRow } from "@/lib/assessment";
import type {
  ClientPersonalizedSpec,
  ClientPracticeIntakeSpec,
  ClientPracticeSpec,
  EvidenceDestination,
  EvidenceSlot,
  IntakeAnswers,
  SlotAnnotation,
} from "@/lib/cmmc/practice-spec";
import { inferSlotKey } from "@/lib/cmmc/practice-spec";
import type { ConnectorProvider } from "@/lib/connectors/types";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
import { computePracticePercent } from "@/lib/cmmc/practice-progress";
import {
  hardResetPracticeAction,
  lockPracticeAction,
  resetIntakeAction,
  saveIntakeStepAction,
} from "./practice-chat-actions";
import { GuidedPracticeQuiz } from "./GuidedPracticeQuiz";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;
export type { ClientEvidenceRow };

type Props = {
  assessmentId: string;
  controlId: string;
  spec: ClientPracticeSpec;
  /**
   * Result of `personalizeSpec(spec, intake_answers)` computed server-side.
   * Null when the practice has no intake spec or the user hasn't completed
   * intake yet. The client never runs personalize() itself because the
   * underlying callbacks aren't RSC-serializable.
   */
  initialPersonalized: ClientPersonalizedSpec | null;
  initialVerdicts: Record<string, ObjectiveVerdict>;
  initiallyLocked: boolean;
  /**
   * Per-practice intake answers, or null if the user hasn't completed the
   * intake yet. When the spec has an intake block AND this is null, the
   * page renders the intake gate before the slot list.
   */
  initialIntakeAnswers: IntakeAnswers | null;
  initialIntakeCompletedAt: string | null;
  evidence: ClientEvidenceRow[];
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
};

const STATUS_COLOR: Record<ObjectiveVerdict["status"], string> = {
  covered: "text-[#10231d] bg-[#e8f5ec] ring-[#2f8f6d]/40",
  partial: "text-amber-800 bg-amber-50 ring-amber-300",
  missing: "text-rose-800 bg-rose-50 ring-rose-300",
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

  // Per-practice intake state. When the spec has an intake block and we
  // don't have a completed-at stamp, render the intake gate instead of
  // the slot list. Once the server-side `saveIntakeAction` resolves, the
  // page revalidates and these props refresh.
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers | null>(
    props.initialIntakeAnswers,
  );
  const [intakeCompletedAt, setIntakeCompletedAt] = useState<string | null>(
    props.initialIntakeCompletedAt,
  );
  useEffect(() => {
    setIntakeAnswers(props.initialIntakeAnswers);
    setIntakeCompletedAt(props.initialIntakeCompletedAt);
  }, [props.initialIntakeAnswers, props.initialIntakeCompletedAt]);

  // Personalized spec computed on the server (page.tsx) and passed in via
  // props. Re-runs when the user saves intake answers because the server
  // action revalidates this route, causing a fresh render with new props.
  const personalized = props.initialPersonalized;
  const activeSpec: ClientPracticeSpec = personalized ?? props.spec;
  const slotAnnotations: Record<string, SlotAnnotation> =
    personalized?.slotAnnotations ?? {};
  const situationSummary: string | null = personalized?.situationSummary ?? null;

  const intakeRequired = Boolean(props.spec.intake);
  const intakeComplete = intakeRequired ? Boolean(intakeCompletedAt) : true;

  const [resettingIntake, startResetIntake] = useTransition();
  const onEditIntake = () => {
    startResetIntake(async () => {
      const res = await resetIntakeAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
      });
      if (!res.ok) return;
      setIntakeAnswers(null);
      setIntakeCompletedAt(null);
      router.refresh();
    });
  };
  // Full nuke: wipes evidence, chat, intake, verdicts, lock, SSP narrative,
  // remediation plans, and supersedes signed affirmations for this practice
  // only. Used by the "Reset this practice" button on every control page so
  // users can re-walk a single practice from zero without touching the others.
  const onHardReset = () => {
    startResetIntake(async () => {
      const res = await hardResetPracticeAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
      });
      if (!res.ok) return;
      setIntakeAnswers(null);
      setIntakeCompletedAt(null);
      setVerdicts({});
      setEvidence([]);
      setLocked(false);
      setLockError(null);
      // Tell Charlie + the chat rail that this practice was just wiped:
      // clear the transcript, drop kickoff dedupe, and re-greet so the
      // user sees the "Let's start <controlId>" opener as if they just
      // landed for the first time.
      window.dispatchEvent(
        new CustomEvent("custodia:practice-reset", {
          detail: {
            assessmentId: props.assessmentId,
            controlId: props.controlId,
          },
        }),
      );
      router.refresh();
    });
  };

  // Local mirror of the server-rendered evidence list. We seed it from
  // props (so the first paint matches the RSC) and refetch the list any
  // time the rail dispatches `evidence-changed` — that's how a Charlie
  // tool call lands a brand-new artifact into the correct slot card
  // without requiring a full page refresh.
  const [evidence, setEvidence] = useState<ClientEvidenceRow[]>(
    props.evidence,
  );
  useEffect(() => {
    setEvidence(props.evidence);
  }, [props.evidence]);
  const refetchEvidence = useCallback(async () => {
    // Refetch with a short backoff: Charlie's tool_end fires the
    // millisecond the INSERT promise resolves, but pooled-DB read replicas
    // and Next.js's per-request cache can lag the new row by a tick.
    // Three quick attempts (0ms, 350ms, 1200ms) covers the realistic
    // window without spamming the API or making the user wait.
    const delays = [0, 350, 1200];
    let lastLen = -1;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetch(
          `/api/assessments/${props.assessmentId}/controls/${encodeURIComponent(props.controlId)}/evidence`,
          { cache: "no-store" },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { evidence: ClientEvidenceRow[] };
        if (!Array.isArray(data.evidence)) continue;
        setEvidence(data.evidence);
        // Stop early once the row count stabilises AND is at least as
        // large as what we had on the prior render — i.e. the new
        // artifact has shown up. (`>` would miss the deletion case;
        // `>=` after a non-empty refetch is the right floor.)
        if (data.evidence.length === lastLen && lastLen >= 0) return;
        lastLen = data.evidence.length;
      } catch (err) {
        console.warn("refetchEvidence failed", err);
      }
    }
  }, [props.assessmentId, props.controlId]);

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
      // Charlie may have generated artifacts via tool calls during the
      // turn — refresh the server component so newly-created evidence
      // shows in the panel below.
      startTransition(() => router.refresh());
    };
    window.addEventListener("practice-graded", handler as EventListener);
    return () =>
      window.removeEventListener("practice-graded", handler as EventListener);
  }, [props.controlId, router]);

  // Listen for `evidence-changed` events fired *during* Charlie's stream
  // (immediately after a successful tool call) so the slot rows fill in
  // the moment Charlie generates an artifact — no need to wait for the
  // turn to finish or for /sync to grade objectives.
  useEffect(() => {
    const handler = () => {
      // 1. Refetch the evidence list directly so the slot card updates
      //    instantly, even if the RSC refresh is throttled or coalesced.
      void refetchEvidence();
      // 2. Also refresh the RSC tree so server-rendered panels (progress
      //    rollups, audit timeline) reflect the same fresh row.
      startTransition(() => router.refresh());
      // 3. Re-grade objective verdicts so the coverage gate (CMMC L1 =
      //    MET / NOT MET) reflects the freshly-uploaded artifact without
      //    requiring the user to click anything. Fire-and-forget; the
      //    quiz's onFinish handler also re-verifies on click as a
      //    belt-and-suspenders check.
      void fetch(
        `/api/assessments/${props.assessmentId}/practice-chat/${encodeURIComponent(props.controlId)}/verify`,
        { method: "POST" },
      )
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {
            objectiveVerdicts: Record<string, ObjectiveVerdict>;
          };
          if (data.objectiveVerdicts) setVerdicts(data.objectiveVerdicts);
        })
        .catch(() => {});
    };
    window.addEventListener("evidence-changed", handler);
    return () => window.removeEventListener("evidence-changed", handler);
  }, [router, refetchEvidence, props.assessmentId, props.controlId]);

  // When the user pastes or drops an image into the Charlie chat composer,
  // the rail emits `charlie-image-incoming` with the File. We catch it here
  // and pop a small picker: which evidence slot should this screenshot
  // satisfy? The picker dispatches `charlie-image-dropped` with the chosen
  // slot key, which the slot's own dropzone already listens for.
  const [pendingImage, setPendingImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ file: File }>).detail;
      if (!detail?.file) return;
      const previewUrl = URL.createObjectURL(detail.file);
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { file: detail.file, previewUrl };
      });
    };
    window.addEventListener("charlie-image-incoming", handler);
    return () => window.removeEventListener("charlie-image-incoming", handler);
  }, []);
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  const allCovered = props.spec.objectives.every(
    (o) => verdicts[o.letter]?.status === "covered",
  );

  // Live, denormalized progress for this practice. Combines two signals:
  //   1. Objectives covered (Charlie's grading verdict per 800-171A letter)
  //   2. Required evidence slots filled (any artifact tagged to the slot
  //      with a 'sufficient' AI-review verdict)
  // The math lives in computePracticePercent so the assessment overview
  // page renders the exact same number for this control — single source
  // of truth, two surfaces can never disagree.
  const progress = computePracticePercent({
    spec: activeSpec,
    verdicts,
    evidence,
  });
  const totalObjectives = progress.totalObjectives;
  const coveredObjectives = progress.coveredObjectives;
  const requiredSlots = activeSpec.evidenceSlots.filter((s) => s.required);
  const filledSlots = progress.filledRequiredSlots;
  const overallPercent = progress.percent;

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
      {/* Sticky practice header: stays pinned just below the workspace nav
          as the user scrolls into the evidence section so they always know
          which practice they're working on. */}
      <header
        className="sticky z-20 -mx-4 mb-6 border-b border-[#cfe3d9] bg-white/95 px-4 pt-6 pb-6 shadow-[0_8px_24px_-18px_rgba(14,42,35,0.4)] backdrop-blur md:-mx-6 md:px-6 md:pt-7"
        style={{ top: "calc(var(--safe-top, 0px) + 72px)" }}
      >
        <Link
          href={`/assessments/${props.assessmentId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]"
        >
          ← Back to overview
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Practice {props.currentIdx + 1} of {props.total} ·{" "}
              {locked ? "Met" : allCovered ? "Ready to lock" : "In progress"}
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
              {props.spec.controlId} — {props.spec.shortName}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#3a544a]">
              {props.spec.oneLiner}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${
              locked
                ? "bg-[#08201a] text-[#bdf2cf] ring-[#08201a]"
                : allCovered
                  ? "bg-[#f4faf6] text-[#2f8f6d] ring-[#2f8f6d]/40"
                  : "bg-[#fcfdfb] text-[#5a7d70] ring-[#cfe3d9]"
            }`}
          >
            {locked ? "MET" : allCovered ? "READY TO LOCK" : "IN PROGRESS"}
          </span>
        </div>
        {/* Reset button — full nuke of this single practice. Wipes
            evidence, chat with Charlie, intake answers, objective grades,
            lock state, SSP narrative, and supersedes any signed
            affirmation row so the bid-packet gate forces a fresh
            signature. Scoped to this control only — the other 14
            practices are untouched. Always visible (works locked or
            unlocked) so users can fully restart a practice that's gone
            sideways. */}
        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              if (resettingIntake) return;
              const ok = window.confirm(
                `Reset ${props.spec.controlId} back to a clean slate?\n\nThis permanently deletes ALL evidence files, chat history with Charlie, quiz answers, objective grades, and the SSP narrative for THIS practice only. The other 14 practices are not touched.\n\nThis cannot be undone.`,
              );
              if (!ok) return;
              onHardReset();
            }}
            disabled={resettingIntake}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c9c9] bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b1f1f] shadow-sm hover:border-[#8b1f1f] hover:bg-[#fbf4f4] hover:text-[#6d1818] disabled:opacity-50"
          >
            {resettingIntake ? "Resetting…" : "↻ Reset this practice"}
          </button>
        </div>
      </header>

      <PracticeProgressBar
        percent={locked ? 100 : overallPercent}
        coveredObjectives={coveredObjectives}
        partialObjectives={progress.partialObjectives}
        totalObjectives={totalObjectives}
        filledSlots={filledSlots}
        totalSlots={requiredSlots.length}
        locked={locked}
      />

      <CharliePrompt locked={locked} controlId={props.controlId} />

      {/* Guided quiz: render the unified "quiz IS the practice" flow when
          the practice has an intake spec and the user hasn't completed it
          yet. Each question is followed inline by the evidence slots that
          objective drives — Charlie / upload / connect / attest are all
          present without making the user dump evidence in a separate step
          at the end. Practices without intake bypass entirely. */}
      {intakeRequired && !intakeComplete && props.spec.intake && (
        <div className="mt-8">
          <GuidedPracticeQuiz
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            spec={props.spec}
            intake={props.spec.intake}
            initialAnswers={intakeAnswers ?? undefined}
            personalized={personalized}
            evidence={evidence}
            connectedProviders={props.connectedProviders}
            uploadEvidenceAction={props.uploadEvidenceAction}
            reReviewEvidenceAction={props.reReviewEvidenceAction}
            deleteEvidenceAction={props.deleteEvidenceAction}
            objectiveVerdicts={verdicts}
            requireFullCoverageToFinish={props.controlId === "AC.L1-3.1.1"}
            onRequestVerify={async () => {
              // Force a fresh server-side re-grade and propagate the new
              // verdicts up so the rest of the page reflects them too.
              // Falls back to null on transport errors — caller will use
              // the last-known verdicts and gate accordingly.
              try {
                const res = await fetch(
                  `/api/assessments/${props.assessmentId}/practice-chat/${encodeURIComponent(props.controlId)}/verify`,
                  { method: "POST" },
                );
                if (!res.ok) return null;
                const data = (await res.json()) as {
                  objectiveVerdicts: Record<string, ObjectiveVerdict>;
                };
                const fresh = data.objectiveVerdicts ?? {};
                setVerdicts(fresh);
                return fresh;
              } catch {
                return null;
              }
            }}
          />
        </div>
      )}

      {intakeComplete && (
      <div className="mt-8 space-y-10">
        {situationSummary && (
          <YourSituationCard
            summary={situationSummary}
            completedAt={intakeCompletedAt}
            onEdit={onEditIntake}
            resetting={resettingIntake}
            locked={locked}
          />
        )}
        {/* Per-practice answers summary — every quiz question and the
            user's selected answer, with inline edit per row. Scoped to
            AC.L1-3.1.1 for now while we ship the prod-grade summary
            flow; other practices keep the legacy "Edit answers" full
            reset until they're upgraded one at a time. */}
        {props.controlId === "AC.L1-3.1.1" &&
          props.spec.intake &&
          intakeAnswers && (
            <AnsweredQuestionsCard
              assessmentId={props.assessmentId}
              controlId={props.controlId}
              intake={props.spec.intake}
              answers={intakeAnswers}
              locked={locked}
              onAnswerSaved={(qid, value) => {
                setIntakeAnswers((prev) => ({ ...(prev ?? {}), [qid]: value }));
                startTransition(() => router.refresh());
              }}
            />
          )}
        {pendingImage && (
          <ChatImageSlotPicker
            file={pendingImage.file}
            previewUrl={pendingImage.previewUrl}
            spec={activeSpec}
            evidence={evidence}
            onPick={(slotKey) => {
              window.dispatchEvent(
                new CustomEvent("charlie-image-dropped", {
                  detail: { slotKey, file: pendingImage.file },
                }),
              );
              // Nudge Charlie to verify what was just uploaded for that slot.
              const slot = activeSpec.evidenceSlots.find(
                (s) => s.key === slotKey,
              );
              if (slot) {
                const letters = slot.satisfies.join(", ");
                window.dispatchEvent(
                  new CustomEvent("charlie-send-message", {
                    detail: {
                      message: `I just dropped a screenshot into the "${slot.label}" slot (objective ${letters}). Once the AI vision review finishes, confirm whether it satisfies the assessor expectation — and if it doesn't, tell me exactly what to capture instead.`,
                    },
                  }),
                );
              }
              setPendingImage(null);
            }}
            onCancel={() => setPendingImage(null)}
          />
        )}
        <ObjectiveEvidencePanel
          spec={activeSpec}
          verdicts={verdicts}
          slotAnnotations={slotAnnotations}
          evidence={evidence}
          assessmentId={props.assessmentId}
          controlId={props.controlId}
          connectedProviders={props.connectedProviders}
          uploadEvidenceAction={props.uploadEvidenceAction}
          reReviewEvidenceAction={props.reReviewEvidenceAction}
          deleteEvidenceAction={props.deleteEvidenceAction}
          onReverify={onReverify}
          reverifying={reverifying}
          locked={locked}
        />
        <LockPanel
          allCovered={allCovered}
          locked={locked}
          lockError={lockError}
          onLock={onLock}
        />
      </div>
      )}

      <NavRow
        assessmentId={props.assessmentId}
        prevId={props.prevId}
        nextId={props.nextId}
        // Gate the "Next practice" link on 100% — but only for the
        // practices we've upgraded to the prod-level summary flow. Every
        // other practice keeps the legacy unconditional next link until
        // it's been upgraded too.
        gateOnComplete={props.controlId === "AC.L1-3.1.1"}
        canAdvance={allCovered || locked}
      />
    </div>
  );
}

function PracticeProgressBar({
  percent,
  coveredObjectives,
  partialObjectives,
  totalObjectives,
  filledSlots,
  totalSlots,
  locked,
}: {
  percent: number;
  coveredObjectives: number;
  partialObjectives: number;
  totalObjectives: number;
  filledSlots: number;
  totalSlots: number;
  locked: boolean;
}) {
  const tone = locked
    ? "bg-[#08201a]"
    : percent >= 80
      ? "bg-[#2f8f6d]"
      : percent >= 50
        ? "bg-amber-500"
        : "bg-[#a8cfc0]";
  return (
    <div className="mb-6 border border-[#cfe3d9] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
          This practice
        </div>
        <div className="font-serif text-2xl font-bold tabular-nums text-[#10231d]">
          {percent}%
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden bg-[#f4faf6]">
        <div
          className={`h-full ${tone} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#3a544a]">
        <span>
          <strong className="font-semibold text-[#10231d]">
            {coveredObjectives} of {totalObjectives}
          </strong>{" "}
          objectives covered
          {partialObjectives > 0 && (
            <span className="text-[#5a7d70]">
              {" "}
              ·{" "}
              <strong className="font-semibold text-[#3a544a]">
                {partialObjectives}
              </strong>{" "}
              partial
            </span>
          )}
        </span>
        <span className="text-[#cfe3d9]" aria-hidden>·</span>
        <span>
          <strong className="font-semibold text-[#10231d]">
            {filledSlots} of {totalSlots}
          </strong>{" "}
          evidence collected
        </span>
        {!locked && percent === 100 && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Ready to lock as MET ↓
          </span>
        )}
      </div>
    </div>
  );
}

function CharliePrompt({ locked, controlId }: { locked: boolean; controlId: string }) {
  if (locked) {
    return (
      <div className="border-l-4 border-[#08201a] bg-[#f4faf6] px-6 py-5">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Practice locked · MET
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-[#10231d]">
          The conversation transcript and the signed narrative are a frozen
          snapshot the assessor can read end-to-end. Evidence below stays
          editable so your packet keeps up with the business year-round.
        </p>
      </div>
    );
  }
  return (
    <div className="border-l-4 border-[#2f8f6d] bg-[#f7fcf9] px-6 py-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#08201a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          vCO
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Talk to Charlie on the right →
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
        Charlie is loaded with the official CMMC requirement for{" "}
        <strong className="font-semibold">{controlId}</strong>. As you chat,
        the assessment objectives below light up green. When all six are
        covered and your evidence is attached, the lock button unlocks.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Unified Objectives × Evidence panel (post-intake review view).
// Each objective is the spine; the slots that satisfy it nest under it,
// so the user reads the same hierarchy an assessor reads:
//   "objective (a) → here is the proof you submitted for (a)".
// A slot that satisfies multiple objectives is rendered under the FIRST
// objective it satisfies to avoid duplicate evidence cards. Slots tied to
// no objective land in a trailing "Supporting evidence" bucket.
// ────────────────────────────────────────────────────────────────────────
function ObjectiveEvidencePanel({
  spec,
  verdicts,
  slotAnnotations,
  evidence,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
  reReviewEvidenceAction,
  deleteEvidenceAction,
  onReverify,
  reverifying,
  locked,
}: {
  spec: ClientPracticeSpec;
  verdicts: Record<string, ObjectiveVerdict>;
  slotAnnotations: Record<string, SlotAnnotation>;
  evidence: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  onReverify: () => void;
  reverifying: boolean;
  locked: boolean;
}) {
  // Bucket artifacts by slot (same logic as EvidencePanel).
  const bySlot: Record<string, ClientEvidenceRow[]> = {};
  const unmatched: ClientEvidenceRow[] = [];
  for (const ev of evidence) {
    const slotKey = inferSlotKey(ev.filename, spec);
    if (slotKey) (bySlot[slotKey] ??= []).push(ev);
    else unmatched.push(ev);
  }

  // Bucket each slot to the FIRST objective in spec.objectives that it satisfies.
  const slotsByObjective: Record<string, typeof spec.evidenceSlots> = {};
  const orphanSlots: typeof spec.evidenceSlots = [];
  for (const slot of spec.evidenceSlots) {
    const firstHit = spec.objectives.find((o) =>
      slot.satisfies.includes(o.letter),
    );
    if (firstHit) {
      (slotsByObjective[firstHit.letter] ??= [] as typeof spec.evidenceSlots).push(slot);
    } else {
      orphanSlots.push(slot);
    }
  }

  const filledCount = spec.evidenceSlots.filter((s) => {
    const items = bySlot[s.key] ?? [];
    return items.some((it) => it.ai_review_verdict === "sufficient");
  }).length;
  const totalRequired = spec.evidenceSlots.filter((s) => s.required).length;

  // Running slot index so the SlotRow numbering matches across objectives.
  let slotIndex = 0;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            {filledCount} of {totalRequired} evidence collected
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
            What an auditor checks
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#5a7d70]">
            Each objective is what the assessor scores. Its evidence is right
            beneath it — fill, replace, or refresh anytime.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ProgressDots filled={filledCount} total={totalRequired} />
          <button
            type="button"
            onClick={onReverify}
            disabled={reverifying}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-50"
          >
            {reverifying ? "Re-grading…" : "Re-grade"}
          </button>
        </div>
      </div>

      {locked && (
        <div className="mb-5 border-l-4 border-[#08201a] bg-[#f4faf6] px-6 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Keep your packet current
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
            This practice is signed and locked as MET — that snapshot is
            preserved for the assessor. Evidence here stays editable: as you
            hire, retire devices, or refresh accounts, upload a new version
            and we&apos;ll review it. Your current packet always reflects
            today.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {spec.objectives.map((o) => {
          const v = verdicts[o.letter] ?? { status: "missing" as const, reason: "" };
          const slots = slotsByObjective[o.letter] ?? [];
          return (
            <div key={o.letter} className="border-l-2 border-[#cfe3d9] pl-5">
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                  Objective {o.letter.toUpperCase()}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${STATUS_COLOR[v.status]}`}
                >
                  {STATUS_LABEL[v.status]}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
                {o.text}
              </p>
              {v.reason && (
                <p className="mt-2 text-[13px] leading-relaxed text-[#5a7d70]">
                  {v.reason}
                </p>
              )}
              {v.status === "partial" && "missing" in v && v.missing && (
                <p className="mt-2 text-[13px] italic leading-relaxed text-amber-700">
                  Missing: {v.missing}
                </p>
              )}

              {slots.length > 0 && (
                <ol className="mt-4 space-y-4">
                  {slots.map((slot) => {
                    slotIndex += 1;
                    return (
                      <SlotRow
                        key={slot.key}
                        index={slotIndex}
                        slot={slot}
                        annotation={slotAnnotations[slot.key]}
                        artifacts={bySlot[slot.key] ?? []}
                        assessmentId={assessmentId}
                        controlId={controlId}
                        connectedProviders={connectedProviders}
                        uploadEvidenceAction={uploadEvidenceAction}
                        reReviewEvidenceAction={reReviewEvidenceAction}
                        deleteEvidenceAction={deleteEvidenceAction}
                        disabled={false}
                      />
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}

        {orphanSlots.length > 0 && (
          <div className="border-l-2 border-[#cfe3d9] pl-5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
              Supporting evidence
            </div>
            <ol className="mt-4 space-y-4">
              {orphanSlots.map((slot) => {
                slotIndex += 1;
                return (
                  <SlotRow
                    key={slot.key}
                    index={slotIndex}
                    slot={slot}
                    annotation={slotAnnotations[slot.key]}
                    artifacts={bySlot[slot.key] ?? []}
                    assessmentId={assessmentId}
                    controlId={controlId}
                    connectedProviders={connectedProviders}
                    uploadEvidenceAction={uploadEvidenceAction}
                    reReviewEvidenceAction={reReviewEvidenceAction}
                    deleteEvidenceAction={deleteEvidenceAction}
                    disabled={false}
                  />
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {unmatched.length > 0 && (
        <div className="mt-8 border-t border-[#cfe3d9] pt-5">
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
            Other artifacts on this practice
          </div>
          <div className="space-y-2">
            {unmatched.map((ev) => (
              <ArtifactCard
                key={ev.id}
                evidence={ev}
                assessmentId={assessmentId}
                controlId={controlId}
                reReviewEvidenceAction={reReviewEvidenceAction}
                deleteEvidenceAction={deleteEvidenceAction}
                disabled={false}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            i < filled ? "bg-[#2f8f6d]" : "bg-[#cfe3d9]"
          }`}
        />
      ))}
    </div>
  );
}

export function SlotRow({
  index,
  slot,
  annotation,
  artifacts,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
  reReviewEvidenceAction,
  deleteEvidenceAction,
  disabled,
}: {
  index: number;
  slot: EvidenceSlot;
  annotation?: SlotAnnotation;
  artifacts: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  const sufficient = artifacts.find((a) => a.ai_review_verdict === "sufficient");
  const status: "filled" | "needs_review" | "empty" = sufficient
    ? "filled"
    : artifacts.length > 0
      ? "needs_review"
      : "empty";

  const statusBadge =
    status === "filled"
      ? { label: "Filled", tone: "bg-[#e8f5ec] text-[#10231d] ring-[#2f8f6d]/40" }
      : status === "needs_review"
        ? { label: "Needs review", tone: "bg-amber-50 text-amber-800 ring-amber-300" }
        : { label: "Empty", tone: "bg-[#fcfdfb] text-[#5a7d70] ring-[#cfe3d9]" };

  // Attestation path: when intake says a roster doesn't apply (e.g. no
  // service accounts touch FCI), the slot collapses into a one-click signed
  // attestation. The button creates an evidence_artifact whose contents are
  // the verbatim auto-narrative; the verifier credits the objective from
  // that artifact like any other piece of evidence.
  const attestation = annotation?.attestation;

  return (
    <li className="border border-[#cfe3d9] bg-white p-6 transition-colors hover:border-[#2f8f6d]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
            Slot {index} ·{" "}
            {slot.required ? "Required" : "Optional"} ·{" "}
            Objective{slot.satisfies.length > 1 ? "s" : ""}{" "}
            {slot.satisfies.map((s) => s.toUpperCase()).join(", ")}
          </div>
          <h3 className="mt-2 font-serif text-xl font-bold tracking-tight text-[#10231d]">
            {slot.label}
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-[#3a544a]">
            {attestation ? attestation.reason : slot.hint}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${statusBadge.tone}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Intake-derived context note: "Based on what you told us…" */}
      {!attestation && annotation?.contextNote && (
        <div className="mt-4 border-l-2 border-[#2f8f6d] bg-[#f7fcf9] px-4 py-3 text-[13px] leading-relaxed text-[#10231d]">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Based on your setup
          </div>
          {annotation.contextNote}
        </div>
      )}

      {/* Filled artifacts for this slot */}
      {artifacts.length > 0 && (
        <div className="mt-4 space-y-2">
          {artifacts.map((ev) => (
            <ArtifactCard
              key={ev.id}
              evidence={ev}
              assessmentId={assessmentId}
              controlId={controlId}
              reReviewEvidenceAction={reReviewEvidenceAction}
              deleteEvidenceAction={deleteEvidenceAction}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Attestation slots — under the single-signature model, the user's
          intake answers ARE the affirmation. The attestation artifact is
          auto-staged server-side on intake save; the final Sign & Affirm
          page is what hashes the packet for SPRS-defensible proof. We
          render a passive callout so the user sees the verbatim narrative
          that will be locked into their bundle. */}
      {attestation && (
        <div className="mt-4 border border-[#cfe3d9] bg-[#f7fcf9] p-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Auto-attested from your intake
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
            Based on what you told us, this objective is satisfied by the
            statement below. It&apos;s already stamped to your evidence vault.
            You&apos;ll sign and hash-lock everything once on the final{" "}
            <span className="font-semibold">Sign &amp; Affirm</span> step —
            that&apos;s what produces your SPRS-defensible packet.
          </p>
          <blockquote className="mt-3 border-l-2 border-[#08201a] bg-white px-4 py-3 font-serif text-[14px] italic leading-relaxed text-[#10231d]">
            “{attestation.autoNarrative}”
          </blockquote>
        </div>
      )}

      {/* Action rail (hidden once locked or when attestation replaces it) */}
      {!disabled && status !== "filled" && !attestation && (
        <SlotActions
          slot={slot}
          recommendedIdx={annotation?.recommendedDestinationIdx}
          assessmentId={assessmentId}
          controlId={controlId}
          connectedProviders={connectedProviders}
          uploadEvidenceAction={uploadEvidenceAction}
        />
      )}

      {/* "Replace" rail when filled — same actions, different label */}
      {!disabled && status === "filled" && !attestation && (
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]">
            Replace this artifact
          </summary>
          <div className="mt-3">
            <SlotActions
              slot={slot}
              recommendedIdx={annotation?.recommendedDestinationIdx}
              assessmentId={assessmentId}
              controlId={controlId}
              connectedProviders={connectedProviders}
              uploadEvidenceAction={uploadEvidenceAction}
            />
          </div>
        </details>
      )}
    </li>
  );
}

/**
 * One-click signed attestation. Submits the verbatim auto-narrative as a
 * .txt evidence artifact through the same uploadEvidenceAction the rest of
 * the slot rail uses, so the artifact lands in the same audit pipeline
 * (AI review, SSP inclusion, lock gate). The user clicking the button is
 * the "signature" — server-side this writes the artifact under their
 * authenticated session.
 */
function AttestationAction({
  slot,
  attestation,
  assessmentId,
  controlId,
  uploadEvidenceAction,
}: {
  slot: EvidenceSlot;
  attestation: NonNullable<SlotAnnotation["attestation"]>;
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const onSign = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Build a .txt file with the verbatim narrative. Filename embeds the
      // slot key so inferSlotKey() can route it back to the right objective.
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `attestation-${slot.key}-${stamp}.txt`;
      const blob = new Blob([attestation.autoNarrative], {
        type: "text/plain",
      });
      const file = new File([blob], filename, { type: "text/plain" });
      const fd = new FormData();
      fd.append("assessmentId", assessmentId);
      fd.append("controlId", controlId);
      fd.append("file", file);
      await uploadEvidenceAction(fd);
      // Let the rest of the page (PracticeChat itself, EvidencePanel,
      // ObjectivesPanel) know an artifact landed.
      window.dispatchEvent(new CustomEvent("evidence-changed"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="mt-4 border border-[#cfe3d9] bg-[#f7fcf9] p-4">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
        Signed attestation
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
        Clicking below signs the following statement with your Custodia
        account, stamps the date, and saves it as evidence:
      </p>
      <blockquote className="mt-3 border-l-2 border-[#08201a] bg-white px-4 py-3 font-serif text-[14px] italic leading-relaxed text-[#10231d]">
        “{attestation.autoNarrative}”
      </blockquote>
      <button
        type="button"
        onClick={onSign}
        disabled={submitting}
        className="mt-3 bg-[#08201a] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf] hover:bg-[#10231d] disabled:opacity-50"
      >
        {submitting ? "Signing…" : attestation.buttonLabel}
      </button>
    </div>
  );
}

function SlotActions({
  slot,
  recommendedIdx,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
}: {
  slot: EvidenceSlot;
  /**
   * Intake-derived hint at which destination the user should pick. Mapped
   * against `slot.destinations` (the full unfiltered list). When the entry
   * at this index lives in `otherDests`, it gets the "Recommended" pill.
   */
  recommendedIdx?: number;
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  // Split destinations into the upload (rendered as the big drop zone — the
  // primary affordance for any slot that accepts a file) and everything else
  // (rendered as small chip-style buttons under "or…").
  const uploadDest = slot.destinations.find((d) => d.type === "upload");
  const recommendedDest =
    typeof recommendedIdx === "number"
      ? slot.destinations[recommendedIdx]
      : undefined;
  const otherDests = slot.destinations.filter((d) => d !== uploadDest);
  return (
    <div className="mt-4 space-y-3">
      {uploadDest && uploadDest.type === "upload" && (
        <SlotDropzone
          slot={slot}
          assessmentId={assessmentId}
          controlId={controlId}
          uploadEvidenceAction={uploadEvidenceAction}
          label={uploadDest.label}
          describes={uploadDest.describes}
          accept={uploadDest.accept}
        />
      )}
      {(otherDests.length > 0 || slot.templatePath) && (
        <div className="flex flex-wrap items-center gap-2">
          {uploadDest && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
              Or
            </span>
          )}
          {otherDests.map((dest, i) => (
            <DestinationButton
              key={`${slot.key}-${dest.type}-${i}`}
              slot={slot}
              dest={dest}
              recommended={
                recommendedDest
                  ? dest === recommendedDest
                  : !uploadDest && i === 0
              }
              assessmentId={assessmentId}
              controlId={controlId}
              connectedProviders={connectedProviders}
              uploadEvidenceAction={uploadEvidenceAction}
            />
          ))}
          {slot.templatePath && (
            <a
              href={slot.templatePath}
              download
              className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline"
            >
              Download template
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Full-bleed drop zone for an evidence slot — drag-and-drop, click-to-browse,
 * AND clipboard paste. Auto-submits the file as soon as it's selected, so
 * the user never has to hunt for an "Upload" button. The slot's `slotKey`
 * is bound to a hidden input so the server action routes the artifact to
 * this exact card on the page. Listens for window `charlie-image-dropped`
 * events tagged with this `slotKey` so the chat-rail paste/drop pathway can
 * fire the same upload pipeline.
 */
function SlotDropzone({
  slot,
  assessmentId,
  controlId,
  uploadEvidenceAction,
  label,
  describes,
  accept,
}: {
  slot: EvidenceSlot;
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  label: string;
  describes: string;
  accept?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We call the server action directly with a fully-populated FormData
  // instead of submitting the <form>. Two reasons:
  //   1. The action returns a Promise, so we can `try/finally` the spinner
  //      state — submitting via requestSubmit() doesn't give us a completion
  //      hook, which is why the dropzone was getting stuck in "Uploading…".
  //   2. We can surface server-side validation errors (MIME deny, rate
  //      limit, 25 MB) inline instead of bubbling them as uncaught Next
  //      action errors.
  const submitWithFile = useCallback(
    async (file: File) => {
      if (file.size > 25 * 1024 * 1024) {
        setError("File is over 25 MB. Try splitting it or compressing.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("assessmentId", assessmentId);
        fd.set("controlId", controlId);
        fd.set("slotKey", slot.key);
        fd.set("file", file);
        await uploadEvidenceAction(fd);
        // Let the rest of the page (PracticeChat itself, EvidencePanel,
        // ObjectivesPanel, progress bar) refresh off the server's new state.
        window.dispatchEvent(new CustomEvent("evidence-changed"));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Upload failed. Please try again.",
        );
      } finally {
        setUploading(false);
      }
    },
    [assessmentId, controlId, slot.key, uploadEvidenceAction],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void submitWithFile(f);
    },
    [submitWithFile],
  );

  // Paste support: when the zone is hovered/focused, intercept clipboard
  // image data and treat it as a drop. This is how a user can grab a
  // screenshot with Win+Shift+S and drop it straight into the slot.
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      if (document.activeElement !== el && !el.matches(":hover")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            void submitWithFile(f);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [submitWithFile]);

  // Cross-component pipe: when the Charlie chat receives a pasted/dropped
  // image and the user picks this slot, the slot picker dispatches a
  // `charlie-image-dropped` event with our slot key. Treat it as a direct
  // file submission so the same auto-review + revalidate path runs.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ slotKey: string; file: File }>).detail;
      if (!detail || detail.slotKey !== slot.key) return;
      void submitWithFile(detail.file);
    };
    window.addEventListener("charlie-image-dropped", handler);
    return () => window.removeEventListener("charlie-image-dropped", handler);
  }, [slot.key, submitWithFile]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept?.join(",")}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void submitWithFile(f);
          // Clear so picking the same filename twice still fires onChange.
          e.target.value = "";
        }}
      />
      <div
        ref={zoneRef}
        title={describes}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center border-2 border-dashed px-6 py-8 text-center transition-colors ${
          uploading
            ? "cursor-progress border-[#2f8f6d] bg-[#eaf3ee]"
            : dragActive
              ? "border-[#2f8f6d] bg-[#eaf3ee]"
              : "border-[#cfe3d9] bg-[#f7fcf9] hover:border-[#2f8f6d] hover:bg-[#f4faf6]"
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center bg-[#08201a] text-[#bdf2cf]">
          {uploading ? (
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="10" cy="10" r="7" opacity="0.25" />
              <path d="M17 10a7 7 0 0 1-7 7" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M10 3a1 1 0 01.7.29l4 4a1 1 0 11-1.4 1.42L11 6.41V13a1 1 0 11-2 0V6.41L6.7 8.71A1 1 0 015.29 7.3l4-4A1 1 0 0110 3zM4 14a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
            </svg>
          )}
        </span>
        <div className="mt-3 font-serif text-base font-bold text-[#10231d]">
          {uploading
            ? "Uploading…"
            : dragActive
              ? "Drop to attach"
              : label}
        </div>
        <div className="mt-1 text-[12px] text-[#5a7d70]">
          Drag a screenshot here, paste from clipboard, or click to browse.
          25&nbsp;MB max.
        </div>
      </div>
      {error && (
        <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * In-page picker shown when the user pastes or drops an image into the
 * Charlie chat rail. Renders the image thumbnail above a list of every
 * evidence slot for this practice (required first, then optional), letting
 * the user route the screenshot to the right slot in one click. The
 * resulting `charlie-image-dropped` event triggers the slot's own upload
 * pipeline, so a single server action handles both pathways.
 */
function ChatImageSlotPicker({
  file,
  previewUrl,
  spec,
  evidence,
  onPick,
  onCancel,
}: {
  file: File;
  previewUrl: string;
  spec: ClientPracticeSpec;
  evidence: ClientEvidenceRow[];
  onPick: (slotKey: string) => void;
  onCancel: () => void;
}) {
  // Slots already covered by a `sufficient` artifact go to the bottom — the
  // user can still pick them (replacement) but we don't want them stealing
  // attention from genuinely-empty required slots.
  const slotsWithStatus = spec.evidenceSlots.map((s) => {
    const filled = evidence.some(
      (ev) =>
        ev.ai_review_verdict === "sufficient" &&
        inferSlotKey(ev.filename, spec) === s.key,
    );
    return { slot: s, filled };
  });
  const ordered = [
    ...slotsWithStatus.filter((x) => x.slot.required && !x.filled),
    ...slotsWithStatus.filter((x) => !x.slot.required && !x.filled),
    ...slotsWithStatus.filter((x) => x.filled),
  ];
  const sizeKb = Math.round(file.size / 1024);
  return (
    <section className="border border-[#2f8f6d]/40 bg-[#f7fcf9] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            From Charlie · screenshot ready
          </p>
          <h3 className="mt-1 font-serif text-lg font-bold text-[#10231d]">
            Which slot does this satisfy?
          </h3>
          <p className="mt-1 text-[13px] text-[#3a544a]">
            Pick a slot below and we&apos;ll save the screenshot, run an AI
            vision review, and ask Charlie to confirm it matches the
            assessor expectation.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]"
        >
          Discard
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="border border-[#cfe3d9] bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Pasted screenshot preview"
            className="block h-auto w-full"
          />
          <p className="mt-2 truncate font-mono text-[10px] text-[#5a7d70]">
            {file.name || "clipboard.png"} · {sizeKb}&nbsp;KB
          </p>
        </div>
        <ul className="space-y-2">
          {ordered.map(({ slot, filled }) => (
            <li key={slot.key}>
              <button
                type="button"
                onClick={() => onPick(slot.key)}
                className="group flex w-full items-start gap-3 border border-[#cfe3d9] bg-white px-4 py-3 text-left transition-colors hover:border-[#2f8f6d] hover:bg-[#f4faf6]"
              >
                <span
                  className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] ring-1 ${
                    filled
                      ? "bg-[#f4faf6] text-[#2f8f6d] ring-[#2f8f6d]/40"
                      : slot.required
                        ? "bg-[#fcfdfb] text-[#10231d] ring-[#cfe3d9]"
                        : "bg-[#fcfdfb] text-[#5a7d70] ring-[#cfe3d9]"
                  }`}
                >
                  {filled
                    ? "Replace"
                    : slot.required
                      ? "Required"
                      : "Optional"}
                </span>
                <span className="flex-1">
                  <span className="block font-serif text-[15px] font-bold text-[#10231d] group-hover:text-[#0e2a23]">
                    {slot.label}
                  </span>
                  <span className="block text-[12px] text-[#5a7d70]">
                    {slot.hint}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d] opacity-0 group-hover:opacity-100"
                >
                  Save →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DestinationButton({
  slot,
  dest,
  recommended,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
}: {
  slot: EvidenceSlot;
  dest: EvidenceDestination;
  recommended: boolean;
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const baseClasses = recommended
    ? "bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf] hover:bg-[#0c2a22]"
    : "border border-[#cfe3d9] bg-white px-4 py-2 text-[12px] font-semibold text-[#10231d] hover:border-[#2f8f6d]";

  if (dest.type === "generate") {
    return (
      <InlineDraftButton
        slot={slot}
        label={dest.label}
        filename={dest.filename}
        format={dest.format}
        recommended={recommended}
      />
    );
  }

  if (dest.type === "connect") {
    // Render one button per provider the slot can be satisfied from. A slot
    // that lists both ["m365", "google_workspace"] gets a "Pull from
    // Microsoft 365" button AND a "Pull from Google Workspace" button — each
    // kicks the right OAuth flow. A "Connected" pill takes the place of any
    // provider the org has already linked.
    const providerMeta: Record<
      ConnectorProvider,
      { label: string; slug: string }
    > = {
      m365: { label: "Microsoft 365", slug: "m365" },
      google_workspace: { label: "Google Workspace", slug: "google" },
    };
    return (
      <>
        {dest.providers.map((p) => {
          const meta = providerMeta[p];
          if (!meta) return null;
          if (connectedProviders.includes(p)) {
            return (
              <span
                key={`${slot.key}-connect-${p}`}
                title={dest.describes}
                className="border border-[#2f8f6d] bg-[#f4faf6] px-4 py-2 text-[12px] font-semibold text-[#2f8f6d]"
              >
                {meta.label} connected — auto-collect coming online
              </span>
            );
          }
          return (
            <a
              key={`${slot.key}-connect-${p}`}
              href={`/api/connectors/${meta.slug}/start`}
              title={dest.describes}
              className={baseClasses}
            >
              Pull from {meta.label} →
            </a>
          );
        })}
      </>
    );
  }

  // dest.type === "upload"
  return (
    <SlotUploadButton
      slot={slot}
      assessmentId={assessmentId}
      controlId={controlId}
      uploadEvidenceAction={uploadEvidenceAction}
      label={dest.label}
      describes={dest.describes}
      accept={dest.accept}
      recommended={recommended}
    />
  );
}

function SlotUploadButton({
  slot,
  assessmentId,
  controlId,
  uploadEvidenceAction,
  label,
  describes,
  accept,
  recommended,
}: {
  slot: EvidenceSlot;
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  label: string;
  describes: string;
  accept?: string[];
  recommended: boolean;
}) {
  const baseClasses = recommended
    ? "inline-flex cursor-pointer items-center bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf] hover:bg-[#0c2a22]"
    : "inline-flex cursor-pointer items-center border border-[#cfe3d9] bg-white px-4 py-2 text-[12px] font-semibold text-[#10231d] hover:border-[#2f8f6d]";

  return (
    <form
      action={uploadEvidenceAction}
      title={describes}
      className="inline"
    >
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="controlId" value={controlId} />
      <input type="hidden" name="slotKey" value={slot.key} />
      <label className={baseClasses}>
        {label}
        <input
          type="file"
          name="file"
          className="hidden"
          accept={accept?.join(",")}
          onChange={(e) => {
            if (e.currentTarget.files?.length) {
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </label>
    </form>
  );
}

/**
 * One-tap "have Charlie draft this for me" entry-point for a slot's
 * `generate` destination. The auto-draft path (compose entirely from intake)
 * tended to fill the artifact with `[FILL IN: ...]` placeholders because
 * intake doesn't know slot-specific facts (antivirus account name, printer
 * model, etc). So this button takes the hybrid route:
 *
 *   1. Click → fires a slot-focused directive into the chat rail telling
 *      Charlie to ask the user 1-3 short, plain-English questions to get
 *      the facts needed for THIS slot, then call generate_evidence_artifact
 *      to drop the finished artifact into the slot.
 *   2. Button enters a "Charlie is gathering details…" waiting state with
 *      an arrow pointing the user toward the chat rail.
 *   3. When the artifact actually lands in the vault (the
 *      `evidence-changed` window event fires), the button exits waiting,
 *      refreshes the route, and fires `custodia:slot-drafted` so the host
 *      page can scroll the user to the next empty slot.
 *
 * If the user clicks the button but then ignores Charlie's question, the
 * button stays in waiting mode until they reload or another evidence
 * upload fires the event — that's intentional, it nudges them back into
 * the chat.
 */
function InlineDraftButton({
  slot,
  label,
  filename,
  format,
  recommended,
}: {
  slot: EvidenceSlot;
  label: string;
  filename: string;
  format: "csv" | "markdown" | "text";
  recommended: boolean;
}) {
  const [waiting, setWaiting] = useState(false);
  const router = useRouter();

  const baseClasses = recommended
    ? "bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf] hover:bg-[#0c2a22]"
    : "border border-[#cfe3d9] bg-white px-4 py-2 text-[12px] font-semibold text-[#10231d] hover:border-[#2f8f6d]";

  const waitingClasses = recommended
    ? "relative overflow-hidden bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf]"
    : "relative overflow-hidden border border-[#2f8f6d] bg-[#eaf3ee] px-4 py-2 text-[12px] font-semibold text-[#10231d]";

  // While we're waiting on Charlie to finish drafting via chat, listen
  // for the evidence-changed event the practice page already fires on
  // every artifact insert. When it fires we assume Charlie just dropped
  // the artifact into this slot — exit waiting, refresh server props so
  // the slot card re-renders with the new artifact, and tell the host
  // page to scroll to the next empty slot.
  useEffect(() => {
    if (!waiting) return;
    // Belt-and-suspenders against the model calling `navigate_user_to`
    // mid-draft (the SSE handler in the rail does `router.push(path)` on
    // every `navigate` event — that was bouncing the user to the next
    // control page when they clicked here). Setting this flag tells the
    // rail to ignore navigate events for the duration of the draft.
    try {
      window.sessionStorage.setItem("custodia.slot-drafting", slot.key);
    } catch {
      /* non-fatal */
    }
    const handler = () => {
      setWaiting(false);
      try {
        window.sessionStorage.removeItem("custodia.slot-drafting");
      } catch {
        /* non-fatal */
      }
      router.refresh();
      window.dispatchEvent(
        new CustomEvent("custodia:slot-drafted", {
          detail: { slotKey: slot.key },
        }),
      );
    };
    window.addEventListener("evidence-changed", handler);
    return () => {
      window.removeEventListener("evidence-changed", handler);
      try {
        window.sessionStorage.removeItem("custodia.slot-drafting");
      } catch {
        /* non-fatal */
      }
    };
  }, [waiting, slot.key, router]);

  const onClick = () => {
    setWaiting(true);
    // Slot-focused directive. Plain-English required, ban jargon, ONE
    // question at a time, then call generate_evidence_artifact when
    // there's enough info. The slot_key + filename + format are passed
    // verbatim so Charlie can't fumble the arguments.
    //
    // Critical: explicitly forbid `navigate_user_to`. The chat tool loop
    // will happily call it (especially when this practice already looks
    // "mostly done") and the rail's SSE handler does `router.push(path)`
    // — that's how a click here was bouncing the user to the next
    // control page. Pin Charlie to this practice until the artifact is
    // generated.
    const message =
      `**SLOT-DRAFT REQUEST — override any prior context.** ` +
      `I just clicked the "${label}" button on the EMPTY \`${slot.key}\` slot card for this practice. ` +
      `The slot is currently empty — ignore anything the prior chat history says about this slot being filled, drafted, or done. The reset button wiped it. ` +
      `Your job RIGHT NOW: draft the **${slot.label}** as a fresh artifact. ` +
      `What it's for: ${slot.hint} ` +
      `\n\n**Behavior rules (these override the general system prompt for this turn):**\n` +
      `1. DO NOT call \`navigate_user_to\` — I am staying on this page.\n` +
      `2. DO NOT call \`interview_for_control_narrative\` — this is a slot-draft, not the SSP narrative interview.\n` +
      `3. DO NOT recap "what's left", "outstanding objectives", "want to continue the interview", "tackle the enforcement proof", or any other slot. Pretend you have never seen this practice before.\n` +
      `4. DO NOT ask a multiple-choice question or offer menus ("a/b/c", "option 1/2/3"). Just ask one short plain-English question at a time.\n` +
      `5. Ban these words from your replies: FCI, NIST, baseline, attestation, objective, satisfies, AC.L1, 800-171.\n` +
      `\n**What to do:**\n` +
      `Ask me ONE short plain-English question to learn the facts you need for the ${slot.label}. After my answer, ask the next one. Three or four short questions total, max. ` +
      `Then call \`generate_evidence_artifact\` with slot_key="${slot.key}", filename="${filename}", format="${format}", using ONLY my real answers (no "[FILL IN]" placeholders — if a field doesn't apply to my setup, leave it out entirely). ` +
      `After the tool returns, give me a one-sentence "I dropped it in your evidence" summary and stop. ` +
      `\n\n**Start now with your first question.**`;
    window.dispatchEvent(
      new CustomEvent("charlie-send-message", { detail: { message } }),
    );
  };

  if (waiting) {
    return (
      <span
        className={waitingClasses}
        aria-live="polite"
        aria-busy="true"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 animate-spin border-2 border-current border-r-transparent rounded-full"
            aria-hidden="true"
          />
          Answer Charlie in the chat →
        </span>
        <span
          className="absolute inset-0 -z-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={baseClasses}
    >
      {label}
    </button>
  );
}

function ArtifactCard({
  evidence,
  assessmentId,
  controlId,
  reReviewEvidenceAction,
  deleteEvidenceAction,
  disabled,
}: {
  evidence: ClientEvidenceRow;
  assessmentId: string;
  controlId: string;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  const verdict = evidence.ai_review_verdict;
  const reviewing = verdict === null || verdict === undefined;
  const verdictTone = reviewing
    ? "text-[#08201a] bg-[#eaf3ee] ring-[#2f8f6d]/40"
    : verdict === "sufficient"
      ? "text-[#10231d] bg-[#e8f5ec] ring-[#2f8f6d]/40"
      : verdict === "insufficient"
        ? "text-rose-800 bg-rose-50 ring-rose-300"
        : verdict === "not_relevant"
          ? "text-rose-800 bg-rose-50 ring-rose-300"
          : "text-[#5a7d70] bg-[#fcfdfb] ring-[#cfe3d9]";
  const generatedByCharlie = evidence.ai_review_model === "charlie-generated";
  // Strip the [slot:KEY]__ prefix from the displayed filename if present.
  const displayName = evidence.filename.replace(/^\[slot:[a-z0-9_]+\]__/i, "");
  // Local pending state for the delete server action so the row dims and the
  // button shows a spinner while the request is in flight. Used <form
  // action={fn}> from React DOM would not give us a Promise to await, so we
  // call the action directly.
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  return (
    <div
      className={`border border-[#cfe3d9] bg-[#fcfdfb] px-4 py-3 text-[13px] transition-opacity ${
        deleting ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/evidence/${evidence.id}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-semibold text-[#10231d] underline-offset-4 hover:underline"
        >
          {displayName}
        </a>
        <div className="flex shrink-0 items-center gap-1.5">
          {generatedByCharlie && (
            <span className="rounded-full bg-[#08201a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
              Charlie
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${verdictTone}`}
          >
            {reviewing && (
              <svg
                viewBox="0 0 20 20"
                className="h-2.5 w-2.5 animate-spin"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden
              >
                <circle cx="10" cy="10" r="7" opacity="0.25" />
                <path d="M17 10a7 7 0 0 1-7 7" strokeLinecap="round" />
              </svg>
            )}
            {reviewing ? "Reviewing" : verdict}
          </span>
        </div>
      </div>
      {evidence.ai_review_summary && (
        <p className="mt-2 leading-relaxed text-[#3a544a]">
          {evidence.ai_review_summary}
        </p>
      )}
      {reviewing && !generatedByCharlie && !evidence.ai_review_summary && (
        <p className="mt-2 text-[12px] italic leading-relaxed text-[#5a7d70]">
          Charlie is comparing this against the assessor expectation — about a
          minute. The verdict will land here automatically.
        </p>
      )}
      {generatedByCharlie && (
        <p className="mt-2 text-[12px] italic leading-relaxed text-[#5a7d70]">
          Charlie drafted this from your conversation. Open it, check the
          details are correct, and replace any time.
        </p>
      )}
      {!disabled && (
        <div className="mt-2 flex items-center gap-4">
          {verdict && !generatedByCharlie && (
            <form action={reReviewEvidenceAction}>
              <input type="hidden" name="artifactId" value={evidence.id} />
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <input type="hidden" name="controlId" value={controlId} />
              <button
                type="submit"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline"
              >
                Re-review
              </button>
            </form>
          )}
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete "${displayName}"? This removes the file and its AI review — you can re-upload anytime.`,
                )
              )
                return;
              setDeleting(true);
              setDeleteError(null);
              try {
                const fd = new FormData();
                fd.set("assessmentId", assessmentId);
                fd.set("controlId", controlId);
                fd.set("artifactId", evidence.id);
                await deleteEvidenceAction(fd);
                window.dispatchEvent(new CustomEvent("evidence-changed"));
              } catch (e) {
                setDeleteError(
                  e instanceof Error ? e.message : "Could not delete.",
                );
                setDeleting(false);
              }
            }}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700 underline-offset-4 hover:text-rose-900 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          {deleteError && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700">
              {deleteError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact summary card rendered above the objectives/evidence panels once
 * the user has completed the per-practice intake. Shows the situation
 * summary built from their answers plus an "Edit answers" link that wipes
 * `intake_answers` and `intake_completed_at` server-side so the user can
 * retake the intake. Disabled once the practice is locked — at that point
 * the intake answers are part of the signed audit trail.
 */
function YourSituationCard({
  summary,
  completedAt,
  onEdit,
  resetting,
  locked,
}: {
  summary: string;
  completedAt: string | null;
  onEdit: () => void;
  resetting: boolean;
  locked: boolean;
}) {
  const when = completedAt
    ? new Date(completedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <section className="border border-[#cfe3d9] bg-[#f7fcf9] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Your situation{when ? ` · captured ${when}` : ""}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
            {summary}
          </p>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={onEdit}
            disabled={resetting}
            className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
          >
            {resetting ? "Resetting…" : "Edit answers"}
          </button>
        )}
      </div>
    </section>
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
      <section className="border-2 border-[#08201a] bg-[#08201a] p-6 md:p-8">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          Practice locked · MET
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-[#a8cfc0]">
          The chat transcript and the signed narrative are a frozen snapshot
          — the assessor reads this end-to-end as proof of how each objective
          was satisfied. Evidence above stays a living document: refresh your
          rosters, devices, and accounts whenever the business changes, and
          your current packet stays accurate.
        </p>
      </section>
    );
  }
  return (
    <section
      className={`border-2 p-6 md:p-8 ${
        allCovered
          ? "border-[#2f8f6d] bg-[#f4faf6]"
          : "border-[#cfe3d9] bg-[#fcfdfb]"
      }`}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
        {allCovered ? "Ready to sign" : "Not ready yet"}
      </div>
      <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
        {allCovered
          ? "Lock this practice as MET"
          : "Locked until every objective is covered"}
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#3a544a]">
        {allCovered
          ? "Charlie has confirmed every assessment objective. Lock the snapshot so the transcript and narrative are preserved for your assessor."
          : "Keep chatting with Charlie on the right. The lock unlocks the moment every objective is covered and every required artifact is attached."}
      </p>
      <button
        type="button"
        onClick={onLock}
        disabled={!allCovered}
        className={`mt-5 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.22em] ${
          allCovered
            ? "bg-[#08201a] text-[#bdf2cf] hover:bg-[#0c2a22]"
            : "cursor-not-allowed bg-[#cfe3d9] text-white"
        }`}
      >
        {allCovered ? "Lock as MET" : "Locked"}
      </button>
      {lockError && (
        <p className="mt-3 text-[13px] text-rose-700">{lockError}</p>
      )}
    </section>
  );
}

function NavRow({
  assessmentId,
  prevId,
  nextId,
  gateOnComplete,
  canAdvance,
}: {
  assessmentId: string;
  prevId: string | null;
  nextId: string | null;
  /** When true, the "Next practice" link is gated behind canAdvance.
   *  When false, behaves like the legacy unconditional next link. */
  gateOnComplete: boolean;
  /** Only consulted when gateOnComplete is true. */
  canAdvance: boolean;
}) {
  const showLockedNext = gateOnComplete && !canAdvance;
  return (
    <div className="mt-10 flex items-center justify-between border-t border-[#cfe3d9] pt-6">
      {prevId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${prevId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]"
        >
          ← Previous practice
        </Link>
      ) : (
        <span />
      )}
      {nextId ? (
        showLockedNext ? (
          <div className="text-right">
            <span
              aria-disabled
              className="cursor-not-allowed font-serif text-lg font-bold tracking-tight text-[#a8cfc0]"
              title="Reach 100% (every objective covered) to unlock the next practice"
            >
              Next practice →
            </span>
            <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#8b1f1f]">
              Locked · finish this practice (100%) first
            </div>
          </div>
        ) : (
          <Link
            href={`/assessments/${assessmentId}/controls/${nextId}`}
            className="font-serif text-lg font-bold tracking-tight text-[#10231d] underline-offset-4 hover:text-[#2f8f6d] hover:underline"
          >
            Next practice →
          </Link>
        )
      ) : (
        <span />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// AnsweredQuestionsCard — post-intake editable summary of every quiz
// question + the user's selected answer. Lives between YourSituationCard
// and the ObjectiveEvidencePanel on practices that have been upgraded to
// the prod-grade summary flow (AC.L1-3.1.1 first, others to follow).
//
// Each row is read-only by default. Clicking "Change" reveals the option
// list inline; picking a new option fires `saveIntakeStepAction` and then
// calls `onAnswerSaved`, which the parent uses to update local state and
// trigger a router.refresh() so personalized situation summary + slot
// annotations re-derive from the new answer.
// ────────────────────────────────────────────────────────────────────────
function AnsweredQuestionsCard({
  assessmentId,
  controlId,
  intake,
  answers,
  locked,
  onAnswerSaved,
}: {
  assessmentId: string;
  controlId: string;
  intake: ClientPracticeIntakeSpec;
  answers: IntakeAnswers;
  locked: boolean;
  onAnswerSaved: (questionId: string, value: string) => void;
}) {
  const [editingQid, setEditingQid] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPick = (questionId: string, value: string) => {
    setError(null);
    startSaving(async () => {
      const res = await saveIntakeStepAction({
        assessmentId,
        controlId,
        questionId,
        value,
      });
      if (!res.ok) {
        setError(res.reason ?? "Could not save your change.");
        return;
      }
      setEditingQid(null);
      onAnswerSaved(questionId, value);
    });
  };

  return (
    <section className="border border-[#cfe3d9] bg-white">
      <header className="border-b border-[#cfe3d9] bg-[#f4faf6] px-6 py-4">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Your answers · {intake.questions.length} questions
        </div>
        <h3 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
          Quiz summary
        </h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#5a7d70]">
          Every question you answered, with the exact words you picked. Edit
          any answer to re-personalize the evidence path below — your saved
          evidence stays put. Use “Reset this practice” at the top to wipe
          everything and start over.
        </p>
      </header>
      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-[13px] text-rose-800">
          {error}
        </div>
      )}
      <ol className="divide-y divide-[#e3eee9]">
        {intake.questions.map((q, idx) => {
          const value = answers[q.id];
          const chosen = q.options.find((o) => o.value === value);
          const isEditing = editingQid === q.id;
          return (
            <li key={q.id} className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                    Question {idx + 1} of {intake.questions.length} · Objective{" "}
                    {q.objectives.map((o) => o.toUpperCase()).join(", ")}
                  </div>
                  <div className="mt-1 font-serif text-[16px] font-semibold text-[#10231d]">
                    {q.prompt}
                  </div>
                  <div className="mt-2 text-[14px] leading-relaxed text-[#3a544a]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                      Your answer →
                    </span>{" "}
                    <span className="font-semibold text-[#10231d]">
                      {chosen?.label ?? "(not answered)"}
                    </span>
                    {chosen?.description && (
                      <div className="mt-1 text-[13px] text-[#5a7d70]">
                        {chosen.description}
                      </div>
                    )}
                  </div>
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingQid((cur) => (cur === q.id ? null : q.id))
                    }
                    disabled={saving}
                    className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
                  >
                    {isEditing ? "Cancel" : "Change"}
                  </button>
                )}
              </div>
              {isEditing && !locked && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const selected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onPick(q.id, opt.value)}
                        disabled={saving}
                        className={`block w-full border bg-white px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-[#2f8f6d] bg-[#f4faf6] ring-1 ring-[#2f8f6d]"
                            : "border-[#cfe3d9] hover:border-[#2f8f6d]"
                        } disabled:opacity-50`}
                      >
                        <div className="font-serif text-[15px] font-semibold text-[#10231d]">
                          {opt.label}
                        </div>
                        {opt.description && (
                          <div className="mt-1 text-[12px] leading-relaxed text-[#5a7d70]">
                            {opt.description}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
