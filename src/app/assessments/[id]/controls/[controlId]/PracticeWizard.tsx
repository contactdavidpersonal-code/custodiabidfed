"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type StepKey = "check" | "capture" | "write" | "done";
const STEPS: Array<{ key: StepKey; label: string; subtitle: string }> = [
  {
    key: "check",
    label: "Quick check",
    subtitle: "A few plain-English questions",
  },
  {
    key: "capture",
    label: "Capture evidence",
    subtitle: "Upload what proves it",
  },
  { key: "write", label: "Your answer", subtitle: "Status + narrative" },
  { key: "done", label: "Review", subtitle: "Lock it in" },
];

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

type QuizAnswer = "yes" | "no" | null;

/**
 * The whole control practice page is now a 4-step guided quiz that walks
 * non-technical users from "what is this asking" to "saved and verified"
 * without making them parse 17 sections. Steps: Check → Capture → Write →
 * Done. Each step persists its progress through server actions; the active
 * step survives revalidation via the `?step=` URL param.
 */
export function PracticeWizard(props: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const stepFromUrl = (params.get("step") as StepKey) || null;

  // Auto-pick the right step the first time the user lands on a control.
  const initialStep: StepKey = useMemo(() => {
    if (stepFromUrl && STEPS.some((s) => s.key === stepFromUrl)) {
      return stepFromUrl;
    }
    if (props.response.status !== "unanswered" && props.response.narrative) {
      return "done";
    }
    if (props.evidence.length > 0) return "write";
    if (props.response.status !== "unanswered") return "capture";
    return "check";
  }, [stepFromUrl, props.response.status, props.response.narrative, props.evidence.length]);

  const [step, setStep] = useState<StepKey>(initialStep);

  useEffect(() => {
    if (step !== initialStep && stepFromUrl !== step) {
      const url = new URL(window.location.href);
      url.searchParams.set("step", step);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [step, initialStep, stepFromUrl, router]);

  // Track which steps the user has completed (for the stepper checkmarks).
  const completion: Record<StepKey, boolean> = {
    check: props.response.status !== "unanswered",
    capture:
      props.response.status === "not_applicable" ||
      props.evidence.some((e) => e.ai_review_verdict === "sufficient") ||
      props.evidence.length > 0,
    write:
      props.response.status !== "unanswered" &&
      (props.response.narrative ?? "").trim().length >= 20,
    done:
      props.response.status !== "unanswered" &&
      (props.response.narrative ?? "").trim().length >= 20 &&
      (props.response.status === "not_applicable" ||
        props.evidence.length > 0),
  };

  const goTo = (s: StepKey) => {
    setStep(s);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
          <span className="text-[#cfe3d9]">·</span>
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

      {/* Stepper */}
      <ol className="mb-6 grid gap-2 rounded-md border border-[#cfe3d9] bg-white p-2 shadow-[0_2px_0_rgba(14,48,37,0.04)] sm:grid-cols-4">
        {STEPS.map((s, idx) => {
          const isActive = s.key === step;
          const isDone = completion[s.key];
          const canJump = idx === 0 || completion[STEPS[idx - 1].key] || isDone;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && goTo(s.key)}
                className={`relative w-full rounded-sm px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-[#0e2a23] text-[#bdf2cf]"
                    : isDone
                      ? "bg-[#f7fcf9] text-[#10231d] hover:bg-[#eaf3ee]"
                      : canJump
                        ? "text-[#10231d] hover:bg-[#f7fcf9]"
                        : "cursor-not-allowed text-[#7a9c90]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm font-mono text-[11px] font-bold ${
                      isActive
                        ? "bg-[#bdf2cf] text-[#0e2a23]"
                        : isDone
                          ? "bg-[#0e2a23] text-[#bdf2cf]"
                          : "bg-[#cfe3d9] text-[#10231d]"
                    }`}
                  >
                    {isDone && !isActive ? "✓" : idx + 1}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {s.label}
                  </span>
                </div>
                <span
                  className={`mt-1 block truncate pl-7 text-[11px] ${
                    isActive
                      ? "text-[#bdf2cf]/80"
                      : "text-[#5a7d70]"
                  }`}
                >
                  {s.subtitle}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Active step body */}
      <div className="rounded-md border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]">
        {step === "check" && (
          <CheckStep
            quiz={props.quiz}
            practice={props.practice}
            response={props.response}
            saveResponseAction={props.saveResponseAction}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            onAdvance={() => goTo("capture")}
          />
        )}
        {step === "capture" && (
          <CaptureStep
            practice={props.practice}
            evidence={props.evidence}
            response={props.response}
            uploadEvidenceAction={props.uploadEvidenceAction}
            deleteEvidenceAction={props.deleteEvidenceAction}
            reReviewEvidenceAction={props.reReviewEvidenceAction}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            onBack={() => goTo("check")}
            onAdvance={() => goTo("write")}
          />
        )}
        {step === "write" && (
          <WriteStep
            response={props.response}
            evidence={props.evidence}
            saveResponseAction={props.saveResponseAction}
            useSuggestedNarrativeAction={props.useSuggestedNarrativeAction}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            onBack={() => goTo("capture")}
            onAdvance={() => goTo("done")}
          />
        )}
        {step === "done" && (
          <DoneStep
            practice={props.practice}
            response={props.response}
            evidence={props.evidence}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
            nextId={props.nextId}
            prevId={props.prevId}
            remediationPlan={props.remediationPlan}
            upsertRemediationPlanAction={props.upsertRemediationPlanAction}
            onEdit={() => goTo("check")}
          />
        )}
      </div>
    </div>
  );
}

/* ============================ STEP 1: CHECK =============================== */

function CheckStep({
  quiz,
  practice,
  response,
  saveResponseAction,
  assessmentId,
  controlId,
  onAdvance,
}: {
  quiz: PracticeQuizQuestion[];
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  response: ControlResponseRow;
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  assessmentId: string;
  controlId: string;
  onAdvance: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>(() =>
    Object.fromEntries(quiz.map((q) => [q.id, null])),
  );
  const [naReason, setNaReason] = useState("");
  const [isNA, setIsNA] = useState(response.status === "not_applicable");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const total = quiz.length;
  const answered = Object.values(answers).filter((a) => a !== null).length;
  const yesCount = Object.values(answers).filter((a) => a === "yes").length;
  const noCount = Object.values(answers).filter((a) => a === "no").length;
  const allAnswered = answered === total && total > 0;

  const recommendation: "yes" | "partial" | "no" | null = useMemo(() => {
    if (!allAnswered) return null;
    if (yesCount === total) return "yes";
    if (noCount === total) return "no";
    return "partial";
  }, [allAnswered, yesCount, noCount, total]);

  const gaps = quiz
    .filter((q) => answers[q.id] === "no")
    .map((q) => ({ id: q.id, gap: q.gap }));

  const submit = (statusValue: string) => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("status", statusValue);
    fd.set("narrative", response.narrative ?? "");
    setSubmitting(true);
    Promise.resolve(saveResponseAction(fd)).finally(() => {
      setSubmitting(false);
      onAdvance();
    });
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
        Step 1 of 4
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#10231d]">
        Quick check
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
        Answer in plain English. We&rsquo;ll route you to the right answer
        automatically. Not sure? Ask the officer on the right anytime.
      </p>

      {practice.whyItMatters && (
        <div className="mt-4 rounded-sm border border-[#e5d6c2] bg-[#fdf8ef] px-4 py-3 text-sm leading-relaxed text-[#10231d]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
            Why this matters
          </p>
          <p className="mt-1">{practice.whyItMatters}</p>
        </div>
      )}

      <form ref={formRef} className="hidden">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="controlId" value={controlId} />
      </form>

      <ol className="mt-6 divide-y divide-[#e4eee8] rounded-sm border border-[#cfe3d9]">
        {quiz.map((q, idx) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#0e2a23] font-mono text-xs font-bold text-[#bdf2cf]">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-[#10231d]">
                    {q.prompt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNA(false);
                        setAnswers((p) => ({ ...p, [q.id]: "yes" }));
                      }}
                      className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                        a === "yes"
                          ? "bg-[#0e2a23] text-[#bdf2cf]"
                          : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNA(false);
                        setAnswers((p) => ({ ...p, [q.id]: "no" }));
                      }}
                      className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                        a === "no"
                          ? "bg-[#b03a2e] text-white"
                          : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#b03a2e] hover:bg-[#fdf2f0]"
                      }`}
                    >
                      Not yet
                    </button>
                  </div>
                  {a === "yes" && (
                    <p className="mt-2 text-xs text-[#2f8f6d]">
                      Good — {q.yesMeans.toLowerCase()}
                    </p>
                  )}
                  {a === "no" && (
                    <p className="mt-2 text-xs text-[#a06b1a]">
                      Gap: {q.gap}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* N/A escape hatch */}
      <div className="mt-4 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={isNA}
            onChange={(e) => {
              setIsNA(e.target.checked);
              if (e.target.checked) {
                setAnswers(
                  Object.fromEntries(quiz.map((q) => [q.id, null])),
                );
              }
            }}
            className="mt-0.5 h-4 w-4 flex-none accent-[#0e2a23]"
          />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-[#10231d]">
              This practice doesn&rsquo;t apply to my business
            </span>
            <p className="mt-0.5 text-xs text-[#5a7d70]">
              Use sparingly. You&rsquo;ll need to briefly explain why on the
              next step.
            </p>
            {isNA && (
              <textarea
                value={naReason}
                onChange={(e) => setNaReason(e.target.value)}
                rows={2}
                placeholder="E.g. We have no physical office — all staff work from personal residences and contract info is fully cloud-hosted."
                className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] outline-none transition-colors focus:border-[#0e2a23]"
              />
            )}
          </div>
        </label>
      </div>

      {/* Recommendation + advance */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {isNA ? (
          <button
            type="button"
            disabled={submitting || naReason.trim().length < 10}
            onClick={() => submit("not_applicable")}
            className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Mark N/A and continue →"}
          </button>
        ) : recommendation ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
                Recommendation
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#10231d]">
                {recommendation === "yes" &&
                  "Looks like a clean Met. Let's grab the evidence."}
                {recommendation === "partial" &&
                  "Partway there — we'll mark this Partial and capture what you have."}
                {recommendation === "no" &&
                  "Not in place yet. We'll mark Not met and build a fix plan."}
              </p>
              {gaps.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[#10231d]">
                  {gaps.map((g) => (
                    <li key={g.id}>
                      <span className="font-semibold text-[#a06b1a]">
                        Fix:&nbsp;
                      </span>
                      {g.gap}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(recommendation)}
              className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:opacity-40"
            >
              {submitting
                ? "Saving…"
                : `Mark as ${STATUS_LABELS[recommendation]} →`}
            </button>
          </div>
        ) : (
          <p className="text-xs text-[#5a7d70]">
            Answer all {total} question{total === 1 ? "" : "s"} to continue.
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================ STEP 2: CAPTURE ============================= */

function CaptureStep({
  practice,
  evidence,
  response,
  uploadEvidenceAction,
  deleteEvidenceAction,
  reReviewEvidenceAction,
  assessmentId,
  controlId,
  onBack,
  onAdvance,
}: {
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  evidence: EvidenceArtifactRow[];
  response: ControlResponseRow;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  deleteEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  assessmentId: string;
  controlId: string;
  onBack: () => void;
  onAdvance: () => void;
}) {
  const providers = practice.providerGuidance;
  const [activeProvider, setActiveProvider] = useState<EvidenceProvider>(
    providers[0]?.provider ?? "manual",
  );
  const guidance =
    providers.find((p) => p.provider === activeProvider) ?? providers[0];

  const isNA = response.status === "not_applicable";
  const sufficientCount = evidence.filter(
    (e) => e.ai_review_verdict === "sufficient",
  ).length;
  const canAdvance = isNA || sufficientCount > 0 || evidence.length > 0;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
        Step 2 of 4
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#10231d]">
        Capture evidence
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
        {isNA
          ? "Skip this step — N/A practices don't need evidence. Click Continue to write a brief explanation."
          : "Upload screenshots or PDFs that prove you do this. The platform reviews each upload and tells you if it's enough."}
      </p>

      {!isNA && providers.length > 0 && guidance && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
              Pick your setup
            </p>
            <div className="flex flex-wrap gap-1.5">
              {providers.map((p) => (
                <button
                  key={p.provider}
                  type="button"
                  onClick={() => setActiveProvider(p.provider)}
                  className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeProvider === p.provider
                      ? "bg-[#0e2a23] text-[#bdf2cf]"
                      : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
                  }`}
                >
                  {providerLabel[p.provider]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] p-4">
            <p className="text-sm font-semibold text-[#10231d]">
              {guidance.label}
              <span className="ml-2 text-xs font-medium text-[#5a7d70]">
                {providerLabel[guidance.provider]}
              </span>
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#10231d]">
              {guidance.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="mt-3 rounded-sm bg-white px-3 py-2 text-sm leading-relaxed text-[#10231d] ring-1 ring-inset ring-[#cfe3d9]">
              <span className="font-semibold">What we need:&nbsp;</span>
              {guidance.capture}
            </div>
            {guidance.adminUrl && (
              <div className="mt-3 rounded-sm border border-[#cfe3d9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
                  Jump straight to the right page
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
                  Opens the {providerLabel[guidance.provider]} admin page for
                  this control in a new tab. Sign in if prompted, then take
                  the screenshots described above.
                </p>
                <a
                  href={guidance.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-[#0e2a23] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:bg-[#0e2a23] hover:text-[#bdf2cf]"
                >
                  Open in {providerLabel[guidance.provider]} ↗
                </a>
              </div>
            )}
            {guidance.template && (
              <div className="mt-3 rounded-sm border border-[#cfe3d9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
                  Use our template
                </p>
                <p className="mt-1 text-sm font-semibold text-[#10231d]">
                  {guidance.template.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
                  {guidance.template.description}
                </p>
                <a
                  href={`/templates/${guidance.template.filename}`}
                  download
                  className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-[#0e2a23] px-3 py-1.5 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  Download template
                </a>
              </div>
            )}
          </div>

          <div className="mt-5">
            <EvidenceDropzone
              action={uploadEvidenceAction}
              assessmentId={assessmentId}
              controlId={controlId}
            />
          </div>

          {evidence.length > 0 && (
            <ul className="mt-5 divide-y divide-[#e4eee8] rounded-sm border border-[#cfe3d9]">
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
          )}

          {evidence.length > 0 && sufficientCount === 0 && (
            <div className="mt-4 rounded-sm border border-[#e5d6c2] bg-[#fdf8ef] px-4 py-3 text-xs leading-relaxed text-[#10231d]">
              <span className="font-semibold text-[#a06b1a]">Heads up:</span>{" "}
              No upload has come back &lsquo;Sufficient&rsquo; from the
              automated reviewer yet. You can continue, but the evidence may
              not count toward attestation. Try Re-review or upload a clearer
              capture.
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#10231d] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!canAdvance}
          onClick={onAdvance}
          className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:opacity-40"
        >
          {isNA ? "Continue →" : "I'm done capturing →"}
        </button>
      </div>
    </div>
  );
}

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
        ? {
            pill: "bg-[#b03a2e] text-white",
            label: "Insufficient",
          }
        : a.ai_review_verdict === "unclear"
          ? {
              pill: "bg-[#a06b1a] text-white",
              label: "Unclear",
            }
          : a.ai_review_verdict === "not_relevant"
            ? {
                pill: "bg-[#5a7d70] text-white",
                label: "Not relevant",
              }
            : { pill: "bg-[#cfe3d9] text-[#10231d]", label: "Reviewing…" };

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
                {a.filename}
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

/* ============================ STEP 3: WRITE =============================== */

function WriteStep({
  response,
  evidence,
  saveResponseAction,
  useSuggestedNarrativeAction,
  assessmentId,
  controlId,
  onBack,
  onAdvance,
}: {
  response: ControlResponseRow;
  evidence: EvidenceArtifactRow[];
  saveResponseAction: (formData: FormData) => Promise<void> | void;
  useSuggestedNarrativeAction: (formData: FormData) => Promise<void> | void;
  assessmentId: string;
  controlId: string;
  onBack: () => void;
  onAdvance: () => void;
}) {
  const [narrative, setNarrative] = useState(response.narrative ?? "");
  const [status, setStatus] = useState(
    response.status === "unanswered" ? "yes" : response.status,
  );
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const wordCount = narrative.trim().split(/\s+/).filter(Boolean).length;
  const isNA = status === "not_applicable";
  const mentionsSystem =
    /\b(microsoft|defender|google|workspace|okta|active directory|windows|macos|aws|azure|router|firewall|laptop|server|gmail|outlook|365|m365|antivirus|vpn|password manager|bitwarden|1password|proton|chromebook|onedrive|sharepoint|teams|slack|github|gitlab)\b/i.test(
      narrative,
    );
  const hasCadence =
    /\b(daily|weekly|monthly|quarterly|annually|yearly|each|every|nightly|hourly|real[- ]?time)\b/i.test(
      narrative,
    );
  const referencesEvidence =
    /\b(screenshot|policy|export|csv|pdf|attached|uploaded|matrix|roster|signed|attestation|log|report|dashboard)\b/i.test(
      narrative,
    );

  const checks = isNA
    ? [
        {
          ok: wordCount >= 15,
          label: "At least 15 words explaining why N/A",
        },
      ]
    : [
        { ok: wordCount >= 30, label: "At least 30 words" },
        { ok: mentionsSystem, label: "Names a system or tool" },
        { ok: hasCadence, label: "Says how often (cadence)" },
        { ok: referencesEvidence, label: "Cites the evidence you uploaded" },
      ];
  const allOk = checks.every((c) => c.ok);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setSubmitting(true);
    try {
      await Promise.resolve(saveResponseAction(fd));
      onAdvance();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
        Step 3 of 4
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#10231d]">
        Your answer
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
        Confirm the status and write a short narrative. This is the paragraph
        an auditor will read in your SSP.
      </p>

      <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-5">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="controlId" value={controlId} />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-[#10231d]">
            Status
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  v: "yes",
                  label: "Met",
                  desc: "We do this and we have evidence.",
                },
                {
                  v: "partial",
                  label: "Partial",
                  desc: "Some places, not everywhere.",
                },
                {
                  v: "no",
                  label: "Not met",
                  desc: "We don't do this yet.",
                },
                {
                  v: "not_applicable",
                  label: "N/A",
                  desc: "Genuinely doesn't apply.",
                },
              ] as Array<{ v: string; label: string; desc: string }>
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-2.5 transition-colors ${
                  status === opt.v
                    ? "border-[#0e2a23] bg-[#f7fcf9]"
                    : "border-[#cfe3d9] bg-white hover:border-[#2f8f6d]"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.v}
                  checked={status === opt.v}
                  onChange={() => setStatus(opt.v as typeof status)}
                  className="mt-0.5 h-4 w-4 flex-none accent-[#0e2a23]"
                />
                <span className="block">
                  <span className="text-sm font-bold text-[#10231d]">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#5a7d70]">
                    {opt.desc}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-[#10231d]">
              Narrative
            </span>
            <span className="text-xs text-[#5a7d70]">
              {wordCount} word{wordCount === 1 ? "" : "s"}
            </span>
          </div>
          <textarea
            name="narrative"
            rows={7}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder={
              isNA
                ? "Briefly explain why this practice doesn't apply to your business."
                : "Describe what you do, where, and how often. Reference the evidence you captured."
            }
            className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#10231d] outline-none transition-colors placeholder:text-[#7a9c90] focus:border-[#0e2a23]"
          />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map((c, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-sm border px-3 py-2 text-xs leading-relaxed ${
                c.ok
                  ? "border-[#cfe3d9] bg-[#f7fcf9] text-[#10231d]"
                  : "border-[#e5d6c2] bg-[#fdf8ef] text-[#5a7d70]"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-sm text-[10px] font-bold ${
                  c.ok
                    ? "bg-[#0e2a23] text-[#bdf2cf]"
                    : "bg-white text-[#a06b1a] ring-1 ring-inset ring-[#e5d6c2]"
                }`}
              >
                {c.ok ? "✓" : "•"}
              </span>
              <span className={c.ok ? "font-medium" : ""}>{c.label}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#10231d] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
            >
              ← Back
            </button>
            <button
              type="submit"
              form="suggest-narrative-form"
              className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#10231d] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
            >
              Fill with suggestion
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting || !allOk}
            className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Save and review →"}
          </button>
        </div>
      </form>

      <form
        id="suggest-narrative-form"
        action={useSuggestedNarrativeAction}
        className="hidden"
      >
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="controlId" value={controlId} />
      </form>

      {evidence.length === 0 && !isNA && (
        <p className="mt-4 text-xs text-[#5a7d70]">
          Tip: jump back to step 2 to attach evidence first — it makes a much
          stronger narrative.
        </p>
      )}
    </div>
  );
}

/* ============================ STEP 4: DONE ================================ */

function DoneStep({
  practice,
  response,
  evidence,
  assessmentId,
  controlId,
  nextId,
  prevId,
  remediationPlan,
  upsertRemediationPlanAction,
  onEdit,
}: {
  practice: Omit<ControlPlaybook, "suggestedNarrative">;
  response: ControlResponseRow;
  evidence: EvidenceArtifactRow[];
  assessmentId: string;
  controlId: string;
  nextId: string | null;
  prevId: string | null;
  remediationPlan: RemediationPlanRow | null;
  upsertRemediationPlanAction: (formData: FormData) => Promise<void> | void;
  onEdit: () => void;
}) {
  const sufficientCount = evidence.filter(
    (e) => e.ai_review_verdict === "sufficient",
  ).length;
  const isNA = response.status === "not_applicable";
  const isComplete =
    response.status !== "unanswered" &&
    (response.narrative ?? "").trim().length >= 20 &&
    (isNA || evidence.length > 0);

  const needsRemediation =
    response.status === "no" || response.status === "partial";

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
        Step 4 of 4
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#10231d]">
        {isComplete ? "Locked in" : "Almost there"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
        {isComplete
          ? "Nice work. This practice is ready for your annual affirmation."
          : "A few things still need finishing — jump back to fix them."}
      </p>

      <dl className="mt-5 divide-y divide-[#e4eee8] rounded-sm border border-[#cfe3d9]">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
            Status
          </dt>
          <dd className="text-sm font-bold text-[#10231d]">
            {STATUS_LABELS[response.status] ?? "Not answered"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
            Evidence
          </dt>
          <dd className="text-sm text-[#10231d]">
            {isNA
              ? "—"
              : `${evidence.length} file${evidence.length === 1 ? "" : "s"} (${sufficientCount} sufficient)`}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
            Narrative
          </dt>
          <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#10231d]">
            {response.narrative || "—"}
          </dd>
        </div>
      </dl>

      {needsRemediation && !remediationPlan && (
        <RemediationInline
          assessmentId={assessmentId}
          controlId={controlId}
          plan={remediationPlan}
          status={response.status}
          upsertRemediationPlanAction={upsertRemediationPlanAction}
        />
      )}

      {remediationPlan && (
        <RemediationInline
          assessmentId={assessmentId}
          controlId={controlId}
          plan={remediationPlan}
          status={response.status}
          upsertRemediationPlanAction={upsertRemediationPlanAction}
        />
      )}

      {practice.commonGotchas.length > 0 && (
        <details className="mt-5 rounded-sm border border-[#cfe3d9] bg-[#f7fcf9]">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-[#10231d]">
            Common gotchas auditors look for
          </summary>
          <ul className="list-disc space-y-1.5 px-8 pb-3 pt-1 text-sm text-[#10231d]">
            {practice.commonGotchas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#10231d] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
        >
          Edit answers
        </button>
        <div className="flex flex-wrap gap-2">
          {prevId && (
            <Link
              href={`/assessments/${assessmentId}/controls/${prevId}`}
              className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#10231d] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
            >
              ← Previous practice
            </Link>
          )}
          {nextId ? (
            <Link
              href={`/assessments/${assessmentId}/controls/${nextId}`}
              className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
            >
              Next practice →
            </Link>
          ) : (
            <Link
              href={`/assessments/${assessmentId}`}
              className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
            >
              Back to overview →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================== INLINE REMEDIATION (Done step) ==================== */

const REMEDIATION_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open - not started" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
  { value: "abandoned", label: "Abandoned" },
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
        ? "This practice is Partial. CMMC L1 has no half-credit - close the gap to Met before signing."
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
            &middot; {plan.status.replace("_", " ")} &middot; target {plan.target_close_date}
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
