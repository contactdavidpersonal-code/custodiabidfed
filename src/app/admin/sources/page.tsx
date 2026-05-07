import Link from "next/link";
import { getSql, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type SourceRow = {
  code: string;
  label: string;
  channel: string;
  affiliate_email: string | null;
  payout_model: string | null;
  payout_amount_cents: number | null;
  payout_pct: string | null;
  active: boolean;
  created_at: string;
};

export default async function AdminSourcesPage() {
  await initDb();
  const sql = getSql();
  const sources = (await sql`
    SELECT code, label, channel, affiliate_email, payout_model,
           payout_amount_cents, payout_pct, active, created_at
    FROM referral_sources
    ORDER BY active DESC, created_at DESC
  `) as SourceRow[];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          Referral sources
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Every channel that brings traffic to{" "}
          <code className="text-[#bdf2cf]">/cmmc-check</code>. Each source
          gets a unique tracking URL and shows up in the pipeline funnel
          with its own attribution.
        </p>
      </header>

      <section className="border border-white/10 bg-[#0a2620] p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Tracking URL</th>
                <th className="px-3 py-2">Payout</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const trackingUrl = `https://bidfedcmmc.com/cmmc-check?src=${s.code}&utm_source=${s.channel}&utm_campaign=${s.code}`;
                const payout =
                  s.payout_model === "flat" && s.payout_amount_cents
                    ? `$${(s.payout_amount_cents / 100).toFixed(0)} flat`
                    : s.payout_model === "first_year_pct" && s.payout_pct
                      ? `${s.payout_pct}% Y1`
                      : s.payout_model === "lifetime_pct" && s.payout_pct
                        ? `${s.payout_pct}% lifetime`
                        : "—";
                return (
                  <tr key={s.code} className="border-b border-white/5 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{s.label}</div>
                      <div className="font-mono text-[11px] text-white/50">{s.code}</div>
                      {s.affiliate_email && (
                        <div className="mt-1 text-[11px] text-white/50">{s.affiliate_email}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-white/70">{s.channel}</td>
                    <td className="px-3 py-3">
                      <code className="block max-w-[420px] truncate font-mono text-[11px] text-[#cce5da]">
                        {trackingUrl}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-white/70">{payout}</td>
                    <td className="px-3 py-3">
                      {s.active ? (
                        <span className="inline-block bg-[#0f3a2d] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#bdf2cf]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-white/50">
                    No sources yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border border-dashed border-white/15 bg-[#0a2620] p-6 text-sm text-white/70">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8ec3b1]">
          Coming next
        </p>
        <p className="mt-2">
          &ldquo;Add source&rdquo; form (channel, affiliate email, payout model)
          and per-source detail page with copy-to-clipboard tracking URLs and
          payout reconciliation.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cce5da] hover:border-[#bdf2cf] hover:text-white"
        >
          ← Back to pipeline
        </Link>
      </div>
    </div>
  );
}
