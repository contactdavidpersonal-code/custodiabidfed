"use client";

import { useState, useTransition } from "react";
import type { MaterialChangeQuestionKey } from "@/lib/assessment";

const LABELS: Record<MaterialChangeQuestionKey, { title: string; detail: string }> = {
  new_facilities: {
    title: "New offices, sites, or facilities since last cycle?",
    detail:
      "Includes a new location processing or storing FCI, a new remote-office posture, or shutting down a site that was in scope before.",
  },
  merger_or_acquisition: {
    title: "Any merger, acquisition, divestiture, or change of control?",
    detail:
      "An M&A event changes ownership and almost always changes the boundary — fresh assessment required.",
  },
  major_it_migration: {
    title: "Major IT migration?",
    detail:
      "Moves like M365 ↔ Google Workspace, on-prem → cloud, adopting a new identity provider, or adding a major new External Service Provider (ESP).",
  },
  fci_handling_change: {
    title: "Has the way you handle FCI changed?",
    detail:
      "New contract type that introduces FCI, materially larger headcount touching FCI, or different storage/transmission patterns.",
  },
};

type Action = (formData: FormData) => Promise<{ error?: string } | void>;

export default function MaterialChangeForm({
  assessmentId,
  action,
  questions,
}: {
  assessmentId: string;
  action: Action;
  questions: MaterialChangeQuestionKey[];
}) {
  const [answers, setAnswers] = useState<Record<string, "yes" | "no" | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const anyYes = Object.values(answers).includes("yes");
  const allAnswered = questions.every((q) => answers[q] === "yes" || answers[q] === "no");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      {questions.map((q) => {
        const meta = LABELS[q];
        return (
          <fieldset
            key={q}
            className="border border-[#cfe3d9] bg-white px-4 py-3"
          >
            <legend className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
              {q.replace(/_/g, " ")}
            </legend>
            <p className="font-serif text-base font-bold text-[#10231d]">
              {meta.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
              {meta.detail}
            </p>
            <div className="mt-3 flex gap-2">
              <label
                className={`cursor-pointer border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
                  answers[q] === "no"
                    ? "border-[#2f8f6d] bg-[#e8f1ec] text-[#0e2a23]"
                    : "border-[#cfe3d9] bg-white text-[#5a7d70] hover:border-[#2f8f6d]"
                }`}
              >
                <input
                  type="radio"
                  name={q}
                  value="no"
                  className="sr-only"
                  checked={answers[q] === "no"}
                  onChange={() => setAnswers((s) => ({ ...s, [q]: "no" }))}
                />
                No
              </label>
              <label
                className={`cursor-pointer border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
                  answers[q] === "yes"
                    ? "border-[#b54708] bg-[#fdf6e3] text-[#5c4a1d]"
                    : "border-[#cfe3d9] bg-white text-[#5a7d70] hover:border-[#b54708]"
                }`}
              >
                <input
                  type="radio"
                  name={q}
                  value="yes"
                  className="sr-only"
                  checked={answers[q] === "yes"}
                  onChange={() => setAnswers((s) => ({ ...s, [q]: "yes" }))}
                />
                Yes
              </label>
            </div>
          </fieldset>
        );
      })}

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
          What changed? {anyYes && <span className="text-[#b54708]">(required when any answer is yes)</span>}
        </span>
        <textarea
          name="rationale"
          rows={3}
          minLength={anyYes ? 40 : 0}
          className="mt-1 w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none"
          placeholder={anyYes
            ? "e.g. Acquired Acme Tech in March 2026; their two-office network now sits inside our FCI boundary."
            : "Optional — note anything for the audit trail."}
        />
      </label>

      {anyYes && (
        <div className="border-l-2 border-[#b54708] bg-[#fdf6e3] px-4 py-3 text-xs leading-relaxed text-[#5c4a1d]">
          <p className="font-bold uppercase tracking-[0.14em]">
            Heads up — this will force a fresh assessment
          </p>
          <p className="mt-1">
            Submitting with a &ldquo;yes&rdquo; will wipe last year&apos;s carried responses
            and require you to re-walk all 15 safeguarding requirements before
            you can sign. This is the federally-expected behavior.
          </p>
        </div>
      )}

      {error && (
        <div className="border-l-2 border-[#b54708] bg-[#fdf6e3] px-4 py-3 text-xs leading-relaxed text-[#5c4a1d]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!allAnswered || pending}
        className="bg-[#10231d] px-6 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-white hover:bg-[#0a1814] disabled:cursor-not-allowed disabled:bg-[#a8c2b8]"
      >
        {pending ? "Recording…" : anyYes ? "Submit & start fresh walk" : "Confirm no material change"}
      </button>
    </form>
  );
}
