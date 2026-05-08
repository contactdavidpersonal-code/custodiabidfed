"use client";

import { useState } from "react";

type Outcome = {
  provider: string;
  kind: string;
  status: "ok" | "skipped" | "failed";
  rowCount?: number;
  artifactId?: string;
  dataHash?: string;
  message?: string;
};

const KIND_LABEL: Record<string, string> = {
  authorized_users_roster: "Authorized users",
  mfa_report: "MFA report",
  external_sharing_audit: "External sharing",
  public_facing_shares: "Public shares",
  patch_compliance: "Patch compliance",
  defender_av_inventory: "AV / Defender",
};

function statusTone(status: Outcome["status"]): string {
  switch (status) {
    case "ok":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "skipped":
      return "border-slate-300 bg-slate-50 text-slate-700";
    case "failed":
      return "border-rose-300 bg-rose-50 text-rose-900";
  }
}

export default function SyncNowButton({
  assessmentId,
}: {
  assessmentId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSync() {
    if (!assessmentId) return;
    setBusy(true);
    setError(null);
    setOutcomes(null);
    try {
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
        return;
      }
      setOutcomes(Array.isArray(data.outcomes) ? data.outcomes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  if (!assessmentId) {
    return (
      <p className="text-xs italic text-[#5a7d70]">
        Start an assessment to enable connector pulls.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSync}
          disabled={busy}
          className=" border border-[#10231d] bg-[#10231d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a1814] disabled:opacity-50"
        >
          {busy ? "Pulling…" : "Sync now"}
        </button>
        <span className="text-xs text-[#5a7d70]">
          Pulls authorized-users + MFA from connected providers and stamps each
          artifact with source, timestamp, and SHA-256 hash.
        </span>
      </div>

      {error && (
        <div className="mt-3 border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {outcomes.map((o, i) => (
            <li
              key={i}
              className={` border px-3 py-2 text-xs ${statusTone(o.status)}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-bold uppercase tracking-wider">
                  {o.status}
                </span>
                <span className="font-mono">{o.provider}</span>
                <span>· {KIND_LABEL[o.kind] ?? o.kind}</span>
                {typeof o.rowCount === "number" && (
                  <span className="ml-auto">{o.rowCount} rows</span>
                )}
              </div>
              {o.dataHash && (
                <div className="mt-1 break-all font-mono text-[10px] opacity-75">
                  sha256:{o.dataHash.slice(0, 24)}…
                </div>
              )}
              {o.message && (
                <div className="mt-1 italic opacity-80">{o.message}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {outcomes && outcomes.length === 0 && (
        <div className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No connector pipelines ran. Connect a provider above first.
        </div>
      )}
    </div>
  );
}
