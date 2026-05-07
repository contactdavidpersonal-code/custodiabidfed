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
  contact_count: number;
  best_email: string | null;
  best_title: string | null;
};

async function getRecentProspects(): Promise<ProspectPreview[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      p.id, p.company_name, p.domain, p.state, p.naics_code,
      p.total_award_amount, p.icp_score, p.icp_band,
      p.ai_score, p.ai_band, p.ai_reasoning, p.status,
      p.most_recent_award_at, p.created_at,
      COALESCE(c.contact_count, 0)::int AS contact_count,
      c.best_email, c.best_title
    FROM prospects p
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS contact_count,
        (SELECT email FROM prospect_contacts pc2
          WHERE pc2.prospect_id = p.id
          ORDER BY pc2.hunter_confidence DESC NULLS LAST LIMIT 1) AS best_email,
        (SELECT title FROM prospect_contacts pc3
          WHERE pc3.prospect_id = p.id
          ORDER BY pc3.hunter_confidence DESC NULLS LAST LIMIT 1) AS best_title
      FROM prospect_contacts pc
      WHERE pc.prospect_id = p.id
    ) c ON TRUE
    WHERE p.status IN ('approved','new','reviewing')
      AND p.ai_reviewed_at IS NOT NULL
    ORDER BY p.ai_score DESC NULLS LAST, p.created_at DESC
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
          Pulls fresh DoD prime contracts (small-business filter on, last 90 days,
          $25k&ndash;$10M), drops obvious non-fits, sends survivors to Claude for ranking,
          then Hunter finds the best personal email for each kept lead.
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
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Why</th>
                  <th className="px-4 py-3 text-left">Contact</th>
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
                      <div className="font-medium">{p.company_name}</div>
                      {p.domain && (
                        <div className="text-[11px] text-white/40">{p.domain}</div>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3 text-[12px] leading-snug text-white/70">
                      {p.ai_reasoning ?? <span className="text-white/30">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {p.best_email ? (
                        <div>
                          <div className="font-mono text-[#bdf2cf]">{p.best_email}</div>
                          {p.best_title && (
                            <div className="text-[11px] text-white/50">{p.best_title}</div>
                          )}
                          {p.contact_count > 1 && (
                            <div className="text-[10px] text-white/40">+{p.contact_count - 1} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/30">no email yet</span>
                      )}
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
                  <th className="px-4 py-3 text-right">Emails</th>
                  <th className="px-4 py-3 text-right">Tokens</th>
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
                    <td className="px-4 py-3 text-right tabular-nums text-[#bdf2cf]">
                      {r.contacts_written}/{r.contacts_attempted}
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
