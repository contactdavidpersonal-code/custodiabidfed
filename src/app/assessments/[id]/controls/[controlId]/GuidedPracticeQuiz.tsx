"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientPersonalizedSpec,
  ClientPracticeIntakeSpec,
  ClientPracticeSpec,
  EvidenceSlot,
  IntakeAnswers,
} from "@/lib/cmmc/practice-spec";
import { inferSlotKey } from "@/lib/cmmc/practice-spec";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
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
  /** Server-computed personalization for the CURRENT (possibly partial)
   *  intake answers. Used to know which required slots will collapse into
   *  a signed attestation on Finish — those don't need a user-uploaded
   *  artifact to satisfy the Finish gate. */
  personalized: ClientPersonalizedSpec | null;
  evidence: ClientEvidenceRow[];
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  /** Latest AI-graded verdict for each NIST 800-171A objective letter.
   *  Source of truth: the parent PracticeChat's `verdicts` state, which is
   *  kept warm by `practice-graded` events and the verify endpoint. */
  objectiveVerdicts: Record<string, ObjectiveVerdict>;
  /** CMMC L1 is binary MET/NOT MET — for prod-grade practices we refuse to
   *  stamp intake-complete and land users on the summary view until every
   *  objective is covered. Off for practices not yet upgraded to that bar. */
  requireFullCoverageToFinish: boolean;
  /** Force a server-side re-grade and return the fresh verdicts. Called
   *  from the Finish handler so a click immediately reflects the latest
   *  evidence reviews instead of waiting for the next event tick. */
  onRequestVerify: () => Promise<Record<string, ObjectiveVerdict> | null>;
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
  // When Charlie fills in an intake answer via the `set_intake_answer` tool,
  // ComplianceOfficerRail fires `custodia:intake-changed` and the server
  // revalidates. Sync local state with the freshly-rendered props using the
  // documented React pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // — store the previous prop key in state and adjust other state during
  // render when it changes. Avoids both cascading effects and ref-in-render.
  const initialAnswersKey = JSON.stringify(props.initialAnswers ?? {});
  const [lastSyncedKey, setLastSyncedKey] = useState<string>(initialAnswersKey);
  if (lastSyncedKey !== initialAnswersKey) {
    setLastSyncedKey(initialAnswersKey);
    const incoming = props.initialAnswers;
    // Hard reset path: server wiped intake_answers (the "Reset this
    // practice" button does this). The incoming prop is null/undefined or
    // an empty object — snap local state back to Q1 with no answers,
    // otherwise the user clicks Reset and sees their old answers + last
    // step still showing.
    if (!incoming || Object.keys(incoming).length === 0) {
      setAnswers({});
      setStepIdx(0);
    } else {
      setAnswers((prev) => ({ ...prev, ...incoming }));
      const cur = props.intake.questions[stepIdx];
      if (cur && incoming[cur.id]) {
        const nextUnansweredIdx = props.intake.questions.findIndex(
          (q) => !incoming[q.id],
        );
        if (nextUnansweredIdx !== -1 && nextUnansweredIdx !== stepIdx) {
          setStepIdx(nextUnansweredIdx);
        }
      }
    }
  }

  // Listen for Charlie's tool-driven intake writes and refresh server props.
  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener("custodia:intake-changed", handler);
    return () =>
      window.removeEventListener("custodia:intake-changed", handler);
  }, [router]);

  // After a one-click inline draft fills a slot, scroll the user down to
  // the next empty slot card so they can keep working without hunting.
  // The InlineDraftButton fires `custodia:slot-drafted` with the slot key
  // it just filled; we find the next sibling `[data-slot-key]` and scroll
  // it into view. router.refresh() in the button takes a moment to swap
  // server props, so we wait a frame before scrolling.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ slotKey: string }>).detail;
      if (!detail?.slotKey) return;
      requestAnimationFrame(() => {
        const current = document.querySelector(
          `[data-slot-key="${detail.slotKey}"]`,
        );
        if (!current) return;
        // Find the next slot li in document order.
        let next = current.nextElementSibling;
        while (next && !(next instanceof HTMLElement && next.dataset.slotKey)) {
          next = next.nextElementSibling;
        }
        const target = next ?? current;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener("custodia:slot-drafted", handler);
    return () =>
      window.removeEventListener("custodia:slot-drafted", handler);
  }, []);
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

  // Required-evidence gate. A required slot is considered satisfied when
  // either (a) the personalized spec marks it as attestation — those get
  // auto-stamped server-side on Finish — or (b) at least one artifact
  // already exists for the slot (any review verdict; the post-intake page
  // re-verifies). We DO NOT block on AI-review status here because the
  // verdict can lag the upload by a few seconds and we don't want users
  // staring at a disabled button. The summary page is the final gate on
  // verdict quality.
  const slotAnnotations = props.personalized?.slotAnnotations ?? {};
  const requiredSlots = props.spec.evidenceSlots.filter((s) => s.required);
  const slotHasArtifact = (slotKey: string) =>
    props.evidence.some(
      (ev) => inferSlotKey(ev.filename, props.spec) === slotKey,
    );
  const missingRequiredSlots = requiredSlots.filter((s) => {
    if (slotAnnotations[s.key]?.attestation) return false;
    return !slotHasArtifact(s.key);
  });
  const allRequiredEvidenceCollected = missingRequiredSlots.length === 0;

  // Objective coverage gate (CMMC L1 is MET/NOT MET — 100% required).
  // When `requireFullCoverageToFinish` is true we ALSO require every
  // 800-171A objective letter to be graded "covered" before we'll stamp
  // the practice intake-complete. Verdicts are AI-graded and may lag the
  // most recent upload by a beat, so onFinish forces a verify first.
  const uncoveredObjectives = props.spec.objectives.filter(
    (o) => props.objectiveVerdicts[o.letter]?.status !== "covered",
  );
  const allObjectivesCovered = uncoveredObjectives.length === 0;
  const canFinish =
    allAnswered &&
    allRequiredEvidenceCollected &&
    (!props.requireFullCoverageToFinish || allObjectivesCovered);

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
    // completion, and every required slot that doesn't auto-attest needs
    // an artifact. This is the LAST gate before the summary view — we
    // refuse to land users on a "saved" summary that's actually still
    // incomplete.
    for (const q of questions) {
      if (!answers[q.id]) {
        const missingIdx = questions.findIndex((qq) => !answers[qq.id]);
        setStepIdx(missingIdx);
        setError(`Please answer "${q.prompt}" before finishing.`);
        return;
      }
    }
    // Required-evidence gate: refuse to stamp completion if any required
    // slot (other than auto-attestation ones) is still empty. The user
    // gets jumped to the first question that owns a missing slot so they
    // see the dropzone they still need to fill.
    if (missingRequiredSlots.length > 0) {
      const firstMissing = missingRequiredSlots[0];
      const ownerIdx = questions.findIndex((q) =>
        q.objectives.some((o) => firstMissing.satisfies.includes(o)),
      );
      if (ownerIdx !== -1) setStepIdx(ownerIdx);
      setError(
        `Still missing required evidence: "${firstMissing.label}". Drop it in below before saving.`,
      );
      return;
    }
    startFinish(async () => {
      // Coverage gate (CMMC L1 = MET/NOT MET). Force a fresh server-side
      // re-grade so the verdict reflects the latest uploads, then refuse
      // to stamp complete unless every objective letter is covered. We
      // do this INSIDE the transition so the button shows "Saving…" while
      // the verify call is in flight — no separate spinner needed.
      if (props.requireFullCoverageToFinish) {
        const fresh = await props.onRequestVerify();
        const verdicts = fresh ?? props.objectiveVerdicts;
        const stillUncovered = props.spec.objectives.filter(
          (o) => verdicts[o.letter]?.status !== "covered",
        );
        if (stillUncovered.length > 0) {
          setError(
            `Cannot save yet — ${stillUncovered.length} of ${props.spec.objectives.length} assessment objectives are not yet "covered". CMMC L1 is MET / NOT MET; every objective has to be covered before this practice can be saved. See the list above for what's still pending.`,
          );
          return;
        }
      }
      const res = await saveIntakeAction({
        assessmentId: props.assessmentId,
        controlId: props.controlId,
        answers,
      });
      if (!res.ok) {
        setError(res.reason ?? "Could not finish. Try again.");
        return;
      }
      // Wake Charlie up with a directive to auto-draft every generable
      // artifact in parallel, then only ask the user for the things that
      // genuinely cannot be auto-drafted (screenshots, signatures).
      const directive = [
        `[INTAKE COMPLETE — ${props.controlId}]`,
        ``,
        `The user just finished the guided quiz for ${props.controlId} (${props.spec.shortName}). They are NON-TECHNICAL — gardener / HVAC tech / handyman with a small federal contract. They expect you, Charlie, to do the work. Their captured environment:`,
        res.situationSummary ?? "(see system prompt for intake summary)",
        ``,
        `Do this RIGHT NOW, in this single response:`,
        `1. Open with ONE short sentence in plain English that mirrors their setup ("Got it — solo shop, Proton email, one laptop. I'll handle the paperwork.").`,
        `2. For EVERY required evidence slot whose destinations include a \`generate\` path AND is still empty: emit a \`generate_evidence_artifact\` tool call in this same assistant message. Parallel tool use is supported — fire them all at once. Use the recommended destination's filename + format. Compose the content from the intake summary and the slot's hint. NO MORE QUESTIONS for these slots — the user already gave you what you need via intake.`,
        `3. For required slots that need a user-supplied artifact (upload screenshot, attestation signature, connector): list them at the end as a short numbered checklist. For each one, give the EXACT steps a non-technical person can follow ("Open Proton Mail in your browser → Settings → All Settings → Account → Sessions → take a screenshot showing the active sessions list → upload it here"). One line per step. No jargon.`,
        `4. End with: "Want me to keep going, or do you want to handle the screenshots first?" — give them an obvious next move.`,
        ``,
        `RULES: Never ask the user "what should the roster say?" — you already know from intake. Never ask them to "review and confirm" before drafting — draft first, they can replace it. Never use the words FCI, CMMC, control, objective, NIST, M365, SaaS, BYOD, attestation, identifier, provisioning, deprovisioning, baseline. Translate every one of those into gardener words.`,
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
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            const directive = [
              `[INTAKE HELP — ${props.controlId} / ${currentQ.id}]`,
              ``,
              `The user is non-technical (think gardener, HVAC tech, small handyman shop with a federal contract). They clicked "Help me pick this one" because they can't self-classify their IT setup. Drive the answer FOR them.`,
              ``,
              `The question is: "${currentQ.prompt}"`,
              ``,
              `Allowed option values (value → label → description):`,
              ...currentQ.options.map(
                (o) =>
                  `  - ${o.value} → ${o.label}${o.description ? ` — ${o.description}` : ""}`,
              ),
              ``,
              `What to do RIGHT NOW (in this single reply):`,
              `1. Ask ONE plain-English question a gardener could answer in 5 seconds. Examples: "What do you use for work email — Gmail, Outlook, Proton, something else?" / "Is it just you, or do you have employees with logins?" / "Do you have an IT person, or is it you?". No acronyms. No "FCI", "M365", "managed", "SaaS", "BYOD" — translate everything.`,
              `2. Stop. Wait for their reply.`,
              ``,
              `When they reply: pick the matching option value from the list above, call \`set_intake_answer({question_id: "${currentQ.id}", value: "<value>"})\`, and in ONE short sentence tell them what you picked and why ("I picked 'Just my email + my laptop' because Proton + one laptop = solo setup"). Then either ask the next intake question or — if all answers are in — proceed to auto-draft every required artifact.`,
            ].join("\n");
            window.dispatchEvent(
              new CustomEvent("charlie-send-message", {
                detail: { message: directive },
              }),
            );
          }}
          disabled={savingStep || finishing}
          className="mb-4 inline-flex items-center gap-2 border border-[#2f8f6d] bg-[#f4faf6] px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#10231d] hover:bg-[#e6f4ec] disabled:opacity-50"
        >
          <span
            className="inline-flex items-center justify-center bg-[#0e2a23] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]"
            aria-hidden
          >
            Charlie
          </span>
          Help me pick this one
        </button>
      </div>
      <div className="space-y-2">
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
              <li key={slot.key} data-slot-key={slot.key}>
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
              disabled={!canFinish || finishing || savingStep}
              className="bg-[#08201a] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf] hover:bg-[#10231d] disabled:opacity-50"
            >
              {finishing ? "Saving…" : "Save & view practice summary"}
            </button>
          )}
        </div>
      </div>

      {isLast && allAnswered && missingRequiredSlots.length > 0 && (
        <div className="mt-5 border-l-2 border-[#c14a3a] bg-[#fbeae6] px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7a2a1f]">
            Required evidence still missing
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-[#3a1a13]">
            {missingRequiredSlots.map((s) => (
              <li key={s.key}>
                <span className="font-semibold">{s.label}</span>
                {s.hint ? (
                  <span className="text-[#5a7d70]"> — {s.hint}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[#5a7d70]">
            Scroll up to the matching question to drop in (or generate /
            connect) the artifact. The button unlocks the moment every
            required slot has evidence.
          </p>
        </div>
      )}

      {/* Coverage gate (CMMC L1 = MET / NOT MET). Once every question is
          answered and every required slot is filled, the user still has to
          clear the AI-graded objective coverage check — every 800-171A
          assessment objective letter for this practice has to be "covered".
          We surface what's still pending so the user knows EXACTLY what to
          fix instead of staring at a disabled button. The list updates
          live as the Charlie rail re-grades after each upload. */}
      {props.requireFullCoverageToFinish &&
        isLast &&
        allAnswered &&
        missingRequiredSlots.length === 0 &&
        uncoveredObjectives.length > 0 && (
          <div className="mt-5 border-l-2 border-[#c1893a] bg-[#fbf3e6] px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7a4f1f]">
              Coverage not yet 100% ·{" "}
              {props.spec.objectives.length - uncoveredObjectives.length}
              /{props.spec.objectives.length} objectives covered
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#3a2913]">
              CMMC Level 1 is <strong>MET or NOT MET</strong> — there is no
              partial credit. Every NIST 800-171A assessment objective for
              this practice has to be graded &ldquo;covered&rdquo; before we&rsquo;ll
              save the practice and let you advance.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-[#3a2913]">
              {uncoveredObjectives.map((o) => {
                const v = props.objectiveVerdicts[o.letter];
                return (
                  <li key={o.letter}>
                    <span className="font-mono text-[11px] font-bold">
                      [{o.letter}]
                    </span>{" "}
                    <span>{o.text}</span>
                    {v?.reason ? (
                      <span className="block text-[11px] text-[#7a5f4f]">
                        {v.status === "missing" ? "Missing: " : "Partial: "}
                        {v.reason}
                      </span>
                    ) : (
                      <span className="block text-[11px] text-[#7a5f4f]">
                        No evidence graded for this objective yet.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-[#7a5f4f]">
              Re-upload or generate evidence above and the AI re-grades
              automatically. The save button will unlock as soon as every
              objective is covered.
            </p>
          </div>
        )}

      <p className="mt-6 text-[12px] leading-relaxed text-[#5a7d70]">
        Saving lands you on this practice&rsquo;s summary — every question, every
        answer, every piece of evidence on one page. Edit any answer, swap
        artifacts, or reset the whole practice from there. You can&rsquo;t move
        on to the next practice until every NIST 800-171A objective for this
        one is &ldquo;covered&rdquo; (100%).
      </p>
    </section>
  );
}

/**
 * One-tap button to hand off an evidence slot to Charlie for drafting.
 * Replaced by the inline `InlineDraftButton` rendered inside `SlotActions`
 * in `PracticeChat.tsx` — that button calls `draftSlotArtifactAction`
 * directly and pops the artifact into the slot without a chat detour.
 * Removed.
 */
