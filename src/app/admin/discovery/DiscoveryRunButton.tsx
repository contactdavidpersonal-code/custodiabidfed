"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DiscoveryRunButton() {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setSummary(null);
    try {
      const res = await fetch("/api/admin/discovery/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        prospects: { written: number; rejected: number };
        enrichment: { contactsWritten: number };
        awards: { fetched: number; pagesScanned: number; error: string | null };
      };
      if (data.awards.error) throw new Error(data.awards.error);
      setSummary(
        `Found ${data.enrichment.contactsWritten} new lead${
          data.enrichment.contactsWritten === 1 ? "" : "s"
        } from ${data.awards.fetched} awards (${data.awards.pagesScanned} page${
          data.awards.pagesScanned === 1 ? "" : "s"
        }). ${data.prospects.written} new prospects, ${data.prospects.rejected} rejected.`,
      );
      // Refresh the server-rendered tables on the page
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
            How many leads?
          </div>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            disabled={busy}
            className="w-24 bg-[#0f3a2d] px-3 py-2 text-base text-white"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#0c2219] transition-colors hover:bg-[#a8e6c0] disabled:opacity-50"
        >
          {busy ? "Agent working…" : `Find ${count} leads`}
        </button>
        <p className="text-xs text-white/50">
          Agent pulls fresh DoD primes, scores them, and drops the top {count} into Prospects with verified emails.
        </p>
      </div>
      {summary && (
        <div className="border border-[#bdf2cf]/40 bg-[#0f3a2d] p-3 text-sm text-[#bdf2cf]">
          {summary}
        </div>
      )}
      {err && (
        <div className="border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          <span className="font-bold uppercase tracking-wider">Error: </span>
          <span className="font-mono text-[12px]">{err}</span>
        </div>
      )}
    </div>
  );
}
