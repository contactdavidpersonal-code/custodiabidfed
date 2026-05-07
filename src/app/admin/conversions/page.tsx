import Link from "next/link";
import { getSql, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type ConvRow = {
  id: string;
  kind: string;
  email: string | null;
  source_code: string | null;
  revenue_cents: number | null;
  occurred_at: string;
};

export default async function AdminConversionsPage() {
  await initDb();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, kind, email, source_code, revenue_cents, occurred_at
    FROM conversions
    ORDER BY occurred_at DESC
    LIMIT 200
  `) as ConvRow[];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          Conversions
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Every quiz completion, trial start, card-on-file, and paid event
          with first-touch attribution.
        </p>
      </header>

      <section className="border border-white/10 bg-[#0a2620]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ec3b1]">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-3 py-2 font-mono text-[11px] text-white/60">
                    {new Date(r.occurred_at).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2">{r.kind}</td>
                  <td className="px-3 py-2 text-white/70">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#cce5da]">
                    {r.source_code ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.revenue_cents
                      ? `$${(r.revenue_cents / 100).toFixed(0)}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-white/50">
                    No conversions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Link
        href="/admin"
        className="inline-block border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cce5da] hover:border-[#bdf2cf] hover:text-white"
      >
        ← Back to pipeline
      </Link>
    </div>
  );
}
