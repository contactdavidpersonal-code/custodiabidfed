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
  most_recent_award_at: string | null;
  created_at: string;
  contact_email: string | null;
  contact_title: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
};

async function getRecentProspects(): Promise<ProspectPreview[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      p.id, p.company_name, p.domain, p.state, p.naics_code,
      p.total_award_amount, p.icp_score, p.icp_band,
      p.most_recent_award_at, p.created_at,
      pc.email AS contact_email,
      pc.title AS contact_title,
      pc.first_name AS contact_first_name,
      pc.last_name AS contact_last_name
    FROM prospects p
    LEFT JOIN LATERAL (
      SELECT email, title, first_name, last_name
      FROM prospect_contacts
      WHERE prospect_id = p.id
      ORDER BY hunter_confidence DESC NULLS LAST
      LIMIT 1
    ) pc ON TRUE
    WHERE p.icp_band IN ('A','B','C')
    ORDER BY p.created_at DESC
    LIMIT 20
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
          Pulls fresh DoD prime contracts, scores each company against your
          CMMC L1 ICP, and finds verified contact emails for the top
          matches. Daily cron runs automatically — use the button below to
          fetch on demand.
        </p>
      </header>

      <section className="border border-white/10 bg-[#0a2620] p-6">
        <DiscoveryRunButton />
      </section>

      <section className="border border-white/10 bg-[#0a2620]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-serif text-2xl">Recent leads</h2>
          <Link
            href="/admin/prospects"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[#bdf2cf] hover:underline"
          >
            View all →
          </Link>
        </header>
        {recentProspects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-white/50">
            No leads yet. Click <strong>Find {`{count}`} leads</strong> above to populate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f3a2d] text-[10px] uppercase tracking-[0.16em] text-[#8ec3b1]">
                <tr>
                  <th className="px-4 py-3 text-left">Score</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3 text-left">NAICS</th>
                  <th className="px-4 py-3 text-right">Award</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentProspects.map((p) => (
                  <tr key={p.id} className="hover:bg-[#0f3a2d]/50">
                    <td className="px-4 py-3">
                      <BandBadge band={p.icp_band} score={p.icp_score} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.company_name}</div>
                      {p.domain && (
                        <div className="text-[11px] text-white/40">{p.domain}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.contact_email ? (
                        <div>
                          <div className="font-mono text-[12px] text-[#bdf2cf]">
                            {p.contact_email}
                          </div>
                          <div className="text-[11px] text-white/50">
                            {[
                              [p.contact_first_name, p.contact_last_name]
                                .filter(Boolean)
                                .join(" "),
                              p.contact_title,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">no email yet</span>
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
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Awards</th>
                  <th className="px-4 py-3 text-right">New</th>
                  <th className="px-4 py-3 text-right">Contacts</th>
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
                      {r.target_count ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.awards_fetched}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.prospects_written}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#bdf2cf]">
                      {r.contacts_written}
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

function BandBadge({ band, score }: { band: string | null; score: number | null }) {
  const color =
    band === "A"
      ? "bg-[#bdf2cf] text-[#0c2219]"
      : band === "B"
        ? "bg-[#0f3a2d] text-[#bdf2cf] border border-[#bdf2cf]/40"
        : "bg-white/5 text-white/60";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 items-center justify-center font-bold ${color}`}
      >
        {band ?? "—"}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-white/50">
        {score ?? "—"}
      </span>
    </div>
  );
}
