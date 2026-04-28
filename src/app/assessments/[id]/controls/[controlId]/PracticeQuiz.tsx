"use client";

import { useMemo, useState } from "react";
import type { PracticeQuizQuestion } from "@/lib/practice-quiz";

type Answer = "yes" | "no" | null;

type Props = {
  controlId: string;
  questions: PracticeQuizQuestion[];
  initialStatus: string;
};

/**
 * "Quick check" — a guided yes/no walkthrough that routes a non-technical
 * user to the right status without making them read the radios.
 *
 * Sits at the very top of each practice page. Answers are pure-client; the
 * component synchronizes its recommendation into the existing
 * `#save-response-form` status radio when the user clicks "Use this answer".
 *
 * Routing rules:
 *   - all yes              → Met
 *   - all no               → Not met
 *   - mixed                → Partial
 * For every "no", we surface the gap as a remediation hint so the user
 * leaves the quiz knowing exactly what to fix.
 */
export function PracticeQuiz({ questions, initialStatus }: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, null])),
  );
  const [applied, setApplied] = useState<string | null>(
    initialStatus && initialStatus !== "unanswered" ? initialStatus : null,
  );

  const total = questions.length;
  const answered = Object.values(answers).filter((a) => a !== null).length;
  const yesCount = Object.values(answers).filter((a) => a === "yes").length;
  const noCount = Object.values(answers).filter((a) => a === "no").length;
  const allAnswered = answered === total;

  const recommendation = useMemo(() => {
    if (!allAnswered) return null;
    if (yesCount === total) return "yes" as const;
    if (noCount === total) return "no" as const;
    return "partial" as const;
  }, [allAnswered, yesCount, noCount, total]);

  const gaps = questions
    .filter((q) => answers[q.id] === "no")
    .map((q) => ({ id: q.id, prompt: q.prompt, gap: q.gap }));

  function setAnswer(id: string, value: Answer) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setApplied(null);
  }

  function applyToForm(target: "yes" | "no" | "partial") {
    const radio = document.querySelector<HTMLInputElement>(
      `#save-response-form input[name="status"][value="${target}"]`,
    );
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      radio.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setApplied(target);
    const form = document.getElementById("save-response-form");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reset() {
    setAnswers(Object.fromEntries(questions.map((q) => [q.id, null])));
    setApplied(null);
  }

  const recoLabels: Record<"yes" | "no" | "partial", string> = {
    yes: "Met",
    partial: "Partial",
    no: "Not met",
  };

  return (
    <section
      className="mb-8 overflow-hidden rounded-md border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]"
      aria-label="Quick check"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cfe3d9] bg-[#f7fcf9] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
            Quick check
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#10231d]">
            Answer a couple of plain-English questions and we&rsquo;ll
            recommend the right answer.
          </p>
        </div>
        <span className="rounded-sm bg-[#0e2a23] px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-[#bdf2cf]">
          {answered} / {total}
        </span>
      </header>

      <ol className="divide-y divide-[#e4eee8]">
        {questions.map((q, idx) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="px-5 py-4">
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
                      onClick={() => setAnswer(q.id, "yes")}
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
                      onClick={() => setAnswer(q.id, "no")}
                      className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                        a === "no"
                          ? "bg-[#b03a2e] text-white"
                          : "border border-[#cfe3d9] bg-white text-[#0e2a23] hover:border-[#b03a2e] hover:bg-[#fdf2f0]"
                      }`}
                    >
                      Not yet
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnswer(q.id, null)}
                      className={`rounded-sm px-3 py-1.5 text-xs font-medium text-[#5a7d70] transition-colors hover:text-[#10231d] ${
                        a === null ? "invisible" : ""
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                  {a === "yes" && (
                    <p className="mt-2 text-xs text-[#2f8f6d]">
                      Good — {q.yesMeans.toLowerCase()}
                    </p>
                  )}
                  {a === "no" && (
                    <p className="mt-2 text-xs text-[#a06b1a]">
                      That&rsquo;s the gap. {q.gap}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {recommendation && (
        <div className="border-t border-[#cfe3d9] bg-[#f7fcf9] px-5 py-4">
          {recommendation === "yes" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f8f6d]">
                  Recommendation
                </p>
                <p className="mt-1 text-sm font-semibold text-[#10231d]">
                  Looks like a clean <span className="font-bold">Met</span>.
                  Capture the evidence below and write a short narrative.
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyToForm("yes")}
                className="rounded-sm bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
              >
                {applied === "yes" ? "Applied ✓" : "Mark as Met"}
              </button>
            </div>
          )}
          {recommendation === "partial" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a06b1a]">
                    Recommendation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#10231d]">
                    You&rsquo;re partway there — mark this{" "}
                    <span className="font-bold">Partial</span> and add a fix
                    plan below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyToForm("partial")}
                  className="rounded-sm bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  {applied === "partial" ? "Applied ✓" : "Mark as Partial"}
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {gaps.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-sm border border-[#e5d6c2] bg-[#fdf8ef] px-3 py-2 text-xs leading-relaxed text-[#10231d]"
                  >
                    <span className="font-semibold text-[#a06b1a]">
                      Fix:&nbsp;
                    </span>
                    {g.gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recommendation === "no" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b03a2e]">
                    Recommendation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#10231d]">
                    This isn&rsquo;t in place yet. Mark{" "}
                    <span className="font-bold">Not met</span> and let&rsquo;s
                    build a fix plan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyToForm("no")}
                  className="rounded-sm bg-[#0e2a23] px-4 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
                >
                  {applied === "no" ? "Applied ✓" : "Mark as Not met"}
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {gaps.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-sm border border-[#e5cfca] bg-[#fdf2f0] px-3 py-2 text-xs leading-relaxed text-[#10231d]"
                  >
                    <span className="font-semibold text-[#b03a2e]">
                      Fix:&nbsp;
                    </span>
                    {g.gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-[11px] font-medium text-[#5a7d70] underline-offset-2 hover:text-[#10231d] hover:underline"
          >
            Reset answers
          </button>
        </div>
      )}
    </section>
  );
}
