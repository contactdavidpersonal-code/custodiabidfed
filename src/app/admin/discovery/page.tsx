import Link from "next/link";
import { initDb, getSql } from "@/lib/db";
import { listRecentRuns } from "@/lib/outbound/discovery-pipeline";
import DiscoveryRunButton from "./DiscoveryRunButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProspectPreview = {
  id: string;
  company_name: string;
  domain: string | null;
  state: string | null;
  naics_code: string | null;
  total_award_amount: number | null;
  icp_score: number | null;
  icp_band: string | null;
  ai_score: number | null;
  ai_band: string | null;
  ai_reasoning: string | null;
  status: string;
  most_recent_award_at: string | null;
  created_at: string;
};

async function getRecentProspects(): Promise<ProspectPreview[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id, company_name, domain, state, naics_code,
      total_award_amount, icp_score, icp_band,
      ai_score, ai_band, ai_reasoning, status,
      most_recent_award_at, created_at
    FROM prospects
    WHERE status IN ('approved','new','reviewing')
    ORDER BY ai_score DESC NULLS LAST, icp_score DESC NULLS LAST, created_at DESC
    LIMIT 25
  `) as ProspectPreview[];
  return rows;
}

export default async function DiscoveryPage() {
  await initDb();
  const [recentRuns, recentProspects] = await Promise.all([
    listRecentRuns(5),
    getRecentProspects(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          Discovery agent
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Pulls fresh DoD prime contracts, rule-filters out the obvious
          non-fits, then sends survivors to Claude for ranking. Top picks
          land here as approved leads. Hunter enrichment is OFF in this
          revision &mdash; we&rsquo;ll add emails on demand once the list is curated.
        </p>
      </header>

      <section className="border border-white/10 bg-[#0a2620] p-6">
        <DiscoveryRunButton />
      </section>

      <section className="border border-white/10 bg-[#0a2620]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-serif text-2xl">Top leads (AI-ranked)</h2>
            <p className="mt-1 text-xs text-white/50">
              Sorted by AI score. Click any row to see the full prospect later (coming soon).
            </p>
          </div>
          <Link
            href="/admin/prospects"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[#bdf2cf] hover:underline"
          >
            View all →
          </Link>
        </header>
        {recentProspects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-white/50">
            No leads yet. Click <strong>Find leads</strong> above to populate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f3a2d] text-[10px] uppercase tracking-[0.16em] text-[#8ec3b1]">
                <tr>
                  <th className="px-4 py-3 text-left">AI</th>
                  <th className="px-4 py-3 text-left">Rule</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Why</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3 text-left">NAICS</th>
                  <th className="px-4 py-3 text-right">Award</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentProspects.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-[#0f3a2d]/50">
                    <td className="px-4 py-3">
                      <BandBadge band={p.ai_band} score={p.ai_score} />
                    </td>
                    <td className="px-4 py-3">
                      <BandBadge band={p.icp_band} score={p.icp_score} muted />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.company_name}</div>
                      {p.domain && (
                        <div className="text-[11px] text-white/40">{p.domain}</div>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3 text-[12px] leading-snug text-white/70">
                      {p.ai_reasoning ?? <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-white/70">
                      {p.state ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-white/70">
                      {p.naics_code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.total_award_amount
                        ? `$${(p.total_award_amount / 1000).toFixed(0)}k`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-white/10 bg-[#0a2620]">
        <header className="border-b border-white/10 px-5 py-4">
          <h2 className="font-serif text-2xl">Recent agent runs</h2>
        </header>
        {recentRuns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/50">
            No runs yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f3a2d] text-[10px] uppercase tracking-[0.16em] text-[#8ec3b1]">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Trigger</th>
                  <th className="px-4 py-3 text-right">Awards</th>
                  <th className="px-4 py-3 text-right">Rule-pass</th>
                  <th className="px-4 py-3 text-right">AI kept</th>
                  <th className="px-4 py-3 text-right">Tokens (in/out)</th>
                  <th className="px-4 py-3 text-right">Time</th>
                  <th className="px-4 py-3 text-left">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentRuns.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-[11px] text-white/60">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[11px] uppercase tracking-wider text-white/70">
                      {r.triggered_by}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.awards_fetched}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.ai_reviewed}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#bdf2cf]">
                      {r.ai_kept}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-white/50">
                      {r.ai_input_tokens}/{r.ai_output_tokens}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-white/50">
                      {(r.duration_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="px-4 py-3 text-[11px] text-rose-300">
                      {r.error_message ? r.error_message.slice(0, 60) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BandBadge({
  band,
  score,
  muted = false,
}: {
  band: string | null;
  score: number | null;
  muted?: boolean;
}) {
  const baseColor = muted
    ? band === "A"
      ? "bg-white/10 text-[#bdf2cf]"
      : "bg-white/5 text-white/40"
    : band === "A"
      ? "bg-[#bdf2cf] text-[#0c2219]"
      : band === "B"
        ? "bg-[#0f3a2d] text-[#bdf2cf] border border-[#bdf2cf]/40"
        : band === "C"
          ? "bg-white/5 text-white/60"
          : "bg-white/5 text-white/30";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 items-center justify-center text-xs font-bold ${baseColor}`}
      >
        {band ?? "—"}
      </span>
      <span
        className={`font-mono text-[11px] tabular-nums ${
          muted ? "text-white/30" : "text-white/50"
        }`}
      >
        {score ?? "—"}
      </span>
    </div>
  );
}
