import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  L1_REQUIREMENT_LABELS,
  readinessScore,
  type CmmcCheckResult,
  type GapStatus,
} from "@/lib/cmmc/applicability";
import { getSession, isValidToken } from "@/lib/cmmc-check/store";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Your CMMC Level 1 Check | Custodia",
  description:
    "A one-page diagnostic produced by Charlie at bidfedcmmc.com.",
  // Don't index per-prospect reports.
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params;
  if (!isValidToken(token)) notFound();
  const session = await getSession(token);
  if (!session || !session.result) notFound();

  return <Report result={session.result} />;
}

function Report({ result }: { result: CmmcCheckResult }) {
  const { determination } = result;
  const isL1 = determination === "level_1";
  const score = isL1 ? readinessScore(result.gaps) : null;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fyEnd = fiscalYearEndLabel();

  return (
    <main className="min-h-screen bg-[#fafaf7] print:bg-white">
      {/* Action bar — hidden on print */}
      <div className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/cmmc-check"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to CMMC Check
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
            <Link
              href="/sign-up?utm_source=cmmc-check"
              className="rounded-full border border-[#10231d] bg-white px-4 py-1.5 text-xs font-semibold text-[#10231d] hover:bg-slate-50"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-8 print:max-w-none print:py-6">
        {/* Letterhead */}
        <header className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
              Custodia · CMMC Level 1 Check
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-[#10231d] sm:text-4xl">
              Your CMMC Level 1 diagnostic
            </h1>
            <div className="mt-2 text-sm text-slate-600">
              {result.companyName ? (
                <>
                  Prepared for <strong>{result.companyName}</strong> ·{" "}
                </>
              ) : null}
              {today}
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="font-serif text-2xl font-bold text-[#10231d]">C</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Charlie · vCO
            </div>
          </div>
        </header>

        {/* Determination card */}
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Determination
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <DeterminationLabel determination={result.determination} />
            {isL1 && score && (
              <div className="text-sm text-slate-600">
                Estimated readiness:{" "}
                <strong className="text-[#10231d]">{score.score}%</strong> ·{" "}
                {score.metCount} met · {score.partialCount} partial ·{" "}
                {score.notMetCount} not met · {score.unsureCount} unsure
              </div>
            )}
          </div>
          {result.whatTheyDo && (
            <p className="mt-3 text-sm italic text-slate-600">
              &ldquo;{result.whatTheyDo}&rdquo;
            </p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-slate-800">
            {result.determinationRationale}
          </p>
        </section>

        {/* Gap matrix — only when L1 applies */}
        {isL1 && (
          <section className="mb-8">
            <h2 className="mb-3 font-serif text-xl font-bold text-[#10231d]">
              The 15 requirements, your posture
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Per FAR 52.204-21(b)(1) and CMMC Assessment Guide Level 1 v2.13.
              Each requirement decomposes into 1–6 NIST SP 800-171A objectives;
              this view rolls up to the requirement level.
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:shadow-none">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Requirement</th>
                    <th className="px-4 py-2.5">Posture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.gaps.map((g) => (
                    <tr key={g.id} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {g.id}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {L1_REQUIREMENT_LABELS[g.id]}
                        {g.note ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {g.note}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-serif text-xl font-bold text-[#10231d]">
              What to do next
            </h2>
            <ol className="space-y-3">
              {result.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm print:shadow-none"
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* CTA — Custodia value prop */}
        <section className="mb-8 rounded-xl border border-[#10231d] bg-[#10231d] p-6 text-white print:bg-white print:text-[#10231d]">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-300 print:text-emerald-800">
            How Custodia closes this in 7 days
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold leading-tight">
            One officer. One platform. The 15 requirements done right.
          </h2>
          <ul className="mt-4 grid gap-2 text-sm leading-relaxed sm:grid-cols-2">
            <li>· Charlie 24/7 inside the workspace, with full evidence tooling</li>
            <li>· Microsoft 365 / Google Workspace evidence collection</li>
            <li>· Signed, hash-anchored annual artifact pack (SPRS-ready)</li>
            <li>· Continuous monitoring · audit support · officer escalation</li>
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-up?utm_source=cmmc-check"
              className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#10231d] hover:bg-amber-200 print:bg-[#10231d] print:text-white"
            >
              Start 14-day free trial — no card
            </Link>
            <span className="text-xs text-emerald-100 print:text-slate-700">
              Current rate <strong>$449/mo</strong> locked through {fyEnd} for
              CMMC Check arrivals.
            </span>
          </div>
        </section>

        {/* Footer / sources */}
        <footer className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
          <p className="mb-1">
            <strong>Sources:</strong> FAR 52.204-21 · 32 CFR § 170 · CMMC
            Assessment Guide Level 1 v2.13 · NIST SP 800-171 r2 ·
            DFARS 252.204-7021 / 7025.
          </p>
          <p className="mb-1">
            This is a directional self-check, not a formal assessment. A
            self-attestation in SPRS must be made by your Affirming Official
            after the 15 requirements are demonstrably met (or covered by an
            Enduring Exception or Temporary Deficiency with milestones, per
            32 CFR § 170.24).
          </p>
          <p>
            Generated by Charlie · Custodia · bidfedcmmc.com · {today}
          </p>
        </footer>
      </article>

      {/* Print-only polish */}
      <style>{`
        @media print {
          @page { margin: 0.6in; }
          html, body { background: white !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>
    </main>
  );
}

function DeterminationLabel({
  determination,
}: {
  determination: CmmcCheckResult["determination"];
}) {
  if (determination === "level_1") {
    return (
      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
        CMMC Level 1 applies
      </span>
    );
  }
  if (determination === "level_2") {
    return (
      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
        Level 2 (CUI) — out of L1 scope
      </span>
    );
  }
  if (determination === "none") {
    return (
      <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
        Not in CMMC scope today
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
      Inconclusive
    </span>
  );
}

function StatusPill({ status }: { status: GapStatus }) {
  const map: Record<GapStatus, { label: string; cls: string }> = {
    met: {
      label: "Met",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    partial: {
      label: "Partial",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    not_met: {
      label: "Not met",
      cls: "bg-rose-50 text-rose-800 border-rose-200",
    },
    unsure: {
      label: "Unsure",
      cls: "bg-slate-50 text-slate-700 border-slate-200",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function fiscalYearEndLabel(): string {
  // U.S. federal FY ends Sep 30. If today is past Sep 30, point to next year's.
  const now = new Date();
  const year =
    now.getMonth() > 8 || (now.getMonth() === 8 && now.getDate() > 30)
      ? now.getFullYear() + 1
      : now.getFullYear();
  return `Sep 30, ${year}`;
}
