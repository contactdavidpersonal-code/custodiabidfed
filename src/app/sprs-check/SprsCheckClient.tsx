"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  QUIZ_QUESTIONS,
  type QuizAnswer,
  type QuizQuestionId,
  type QuizResult,
} from "@/lib/cmmc/sprs-scoring";

type AnswersMap = Partial<Record<QuizQuestionId, QuizAnswer>>;

const ANSWER_LABELS: Record<QuizAnswer, string> = {
  yes: "Yes",
  partial: "Mostly",
  no: "No",
  unsure: "Not sure",
};

export default function SprsCheckClient() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = QUIZ_QUESTIONS.length;
  const isQuestionStep = step >= 0 && step < total;
  const isContactStep = step === total;
  const current = isQuestionStep ? QUIZ_QUESTIONS[step] : null;
  const progress = useMemo(() => {
    const answered = Object.keys(answers).length;
    return Math.round((answered / total) * 100);
  }, [answers, total]);

  function setAnswer(id: QuizQuestionId, a: QuizAnswer) {
    setAnswers((prev) => ({ ...prev, [id]: a }));
    setTimeout(() => setStep((s) => s + 1), 120);
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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          &larr; Back to Custodia
        </Link>
      </div>

      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-serif text-3xl text-slate-900">
          Free SPRS Self-Check
        </h1>
        <span className="text-xs uppercase tracking-wider text-slate-500">
          {Object.keys(answers).length} / {total}
        </span>
      </div>

      <p className="mb-6 text-slate-600">
        12 plain-English questions. Two minutes. We&apos;ll give you a
        SPRS-style score primes recognize, and a free PDF gap report.
        No login required.
      </p>

      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isQuestionStep && current && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {current.family}
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            {current.question}
          </h2>
          <p className="mb-6 text-sm text-slate-600">{current.helper}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["yes", "partial", "no", "unsure"] as QuizAnswer[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAnswer(current.id, a)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-emerald-50"
              >
                {ANSWER_LABELS[a]}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mt-4 text-sm text-slate-500 hover:text-slate-900"
            >
              &larr; Back
            </button>
          )}
        </div>
      )}

      {isContactStep && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            Where should we send your gap report?
          </h2>
          <p className="mb-6 text-sm text-slate-600">
            Optional, but you&apos;ll get a written summary of every control
            you missed plus a one-pager Charlie can use to jump-start a full
            assessment.
          </p>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Work email (optional)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Company name (optional)
              </span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Federal Services LLC"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            {error && (
              <p className="text-sm text-rose-600">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Scoring…" : "Get my SPRS score"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({ result, answers }: { result: QuizResult; answers: AnswersMap }) {
  const color =
    result.score >= 88
      ? "emerald"
      : result.score >= 50
        ? "amber"
        : "rose";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 print-document">
      <div className="mb-6 flex items-baseline justify-between print:hidden">
        <Link
          href="/"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          &larr; Back to Custodia
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Save as PDF
        </button>
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Custodia &middot; SPRS Self-Check Result
      </div>
      <h1 className="mb-6 font-serif text-4xl text-slate-900">
        Your SPRS-style score
      </h1>

      <div
        className={`mb-8 rounded-2xl border-2 p-8 text-center ${
          color === "emerald"
            ? "border-emerald-500 bg-emerald-50"
            : color === "amber"
              ? "border-amber-500 bg-amber-50"
              : "border-rose-500 bg-rose-50"
        }`}
      >
        <div className="text-6xl font-bold text-slate-900">
          {result.score}
          <span className="text-3xl text-slate-500">/{result.maxScore}</span>
        </div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
          {result.bidEligible
            ? "Likely bid-eligible (≥ 88)"
            : "Below the typical prime threshold (88)"}
        </div>
      </div>

      <h2 className="mb-3 font-serif text-2xl text-slate-900">
        Where you&apos;re losing points
      </h2>
      {result.gaps.length === 0 ? (
        <p className="mb-8 text-slate-700">
          You answered &ldquo;Yes&rdquo; on every question. That&apos;s rare.
          A formal assessment with documented evidence is your next step.
        </p>
      ) : (
        <ul className="mb-8 space-y-3">
          {result.gaps.map((g) => (
            <li
              key={g.questionId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {g.family} &middot; {g.controlId}
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {g.question}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Your answer: {ANSWER_LABELS[g.answer]}
                  </div>
                </div>
                <div className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                  −{g.pointsLost}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 print:hidden">
        <h3 className="mb-2 font-serif text-xl text-slate-900">
          Want Charlie to fix these for you?
        </h3>
        <p className="mb-4 text-sm text-slate-700">
          Custodia is TurboTax for CMMC Level 1. $449/month, flat. 14-day
          free trial. Federal bid-ready in 7 days, or your money back.
        </p>
        <Link
          href="/pricing"
          className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Start my 14-day free trial
        </Link>
      </div>

      <div className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          This is a self-administered diagnostic, not a CMMC certification.
          The point weights mirror the DoD Assessment Methodology v1.2.1.
          The {Object.keys(answers).length} answers above were used to compute
          your score on {new Date().toLocaleDateString()}. A formal annual
          self-assessment under FAR 52.204-21 is required before submitting
          your SPRS affirmation.
        </p>
      </div>
    </div>
  );
}
