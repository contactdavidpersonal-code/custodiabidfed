"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type {
  EvidenceArtifactRow,
} from "@/lib/assessment";
import type { ControlPlaybook } from "@/lib/playbook";
import type {
  Choice,
  EvidencePath,
  PracticeQuiz,
  QuizStep,
  VaultForm,
} from "@/lib/practice-quizzes";
import type { ConnectorProvider } from "@/lib/connectors/types";
import { EvidenceDropzone } from "./EvidenceDropzone";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;

type Props = {
  assessmentId: string;
  controlId: string;
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  quiz: PracticeQuiz;
  /** which connector providers the org has live tokens for */
  connectedProviders: ConnectorProvider[];
  evidence: ClientEvidenceRow[];
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  submitVaultEntryAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  useSuggestedNarrativeAction: (formData: FormData) => Promise<void> | void;
};

type AnswerLog = Array<
  | { kind: "choice"; stepId: string; choice: Choice }
  | { kind: "evidence"; stepId: string; pathLabel: string; artifactId?: string }
  | { kind: "skip"; stepId: string; label: string }
>;

const PROVIDER_LABEL: Record<ConnectorProvider, string> = {
  m365: "Microsoft 365",
  google_workspace: "Google Workspace",
};

const PROVIDER_ICON: Record<ConnectorProvider, string> = {
  m365: "M",
  google_workspace: "G",
};

export function PracticeQuiz(props: Props) {
  const router = useRouter();
  const activeStepRef = useRef<HTMLDivElement>(null);
  const totalSteps = props.quiz.steps.length;
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerLog>([]);
  const [stepEvidence, setStepEvidence] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const step = props.quiz.steps[stepIdx];

  const goNext = () => {
    if (stepIdx < totalSteps - 1) {
      setStepIdx((i) => i + 1);
    }
  };
  const goPrev = () => {
    if (stepIdx > 0) {
      // pop the last log entry that came from a step we're rewinding past
      setAnswers((prev) => {
        const targetStepId = props.quiz.steps[stepIdx - 1].id;
        const idx = prev.findIndex((a) => a.stepId === targetStepId);
        return idx === -1 ? prev : prev.slice(0, idx);
      });
      setStepIdx((i) => i - 1);
    }
  };

  // Auto-scroll the page so the active step sits just below the sticky header.
  useEffect(() => {
    if (activeStepRef.current) {
      // Defer one frame so the DOM has the new step rendered before measuring.
      requestAnimationFrame(() => {
        activeStepRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    }
  }, [stepIdx]);

  const recordChoice = (choice: Choice) => {
    setAnswers((prev) => [...prev, { kind: "choice", stepId: step.id, choice }]);
    // Auto-advance after a brief beat so Charlie's reaction has time to land.
    setTimeout(goNext, 650);
  };

  const recordEvidence = (pathLabel: string, artifactId?: string) => {
    setAnswers((prev) => [
      ...prev,
      { kind: "evidence", stepId: step.id, pathLabel, artifactId },
    ]);
    setStepEvidence((p) => ({ ...p, [step.id]: pathLabel }));
    setTimeout(goNext, 600);
  };

  const recordSkip = (label: string) => {
    setAnswers((prev) => [...prev, { kind: "skip", stepId: step.id, label }]);
    setTimeout(goNext, 400);
  };

  // ====================== final summary -> lock-in ======================

  const verdict: "met" | "not_met" = useMemo(() => {
    let failed = false;
    for (const a of answers) {
      if (a.kind === "choice" && a.choice.failsObjectives?.length) failed = true;
    }
    // Need at least one evidence path to have produced an artifact for [a]/[d]
    const hasUserRoster = answers.some(
      (a) => a.kind === "evidence" && a.stepId === "users_evidence",
    );
    if (!hasUserRoster) failed = true;
    return failed ? "not_met" : "met";
  }, [answers]);

  const finalize = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("assessmentId", props.assessmentId);
      fd.set("controlId", props.controlId);
      fd.set("status", verdict === "met" ? "yes" : "no");
      fd.set("narrative", "");
      await Promise.resolve(props.saveResponseAction(fd));

      if (verdict === "met") {
        const fd2 = new FormData();
        fd2.set("assessmentId", props.assessmentId);
        fd2.set("controlId", props.controlId);
        await Promise.resolve(props.useSuggestedNarrativeAction(fd2));
      }

      if (props.nextId) {
        router.push(`/assessments/${props.assessmentId}/controls/${props.nextId}`);
      } else {
        router.push(`/assessments/${props.assessmentId}`);
      }
    } finally {
      setSubmitting(false);
      setShowCompleted(true);
    }
  };

  // =========================================================================

  return (
    <div className="mx-auto max-w-3xl px-6 pb-10">
      {/* ======== STICKY HEADER ========
          Global assessments nav is sticky at top-0 z-30 (~60px tall),
          so we anchor below it. */}
      <div className="sticky top-[60px] z-20 -mx-6 border-b border-[#cfe3d9] bg-[#fbfdfb]/95 px-6 pt-5 pb-3 backdrop-blur supports-[backdrop-filter]:bg-[#fbfdfb]/80">
        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#0e2a23] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#bdf2cf]">
                {props.practice.domain}
              </span>
              <span className="font-mono text-xs font-semibold text-[#5a7d70]">
                {props.practice.id}
              </span>
              <span className="text-[#cfe3d9]">&middot;</span>
              <span className="text-xs font-medium text-[#5a7d70]">
                ~{props.quiz.estimatedMinutes} min
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#10231d] md:text-2xl">
              {props.practice.shortName}
            </h1>
          </div>
          <StatusBadge verdict={verdict} locked={showCompleted} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#5a7d70]">
            <span>
              Question {Math.min(stepIdx + 1, totalSteps)} of {totalSteps}
            </span>
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIdx === 0}
              className="font-semibold text-[#2f8f6d] transition-colors hover:text-[#10231d] disabled:cursor-not-allowed disabled:opacity-30"
            >
              &larr; Back
            </button>
          </div>
          <div className="mt-1 h-1 w-full bg-[#e4eee8]">
            <div
              className="h-1 bg-[#2f8f6d] transition-all duration-300"
              style={{
                width: `${((stepIdx + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[#5a7d70]">
        {props.quiz.oneLiner}
      </p>

      {/* ======== CHAT HISTORY ======== */}
      <div className="mt-5 space-y-3">
        {props.quiz.steps.slice(0, stepIdx).map((s, i) => {
          const log = answers.find((a) => a.stepId === s.id);
          return (
            <div key={s.id}>
              <CharlieBubble compact>{compactCharlieLine(s)}</CharlieBubble>
              {log && <UserBubble log={log} />}
              {log?.kind === "choice" && log.choice.charlieReaction && (
                <CharlieBubble compact tone="follow">
                  {log.choice.charlieReaction}
                </CharlieBubble>
              )}
              {log?.kind === "choice" && log.choice.remediationHint && (
                <RemediationNote text={log.choice.remediationHint} />
              )}
              {i === stepIdx - 1 && <div className="h-1" />}
            </div>
          );
        })}
      </div>

      {/* ======== ACTIVE STEP ======== */}
      <div ref={activeStepRef} className="mt-3 scroll-mt-56">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
          <CharlieBubble>
            <RichText text={step.charlieSays} />
          </CharlieBubble>

          <div className="mt-4">
            {step.kind === "intro" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={goNext}
                  className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  {step.ctaLabel}
                </button>
              </div>
            )}

            {step.kind === "multiple_choice" && (
              <ChoiceList
                step={step}
                onPick={(c) => recordChoice(c)}
              />
            )}

            {step.kind === "evidence_picker" && (
              <EvidencePicker
                step={step}
                assessmentId={props.assessmentId}
                controlId={props.controlId}
                connectedProviders={props.connectedProviders}
                vaultForms={props.quiz.vaultForms}
                uploadEvidenceAction={props.uploadEvidenceAction}
                submitVaultEntryAction={props.submitVaultEntryAction}
                onResolved={(pathLabel) => recordEvidence(pathLabel)}
                onSkip={(label) => recordSkip(label)}
              />
            )}

            {step.kind === "summary" && (
              <SummaryCard
                quiz={props.quiz}
                answers={answers}
                stepEvidence={stepEvidence}
                verdict={verdict}
                submitting={submitting}
                onLockIn={finalize}
                nextId={props.nextId}
                showCompleted={showCompleted}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}

/* =========================== chat primitives =========================== */

function StatusBadge({
  verdict,
  locked,
}: {
  verdict: "met" | "not_met";
  locked: boolean;
}) {
  // Once locked in, the badge reflects the saved verdict. Until then,
  // we always show NOT MET so the user has a clear "this is the goal"
  // target. The badge flips to MET only when the running verdict says so
  // AND the practice has been finalized.
  const showMet = locked && verdict === "met";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        showMet
          ? "bg-[#2f8f6d] text-white"
          : "border border-[#b03a2e] bg-[#fbf3f2] text-[#b03a2e]"
      }`}
      aria-label={showMet ? "Practice status: met" : "Practice status: not met"}
    >
      <span
        className={`inline-block h-1.5 w-1.5 ${
          showMet ? "bg-white" : "bg-[#b03a2e]"
        }`}
      />
      {showMet ? "Met" : "Not met"}
    </span>
  );
}

function CharlieBubble({
  children,
  compact,
  tone,
}: {
  children: React.ReactNode;
  compact?: boolean;
  tone?: "follow";
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex flex-none items-center justify-center bg-[#0e2a23] font-mono font-bold text-[#bdf2cf] ${
          compact ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
        }`}
      >
        C
      </div>
      <div
        className={`min-w-0 flex-1 border bg-white ${
          compact ? "px-3 py-2" : "px-4 py-3"
        } ${
          tone === "follow"
            ? "border-[#cfe3d9] bg-[#f7fcf9]"
            : "border-[#cfe3d9]"
        }`}
      >
        <div className={`${compact ? "text-xs" : "text-sm"} leading-relaxed text-[#10231d]`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ log }: { log: AnswerLog[number] }) {
  const text =
    log.kind === "choice"
      ? log.choice.label
      : log.kind === "evidence"
        ? log.pathLabel
        : log.label;
  return (
    <div className="mt-2 flex justify-end">
      <div className="max-w-[80%] bg-[#0e2a23] px-3 py-1.5 text-xs font-semibold text-[#bdf2cf]">
        {text}
      </div>
    </div>
  );
}

function RemediationNote({ text }: { text: string }) {
  return (
    <div className="mt-2 ml-12 border-l-2 border-[#a06b1a] bg-[#fff8ec] px-3 py-2 text-xs leading-relaxed text-[#704708]">
      <span className="font-bold uppercase tracking-wider text-[10px] text-[#a06b1a]">
        Remediation note
      </span>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}

/* =========================== choice list =========================== */

function ChoiceList({
  step,
  onPick,
}: {
  step: Extract<QuizStep, { kind: "multiple_choice" }>;
  onPick: (c: Choice) => void;
}) {
  return (
    <div className="space-y-2">
      {step.choices.map((c) => {
        const accent =
          c.tone === "ok"
            ? "#2f8f6d"
            : c.tone === "warn"
              ? "#a06b1a"
              : c.tone === "danger"
                ? "#b03a2e"
                : "#0e2a23";
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onPick(c)}
            className="group flex w-full items-start gap-3 border border-[#cfe3d9] bg-white p-3 text-left transition-all hover:border-[#0e2a23] hover:shadow-[0_2px_0_rgba(14,48,37,0.06)]"
          >
            <span
              className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center font-mono text-[9px] font-bold transition-colors"
              style={{ borderColor: accent, color: accent, border: `1.5px solid ${accent}` }}
            >
              &middot;
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#10231d] group-hover:text-[#0e2a23]">
                {c.label}
              </span>
              {c.hint && (
                <span className="mt-0.5 block text-xs leading-snug text-[#5a7d70]">
                  {c.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================== evidence picker =========================== */

function EvidencePicker({
  step,
  assessmentId,
  controlId,
  connectedProviders,
  vaultForms,
  uploadEvidenceAction,
  submitVaultEntryAction,
  onResolved,
  onSkip,
}: {
  step: Extract<QuizStep, { kind: "evidence_picker" }>;
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  vaultForms: Record<string, VaultForm>;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  submitVaultEntryAction: (formData: FormData) => Promise<void> | void;
  onResolved: (pathLabel: string) => void;
  onSkip: (label: string) => void;
}) {
  const [openPath, setOpenPath] = useState<string | null>(null);

  return (
    <div>
      {step.stem && (
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f8f6d]">
          {step.stem}
        </p>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {step.paths.map((p, i) => {
          const key = pathKey(p, i);
          const isOpen = openPath === key;
          return (
            <div key={key} className={isOpen ? "md:col-span-2" : "md:col-span-1"}>
              <PathButton
                path={p}
                connected={
                  p.kind === "connector" ? connectedProviders.includes(p.provider) : false
                }
                onOpen={() => setOpenPath(isOpen ? null : key)}
                isOpen={isOpen}
              />
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 border border-[#cfe3d9] bg-white p-4">
                      <PathBody
                        path={p}
                        connected={
                          p.kind === "connector"
                            ? connectedProviders.includes(p.provider)
                            : false
                        }
                        assessmentId={assessmentId}
                        controlId={controlId}
                        vaultForms={vaultForms}
                        uploadEvidenceAction={uploadEvidenceAction}
                        submitVaultEntryAction={submitVaultEntryAction}
                        onResolved={(label) => {
                          setOpenPath(null);
                          onResolved(label);
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      {step.allowSkip && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onSkip(step.skipLabel ?? "Skipped")}
            className="text-xs font-semibold text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline"
          >
            {step.skipLabel ?? "Skip this step"}
          </button>
        </div>
      )}
    </div>
  );
}

function pathKey(p: EvidencePath, i: number) {
  if (p.kind === "connector") return `c-${p.provider}-${i}`;
  if (p.kind === "template") return `t-${p.filename}-${i}`;
  if (p.kind === "vault") return `v-${p.formId}-${i}`;
  return `u-${i}`;
}

function PathButton({
  path,
  connected,
  onOpen,
  isOpen,
}: {
  path: EvidencePath;
  connected: boolean;
  onOpen: () => void;
  isOpen: boolean;
}) {
  const icon =
    path.kind === "connector"
      ? PROVIDER_ICON[path.provider]
      : path.kind === "vault"
        ? "V"
        : path.kind === "template"
          ? "T"
          : "\u2191";
  const accent =
    path.kind === "connector" ? (connected ? "#2f8f6d" : "#0e2a23") : "#0e2a23";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 border bg-white p-3 text-left transition-all hover:shadow-[0_2px_0_rgba(14,48,37,0.06)] ${
        isOpen ? "border-[#0e2a23]" : "border-[#cfe3d9] hover:border-[#0e2a23]"
      }`}
    >
      <span
        className="flex h-8 w-8 flex-none items-center justify-center font-mono text-xs font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#10231d]">{path.label}</span>
          {path.kind === "connector" && (
            <span
              className="px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: connected ? "#2f8f6d" : "#e4eee8",
                color: connected ? "white" : "#5a7d70",
              }}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-[#5a7d70]">
          {path.hint}
        </span>
      </span>
    </button>
  );
}

function PathBody({
  path,
  connected,
  assessmentId,
  controlId,
  vaultForms,
  uploadEvidenceAction,
  submitVaultEntryAction,
  onResolved,
}: {
  path: EvidencePath;
  connected: boolean;
  assessmentId: string;
  controlId: string;
  vaultForms: Record<string, VaultForm>;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  submitVaultEntryAction: (formData: FormData) => Promise<void> | void;
  onResolved: (label: string) => void;
}) {
  if (path.kind === "connector") {
    if (connected) {
      return (
        <div>
          <p className="text-xs leading-relaxed text-[#10231d]">
            <span className="font-bold text-[#2f8f6d]">Connected. </span>
            Charlie can pull this from your {PROVIDER_LABEL[path.provider]} tenant
            automatically. (Auto-pull is being rolled out — for now, click below
            to mark it as collected and Charlie will fetch on the next run.)
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onResolved(`Auto-pull from ${PROVIDER_LABEL[path.provider]}`)}
              className="bg-[#2f8f6d] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#247856]"
            >
              {"Use auto-pull \u2192"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="text-xs leading-relaxed text-[#10231d]">
          Connect your {PROVIDER_LABEL[path.provider]} tenant once and Charlie
          will auto-collect this evidence (and most of the other practices)
          without asking again.
        </p>
        <div className="mt-3 flex justify-end">
          <Link
            href="/assessments/connections"
            className="bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            {`Connect ${PROVIDER_LABEL[path.provider]} \u2192`}
          </Link>
        </div>
      </div>
    );
  }

  if (path.kind === "template") {
    return (
      <div>
        <p className="text-xs leading-relaxed text-[#10231d]">
          Download the template, fill it out, and upload it back here.
          Charlie will then verify it.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <a
            href={`/templates/${path.filename}`}
            download
            className="border border-[#0e2a23] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0e2a23] transition-colors hover:bg-[#0e2a23] hover:text-[#bdf2cf]"
          >
            {`\u2193 ${path.filename}`}
          </a>
        </div>
        <div className="mt-3 border-t border-[#e4eee8] pt-3">
          <UploadInline
            assessmentId={assessmentId}
            controlId={controlId}
            uploadEvidenceAction={uploadEvidenceAction}
            onDone={() => onResolved(`Uploaded filled template (${path.filename})`)}
          />
        </div>
      </div>
    );
  }

  if (path.kind === "vault") {
    const form = vaultForms[path.formId];
    if (!form) return <p className="text-xs text-[#b03a2e]">Form not found.</p>;
    return (
      <VaultEntryForm
        form={form}
        assessmentId={assessmentId}
        controlId={controlId}
        submitVaultEntryAction={submitVaultEntryAction}
        onDone={() => onResolved(`Filled in Vault: ${form.title}`)}
      />
    );
  }

  // upload
  return (
    <UploadInline
      assessmentId={assessmentId}
      controlId={controlId}
      uploadEvidenceAction={uploadEvidenceAction}
      onDone={() => onResolved("Uploaded existing evidence")}
    />
  );
}

/* =========================== upload inline =========================== */

function UploadInline({
  assessmentId,
  controlId,
  uploadEvidenceAction,
  onDone,
}: {
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  onDone: () => void;
}) {
  // Wrap upload action so we can fire onDone after it resolves.
  const wrapped = async (fd: FormData) => {
    await Promise.resolve(uploadEvidenceAction(fd));
    onDone();
  };
  return (
    <EvidenceDropzone
      action={wrapped}
      assessmentId={assessmentId}
      controlId={controlId}
      compact
    />
  );
}

/* =========================== vault entry form =========================== */

function VaultEntryForm({
  form,
  assessmentId,
  controlId,
  submitVaultEntryAction,
  onDone,
}: {
  form: VaultForm;
  assessmentId: string;
  controlId: string;
  submitVaultEntryAction: (formData: FormData) => Promise<void> | void;
  onDone: () => void;
}) {
  const blankRow = useMemo(
    () => Object.fromEntries(form.fields.map((f) => [f.key, ""])) as Record<string, string>,
    [form.fields],
  );
  const [rows, setRows] = useState<Record<string, string>[]>([{ ...blankRow }]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const updateCell = (i: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...blankRow }]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const submit = () => {
    setError(null);
    // Drop empty rows
    const filled = rows.filter((r) =>
      form.fields.some((f) => (r[f.key] ?? "").trim().length > 0),
    );
    if (filled.length === 0) {
      setError("Add at least one row before saving.");
      return;
    }
    // Required-field check
    for (let i = 0; i < filled.length; i++) {
      for (const f of form.fields) {
        if (f.required && !(filled[i][f.key] ?? "").trim()) {
          setError(`Row ${i + 1}: "${f.label}" is required.`);
          return;
        }
      }
    }

    const headers = form.fields.map((f) => f.label);
    const matrix = filled.map((r) => form.fields.map((f) => r[f.key] ?? ""));

    const fd = new FormData();
    fd.set("assessmentId", assessmentId);
    fd.set("controlId", controlId);
    fd.set("title", form.title);
    fd.set("filenameStem", form.filenameStem);
    fd.set("headers", JSON.stringify(headers));
    fd.set("rows", JSON.stringify(matrix));

    startTransition(async () => {
      try {
        await Promise.resolve(submitVaultEntryAction(fd));
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save vault entry.");
      }
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[#10231d]">{form.title}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#5a7d70]">
          Saves as a spreadsheet in your vault
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="border border-[#cfe3d9] bg-[#fbfdfb] p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5a7d70]">
                Row {i + 1}
              </span>
              {form.repeating && rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-[10px] font-semibold text-[#b03a2e] hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {form.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5a7d70]">
                    {f.label}
                    {f.required && <span className="text-[#b03a2e]"> *</span>}
                  </span>
                  {f.type === "select" ? (
                    <select
                      value={row[f.key] ?? ""}
                      onChange={(e) => updateCell(i, f.key, e.target.value)}
                      className="mt-1 w-full border border-[#cfe3d9] bg-white px-2 py-1.5 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
                    >
                      <option value="">Pick one…</option>
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      value={row[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => updateCell(i, f.key, e.target.value)}
                      className="mt-1 w-full border border-[#cfe3d9] bg-white px-2 py-1.5 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {form.repeating ? (
          <button
            type="button"
            onClick={addRow}
            className="border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#10231d] transition-colors hover:border-[#0e2a23]"
          >
            + Add another row
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="bg-[#0e2a23] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving to Vault\u2026" : "Save to Vault \u2192"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-[#b03a2e]">{error}</p>
      )}
    </div>
  );
}

/* =========================== summary =========================== */

function SummaryCard({
  quiz,
  answers,
  stepEvidence,
  verdict,
  submitting,
  onLockIn,
  nextId,
  showCompleted,
}: {
  quiz: PracticeQuiz;
  answers: AnswerLog;
  stepEvidence: Record<string, string>;
  verdict: "met" | "not_met";
  submitting: boolean;
  onLockIn: () => void;
  nextId: string | null;
  showCompleted: boolean;
}) {
  const objectiveStatus: Record<string, "met" | "fail" | "open"> = {};
  // Initial state from quiz steps
  for (const s of quiz.steps) {
    if (s.kind === "evidence_picker") {
      const got = !!stepEvidence[s.id];
      for (const obj of s.satisfies) {
        objectiveStatus[obj] = got ? "met" : "open";
      }
    }
  }
  for (const a of answers) {
    if (a.kind === "choice") {
      for (const o of a.choice.satisfies ?? []) objectiveStatus[o] = "met";
      for (const o of a.choice.failsObjectives ?? []) objectiveStatus[o] = "fail";
    }
  }

  return (
    <div className="border border-[#cfe3d9] bg-white p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center font-mono text-sm font-bold text-white"
          style={{
            backgroundColor: verdict === "met" ? "#2f8f6d" : "#a06b1a",
          }}
        >
          {verdict === "met" ? "\u2713" : "!"}
        </span>
        <div>
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: verdict === "met" ? "#2f8f6d" : "#a06b1a" }}
          >
            {verdict === "met" ? "Ready to mark MET" : "Will mark NOT MET"}
          </p>
          <p className="mt-1 text-sm text-[#10231d]">
            {verdict === "met"
              ? "Every objective has either evidence in your vault or an attestation. Lock it in to draft your SSP language and move on."
              : "One or more objectives are at risk. Locking in will record this as NOT MET and Charlie will draft a remediation plan you can work through."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {Object.entries(objectiveStatus).map(([letter, status]) => (
          <div
            key={letter}
            className="flex items-center gap-3 border border-[#e4eee8] bg-[#fbfdfb] px-3 py-2"
          >
            <span
              className="inline-flex h-6 w-6 flex-none items-center justify-center font-mono text-[10px] font-bold"
              style={{
                backgroundColor:
                  status === "met"
                    ? "#2f8f6d"
                    : status === "fail"
                      ? "#b03a2e"
                      : "#e4eee8",
                color: status === "open" ? "#5a7d70" : "white",
              }}
            >
              {status === "met" ? "\u2713" : status === "fail" ? "\u00d7" : `[${letter}]`}
            </span>
            <span className="font-mono text-[11px] text-[#5a7d70]">
              Objective [{letter}]
            </span>
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider"
              style={{
                color:
                  status === "met"
                    ? "#2f8f6d"
                    : status === "fail"
                      ? "#b03a2e"
                      : "#a06b1a",
              }}
            >
              {status === "met" ? "Met" : status === "fail" ? "Not Met" : "Open"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onLockIn}
          disabled={submitting || showCompleted}
          className="bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Saving\u2026"
            : nextId
              ? "Lock it in \u2192 next practice"
              : "Lock it in \u2192 finish"}
        </button>
      </div>
    </div>
  );
}

/* =========================== utilities =========================== */

function compactCharlieLine(s: QuizStep): string {
  // Collapse to a single line for the chat history scroll-back view.
  const raw =
    s.kind === "intro"
      ? "Walked through what this practice is about."
      : s.kind === "multiple_choice"
        ? firstSentence(s.charlieSays)
        : s.kind === "evidence_picker"
          ? firstSentence(s.charlieSays)
          : firstSentence(s.charlieSays);
  return raw;
}

function firstSentence(t: string): string {
  // Strip markdown bold for the compact view.
  const plain = t.replace(/\*\*/g, "");
  const m = plain.match(/^(.+?[.?!])\s/);
  return m ? m[1] : plain.slice(0, 120);
}

/**
 * Tiny markdown renderer for **bold** in Charlie's lines. Anything else is
 * rendered as plain text — we deliberately don't pull in a full md lib.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-bold text-[#0e2a23]">
              {p.slice(2, -2)}
            </strong>
          );
        }
        // preserve paragraph breaks
        return p.split("\n\n").map((para, j, arr) => (
          <span key={`${i}-${j}`}>
            {para}
            {j < arr.length - 1 && <span className="block h-2" />}
          </span>
        ));
      })}
    </>
  );
}
