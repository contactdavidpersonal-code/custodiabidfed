"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientPracticeIntakeSpec,
  ClientPracticeSpec,
  EvidenceSlot,
  IntakeAnswers,
} from "@/lib/cmmc/practice-spec";
import { inferSlotKey } from "@/lib/cmmc/practice-spec";
import type { ConnectorProvider } from "@/lib/connectors/types";
import {
  saveIntakeAction,
  saveIntakeStepAction,
} from "./practice-chat-actions";
import { SlotRow, type ClientEvidenceRow } from "./PracticeChat";

/**
 * GuidedPracticeQuiz — the new "quiz IS the practice" flow. Replaces the
 * old two-stage flow (intake-then-evidence) with a single integrated walk
 * where each question is followed inline by the evidence slots that the
 * question's objectives drive. User picks an answer → drops evidence right
 * there (Charlie, upload, connect, or auto-attest) → moves to the next
 * question. Charlie stays on the right rail (rendered by the page shell)
 * and can be invoked per-slot via a one-click button that dispatches a
 * `charlie-send-message` event with a slot-specific directive.
 *
 * Key design rules:
 *   - Single source of truth for slot UI: we reuse `SlotRow` from
 *     PracticeChat so the affordances (recommended destination, upload,
 *     connect, replace, attestation callout) are identical to the
 *     post-finish view. Zero duplicated rendering logic.
 *   - Incremental save: each answer fires `saveIntakeStepAction` so a
 *     page refresh restores quiz position. No completion stamp, no
 *     Charlie kickoff during the walk.
 *   - Slots are assigned to the FIRST question whose `objectives` overlaps
 *     with their `satisfies` letters. Slots with no objective overlap (or
 *     "leftover" slots) appear under the last question as a catch-all.
 *   - Final "Finish" button fires the full `saveIntakeAction` which stamps
 *     completion, auto-stages attestations, and wakes Charlie. After that
 *     the page rerenders into the standard post-intake layout.
 *   - This flow only runs when a practice has an intake spec AND the user
 *     hasn't completed it yet. Locked practices and no-intake practices
 *     bypass entirely.
 */
export function GuidedPracticeQuiz(props: {
  assessmentId: string;
  controlId: string;
  spec: ClientPracticeSpec;
  intake: ClientPracticeIntakeSpec;
  initialAnswers?: IntakeAnswers;
  evidence: ClientEvidenceRow[];
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(() => {
    // Resume on the first unanswered question, or step 0 if fresh.
    const firstUnansweredIdx = props.intake.questions.findIndex(
      (q) => !props.initialAnswers?.[q.id],
    );
    return firstUnansweredIdx === -1 ? 0 : firstUnansweredIdx;
  });
  const [answers, setAnswers] = useState<IntakeAnswers>(
    props.initialAnswers ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [savingStep, startSaveStep] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [showWhy, setShowWhy] = useState(false);

  const questions = props.intake.questions;
  const totalSteps = questions.length;
  const currentQ = questions[stepIdx];

  // Assign each evidence slot to a single question (the first one whose
  // objective letters overlap with the slot's `satisfies`). Slots that
  // don't overlap any question land under the last question as a
  // catch-all so they still get filled before "Finish" makes sense.
  const slotsByQuestionIdx = useMemo(() => {
    const buckets: EvidenceSlot[][] = questions.map(() => []);
    const seen = new Set<string>();
    for (const slot of props.spec.evidenceSlots) {
      const ownerIdx = questions.findIndex((q) =>
        q.objectives.some((o) => slot.satisfies.includes(o)),
      );
      const targetIdx = ownerIdx === -1 ? totalSteps - 1 : ownerIdx;
      if (seen.has(slot.key)) continue;
      seen.add(slot.key);
      buckets[targetIdx].push(slot);
    }
    return buckets;
  }, [questions, props.spec.evidenceSlots, totalSteps]);

  // Bucket current evidence by slot key so SlotRow can show what's already
  // collected for each slot in the current question's section.
  const evidenceBySlot = useMemo(() => {
    const map: Record<string, ClientEvidenceRow[]> = {};
    for (const ev of props.evidence) {
      const key = inferSlotKey(ev.filename, props.spec);
      if (key) (map[key] ??= []).push(ev);
    }
    return map;
  }, [props.evidence, props.spec]);

  const currentSlots = slotsByQuestionIdx[stepIdx] ?? [];
  const currentValue = answers[currentQ.id];
  const isLast = stepIdx === totalSteps - 1;
  const allAnswered = questions.every((q) => Boolean(answers[q.id]));

  const onSelect = (value: string) => {
    setError(null);
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));
    // Persist incrementally so a refresh doesn't drop the walk.
    startSaveStep(async () => {
      const res = await saveIntakeStepAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
        questionId: currentQ.id,
        value,
      });
      if (!res.ok) {
        setError(res.reason ?? "Could not save your answer. Try again.");
      }
    });
  };

  const onNext = () => {
    setError(null);
    setShowWhy(false);
    setStepIdx((s) => Math.min(s + 1, totalSteps - 1));
  };

  const onBack = () => {
    setError(null);
    setShowWhy(false);
    setStepIdx((s) => Math.max(0, s - 1));
  };

  const onFinish = () => {
    // Final validation: every question needs an answer before we stamp
    // completion. (Slots don't need to be filled — the user can still
    // come back to empty ones after, and attestation-eligible ones will
    // be auto-stamped server-side here.)
    for (const q of questions) {
      if (!answers[q.id]) {
        const missingIdx = questions.findIndex((qq) => !answers[qq.id]);
        setStepIdx(missingIdx);
        setError(`Please answer "${q.prompt}" before finishing.`);
        return;
      }
    }
    startFinish(async () => {
      const res = await saveIntakeAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
        answers,
      });
      if (!res.ok) {
        setError(res.reason ?? "Could not finish. Try again.");
        return;
      }
      // Wake Charlie up with a directive to walk any remaining empty slots.
      const directive = [
        `[INTAKE COMPLETE — ${props.controlId}]`,
        ``,
        `The user just finished the guided quiz for ${props.controlId} (${props.spec.shortName}). Their captured environment:`,
        res.situationSummary ?? "(see system prompt for intake summary)",
        ``,
        `Open with one sentence mirroring what you heard, then for each STILL-EMPTY required evidence slot (skip filled ones): name it, say what objective it covers and what an assessor wants in one line, and recommend the specific path — generate-with-me (offer to draft via generate_evidence_artifact), connect a tool, upload (state exactly what to upload — filename, columns, screenshot details), or sign an attestation. Drive ONE slot at a time. NEVER mark the practice MET.`,
      ].join("\n");
      window.dispatchEvent(
        new CustomEvent("charlie-send-message", {
          detail: { message: directive },
        }),
      );
      router.refresh();
    });
  };

  return (
    <section className="mx-auto max-w-3xl">
      {/* Lead */}
      <div className="mb-8 border-b border-[#cfe3d9] pb-6">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Guided walkthrough · {totalSteps} questions
        </div>
        <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d]">
          Let&apos;s do {props.spec.shortName.toLowerCase()} together
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#3a544a]">
          {props.intake.preamble}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
          Answer one question, then drop the evidence for it right below —
          generate it with Charlie, connect a tool, upload, or sign an
          attestation. Charlie is on the right if you get stuck.
        </p>
      </div>

      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-2">
        {questions.map((q, i) => {
          const answered = Boolean(answers[q.id]);
          const isCurrent = i === stepIdx;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setError(null);
                setShowWhy(false);
                setStepIdx(i);
              }}
              className={`h-2 flex-1 rounded-full transition-colors ${
                isCurrent
                  ? "bg-[#08201a]"
                  : answered
                    ? "bg-[#2f8f6d]"
                    : "bg-[#cfe3d9]"
              }`}
              aria-label={`Go to question ${i + 1}`}
            />
          );
        })}
      </div>

      {/* Current question header */}
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
        Question {stepIdx + 1} of {totalSteps} · Objective{" "}
        {currentQ.objectives.map((o) => o.toUpperCase()).join(", ")}
      </div>
      <h3 className="font-serif text-2xl font-bold leading-tight tracking-tight text-[#10231d]">
        {currentQ.prompt}
      </h3>
      {currentQ.helpText && (
        <p className="mt-3 text-[14px] leading-relaxed text-[#5a7d70]">
          {currentQ.helpText}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowWhy((s) => !s)}
        className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d] hover:text-[#10231d]"
        aria-expanded={showWhy}
      >
        {showWhy ? "Hide" : "Why we ask"} ·{" "}
        <span className="font-mono normal-case tracking-normal text-[11px] font-medium text-[#5a7d70]">
          {currentQ.regAnchor}
        </span>
      </button>
      {showWhy && (
        <blockquote className="mt-3 border-l-2 border-[#2f8f6d] bg-[#f7fcf9] px-4 py-3 font-serif text-[14px] italic leading-relaxed text-[#10231d]">
          &ldquo;{currentQ.regQuote}&rdquo;
          <div className="mt-2 font-mono text-[10px] font-bold uppercase not-italic tracking-[0.22em] text-[#5a7d70]">
            — {currentQ.regAnchor}
          </div>
        </blockquote>
      )}

      {/* Answer chips */}
      <div className="mt-6 space-y-2">
        {currentQ.options.map((opt) => {
          const selected = currentValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              disabled={savingStep}
              className={`block w-full border bg-white px-5 py-4 text-left transition-colors ${
                selected
                  ? "border-[#2f8f6d] bg-[#f4faf6] ring-1 ring-[#2f8f6d]"
                  : "border-[#cfe3d9] hover:border-[#2f8f6d]"
              } disabled:opacity-50`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-serif text-[16px] font-semibold text-[#10231d]">
                    {opt.label}
                  </div>
                  {opt.description && (
                    <div className="mt-1 text-[13px] leading-relaxed text-[#5a7d70]">
                      {opt.description}
                    </div>
                  )}
                </div>
                {selected && (
                  <span
                    className="mt-0.5 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]"
                    aria-hidden
                  >
                    ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 border border-rose-300 bg-rose-50 px-4 py-3 text-[14px] text-rose-800">
          {error}
        </div>
      )}

      {/* Inline evidence section — only appears once the user has picked an
          answer for this question. Each slot renders the same full
          SlotRow used post-intake so they see every destination (Charlie
          generate, connect, upload, replace) right here. */}
      {currentValue && currentSlots.length > 0 && (
        <div className="mt-10 border-t border-[#cfe3d9] pt-8">
          <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Now drop the evidence for this
          </div>
          <h4 className="font-serif text-xl font-bold tracking-tight text-[#10231d]">
            Evidence tied to this answer
          </h4>
          <p className="mt-2 text-[13px] leading-relaxed text-[#5a7d70]">
            Each card is one artifact an assessor would ask for. Use Charlie
            (right rail), connect a tool, or upload — or ask Charlie to draft
            it from here.
          </p>
          <ol className="mt-5 space-y-4">
            {currentSlots.map((slot, idx) => (
              <li key={slot.key}>
                <SlotRow
                  index={idx + 1}
                  slot={slot}
                  // Personalization annotations don't exist yet (they only
                  // materialize on the final save). Pass undefined; SlotRow
                  // falls back to the generic destination list which still
                  // gives the user every option.
                  annotation={undefined}
                  artifacts={evidenceBySlot[slot.key] ?? []}
                  assessmentId={props.assessmentId}
                  controlId={props.controlId}
                  connectedProviders={props.connectedProviders}
                  uploadEvidenceAction={props.uploadEvidenceAction}
                  reReviewEvidenceAction={props.reReviewEvidenceAction}
                  deleteEvidenceAction={props.deleteEvidenceAction}
                  disabled={false}
                />
                <CharlieDraftButton
                  slotLabel={slot.label}
                  slotKey={slot.key}
                  satisfies={slot.satisfies}
                />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Step nav */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#cfe3d9] pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={stepIdx === 0 || savingStep || finishing}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {!isLast && (
            <button
              type="button"
              onClick={onNext}
              disabled={!currentValue || savingStep || finishing}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
            >
              Next question →
            </button>
          )}
          {isLast && (
            <button
              type="button"
              onClick={onFinish}
              disabled={!allAnswered || finishing || savingStep}
              className="bg-[#08201a] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf] hover:bg-[#10231d] disabled:opacity-50"
            >
              {finishing ? "Finishing…" : "Finish & open evidence packet"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-[#5a7d70]">
        Note: every NIST 800-171A objective still has to reach &ldquo;covered&rdquo;
        for this practice to lock as MET. Your answers personalize the
        evidence path (which artifact, which connector, or a signed
        attestation) — nothing is skipped.
      </p>
    </section>
  );
}

/**
 * One-tap button to hand off an evidence slot to Charlie for drafting.
 * Dispatches a `charlie-send-message` event with a slot-specific directive
 * so Charlie picks up exactly which artifact to generate next without the
 * user having to retype the slot label.
 */
function CharlieDraftButton({
  slotLabel,
  slotKey,
  satisfies,
}: {
  slotLabel: string;
  slotKey: string;
  satisfies: string[];
}) {
  const onClick = () => {
    const letters = satisfies.join(", ");
    const message = `Help me draft the "${slotLabel}" artifact for slot \`${slotKey}\` (objective ${letters}). Ask me whatever you need, then generate it for me with generate_evidence_artifact using slot_key="${slotKey}".`;
    window.dispatchEvent(
      new CustomEvent("charlie-send-message", { detail: { message } }),
    );
  };
  return (
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d] underline-offset-4 hover:text-[#10231d] hover:underline"
      >
        ↗ Have Charlie draft this with me
      </button>
    </div>
  );
}
