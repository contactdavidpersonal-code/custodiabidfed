import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import { CONNECTORS, isConnectorConfigured } from "@/lib/connectors/registry";
import { getConnectorTokenStatus } from "@/lib/connectors/storage";
import type { ConnectorProvider } from "@/lib/connectors/types";
import { playbookById } from "@/lib/playbook";
import { disconnectConnectorAction } from "./actions";

export const metadata = {
  title: "Connections · Custodia",
  description:
    "Connect Microsoft 365 or Google Workspace to auto-collect CMMC Level 1 evidence.",
};

const PROVIDER_ORDER: ReadonlyArray<ConnectorProvider> = ["m365", "google_workspace"];

const CONTROL_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(playbookById).map(([id, p]) => [id, p.shortName]),
);

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function expiryNote(expires: string | null): { text: string; tone: string } {
  if (!expires) return { text: "No expiry recorded", tone: "text-slate-500" };
  const ms = new Date(expires).getTime() - Date.now();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (ms <= 0) return { text: "Token expired — reconnect", tone: "text-rose-700" };
  if (days < 7)
    return { text: `Token expires in ${days} day${days === 1 ? "" : "s"}`, tone: "text-amber-700" };
  return { text: `Token valid (~${days} days)`, tone: "text-emerald-700" };
}

export default async function ConnectionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const org = await ensureOrgForUser(userId);
  const tokens = await getConnectorTokenStatus(org.id);

  const tokenByProvider = new Map<ConnectorProvider, (typeof tokens)[number]>();
  for (const t of tokens) {
    if (!t.revoked_at) tokenByProvider.set(t.provider, t);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/assessments"
          className="text-sm font-medium text-[#5a7d70] hover:text-[#10231d]"
        >
          &larr; Back to assessment
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d]">
          Connect your stack
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#456c5f]">
          Custodia connects to your identity provider <strong>read-only</strong> to
          auto-collect the same evidence you would otherwise screenshot manually.
          Nothing is written back to your tenant. Disconnect any time and tokens are
          purged within 24 hours.
        </p>
      </header>

      <div className="space-y-5">
        {PROVIDER_ORDER.map((provider) => {
          const cfg = CONNECTORS[provider];
          const token = tokenByProvider.get(provider);
          const { configured, missing } = isConnectorConfigured(provider);
          const startPath = `/api/connectors/${provider === "google_workspace" ? "google" : provider}/start`;
          const exp = expiryNote(token?.expires_at ?? null);

          return (
            <section
              key={provider}
              className="rounded-lg border border-[#cfe3d9] bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl font-bold text-[#10231d]">
                      {cfg.label}
                    </h2>
                    {token ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900 ring-1 ring-emerald-200">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-[#456c5f]">{cfg.tagline}</p>
                </div>

                {!configured ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <div className="font-bold uppercase tracking-wider">
                      Setup pending
                    </div>
                    <div className="mt-0.5">
                      Platform admin must configure: {missing.join(", ")}
                    </div>
                  </div>
                ) : token ? (
                  <form action={disconnectConnectorAction}>
                    <input type="hidden" name="provider" value={provider} />
                    <button
                      type="submit"
                      className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <a
                    href={startPath}
                    className="rounded-md bg-[#10231d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a1814]"
                  >
                    Connect {cfg.label}
                  </a>
                )}
              </div>

              {token && (
                <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-[#eef3f0] pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5a7d70]">
                      Connected
                    </dt>
                    <dd className="mt-0.5 text-[#10231d]">{fmt(token.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5a7d70]">
                      Last used
                    </dt>
                    <dd className="mt-0.5 text-[#10231d]">
                      {token.last_used_at ? fmt(token.last_used_at) : "Not yet used"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5a7d70]">
                      Expiry
                    </dt>
                    <dd className={`mt-0.5 ${exp.tone}`}>{exp.text}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-4 border-t border-[#eef3f0] pt-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#5a7d70]">
                  Auto-pulls evidence for
                </h3>
                <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  {cfg.controlsCovered.map((cid) => (
                    <li key={cid} className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-[#5a7d70]">{cid}</span>
                      <span className="text-[#10231d]">
                        {CONTROL_NAMES[cid] ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <details className="mt-4 text-xs text-[#5a7d70]">
                <summary className="cursor-pointer font-semibold text-[#456c5f] hover:text-[#10231d]">
                  Permissions requested ({cfg.scopes.length})
                </summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-[11px]">
                  {cfg.scopes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-[#5a7d70]">
        Tokens are encrypted at rest with AES-256-GCM. Connecting requires a
        Microsoft Entra ID Global Admin or Google Workspace Super Admin so the
        consent grant covers the entire tenant. See our{" "}
        <Link href="/privacy" className="underline decoration-emerald-700 underline-offset-2">
          Privacy Policy
        </Link>{" "}
        for full data-handling details.
      </p>
    </main>
  );
}
