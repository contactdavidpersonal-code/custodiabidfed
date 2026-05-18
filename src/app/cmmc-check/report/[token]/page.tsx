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

        {/* CTA — branches on determination */}
        {isL1 && (
          <section className="mb-8 rounded-xl border border-[#10231d] bg-[#10231d] p-6 text-white print:bg-white print:text-[#10231d]">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#c4f0b8] print:text-emerald-800">
              You&apos;re in scope. Here&apos;s how Custodia closes this in seven days.
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-tight">
              One officer. One platform. The fifteen practices done right.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100 print:text-slate-700">
              You walked through this with me, Charlie. Inside Custodia, I&apos;m
              your full-time officer with the tools to actually fix the gaps
              we just found, generate the artifact pack a contracting officer
              expects, and post your score where they look for it.
            </p>
            <ul className="mt-4 grid gap-2 text-sm leading-relaxed sm:grid-cols-2">
              <li>· Charlie 24/7 inside the workspace, full evidence tooling</li>
              <li>· Microsoft 365 / Google Workspace evidence collection</li>
              <li>· Signed annual artifact pack — security plan, evidence, affirmation</li>
              <li>· Continuous monitoring · audit support · officer escalation</li>
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4 print:hidden">
              <Link
                href="/sign-up?utm_source=cmmc-check&utm_medium=report&utm_campaign=l1"
                className="inline-flex items-center gap-2 bg-[#c4f0b8] px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#0a2620] transition-all hover:bg-white hover:tracking-[0.22em]"
              >
                Continue with Custodia →
              </Link>
              <span className="text-xs text-emerald-100 print:text-slate-700">
                14-day free trial · No credit card · <strong>$249/mo</strong>{" "}
                or $2,496/yr on annual.
              </span>
            </div>
          </section>
        )}

        {determination === "none" && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 print:shadow-none">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
              You&apos;re not in scope today
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-[#10231d]">
              Save this report. Come back when one of these happens.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              The basic federal cyber standard kicks in the moment you handle{" "}
              <em>non-public</em> contract information from a federal buyer or
              prime. None of that&apos;s true for you yet — most small
              businesses aren&apos;t in scope and don&apos;t need to spend a
              dollar on this until they are.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-800 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  When to come back
                </div>
                <ul className="mt-2 space-y-1.5 leading-relaxed">
                  <li>· You win a federal contract or task order — even a small one</li>
                  <li>· A prime contractor adds you to a teaming agreement</li>
                  <li>
                    · A buyer sends you specs, drawings, or statements of work
                    that aren&apos;t public on a government website
                  </li>
                  <li>· A contracting officer or prime asks for your score</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  What size contract triggers it
                </div>
                <p className="mt-2 leading-relaxed">
                  There is no dollar floor. A $5,000 task order with non-public
                  contract info triggers the same fifteen practices as a
                  $5M one. If you&apos;re subbing under a prime, the prime
                  flows it down to you regardless of award size.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
              <Link
                href="/sign-up?utm_source=cmmc-check&utm_medium=report&utm_campaign=none"
                className="inline-flex items-center gap-2 bg-[#c4f0b8] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#0a2620] transition-all hover:bg-white hover:tracking-[0.22em]"
              >
                Set up Custodia anyway →
              </Link>
              <span className="text-xs text-slate-600">
                Some founders set the platform up <em>before</em> the first
                award lands so they&apos;re bid-ready day one.
              </span>
            </div>
          </section>
        )}

        {determination === "level_2" && (
          <section className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-6 print:shadow-none">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-900">
              This is bigger than the basic standard
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-[#10231d]">
              You&apos;re looking at Level 2 — talk to a human on our team.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-800">
              You mentioned controlled or marked information. That puts you
              past the basic standard and into a much heavier lift —
              roughly 110 controls, third-party audits, and serious
              documentation. Custodia handles Level 2 as a separate
              officer-led engagement; we don&apos;t recommend tackling it
              yourself with a self-serve tool.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
              <Link
                href="/sign-up?utm_source=cmmc-check&utm_medium=report&utm_campaign=l2"
                className="inline-flex items-center gap-2 bg-[#10231d] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#0a1813]"
              >
                Talk to a Custodia officer →
              </Link>
              <span className="text-xs text-slate-600">
                A real person reaches out within one business day.
              </span>
            </div>
          </section>
        )}

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
