"use client";

import { useState, useTransition } from "react";
import type { TailorResult } from "@/lib/ai/bid-drafting";

type Props = {
  assessmentId: string;
  masterCapability: string;
  masterDifferentiators: string;
  tailorAction: (formData: FormData) => Promise<TailorResult>;
  initialOpportunity?: string;
  initialOpportunityLabel?: string;
};

/**
 * Client form for per-opportunity tailoring.
 *
 * Three states:
 *   1. Empty — user pastes solicitation, clicks "Tailor with AI".
 *   2. Drafted — AI returned proposed overrides; user edits them.
 *   3. Open — user clicks "Open packet"; we encode the overrides as
 *      base64-JSON in `?o=` and open the packet route in a new tab. The
 *      packet route decodes and applies, no DB write needed.
 */
export function TailorForm({
  assessmentId,
  masterCapability,
  masterDifferentiators,
  tailorAction,
  initialOpportunity = "",
  initialOpportunityLabel = "",
}: Props) {
  const [opportunity, setOpportunity] = useState(initialOpportunity);
  const [opportunityLabel, setOpportunityLabel] = useState(
    initialOpportunityLabel,
  );
  const [capability, setCapability] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleTailor() {
    setError(null);
    const fd = new FormData();
    fd.set("assessmentId", assessmentId);
    fd.set("opportunity", opportunity);
    startTransition(async () => {
      try {
        const result = await tailorAction(fd);
        setCapability(result.capability_statement);
        setDifferentiators(result.differentiators);
        setDrafted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tailor failed");
      }
    });
  }

  function packetUrl(): string {
    const overrides = {
      capability_statement: capability,
      differentiators,
      opportunity_label: opportunityLabel.trim() || undefined,
    };
    const json = JSON.stringify(overrides);
    // base64url-safe (browsers and Node both support btoa for ASCII; the
    // override text is plain English, no need to handle non-ASCII specially —
    // but encodeURIComponent first to be safe with curly quotes etc).
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `/api/assessments/${assessmentId}/bid-packet?o=${b64}`;
  }

  function reset() {
    setDrafted(false);
    setCapability("");
    setDifferentiators("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#cfe3d9] bg-white p-6">
        <h2 className="font-serif text-lg font-bold">1. The opportunity</h2>
        <p className="mt-1 text-xs text-[#456c5f]">
          Paste the SAM.gov notice description, scope of work, or
          solicitation text. The more specific the language, the better the
          tailor.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
              Opportunity label (optional)
            </span>
            <input
              type="text"
              value={opportunityLabel}
              onChange={(e) => setOpportunityLabel(e.target.value)}
              placeholder="e.g. DHS S&T NAICS 541512 RFQ — Cyber Engineer Support"
              className="mt-1 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-[#456c5f]">
              Shown on the packet so you can keep tailored versions straight.
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
              Solicitation text
            </span>
            <textarea
              value={opportunity}
              onChange={(e) => setOpportunity(e.target.value)}
              rows={10}
              placeholder="Paste the full notice, scope of work, or relevant sections of the solicitation here…"
              className="mt-1 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 font-mono text-xs focus:border-[#2f8f6d] focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-[#456c5f]">
              {opportunity.trim().length.toLocaleString()} characters
              {opportunity.trim().length < 50
                ? " · paste at least a paragraph"
                : ""}
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {error ? (
              <span className="font-semibold text-[#b03a2e]">{error}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleTailor}
            disabled={pending || opportunity.trim().length < 50}
            className="rounded-sm bg-[#10231d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0e2a23] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Tailoring…"
              : drafted
                ? "↻ Re-tailor with new opportunity"
                : "✨ Tailor with Charlie"}
          </button>
        </div>
      </section>

      {drafted ? (
        <>
          <section className="rounded-md border border-[#cfe3d9] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold">
                  2. Charlie’s draft — edit freely
                </h2>
                <p className="mt-1 text-xs text-[#456c5f]">
                  Make this yours. The AI proposes; you decide what ships.
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-sm border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#10231d] hover:bg-[#f1f6f3]"
              >
                Discard draft
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
                  Tailored capability statement
                </h3>
                <textarea
                  value={capability}
                  onChange={(e) => setCapability(e.target.value)}
                  rows={14}
                  className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none"
                />
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-[#456c5f] hover:text-[#10231d]">
                    Show master version for comparison
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-sm border border-[#e3eee8] bg-[#f7fcf9] p-3 text-[12px] text-[#10231d]">
                    {masterCapability || "(empty)"}
                  </pre>
                </details>
              </div>
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
                  Tailored differentiators
                </h3>
                <textarea
                  value={differentiators}
                  onChange={(e) => setDifferentiators(e.target.value)}
                  rows={14}
                  className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none"
                />
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-[#456c5f] hover:text-[#10231d]">
                    Show master version for comparison
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-sm border border-[#e3eee8] bg-[#f7fcf9] p-3 text-[12px] text-[#10231d]">
                    {masterDifferentiators || "(empty)"}
                  </pre>
                </details>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[#10231d] bg-[#10231d] p-6 text-white">
            <h2 className="font-serif text-lg font-bold text-white">
              3. Generate the tailored packet
            </h2>
            <p className="mt-2 text-sm text-[#cfe3d9]">
              Opens the packet with these overrides applied. Your master
              profile is untouched — share this URL or save the printed PDF.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={packetUrl()}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-sm bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#0e2a23] hover:bg-white"
              >
                Open tailored packet
              </a>
              <a
                href={packetUrl()}
                download
                className="rounded-sm border border-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] hover:bg-[#0e2a23]"
              >
                Download HTML
              </a>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
