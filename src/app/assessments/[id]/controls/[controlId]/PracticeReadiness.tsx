"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  initialStatus: string;
  initialNarrative: string;
  evidenceCount: number;
  evidenceSufficientCount: number;
};

/**
 * Live readiness meter + narrative coach for a single CMMC practice page.
 *
 * Listens to the existing #save-response-form inputs (the status radios and
 * the narrative textarea) so it can recompute a 0–100 readiness score on
 * every keystroke and render a traffic-light checklist of what's still
 * missing. No server calls — pure client computation.
 *
 * The component is mounted between the header and "Why this matters" so it
 * sits near the top and acts as a live progress indicator the user can keep
 * an eye on as they fill the page out.
 */
export function PracticeReadiness({
  initialStatus,
  initialNarrative,
  evidenceCount,
  evidenceSufficientCount,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [narrative, setNarrative] = useState(initialNarrative);

  useEffect(() => {
    const form = document.getElementById("save-response-form");
    if (!form) return;
    const handle = (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!t) return;
      if (t instanceof HTMLInputElement && t.name === "status" && t.checked) {
        setStatus(t.value);
      }
      if (t instanceof HTMLTextAreaElement && t.name === "narrative") {
        setNarrative(t.value);
      }
    };
    form.addEventListener("input", handle);
    form.addEventListener("change", handle);
    return () => {
      form.removeEventListener("input", handle);
      form.removeEventListener("change", handle);
    };
  }, []);

  const checks = useMemo(() => {
    const isNA = status === "not_applicable";
    const wordCount = narrative.trim().split(/\s+/).filter(Boolean).length;
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
    return [
      {
        key: "status",
        label: "Status selected",
        ok: status !== "" && status !== "unanswered",
        hint: "Pick Met / Partial / Not met / N/A below.",
      },
      {
        key: "evidence",
        label: isNA ? "Evidence (skipped — N/A)" : "Evidence attached",
        ok: isNA || evidenceCount > 0,
        hint: "Drag a screenshot or PDF into the evidence vault.",
      },
      {
        key: "evidence_ok",
        label: isNA
          ? "Auto-review (skipped — N/A)"
          : "Evidence auto-review passed",
        ok: isNA || evidenceSufficientCount > 0,
        hint: "At least one artifact needs to come back ‘Sufficient’ from the AI reviewer.",
      },
      {
        key: "narrative_length",
        label: isNA
          ? "Narrative explains why N/A"
          : "Narrative is at least 30 words",
        ok: isNA ? wordCount >= 15 : wordCount >= 30,
        hint: isNA
          ? "Briefly state why this practice does not apply to your scope."
          : "Aim for 2–4 sentences in plain English.",
      },
      {
        key: "narrative_system",
        label: "Narrative names a system or tool",
        ok: isNA || mentionsSystem,
        hint: "Mention what you actually use — e.g. Microsoft 365, Defender, Bitwarden.",
      },
      {
        key: "narrative_cadence",
        label: "Narrative says how often",
        ok: isNA || hasCadence,
        hint: "Auditors look for cadence — daily, weekly, monthly, real-time…",
      },
      {
        key: "narrative_evidence_link",
        label: "Narrative cites the evidence",
        ok: isNA || referencesEvidence,
        hint: "Reference the screenshot, export, or signed page you attached.",
      },
    ];
  }, [status, narrative, evidenceCount, evidenceSufficientCount]);

  const total = checks.length;
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / total) * 100);

  const tone =
    score === 100
      ? {
          rail: "bg-[#0e2a23]",
          fill: "bg-[#bdf2cf]",
          headline: "Ready to attest",
          chipBg: "bg-[#0e2a23]",
          chipText: "text-[#bdf2cf]",
          accent: "text-[#0e2a23]",
        }
      : score >= 60
        ? {
            rail: "bg-[#cfe3d9]",
            fill: "bg-[#2f8f6d]",
            headline: "Almost there",
            chipBg: "bg-[#0e2a23]",
            chipText: "text-[#bdf2cf]",
            accent: "text-[#0e2a23]",
          }
        : {
            rail: "bg-[#cfe3d9]",
            fill: "bg-[#2f8f6d]",
            headline: "Let's build this answer",
            chipBg: "bg-white",
            chipText: "text-[#0e2a23]",
            accent: "text-[#0e2a23]",
          };

  const nextUp = checks.find((c) => !c.ok);

  return (
    <section
      className="mb-8 rounded-md border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]"
      aria-label="Practice readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a7d70]">
            Readiness
          </p>
          <p className={`mt-1 text-lg font-semibold ${tone.accent}`}>
            {tone.headline}
          </p>
          {nextUp ? (
            <p className="mt-1 max-w-xl text-sm text-[#5a7d70]">
              Next up: <span className="text-[#10231d]">{nextUp.hint}</span>
            </p>
          ) : (
            <p className="mt-1 max-w-xl text-sm text-[#5a7d70]">
              Every signal is green. Save your answer below to lock it in.
            </p>
          )}
        </div>
        <div
          className={`inline-flex items-baseline gap-1 rounded-sm px-3 py-1.5 ${tone.chipBg} ${tone.chipText}`}
        >
          <span className="font-mono text-2xl font-bold leading-none tabular-nums">
            {score}
          </span>
          <span className="text-xs font-semibold opacity-80">/ 100</span>
        </div>
      </div>

      <div className={`mt-4 h-1.5 w-full rounded-sm ${tone.rail}`}>
        <div
          className={`h-1.5 rounded-sm ${tone.fill} transition-[width] duration-500 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((c) => (
          <li
            key={c.key}
            className={`flex items-start gap-2 rounded-sm border px-3 py-2 text-xs leading-relaxed ${
              c.ok
                ? "border-[#cfe3d9] bg-[#f7fcf9] text-[#10231d]"
                : "border-[#e5d6c2] bg-[#fdf8ef] text-[#5a7d70]"
            }`}
          >
            <span
              aria-hidden
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
    </section>
  );
}
