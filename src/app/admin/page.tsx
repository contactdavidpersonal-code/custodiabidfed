import Link from "next/link";
import { getSql, initDb } from "@/lib/db";

/**
 * Admin pipeline dashboard. Funnel from USAspending discovery → paid card.
 * Reads strictly aggregate counts (no PII on this page) so it's safe to
 * leave open on a screen.
 */
export const dynamic = "force-dynamic";

type FunnelRow = {
  prospects_total: number;
  prospects_qualified: number;
  prospects_approved: number;
  contacts_total: number;
  contacts_pushed: number;
  contacts_replied: number;
  contacts_unsubscribed: number;
  touches_total: number;
  conv_quiz: number;
  conv_trial: number;
  conv_paid: number;
  revenue_cents: number;
};

type SourceRow = {
  code: string;
  label: string;
  channel: string;
  touches: number;
  trials: number;
  paid: number;
  revenue_cents: number;
};

export default async function AdminDashboardPage() {
  await initDb();
  const sql = getSql();

  const [funnel] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM prospects) AS prospects_total,
      (SELECT COUNT(*)::int FROM prospects WHERE icp_band IN ('A','B')) AS prospects_qualified,
      (SELECT COUNT(*)::int FROM prospects WHERE status IN ('approved','queued','sending','engaged','converted')) AS prospects_approved,
      (SELECT COUNT(*)::int FROM prospect_contacts) AS contacts_total,
      (SELECT COUNT(*)::int FROM prospect_contacts WHERE pushed_to_instantly_at IS NOT NULL) AS contacts_pushed,
      (SELECT COUNT(*)::int FROM prospect_contacts WHERE replied = TRUE) AS contacts_replied,
      (SELECT COUNT(*)::int FROM prospect_contacts WHERE unsubscribed = TRUE) AS contacts_unsubscribed,
      (SELECT COUNT(*)::int FROM attribution_touches) AS touches_total,
      (SELECT COUNT(*)::int FROM conversions WHERE kind = 'quiz_completed') AS conv_quiz,
      (SELECT COUNT(*)::int FROM conversions WHERE kind = 'trial_started') AS conv_trial,
      (SELECT COUNT(*)::int FROM conversions WHERE kind = 'paid') AS conv_paid,
      (SELECT COALESCE(SUM(revenue_cents),0)::int FROM conversions WHERE kind = 'paid') AS revenue_cents
  `) as FunnelRow[];

  const sources = (await sql`
    SELECT
      rs.code,
      rs.label,
      rs.channel,
      (SELECT COUNT(*)::int FROM attribution_touches WHERE source_code = rs.code) AS touches,
      (SELECT COUNT(*)::int FROM conversions WHERE source_code = rs.code AND kind = 'trial_started') AS trials,
      (SELECT COUNT(*)::int FROM conversions WHERE source_code = rs.code AND kind = 'paid') AS paid,
      (SELECT COALESCE(SUM(revenue_cents),0)::int FROM conversions WHERE source_code = rs.code AND kind = 'paid') AS revenue_cents
    FROM referral_sources rs
    WHERE rs.active = TRUE
    ORDER BY paid DESC, trials DESC, touches DESC
  `) as SourceRow[];

  const dollars = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          Customer acquisition funnel
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          End-to-end attribution from cold outreach (and every other channel)
          through trial start to paid card. Numbers update in real time as
          touches and conversions land.
        </p>
      </header>

      {/* Funnel */}
      <section className="border border-white/10 bg-[#0a2620] p-6 shadow-2xl">
        <h2 className="font-serif text-2xl">Funnel</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FunnelCell label="Prospects discovered" value={funnel.prospects_total} />
          <FunnelCell label="ICP-qualified (A/B)" value={funnel.prospects_qualified} />
          <FunnelCell label="Contacts enriched" value={funnel.contacts_total} />
          <FunnelCell label="Pushed to Instantly" value={funnel.contacts_pushed} />
          <FunnelCell label="Replied" value={funnel.contacts_replied} accent />
          <FunnelCell label="Unsubscribed" value={funnel.contacts_unsubscribed} muted />
          <FunnelCell label="Quiz completed" value={funnel.conv_quiz} />
          <FunnelCell label="Trial started" value={funnel.conv_trial} accent />
          <FunnelCell label="Paid (card on file)" value={funnel.conv_paid} accent />
          <FunnelCell
            label="Revenue (paid)"
            value={dollars(funnel.revenue_cents)}
            accent
          />
          <FunnelCell label="Touches recorded" value={funnel.touches_total} muted />
        </div>
      </section>

      {/* Sources */}
      <section className="border border-white/10 bg-[#0a2620] p-6 shadow-2xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl">Sources</h2>
            <p className="mt-1 text-sm text-white/60">
              Every channel that brings traffic to /cmmc-check. Add
              affiliates, content campaigns, and paid ads from the{" "}
              <Link href="/admin/sources" className="underline decoration-[#bdf2cf]/60 hover:text-white">
                Sources
              </Link>{" "}
              tab.
            </p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2 text-right">Touches</th>
                <th className="px-3 py-2 text-right">Trials</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.code} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[11px] text-white/50">{s.code}</div>
                  </td>
                  <td className="px-3 py-3 text-white/70">{s.channel}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.touches}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.trials}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#bdf2cf]">{s.paid}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{dollars(s.revenue_cents)}</td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/50">
                    No sources yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard
          title="Discovery"
          desc="Pull DoD prime contracts from USAspending, score by ICP, and enrich with Hunter."
          href="/admin/discovery"
          cta="Run discovery"
        />
        <ActionCard
          title="Push leads to Instantly"
          desc="Approve top-band contacts and push them as Instantly leads with attribution variables."
          href="/admin/contacts"
          cta="Open contacts"
        />
        <ActionCard
          title="Add a source"
          desc="Create a new referral source — affiliate, content campaign, or ad — get a tracking URL."
          href="/admin/sources"
          cta="Manage sources"
        />
      </section>
    </div>
  );
}

function FunnelCell({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${
        accent
          ? "border-[#bdf2cf]/30 bg-[#0f3a2d]"
          : muted
            ? "border-white/5 bg-[#0a2620]/50"
            : "border-white/10 bg-[#0f3a2d]"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
        {label}
      </div>
      <div
        className={`mt-2 font-serif text-3xl tabular-nums ${
          accent ? "text-[#bdf2cf]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block border border-white/10 bg-[#0a2620] p-5 transition-colors hover:border-[#bdf2cf]/40"
    >
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#bdf2cf]">
        {cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
