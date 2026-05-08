"use client";

import { useState, useTransition } from "react";

type Invitation = {
  id: string;
  client_email: string;
  client_name: string | null;
  sections: string[];
  completed_sections: string[];
  last_seen_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  url: string;
};

const SECTION_LABELS: Record<string, string> = {
  profile: "Business profile",
  boundary: "FCI boundary",
};

export function ClientsPanel({
  orgName,
  initialInvitations,
}: {
  orgName: string;
  initialInvitations: Invitation[];
}) {
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/msp/intake-invites", { method: "GET" });
    if (!res.ok) return;
    const data = (await res.json()) as { invitations: Invitation[] };
    setInvitations(data.invitations);
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Client email is required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/msp/intake-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_email: email.trim(),
          client_name: name.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed: ${res.status}`);
        return;
      }
      setEmail("");
      setName("");
      await refresh();
    });
  };

  const revoke = (id: string) => {
    if (!confirm("Revoke this intake link? The client will no longer be able to use it.")) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/msp/intake-invites?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (res.ok) await refresh();
    });
  };

  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch {
      // fallback: ignore
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="border border-[#cfe3d9] bg-white">
        <div className="border-b border-[#cfe3d9] px-4 py-3">
          <h2 className="font-serif text-lg font-bold text-[#10231d]">
            Active intake links
          </h2>
        </div>
        {invitations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#5a7d70]">
            No invites yet. Use the form on the right to send your first one.
          </div>
        ) : (
          <ul className="divide-y divide-[#e6efe9]">
            {invitations.map((inv) => {
              const total = inv.sections.length;
              const done = inv.completed_sections.length;
              const expired = new Date(inv.expires_at) < new Date();
              const status = inv.revoked_at
                ? "Revoked"
                : expired
                  ? "Expired"
                  : done === total
                    ? "Complete"
                    : done > 0
                      ? "In progress"
                      : "Sent";
              return (
                <li key={inv.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#10231d]">
                        {inv.client_name || inv.client_email}
                      </div>
                      {inv.client_name && (
                        <div className="text-xs text-[#5a7d70]">
                          {inv.client_email}
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {inv.sections.map((s) => (
                          <span
                            key={s}
                            className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${
                              inv.completed_sections.includes(s)
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-[#cfe3d9] bg-white text-[#5a7d70]"
                            }`}
                          >
                            {SECTION_LABELS[s] ?? s}
                            {inv.completed_sections.includes(s) ? " ✓" : ""}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-[11px] text-[#5a7d70]">
                        {status} ·{" "}
                        {inv.last_seen_at
                          ? `last seen ${new Date(inv.last_seen_at).toLocaleString()}`
                          : "never opened"}{" "}
                        · expires{" "}
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => copy(inv.id, inv.url)}
                        disabled={!!inv.revoked_at}
                        className="border border-[#0e2a23] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:bg-[#0e2a23] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copiedId === inv.id ? "Copied!" : "Copy link"}
                      </button>
                      {!inv.revoked_at && (
                        <button
                          type="button"
                          onClick={() => revoke(inv.id)}
                          disabled={pending}
                          className="text-[11px] text-rose-700 underline-offset-2 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="border border-[#cfe3d9] bg-white">
        <div className="border-b border-[#cfe3d9] px-4 py-3">
          <h2 className="font-serif text-lg font-bold text-[#10231d]">
            New intake link
          </h2>
          <p className="mt-1 text-xs text-[#5a7d70]">
            For client of <strong>{orgName}</strong>.
          </p>
        </div>
        <form className="space-y-3 px-4 py-4" onSubmit={create}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5a7d70]">
              Client email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="signer@client.com"
              className="mt-1 w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0e2a23]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5a7d70]">
              Client name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pat Smith"
              className="mt-1 w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm outline-none focus:border-[#0e2a23]"
            />
          </div>
          {error && (
            <div className="border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#0e2a23] px-4 py-2 text-sm font-bold tracking-tight text-white transition-colors hover:bg-[#10231d] disabled:opacity-50"
          >
            {pending ? "Working…" : "Generate intake link"}
          </button>
          <p className="text-[11px] leading-relaxed text-[#5a7d70]">
            We don&apos;t email the link automatically — copy it, paste it
            into your existing client communication channel. Each link is
            valid for 14 days.
          </p>
        </form>
      </aside>
    </div>
  );
}
