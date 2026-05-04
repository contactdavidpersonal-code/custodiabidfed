import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  getDailyDiscoverForOrg,
  type DiscoverCard,
} from "@/lib/discover";
import { getRadarEmailsEnabled } from "@/lib/sam-radar";
import { typicalRangeForNaics } from "@/lib/naics-ranges";
import { setMondayDigestAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Discover — bonus opportunities tab.
 *
 * Shows up to 15 active SAM.gov notices matched to the org's NAICS codes,
 * filtered for CMMC L1 fitness. Refreshes once per UTC day per NAICS code
 * via a shared cache (sam_naics_daily) so the public api.data.gov key
 * scales with NAICS diversity, not user count.
 *
 * No lock, no tailor-packet flow — every card deeplinks straight to
 * SAM.gov. The page also hosts the toggle for the Monday weekly digest
 * email so users can opt out in one click.
 */
export default async function OpportunitiesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  const naics = org.naics_codes ?? [];
  const [discover, digestEnabled] = await Promise.all([
    getDailyDiscoverForOrg({ naicsCodes: naics }),
    getRadarEmailsEnabled(org.id),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3 px-4 py-4 md:gap-6 md:px-6 md:py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Bonus &middot; Daily Discover
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold">
              Today&apos;s top opportunities for your NAICS.
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
              A daily scrub of active SAM.gov notices that fit a CMMC Level 1 contractor &mdash; no CUI, no DFARS 7012, just work you can bid on. Refreshes once per day. Click any card to open it on SAM.gov.
            </p>
          </div>
          <Link
            href="/assessments"
            className="border border-[#cfe3d9] bg-white px-3 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Workspace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        {/* NAICS pills + Monday digest toggle */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-stretch">
          <div className="border border-[#cfe3d9] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-[0.14em] text-[#456c5f]">
                Watching NAICS:
              </span>
              {naics.length > 0 ? (
                naics.map((c) => (
                  <span
                    key={c}
                    className="bg-[#f1f6f3] px-2 py-1 font-mono text-[11px] text-[#10231d]"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-[#a06b1a]">
                  No NAICS configured &mdash;{" "}
                  <Link
                    href="/profile/bid-ready"
                    className="underline hover:text-[#10231d]"
                  >
                    add some on your bid profile
                  </Link>
                  .
                </span>
              )}
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[#7a9c90]">
              Refreshed {discover.fetchedFor}
            </p>
          </div>

          <DigestToggleCard enabled={digestEnabled} />
        </div>

        {/* Cards */}
        {discover.configMissing ? (
          <EmptyState naicsCount={naics.length} />
        ) : discover.cards.length === 0 ? (
          <NothingToday liveFetchFailed={discover.liveFetchFailed} />
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {discover.cards.map((c) => (
              <DiscoverCardItem key={c.noticeId} card={c} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/* ---------------------------------------------------------------------- */

function DigestToggleCard({ enabled }: { enabled: boolean }) {
  return (
    <form
      action={setMondayDigestAction}
      className="flex min-w-[260px] flex-col justify-between border border-[#cfe3d9] bg-[#f1f6f3] p-5"
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0e5c41]">
          📬 Monday digest
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[#10231d]">
          A weekly email every Monday morning with the newest opportunities for your NAICS &mdash; on by default.
        </p>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#10231d]">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="h-4 w-4 accent-[#0e5c41]"
        />
        Send me Monday digests
      </label>
      <button
        type="submit"
        className="mt-3 bg-[#0e2a23] px-4 py-2 text-sm font-bold text-[#bdf2cf] hover:bg-[#10342a]"
      >
        Save
      </button>
    </form>
  );
}

function EmptyState({ naicsCount }: { naicsCount: number }) {
  return (
    <div className="mt-6 border border-dashed border-[#cfe3d9] bg-white px-6 py-12 text-center">
      <p className="font-serif text-lg font-bold text-[#10231d]">
        {naicsCount === 0
          ? "Add a NAICS code to start exploring."
          : "Discover isn't available right now."}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#456c5f]">
        {naicsCount === 0
          ? "We use the NAICS codes on your bid profile to scan SAM.gov each day for matching opportunities."
          : "We can't reach SAM.gov from this server right now. Check back in a few minutes."}
      </p>
      {naicsCount === 0 ? (
        <Link
          href="/profile/bid-ready"
          className="mt-5 inline-block bg-[#0e2a23] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] hover:bg-[#10342a]"
        >
          Set up bid profile →
        </Link>
      ) : null}
    </div>
  );
}

function NothingToday({ liveFetchFailed }: { liveFetchFailed: boolean }) {
  return (
    <div className="mt-6 border border-dashed border-[#cfe3d9] bg-white px-6 py-12 text-center">
      <p className="font-serif text-lg font-bold text-[#10231d]">
        {liveFetchFailed
          ? "SAM.gov was unreachable just now."
          : "No fresh matches today."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#456c5f]">
        {liveFetchFailed
          ? "We'll try again on the next page load. If this persists, the SAM.gov API key may need rotating."
          : "Federal posting volume is uneven by NAICS. New notices arrive daily — check back tomorrow."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function formatDate(input: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DiscoverCardItem({ card }: { card: DiscoverCard }) {
  const range = card.awardAmount ? null : typicalRangeForNaics(card.naicsCode);
  return (
    <li className="flex flex-col border border-[#cfe3d9] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#456c5f]">
        {card.department ? <span>{card.department}</span> : null}
        {card.postedDate ? (
          <>
            <span>·</span>
            <span>Posted {formatDate(card.postedDate)}</span>
          </>
        ) : null}
      </div>
      <h3 className="mt-2 font-serif text-base font-bold leading-snug">
        {card.title}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.type ? (
          <span className="inline-block bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]">
            {card.type}
          </span>
        ) : null}
        {card.setAside ? (
          <span className="inline-block bg-[#f1f6f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#456c5f]">
            {card.setAside}
          </span>
        ) : null}
        {card.awardAmount ? (
          <span
            title="Awarded contract value reported by SAM.gov"
            className="inline-block bg-[#0e5c41] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
          >
            Awarded {card.awardAmount}
          </span>
        ) : range ? (
          <span
            title={`Typical small-business award range for NAICS ${card.naicsCode}. Heuristic from FPDS historicals — not the agency's actual ceiling.`}
            className="inline-block border border-[#cfe3d9] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]"
          >
            Typical {range.label}
          </span>
        ) : null}
        {card.responseDeadline ? (
          <span className="inline-block border border-[#a06b1a] bg-[#fff7eb] px-2 py-0.5 text-[11px] font-bold text-[#a06b1a]">
            Response due {formatDate(card.responseDeadline)}
          </span>
        ) : null}
      </div>

      {card.excerpt ? (
        <p className="mt-3 text-sm leading-relaxed text-[#456c5f]">
          {card.excerpt}
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-1 gap-y-1 text-xs text-[#456c5f]">
        {card.naicsCode ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
              NAICS
            </dt>
            <dd className="font-mono text-[#10231d]">{card.naicsCode}</dd>
          </div>
        ) : null}
        {card.solicitationNumber ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
              Solicitation
            </dt>
            <dd className="break-all font-mono text-[#10231d]">
              {card.solicitationNumber}
            </dd>
          </div>
        ) : null}
        {card.placeOfPerformance ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
              Location
            </dt>
            <dd className="text-[#10231d]">{card.placeOfPerformance}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex-1" />

      <div className="mt-2 border-t border-[#eef3f0] pt-3">
        {card.samUrl ? (
          <a
            href={card.samUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block w-full bg-[#10231d] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0e2a23]"
          >
            View on SAM.gov →
          </a>
        ) : (
          <span className="block w-full cursor-not-allowed border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]">
            No SAM.gov link on file
          </span>
        )}
      </div>
    </li>
  );
}
