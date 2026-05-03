"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  QUIZ_QUESTIONS,
  type QuizAnswer,
  type QuizQuestionId,
  type QuizResult,
} from "@/lib/cmmc/sprs-scoring";

type AnswersMap = Partial<Record<QuizQuestionId, QuizAnswer>>;
type Stage = "intro" | "quiz" | "contact";

const ANSWER_LABELS: Record<QuizAnswer, string> = {
  yes: "Yes",
  partial: "Mostly",
  no: "No",
  unsure: "Not sure",
};

const ANSWER_HELP: Record<QuizAnswer, string> = {
  yes: "Fully in place today",
  partial: "Some of this, not all",
  no: "Not yet",
  unsure: "Need to check",
};

// Cinematic Apple-style easing
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.83, 0, 0.17, 1] as const;

export default function SprsCheckClient() {
  const [stage, setStage] = useState<Stage>("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = QUIZ_QUESTIONS.length;
  const current = stage === "quiz" ? QUIZ_QUESTIONS[step] : null;
  const answered = Object.keys(answers).length;
  const progress = useMemo(
    () => Math.round((answered / total) * 100),
    [answered, total],
  );

  function setAnswer(id: QuizQuestionId, a: QuizAnswer) {
    setAnswers((prev) => ({ ...prev, [id]: a }));
    if (step + 1 < total) {
      setTimeout(() => setStep((s) => s + 1), 220);
    } else {
      setTimeout(() => setStage("contact"), 260);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sprs-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          email: email || null,
          companyName: companyName || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setResult(json.result as QuizResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ResultView result={result} answers={answers} />;
  }

  return (
    <div className="relative isolate overflow-hidden">
      {/* Ambient mint glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[640px] w-[1100px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_rgba(196,240,184,0.12),_transparent_70%)]"
      />

      {/* Top bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60 transition-colors hover:text-[#c4f0b8]"
        >
          &larr; Custodia
        </Link>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
          Federal Cyber Readiness Check
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:pt-16">
        <AnimatePresence mode="wait">
          {stage === "intro" && (
            <IntroStage key="intro" onBegin={() => setStage("quiz")} />
          )}

          {stage === "quiz" && current && (
            <QuizStage
              key={`q-${current.id}`}
              questionIndex={step}
              total={total}
              progress={progress}
              family={current.family}
              question={current.question}
              helper={current.helper}
              onAnswer={(a) => setAnswer(current.id, a)}
              onBack={
                step > 0
                  ? () => setStep((s) => s - 1)
                  : () => setStage("intro")
              }
            />
          )}

          {stage === "contact" && (
            <ContactStage
              key="contact"
              email={email}
              companyName={companyName}
              submitting={submitting}
              error={error}
              onEmail={setEmail}
              onCompany={setCompanyName}
              onBack={() => {
                setStage("quiz");
                setStep(total - 1);
              }}
              onSubmit={submit}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────── Intro ───────────── */

function IntroStage({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5, ease: EASE_OUT }}
        className="mx-auto mb-8 inline-flex items-center gap-2 border border-[#c4f0b8]/40 bg-[#0a2620] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c4f0b8]"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c4f0b8]" />
        Free · Two minutes · No login
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.7, ease: EASE_OUT }}
        className="font-serif text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl"
      >
        Find out if your company is{" "}
        <span className="text-[#c4f0b8]">bid-eligible</span> for federal contracts.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.6, ease: EASE_OUT }}
        className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
      >
        Twelve plain-English questions. We&apos;ll calculate the same Supplier
        Performance Risk System (SPRS) score that prime contractors look for,
        and give you a written gap report covering every one of the seventeen
        Cybersecurity Maturity Model Certification (CMMC) Level&nbsp;1 practices.
      </motion.p>

      {/* Trust strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.6, ease: EASE_OUT }}
        className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3 text-center"
      >
        {[
          { k: "12", v: "Plain-English questions" },
          { k: "~2 min", v: "To complete" },
          { k: "0", v: "Account required" },
        ].map((s) => (
          <div
            key={s.k}
            className="border border-white/10 bg-[#0a2620] px-3 py-5"
          >
            <div className="font-serif text-2xl text-white">{s.k}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {s.v}
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.6, ease: EASE_OUT }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <button
          type="button"
          onClick={onBegin}
          className="group inline-flex items-center gap-3 bg-[#c4f0b8] px-8 py-4 text-sm font-bold uppercase tracking-[0.18em] text-[#0a2620] transition-all hover:bg-white hover:tracking-[0.22em]"
        >
          Begin my readiness check
          <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
        </button>
        <p className="text-xs text-white/40">
          Used by founders preparing Department of Defense bids.
        </p>
      </motion.div>

      {/* Compliance reassurance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mx-auto mt-16 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-[11px] uppercase tracking-[0.2em] text-white/40"
      >
        <span>Mirrors DoD Assessment Methodology v1.2.1</span>
        <span aria-hidden>·</span>
        <span>Aligned to FAR&nbsp;52.204-21</span>
      </motion.div>
    </motion.div>
  );
}

/* ───────────── Quiz ───────────── */

function QuizStage({
  questionIndex,
  total,
  progress,
  family,
  question,
  helper,
  onAnswer,
  onBack,
}: {
  questionIndex: number;
  total: number;
  progress: number;
  family: string;
  question: string;
  helper: string;
  onAnswer: (a: QuizAnswer) => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress */}
      <div className="mb-10">
        <div className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
          <span>
            Question {questionIndex + 1} of {total}
          </span>
          <span className="text-[#c4f0b8]">{progress}% complete</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden bg-white/10">
          <motion.div
            className="h-full bg-[#c4f0b8]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="border border-white/10 bg-[#0a2620] p-8 sm:p-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4f0b8]"
          >
            {family}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5, ease: EASE_OUT }}
            className="font-serif text-2xl leading-tight tracking-tight text-white sm:text-3xl"
          >
            {question}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="mt-4 text-sm leading-relaxed text-white/65"
          >
            {helper}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.5 }}
            className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {(["yes", "partial", "no", "unsure"] as QuizAnswer[]).map((a, i) => (
              <motion.button
                key={a}
                type="button"
                onClick={() => onAnswer(a)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.26 + i * 0.05,
                  duration: 0.4,
                  ease: EASE_OUT,
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="group flex items-center justify-between border border-white/15 bg-[#0f3a2d] px-5 py-4 text-left transition-colors hover:border-[#c4f0b8] hover:bg-[#103930]"
              >
                <div>
                  <div className="text-base font-semibold text-white">
                    {ANSWER_LABELS[a]}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {ANSWER_HELP[a]}
                  </div>
                </div>
                <span className="text-[#c4f0b8] opacity-0 transition-opacity group-hover:opacity-100">
                  &rarr;
                </span>
              </motion.button>
            ))}
          </motion.div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-[#c4f0b8]"
            >
              &larr; Back
            </button>
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/30">
              Press a tile to continue
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ───────────── Contact ───────────── */

function ContactStage({
  email,
  companyName,
  submitting,
  error,
  onEmail,
  onCompany,
  onBack,
  onSubmit,
}: {
  email: string;
  companyName: string;
  submitting: boolean;
  error: string | null;
  onEmail: (v: string) => void;
  onCompany: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 border border-[#c4f0b8]/40 bg-[#0a2620] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c4f0b8]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c4f0b8]" />
          Last step
        </div>
        <h2 className="font-serif text-3xl tracking-tight text-white sm:text-4xl">
          Where should we send your gap report?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-white/65 sm:text-base">
          Optional &mdash; but you&apos;ll receive a written summary of every
          control you missed, plus a one-pager your virtual compliance officer
          can use to jump-start a full assessment.
        </p>
      </div>

      <div className="border border-white/10 bg-[#0a2620] p-8 sm:p-10">
        <div className="space-y-5">
          <Field
            label="Work email"
            type="email"
            value={email}
            onChange={onEmail}
            placeholder="you@company.com"
            optional
          />
          <Field
            label="Company name"
            value={companyName}
            onChange={onCompany}
            placeholder="Acme Federal Services LLC"
            optional
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </motion.p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="border border-white/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:border-[#c4f0b8] hover:text-[#c4f0b8]"
            >
              &larr; Back
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="group flex flex-1 items-center justify-center gap-2 bg-[#c4f0b8] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#0a2620] transition-all hover:bg-white disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin border-2 border-[#0a2620] border-t-transparent" />
                  Scoring your answers
                </>
              ) : (
                <>
                  Calculate my score
                  <span className="transition-transform group-hover:translate-x-1">
                    &rarr;
                  </span>
                </>
              )}
            </button>
          </div>

          <p className="pt-2 text-center text-[11px] leading-relaxed text-white/40">
            We&apos;ll never sell your information. One follow-up email at most,
            and you can unsubscribe in one click.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
        {label}
        {optional && <span className="text-white/30">Optional</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-white/15 bg-[#0f3a2d] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#c4f0b8]"
      />
    </label>
  );
}

/* ───────────── Result ───────────── */

function ResultView({
  result,
  answers,
}: {
  result: QuizResult;
  answers: AnswersMap;
}) {
  const tone =
    result.score >= 88 ? "good" : result.score >= 50 ? "warn" : "bad";

  const toneClasses = {
    good: {
      ring: "border-[#c4f0b8]",
      glow: "bg-[radial-gradient(ellipse_at_center,_rgba(196,240,184,0.25),_transparent_70%)]",
      label: "text-[#c4f0b8]",
    },
    warn: {
      ring: "border-amber-300",
      glow: "bg-[radial-gradient(ellipse_at_center,_rgba(252,211,77,0.22),_transparent_70%)]",
      label: "text-amber-300",
    },
    bad: {
      ring: "border-rose-300",
      glow: "bg-[radial-gradient(ellipse_at_center,_rgba(253,164,175,0.22),_transparent_70%)]",
      label: "text-rose-300",
    },
  }[tone];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-white print-document">
      <div className="mb-8 flex items-baseline justify-between print:hidden">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60 transition-colors hover:text-[#c4f0b8]"
        >
          &larr; Custodia
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#c4f0b8] hover:text-[#c4f0b8]"
        >
          Save as PDF
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <div className="text-center">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
            Custodia &middot; Your Readiness Result
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl">
            Your Supplier Performance Risk System score
          </h1>
        </div>

        {/* Score reveal */}
        <div className="relative mt-12 flex flex-col items-center">
          <div className={`pointer-events-none absolute inset-0 -z-10 ${toneClasses.glow}`} />
          <ScoreCounter to={result.score} max={result.maxScore} ringClass={toneClasses.ring} />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            className={`mt-6 text-xs font-semibold uppercase tracking-[0.24em] ${toneClasses.label}`}
          >
            {result.bidEligible
              ? "Likely bid-eligible · Score is at or above 88"
              : "Below the typical prime threshold of 88"}
          </motion.div>
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6, ease: EASE_OUT }}
        className="mt-16"
      >
        <h2 className="font-serif text-2xl tracking-tight text-white sm:text-3xl">
          Where you&apos;re losing points
        </h2>
        {result.gaps.length === 0 ? (
          <p className="mt-4 text-white/70">
            You answered &ldquo;Yes&rdquo; on every question. That&apos;s rare.
            A formal assessment with documented evidence is your next step.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {result.gaps.map((g, i) => (
              <motion.li
                key={g.questionId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.7 + i * 0.04,
                  duration: 0.45,
                  ease: EASE_OUT,
                }}
                className="border border-white/10 bg-[#0a2620] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4f0b8]">
                      {g.family} &middot; {g.controlId}
                    </div>
                    <div className="mt-2 text-sm text-white">{g.question}</div>
                    <div className="mt-1 text-xs text-white/50">
                      Your answer: {ANSWER_LABELS[g.answer]}
                    </div>
                  </div>
                  <div className="border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-200">
                    &minus;{g.pointsLost}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6, ease: EASE_OUT }}
        className="mt-12 border border-[#c4f0b8]/30 bg-[#f7f7f3] p-8 text-[#0a2620] print:hidden"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0a2620]/60">
          Recommended next step
        </div>
        <h3 className="mt-2 font-serif text-3xl tracking-tight">
          Want Charlie to fix these for you?
        </h3>
        <p className="mt-3 max-w-lg text-sm text-[#0a2620]/75">
          Custodia is the TurboTax-style platform for Cybersecurity Maturity
          Model Certification (CMMC) Level&nbsp;1. Flat $449 per month.
          14-day free trial. Federal bid-ready in seven days &mdash; or your
          money back.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 bg-[#0a2620] px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c4f0b8] transition-colors hover:bg-[#0d2e25]"
          >
            Start my 14-day free trial
            <span>&rarr;</span>
          </Link>
          <Link
            href="/meet-charlie"
            className="inline-flex items-center justify-center gap-2 border border-[#0a2620]/30 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#0a2620] transition-colors hover:border-[#0a2620]"
          >
            Talk to Charlie first
          </Link>
        </div>
      </motion.div>

      <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
        This is a self-administered diagnostic, not a Cybersecurity Maturity
        Model Certification. The point weights mirror the Department of
        Defense Assessment Methodology v1.2.1. The {Object.keys(answers).length}{" "}
        answers above were used to compute your score on{" "}
        {new Date().toLocaleDateString()}. A formal annual self-assessment
        under Federal Acquisition Regulation clause 52.204-21 is required
        before submitting your Supplier Performance Risk System affirmation.
      </div>
    </div>
  );
}

function ScoreCounter({
  to,
  max,
  ringClass,
}: {
  to: number;
  max: number;
  ringClass: string;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => mv.set(to), 200);
    const u = display.on("change", () => setTick((n) => n + 1));
    return () => {
      clearTimeout(t);
      u();
    };
  }, [to, mv, display]);

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE_IN_OUT }}
      className={`flex h-56 w-56 flex-col items-center justify-center border-2 ${ringClass} bg-[#0a2620]`}
    >
      <div className="font-serif text-7xl font-normal leading-none text-white tabular-nums">
        {display.get()}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
        out of {max}
      </div>
    </motion.div>
  );
}
