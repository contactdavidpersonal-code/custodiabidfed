"use client";

import { useState } from "react";
import Link from "next/link";

type DiscoveryResult = {
  ok: boolean;
  dryRun: boolean;
  params: {
    daysBack: number;
    minAmount: number;
    maxAmount: number;
    enrich: boolean;
    enrichLimit: number;
    apply: boolean;
  };
  range: { start: string; end: string };
  awards: { fetched: number; error: string | null };
  prospects: {
    written: number;
    skipped: number;
    rejected: number;
    topBandIds: string[];
  };
  enrichment: {
    attempted: number;
    contactsFound: number;
    contactsWritten: number;
    errors: string[];
  };
};

export default function DiscoveryConsole() {
  const [daysBack, setDaysBack] = useState(30);
  const [minAmount, setMinAmount] = useState(100_000);
  const [maxAmount, setMaxAmount] = useState(10_000_000);
  const [enrichLimit, setEnrichLimit] = useState(10);
  const [apply, setApply] = useState(false);
  const [enrich, setEnrich] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({
        daysBack: String(daysBack),
        minAmount: String(minAmount),
        maxAmount: String(maxAmount),
        enrich: enrich ? "1" : "0",
        enrichLimit: String(enrichLimit),
        apply: apply ? "1" : "0",
      });
      const res = await fetch(`/api/admin/discovery/run?${qs.toString()}`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 400)}`);
      }
      setResult((await res.json()) as DiscoveryResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          Discovery
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Pull DoD prime contracts from USAspending, score them by ICP, and
          (optionally) enrich top-band prospects with Hunter.io contacts.
          Default is dry-run &mdash; flip &ldquo;Apply&rdquo; to actually write to the database.
        </p>
      </header>

      <section className="border border-white/10 bg-[#0a2620] p-6">
        <h2 className="font-serif text-2xl">Parameters</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Days back">
            <input
              type="number"
              min={1}
              max={365}
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="w-full bg-[#0f3a2d] px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Min award $ (cents not used)">
            <input
              type="number"
              min={0}
              step={10_000}
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="w-full bg-[#0f3a2d] px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Max award $">
            <input
              type="number"
              min={0}
              step={100_000}
              value={maxAmount}
              onChange={(e) => setMaxAmount(Number(e.target.value))}
              className="w-full bg-[#0f3a2d] px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Hunter enrich limit (top band only)">
            <input
              type="number"
              min={0}
              max={50}
              value={enrichLimit}
              onChange={(e) => setEnrichLimit(Number(e.target.value))}
              className="w-full bg-[#0f3a2d] px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Enrich with Hunter">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrich}
                onChange={(e) => setEnrich(e.target.checked)}
              />
              Run Hunter on band-A/B prospects
            </label>
          </Field>
          <Field label="Apply changes to DB">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={apply}
                onChange={(e) => setApply(e.target.checked)}
              />
              <span
                className={
                  apply
                    ? "font-bold text-[#bdf2cf]"
                    : "text-white/70"
                }
              >
                {apply ? "WRITE MODE" : "Dry run (no DB writes)"}
              </span>
            </label>
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#0c2219] transition-colors hover:bg-[#a8e6c0] disabled:opacity-50"
          >
            {busy ? "Running…" : "Run discovery"}
          </button>
          <Link
            href="/admin"
            className="border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cce5da] hover:border-[#bdf2cf] hover:text-white"
          >
            ← Back
          </Link>
        </div>
      </section>

      {err && (
        <section className="border border-rose-500/40 bg-rose-950/40 p-5 text-sm text-rose-200">
          <div className="font-bold uppercase tracking-wider">Error</div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px]">{err}</pre>
        </section>
      )}

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultPanel({ result }: { result: DiscoveryResult }) {
  return (
    <section className="space-y-5">
      <div
        className={`border p-5 ${
          result.dryRun
            ? "border-amber-500/40 bg-amber-950/20"
            : "border-[#bdf2cf]/40 bg-[#0f3a2d]"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#bdf2cf]">
          {result.dryRun ? "Dry run" : "Applied"} &middot; {result.range.start} →{" "}
          {result.range.end}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Awards fetched" value={result.awards.fetched} />
          <Metric label="New prospects" value={result.prospects.written} accent />
          <Metric label="Updated (existed)" value={result.prospects.skipped} muted />
          <Metric label="Rejected" value={result.prospects.rejected} muted />
          <Metric
            label="Hunter attempted"
            value={result.enrichment.attempted}
          />
          <Metric
            label="Contacts written"
            value={result.enrichment.contactsWritten}
            accent
          />
        </div>
      </div>

      {result.awards.error && (
        <div className="border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
          <div className="font-bold uppercase tracking-wider">USAspending error</div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px]">
            {result.awards.error}
          </pre>
        </div>
      )}

      {result.enrichment.errors.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-200">
          <div className="font-bold uppercase tracking-wider">
            Enrichment errors ({result.enrichment.errors.length})
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-[12px]">
            {result.enrichment.errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="border border-white/10 bg-[#0a2620] p-4">
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.18em] text-[#bdf2cf]">
          Raw response (debug)
        </summary>
        <pre className="mt-3 overflow-x-auto font-mono text-[11px] text-white/70">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>

      <div className="flex gap-3">
        <Link
          href="/admin/prospects"
          className="border border-[#bdf2cf]/40 bg-[#0a2620] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#bdf2cf] hover:bg-[#0f3a2d]"
        >
          View prospects →
        </Link>
        <Link
          href="/admin/contacts"
          className="border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cce5da] hover:border-[#bdf2cf] hover:text-white"
        >
          View contacts →
        </Link>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`border p-3 ${
        accent
          ? "border-[#bdf2cf]/30 bg-[#0a2620]"
          : muted
            ? "border-white/5 bg-[#0a2620]/50"
            : "border-white/10 bg-[#0a2620]"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
        {label}
      </div>
      <div
        className={`mt-1.5 font-serif text-2xl tabular-nums ${
          accent ? "text-[#bdf2cf]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
