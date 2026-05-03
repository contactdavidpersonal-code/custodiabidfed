"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type {
  ControlResponseRow,
  EvidenceArtifactRow,
  ReuseCandidate,
} from "@/lib/assessment";
import type { ControlPlaybook } from "@/lib/playbook";
import type { PracticeGuide } from "@/lib/practice-guides";
import { EvidenceDropzone } from "./EvidenceDropzone";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;
type ClientReuseCandidate = Omit<ReuseCandidate, "blob_url">;

type Props = {
  assessmentId: string;
  controlId: string;
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  guide: PracticeGuide;
  response: ControlResponseRow;
  evidence: ClientEvidenceRow[];
  reuseCandidates: ClientReuseCandidate[];
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  tagArtifactPracticeAction: (formData: FormData) => Promise<void> | void;
  useSuggestedNarrativeAction: (formData: FormData) => Promise<void> | void;
};

type ObjectiveState = "unanswered" | "yes" | "not_yet" | "help";

type LockStatus = "met" | "not_met" | "na" | null;

const STAGES = [
  { key: "orient", label: "What we're protecting" },
  { key: "confirm", label: "Confirm what you do" },
  { key: "prove", label: "Prove it" },
  { key: "lock", label: "Lock it in" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function parseQ(filename: string): { display: string } {
  const m = /^\[q:([^\]]+)\]__(.*)$/.exec(filename);
  return { display: m ? m[2] : filename };
}

export function GuidedPracticeFlow(props: Props) {
  const router = useRouter();
  const sectionRefs = {
    orient: useRef<HTMLDivElement>(null),
    confirm: useRef<HTMLDivElement>(null),
    prove: useRef<HTMLDivElement>(null),
    lock: useRef<HTMLDivElement>(null),
  };

  const sufficientCount = props.evidence.filter(
    (e) => e.ai_review_verdict === "sufficient",
  ).length;

  const initialLock: LockStatus =
    props.response.status === "yes"
      ? "met"
      : props.response.status === "no"
        ? "not_met"
        : props.response.status === "not_applicable"
          ? "na"
          : null;

  const [activeStage, setActiveStage] = useState<StageKey>(
    initialLock ? "lock" : sufficientCount > 0 ? "prove" : "orient",
  );
  const [showFciHelp, setShowFciHelp] = useState(false);
  const [objectiveState, setObjectiveState] = useState<
    Record<string, ObjectiveState>
  >(() => {
    const seed: Record<string, ObjectiveState> = {};
    for (const o of props.guide.objectives) {
      seed[o.letter] = "unanswered";
    }
    return seed;
  });
  const [openObjective, setOpenObjective] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<LockStatus>(initialLock);
  const [naReason, setNaReason] = useState(
    props.response.status === "not_applicable"
      ? props.response.narrative ?? ""
      : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const yesCount = useMemo(
    () => Object.values(objectiveState).filter((v) => v === "yes").length,
    [objectiveState],
  );
  const totalObjectives = props.guide.objectives.length;
  const allConfirmed = yesCount === totalObjectives;

  const goTo = (stage: StageKey) => {
    setActiveStage(stage);
    sectionRefs[stage].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const lockReady =
    lockStatus === "met"
      ? sufficientCount > 0 && allConfirmed
      : lockStatus === "not_met"
        ? true
        : lockStatus === "na"
          ? naReason.trim().length >= 10
          : false;

  const submitLock = async () => {
    if (!lockReady || submitting || !lockStatus) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("assessmentId", props.assessmentId);
      fd.set("controlId", props.controlId);
      fd.set(
        "status",
        lockStatus === "met" ? "yes" : lockStatus === "not_met" ? "no" : "not_applicable",
      );
      fd.set(
        "narrative",
        lockStatus === "na" ? naReason.trim() : props.response.narrative ?? "",
      );
      await Promise.resolve(props.saveResponseAction(fd));

      if (lockStatus === "met" && !(props.response.narrative ?? "").trim()) {
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* ========== TOP BAR ========== */}
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

      {/* ========== HEADER ========== */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-[#0e2a23] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#bdf2cf]">
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
          {props.guide.fciFraming.headline}
        </p>
      </header>

      {/* ========== STICKY STEPPER ========== */}
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-[#cfe3d9] bg-[#f7f7f3]/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#f7f7f3]/80">
        <ol className="flex items-stretch gap-1">
          {STAGES.map((s, i) => {
            const completed =
              (s.key === "orient" && activeStage !== "orient") ||
              (s.key === "confirm" && allConfirmed) ||
              (s.key === "prove" && sufficientCount > 0) ||
              (s.key === "lock" && initialLock !== null);
            const active = activeStage === s.key;
            return (
              <li key={s.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => goTo(s.key)}
                  className={`group flex w-full items-center gap-2 border-b-2 px-2 py-1.5 text-left transition-colors ${
                    active
                      ? "border-[#0e2a23] text-[#10231d]"
                      : completed
                        ? "border-[#2f8f6d] text-[#2f8f6d] hover:text-[#10231d]"
                        : "border-[#cfe3d9] text-[#5a7d70] hover:text-[#10231d]"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 flex-none items-center justify-center font-mono text-[10px] font-bold ${
                      completed
                        ? "bg-[#2f8f6d] text-white"
                        : active
                          ? "bg-[#0e2a23] text-[#bdf2cf]"
                          : "border border-[#cfe3d9] bg-white text-[#5a7d70]"
                    }`}
                  >
                    {completed ? "\u2713" : i + 1}
                  </span>
                  <span className="truncate text-[11px] font-bold uppercase tracking-[0.14em]">
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ========== STAGE 1: ORIENT ========== */}
      <section ref={sectionRefs.orient} className="mb-8 scroll-mt-20">
        <StageHeading number={1} label="What we're protecting" />
        <div className="border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
          <p className="text-base leading-relaxed text-[#10231d]">
            {props.guide.fciFraming.body}
          </p>
          <button
            type="button"
            onClick={() => setShowFciHelp((v) => !v)}
            className="mt-3 text-xs font-semibold text-[#2f8f6d] underline-offset-4 hover:underline"
          >
            {showFciHelp ? "Hide" : "What does FCI look like in practice?"}
          </button>
          <AnimatePresence>
            {showFciHelp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm leading-relaxed text-[#10231d]">
                  <p className="font-semibold text-[#0e2a23]">FCI examples:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>The SOW or contract document the prime sent you</li>
                    <li>Internal emails discussing contract details</li>
                    <li>Drawings, specs, or files you produce for the contract</li>
                    <li>Pricing and proposal information you submitted</li>
                  </ul>
                  <p className="mt-3 font-semibold text-[#0e2a23]">Not FCI:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Information already published on a public website</li>
                    <li>Press releases or marketing material from the prime</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 border border-[#cfe3d9] bg-[#fbfdfb] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
            What this looks like in real life
          </p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#10231d]">
            <p>
              <span className="font-semibold">Setup. </span>
              {props.guide.realWorldExample.setup}
            </p>
            <p>
              <span className="font-semibold">What they do. </span>
              {props.guide.realWorldExample.action}
            </p>
            <p className="border-l-2 border-[#2f8f6d] bg-[#f7fcf9] py-2 pl-3">
              <span className="font-semibold">So what. </span>
              {props.guide.realWorldExample.soWhat}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => goTo("confirm")}
            className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            Got it &mdash; let&rsquo;s walk through what CMMC checks &rarr;
          </button>
        </div>
      </section>

      {/* ========== STAGE 2: CONFIRM (objectives Q&A) ========== */}
      <section ref={sectionRefs.confirm} className="mb-8 scroll-mt-20">
        <StageHeading
          number={2}
          label="Confirm what you do"
          rightSlot={
            <span className="font-mono text-xs text-[#5a7d70]">
              {yesCount} of {totalObjectives} confirmed
            </span>
          }
        />
        <p className="mb-3 text-sm text-[#5a7d70]">
          A 3PAO checks each of these individually. Answer for your business
          &mdash; the formal NIST objective is shown below each question for
          traceability.
        </p>
        <ul className="space-y-2">
          {props.guide.objectives.map((o) => {
            const state = objectiveState[o.letter];
            const isOpen = openObjective === o.letter;
            return (
              <li
                key={o.letter}
                className={`border bg-white transition-colors ${
                  state === "yes"
                    ? "border-[#2f8f6d]"
                    : state === "not_yet" || state === "help"
                      ? "border-[#a06b1a]"
                      : "border-[#cfe3d9]"
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center font-mono text-[10px] font-bold ${
                      state === "yes"
                        ? "bg-[#2f8f6d] text-white"
                        : state === "not_yet" || state === "help"
                          ? "bg-[#a06b1a] text-white"
                          : "border border-[#cfe3d9] bg-white text-[#5a7d70]"
                    }`}
                  >
                    {state === "yes" ? "\u2713" : `[${o.letter}]`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#10231d]">
                      {o.prompt}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenObjective(isOpen ? null : o.letter)
                      }
                      className="mt-1 text-[11px] font-semibold text-[#2f8f6d] underline-offset-4 hover:underline"
                    >
                      {isOpen ? "Hide details" : "What does this mean?"}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-2 border-l-2 border-[#cfe3d9] pl-3 text-xs leading-relaxed text-[#10231d]/85">
                            <p>{o.helpText}</p>
                            <p className="text-[#5a7d70]">
                              <span className="font-semibold text-[#10231d]">
                                Looks like:{" "}
                              </span>
                              {o.example}
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-[#5a7d70]">
                              NIST 800-171A [{o.letter}]: {o.formalAsk}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <ObjBtn
                        active={state === "yes"}
                        tone="ok"
                        onClick={() =>
                          setObjectiveState((s) => ({ ...s, [o.letter]: "yes" }))
                        }
                      >
                        Yes, we do this
                      </ObjBtn>
                      <ObjBtn
                        active={state === "not_yet"}
                        tone="warn"
                        onClick={() =>
                          setObjectiveState((s) => ({
                            ...s,
                            [o.letter]: "not_yet",
                          }))
                        }
                      >
                        Not yet
                      </ObjBtn>
                      <ObjBtn
                        active={state === "help"}
                        tone="info"
                        onClick={() => {
                          setObjectiveState((s) => ({
                            ...s,
                            [o.letter]: "help",
                          }));
                          setOpenObjective(o.letter);
                        }}
                      >
                        Charlie, help me
                      </ObjBtn>
                    </div>
                    {state === "help" && (
                      <p className="mt-2 text-[11px] text-[#a06b1a]">
                        Open the Charlie chat (right rail) and paste this
                        question. He&rsquo;ll walk you through it for your
                        specific business setup.
                      </p>
                    )}
                    {state === "not_yet" && (
                      <p className="mt-2 text-[11px] text-[#a06b1a]">
                        That&rsquo;s OK &mdash; we&rsquo;ll mark this practice
                        NOT MET when you lock in, and Charlie will draft a
                        remediation plan.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => goTo("prove")}
            className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            Next &mdash; show the proof &rarr;
          </button>
        </div>
      </section>

      {/* ========== STAGE 3: PROVE ========== */}
      <section ref={sectionRefs.prove} className="mb-8 scroll-mt-20">
        <StageHeading
          number={3}
          label="Prove it"
          rightSlot={
            <span className="font-mono text-xs text-[#5a7d70]">
              {sufficientCount} sufficient artifact
              {sufficientCount === 1 ? "" : "s"}
            </span>
          }
        />
        <p className="mb-3 text-sm text-[#5a7d70]">
          A 3PAO uses three methods to verify a practice. Cover at least one
          per method &mdash; one artifact often satisfies more than one.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          {props.guide.evidenceMethods.map((m) => (
            <div
              key={m.method}
              className="border border-[#cfe3d9] bg-white p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                {m.method}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#10231d]">
                {m.title}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#10231d]/85">
                {m.ask}
              </p>
              <ul className="mt-2 space-y-1">
                {m.acceptedShape.map((shape, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-[#5a7d70]"
                  >
                    <span className="mt-0.5 inline-flex h-2.5 w-2.5 flex-none items-center justify-center bg-[#0e2a23] text-[8px] font-bold text-[#bdf2cf]">
                      &#x2713;
                    </span>
                    <span>{shape}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#5a7d70]">
                {m.formats}
              </p>
            </div>
          ))}
        </div>

        {/* Existing artifacts */}
        {props.evidence.length > 0 && (
          <div className="mt-4 border border-[#cfe3d9] bg-white">
            <div className="border-b border-[#cfe3d9] bg-[#f7fcf9] px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                On file for this practice
              </p>
            </div>
            <ul className="divide-y divide-[#e4eee8]">
              {props.evidence.map((a) => (
                <ArtifactRow
                  key={a.id}
                  artifact={a}
                  assessmentId={props.assessmentId}
                  controlId={props.controlId}
                  reReviewEvidenceAction={props.reReviewEvidenceAction}
                  deleteEvidenceAction={props.deleteEvidenceAction}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Upload */}
        <div className="mt-4 border border-[#cfe3d9] bg-white p-4">
          <EvidenceDropzone
            action={props.uploadEvidenceAction}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
          />
        </div>

        {/* Reuse */}
        {props.reuseCandidates.length > 0 && (
          <ReuseStrip
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            candidates={props.reuseCandidates}
            tagArtifactPracticeAction={props.tagArtifactPracticeAction}
          />
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => goTo("lock")}
            className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            Next &mdash; lock it in &rarr;
          </button>
        </div>
      </section>

      {/* ========== STAGE 4: LOCK ========== */}
      <section ref={sectionRefs.lock} className="mb-8 scroll-mt-20">
        <StageHeading number={4} label="Lock it in" />
        <p className="mb-3 text-sm text-[#5a7d70]">
          Pick the verdict that matches your situation. CMMC L1 uses three:
          MET, NOT MET, NOT APPLICABLE.
        </p>

        <div className="space-y-2">
          <LockOption
            value="met"
            current={lockStatus}
            onPick={setLockStatus}
            title="MET"
            sub="We do this and we have evidence on file."
            tone="ok"
            disabled={!(sufficientCount > 0 && allConfirmed)}
            disabledReason={
              sufficientCount === 0
                ? "Need at least one artifact reviewed as Sufficient."
                : !allConfirmed
                  ? `Confirm all ${totalObjectives} objectives first (${yesCount}/${totalObjectives} done).`
                  : undefined
            }
          />
          <LockOption
            value="not_met"
            current={lockStatus}
            onPick={setLockStatus}
            title="NOT MET"
            sub="We don't currently meet this. Charlie will draft a remediation plan."
            tone="warn"
          />
          <LockOption
            value="na"
            current={lockStatus}
            onPick={setLockStatus}
            title="NOT APPLICABLE"
            sub={props.guide.applicabilityNotes}
            tone="muted"
          />
        </div>

        {lockStatus === "na" && (
          <div className="mt-3 border border-[#cfe3d9] bg-white p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
              Why is this practice N/A for your business?
            </label>
            <textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              rows={3}
              placeholder="E.g. We have no physical office; all staff work remotely on cloud-only systems."
              className="mt-2 w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
            />
            <p className="mt-1 text-[11px] text-[#5a7d70]">
              Auditors will read this. Be specific.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!lockReady || submitting}
            onClick={submitLock}
            className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? "Saving\u2026"
              : props.nextId
                ? "Lock it in \u2192 next practice"
                : "Lock it in \u2192 finish"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function StageHeading({
  number,
  label,
  rightSlot,
}: {
  number: number;
  label: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-[#5a7d70]">
          STAGE {number}
        </span>
        <span className="text-xl font-bold tracking-tight text-[#10231d]">
          {label}
        </span>
      </h2>
      {rightSlot}
    </div>
  );
}

function ObjBtn({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "ok" | "warn" | "info";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = "px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors";
  const styles = active
    ? tone === "ok"
      ? "bg-[#2f8f6d] text-white"
      : tone === "warn"
        ? "bg-[#a06b1a] text-white"
        : "bg-[#0e2a23] text-[#bdf2cf]"
    : "border border-[#cfe3d9] bg-white text-[#5a7d70] hover:border-[#0e2a23] hover:text-[#10231d]";
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function LockOption({
  value,
  current,
  onPick,
  title,
  sub,
  tone,
  disabled,
  disabledReason,
}: {
  value: LockStatus;
  current: LockStatus;
  onPick: (v: LockStatus) => void;
  title: string;
  sub: string;
  tone: "ok" | "warn" | "muted";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const active = current === value;
  const accent =
    tone === "ok" ? "#2f8f6d" : tone === "warn" ? "#a06b1a" : "#5a7d70";
  return (
    <button
      type="button"
      onClick={() => !disabled && onPick(value)}
      disabled={disabled}
      className={`flex w-full items-start gap-3 border p-4 text-left transition-colors ${
        active
          ? "bg-white shadow-[0_2px_0_rgba(14,48,37,0.04)]"
          : "bg-white hover:border-[#0e2a23]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      style={{ borderColor: active ? accent : "#cfe3d9" }}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center font-mono text-[10px] font-bold"
        style={{
          backgroundColor: active ? accent : "transparent",
          color: active ? "white" : accent,
          border: active ? "none" : `1px solid ${accent}`,
        }}
      >
        {active ? "\u2713" : "\u00b7"}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block font-mono text-xs font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-[#10231d]">
          {sub}
        </span>
        {disabled && disabledReason && (
          <span className="mt-1 block text-[11px] text-[#a06b1a]">
            {disabledReason}
          </span>
        )}
      </span>
    </button>
  );
}

function ArtifactRow({
  artifact: a,
  assessmentId,
  controlId,
  reReviewEvidenceAction,
  deleteEvidenceAction,
}: {
  artifact: ClientEvidenceRow;
  assessmentId: string;
  controlId: string;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const [isReviewing, startReviewTransition] = useTransition();
  const display = parseQ(a.filename).display;
  const verdictTone =
    a.ai_review_verdict === "sufficient"
      ? { pill: "bg-[#2f8f6d] text-white", label: "Sufficient" }
      : a.ai_review_verdict === "insufficient"
        ? { pill: "bg-[#b03a2e] text-white", label: "Insufficient" }
        : a.ai_review_verdict === "unclear"
          ? { pill: "bg-[#a06b1a] text-white", label: "Unclear" }
          : a.ai_review_verdict === "not_relevant"
            ? { pill: "bg-[#5a7d70] text-white", label: "Not relevant" }
            : {
                pill: "bg-[#e4eee8] text-[#5a7d70] border border-[#cfe3d9]",
                label: "Not reviewed",
              };
  const hasVerdict = a.ai_review_verdict !== null;

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
          <span className="flex h-9 w-9 flex-none items-center justify-center bg-[#0e2a23] font-mono text-[10px] font-bold text-[#bdf2cf]">
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
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${verdictTone.pill}`}
              >
                {verdictTone.label}
              </span>
            </div>
            {a.ai_review_summary && (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#5a7d70]">
                {a.ai_review_summary}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={triggerReview}
            disabled={isReviewing}
            className="border border-[#0e2a23] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0e2a23] transition-colors hover:bg-[#0e2a23] hover:text-[#bdf2cf] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReviewing
              ? "Reviewing\u2026"
              : hasVerdict
                ? "Re-review"
                : "Ask Charlie to review"}
          </button>
          <form action={deleteEvidenceAction}>
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="controlId" value={controlId} />
            <input type="hidden" name="artifactId" value={a.id} />
            <button
              type="submit"
              className="text-[11px] font-semibold text-[#5a7d70] transition-colors hover:text-[#b03a2e]"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

function ReuseStrip({
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
  const sorted = [...candidates].sort((a, b) => {
    if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
    return b.captured_at.localeCompare(a.captured_at);
  });
  const suggestedCount = sorted.filter((c) => c.suggested).length;

  return (
    <details className="mt-3 border border-[#cfe3d9] bg-[#fbfdfb]">
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
                  <span className="bg-[#e4eee8] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#5a7d70]">
                    From {c.source_control_id}
                  </span>
                  {c.suggested && (
                    <span className="bg-[#0e2a23] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#bdf2cf]">
                      Suggested
                    </span>
                  )}
                </div>
              </div>
              <form action={tagArtifactPracticeAction}>
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="controlId" value={controlId} />
                <input type="hidden" name="artifactId" value={c.id} />
                <button
                  type="submit"
                  className="border border-[#0e2a23] bg-[#0e2a23] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
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
