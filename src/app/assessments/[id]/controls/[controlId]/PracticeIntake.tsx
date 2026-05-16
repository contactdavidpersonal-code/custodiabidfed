"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  IntakeAnswers,
  PracticeIntakeSpec,
} from "@/lib/cmmc/practice-spec";
import { saveIntakeAction } from "./practice-chat-actions";

/**
 * TurboTax-style intake for a single CMMC practice. Renders ONE question at
 * a time, big tappable chips, "Why we ask" disclosure showing the verbatim
 * NIST 800-171A / SAG citation that drives the question. On submit it POSTs
 * the answers to the server, which validates against the spec, persists to
 * `practice_conversations.intake_answers`, and reruns the verifier.
 *
 * Hard rule echoed in copy: intake routes evidence paths — it does NOT
 * excuse any assessment objective. Every objective must still reach
 * "covered" before the practice can lock as MET.
 */
export function PracticeIntake(props: {
  assessmentId: string;
  controlId: string;
  controlShortName: string;
  intake: PracticeIntakeSpec;
  /** Existing answers (e.g. user re-opened the intake to edit). */
  initialAnswers?: IntakeAnswers;
}) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(
    props.initialAnswers ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showWhy, setShowWhy] = useState(false);

  const questions = props.intake.questions;
  const totalSteps = questions.length;
  const currentQ = questions[stepIdx];

  const select = (value: string) => {
    setError(null);
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));
    // Auto-advance after a short pause so the user sees the chip light up.
    if (stepIdx < totalSteps - 1) {
      setTimeout(() => {
        setStepIdx((s) => Math.min(s + 1, totalSteps - 1));
        setShowWhy(false);
      }, 220);
    }
  };

  const onSubmit = () => {
    // Every question must have an answer.
    for (const q of questions) {
      if (!answers[q.id]) {
        const missingIdx = questions.findIndex((qq) => !answers[qq.id]);
        setStepIdx(missingIdx);
        setError(`Please answer "${q.prompt}".`);
        return;
      }
    }
    startTransition(async () => {
      const res = await saveIntakeAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
        answers,
      });
      if (!res.ok) {
        setError(res.reason ?? "Could not save. Try again.");
        return;
      }
      // Tell the Charlie rail what we know so he opens with the right context
      // on the user's next turn (not the generic spec-only opener).
      window.dispatchEvent(
        new CustomEvent("practice-intake-completed", {
          detail: {
            controlId: props.controlId,
            situationSummary: res.situationSummary,
          },
        }),
      );
      router.refresh();
    });
  };

  const isLast = stepIdx === totalSteps - 1;
  const allAnswered = questions.every((q) => Boolean(answers[q.id]));
  const currentValue = answers[currentQ.id];

  return (
    <section className="mx-auto max-w-2xl">
      {/* Header: scope + reassurance */}
      <div className="mb-8 border-b border-[#cfe3d9] pb-6">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Before we collect evidence
        </div>
        <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d]">
          {totalSteps} quick questions about {props.controlShortName.toLowerCase()}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#3a544a]">
          {props.intake.preamble}
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
          “{currentQ.regQuote}”
          <div className="mt-2 font-mono text-[10px] font-bold uppercase not-italic tracking-[0.22em] text-[#5a7d70]">
            — {currentQ.regAnchor}
          </div>
        </blockquote>
      )}

      <div className="mt-6 space-y-2">
        {currentQ.options.map((opt) => {
          const selected = currentValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              disabled={pending}
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#cfe3d9] pt-5">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setShowWhy(false);
            setStepIdx((s) => Math.max(0, s - 1));
          }}
          disabled={stepIdx === 0 || pending}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {!isLast && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowWhy(false);
                setStepIdx((s) => Math.min(s + 1, totalSteps - 1));
              }}
              disabled={!currentValue || pending}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-40"
            >
              Next →
            </button>
          )}
          {isLast && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!allAnswered || pending}
              className="bg-[#08201a] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf] hover:bg-[#10231d] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Personalize my evidence list"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-[#5a7d70]">
        Note: every NIST 800-171A objective still has to reach “covered” for
        this practice to lock as MET. Your answers personalize the evidence
        path (which artifact, which connector, or a signed attestation) —
        nothing is skipped.
      </p>
    </section>
  );
}
