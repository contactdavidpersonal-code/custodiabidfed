import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser, listAssessmentsForOrg } from "@/lib/assessment";
import {
  listOpportunitiesForOrg,
  type OpportunityRow,
} from "@/lib/sam-radar";
import { getCachedLivePreview } from "@/lib/opportunities-live-cache";
import { typicalRangeForNaics } from "@/lib/naics-ranges";
import { pickSampleOpportunities } from "@/lib/sample-opportunities";
import { dismissOpportunityAction } from "./actions";

export const dynamic = "force-dynamic";

const PREVIEW_TARGET = 4;

/**
 * Card-shape used by the page renderer. Persisted inbox rows have a UUID `id`
 * + dismiss support; live preview rows from SAM.gov have only the SAM
 * notice_id and skip the dismiss form.
 */
type DisplayOpportunity = {
  key: string;
  id: string | null; // null = live preview or sample, no inbox row yet
  title: string;
  department: string | null;
  type: string | null;
  naics_code: string | null;
  set_aside: string | null;
  posted_date: string | null;
  response_deadline: string | null;
  solicitation_number: string | null;
  place_of_performance: string | null;
  award_amount: string | null;
  sam_url: string | null;
  /** Short "what they want" blurb fetched from the noticedesc endpoint. */
  summary: string | null;
  /** Raw URL of the noticedesc resource so we only fetch on the server. */
  description_url: string | null;
  /** Synthetic seed used to backfill the page when SAM.gov returns < 4
   *  matches. Sample cards never deeplink to SAM.gov and aren't dismissable. */
  is_sample: boolean;
};

function rowToDisplay(r: OpportunityRow): DisplayOpportunity {
  return {
    key: `inbox:${r.id}`,
    id: r.id,
    title: r.title,
    department: r.department,
    type: r.type,
    naics_code: r.naics_code,
    set_aside: r.set_aside,
    posted_date: r.posted_date,
    response_deadline: r.response_deadline,
    solicitation_number: null,
    place_of_performance: null,
    award_amount: null,
    sam_url: r.sam_url,
    // Persisted inbox rows already have prose copy in `description` (the
    // weekly cron stores the full text). Truncate at render time so the
    // card stays compact.
    summary: summarizeDescription(r.description),
    description_url: null,
    is_sample: false,
  };
}

/**
 * Render any of the date strings SAM.gov returns (some are full ISO
 * timestamps with timezone suffixes, others are bare YYYY-MM-DD) as just
 * the date in `Mon DD, YYYY` form. Falls back to the raw string if it
 * doesn't parse so we never lose information.
 */
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

/** Strip HTML tags + decode common entities + collapse whitespace. */
function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain-text fallback: strip HTML, truncate to a card-friendly length, end
 * on a word boundary. Used both for persisted inbox descriptions and as a
 * safety net when the AI summarizer is unavailable.
 */
function summarizeDescription(raw: string | null, max = 260): string | null {
  if (!raw) return null;
  const text = stripHtml(raw);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max - 40 ? lastSpace : max).trim()}\u2026`;
}

export default async function OpportunitiesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  const naics = org.naics_codes ?? [];
  const [rows, assessments] = await Promise.all([
    listOpportunitiesForOrg({ organizationId: org.id }),
    listAssessmentsForOrg(org.id),
  ]);
  const attestedAssessment = assessments.find((a) => a.status === "attested");
  const inProgressAssessment = !attestedAssessment
    ? assessments.find((a) => a.status !== "archived")
    : null;
  const isAttested = Boolean(attestedAssessment);

  // Build the display list. Always start from the inbox (persisted weekly
  // matches), then top up with live SAM.gov results until we hit the preview
  // target so a brand-new account isn't staring at "No opportunities yet."
  // Live results are display-only — we don't persist them here; the Monday
  // cron is still the canonical inbox writer.
  const inboxDisplay = rows.map(rowToDisplay);
  const seenNotices = new Set(rows.map((r) => r.notice_id));
  const livePreview: DisplayOpportunity[] = [];

  // Live SAM.gov preview is fronted by a per-org cache (sam_live_cache).
  // The cache layer handles the SAM.gov fetch, the Anthropic Haiku summary,
  // hash-based change detection, and stale-on-failure fallback so this
  // page render is now a single DB read in the steady state.
  let liveFetchFailed = false;
  let staleSamFetch = false;
  if (inboxDisplay.length < PREVIEW_TARGET && naics.length > 0) {
    const result = await getCachedLivePreview({
      organizationId: org.id,
      naicsCodes: naics,
    });
    liveFetchFailed = result.liveFetchFailed;
    staleSamFetch = result.staleSamFetch;
    for (const c of result.cards) {
      if (seenNotices.has(c.noticeId)) continue;
      seenNotices.add(c.noticeId);
      livePreview.push({
        key: `live:${c.noticeId}`,
        id: null,
        title: c.title,
        department: c.department,
        type: c.type,
        naics_code: c.naicsCode,
        set_aside: c.setAside,
        posted_date: c.postedDate,
        response_deadline: c.responseDeadline,
        solicitation_number: c.solicitationNumber,
        place_of_performance: c.placeOfPerformance,
        award_amount: c.awardAmount,
        sam_url: c.samUrl,
        summary: c.summary,
        description_url: null,
        is_sample: false,
      });
      if (inboxDisplay.length + livePreview.length >= PREVIEW_TARGET) break;
    }
  }

  const display: DisplayOpportunity[] = [...inboxDisplay, ...livePreview];

  // Backfill with realistic sample opportunities so a brand-new account
  // (or an outage where SAM.gov is unreachable) never lands on an empty
  // pipeline. Samples are clearly labeled in the UI and don't deeplink
  // to SAM.gov so users can't accidentally try to bid on them. Once
  // the radar starts filling the inbox, real matches push samples down
  // and eventually replace them entirely.
  if (display.length < PREVIEW_TARGET) {
    const bank = pickSampleOpportunities(naics);
    const need = PREVIEW_TARGET - display.length;
    const today = new Date();
    for (let i = 0; i < bank.length && i < need; i += 1) {
      const s = bank[i];
      const due = new Date(today);
      due.setDate(due.getDate() + s.responseDeadlineInDays);
      display.push({
        key: `sample:${s.key}`,
        id: null,
        title: s.title,
        department: s.department,
        type: s.type,
        naics_code: s.naicsCode,
        set_aside: s.setAside,
        posted_date: today.toISOString().slice(0, 10),
        response_deadline: due.toISOString().slice(0, 10),
        solicitation_number: null,
        place_of_performance: s.placeOfPerformance,
        award_amount: null,
        sam_url: null,
        summary: s.summary,
        description_url: null,
        is_sample: true,
      });
    }
  }
  const sampleCount = display.filter((d) => d.is_sample).length;

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 md:gap-6 md:px-6 md:py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Step 7 of 7 · Find &amp; submit bids
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold">
              You&apos;re bid-ready. Here&apos;s your matched federal pipeline.
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
              Active SAM.gov notices matched to {org.name}&apos;s NAICS codes and capabilities. One click on any row tailors your packet to the agency&apos;s exact PWS language and submits a polished response in minutes, not days.
            </p>
          </div>
          <Link
            href="/assessments"
            className=" border border-[#cfe3d9] bg-white px-3 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Workspace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        {!isAttested && (
          <div className="mb-6 overflow-hidden  border border-[#a06b1a] bg-[#fff7e8] p-5 shadow-[0_2px_0_rgba(160,107,26,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
                  Preview &middot; Submitting bids is locked
                </p>
                <h2 className="mt-1 font-serif text-lg font-bold text-[#5a3d0a]">
                  Browse opportunities now &mdash; finish steps 1&ndash;6 to submit.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5a3d0a]">
                  We need a signed CMMC Level 1 affirmation on file before primes will accept your bid. The opportunity feed is fully visible during your 14-day free trial; the &ldquo;Tailor packet&rdquo; and &ldquo;View on SAM.gov&rdquo; actions unlock the moment you finish step 4 (Sign &amp; affirm).
                </p>
              </div>
              <Link
                href={
                  inProgressAssessment
                    ? `/assessments/${inProgressAssessment.id}`
                    : `/assessments`
                }
                className=" bg-[#0e2a23] px-4 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
              >
                Finish my CMMC L1 &rarr;
              </Link>
            </div>
          </div>
        )}

        <div className=" border border-[#cfe3d9] bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-[0.14em] text-[#456c5f]">
              Watching NAICS:
            </span>
            {naics.length > 0 ? (
              naics.map((c) => (
                <span
                  key={c}
                  className=" bg-[#f1f6f3] px-2 py-1 font-mono text-[11px] text-[#10231d]"
                >
                  {c}
                </span>
              ))
            ) : (
              <span className="text-[#a06b1a]">
                No NAICS configured —{" "}
                <Link
                  href="/profile/bid-ready"
                  className="underline hover:text-[#10231d]"
                >
                  add some on your bid profile
                </Link>{" "}
                to start receiving matches.
              </span>
            )}
          </div>
        </div>

        {display.length === 0 ? (
          <div className="mt-6  border border-dashed border-[#cfe3d9] bg-white p-10 text-center text-sm text-[#456c5f]">
            <p className="font-semibold text-[#10231d]">
              No opportunities yet.
            </p>
            <p className="mt-1">
              {naics.length === 0
                ? "Add at least one NAICS code on your bid profile to start receiving matches."
                : "The radar runs every Monday morning. Any new SAM.gov notices matching your NAICS codes will appear here."}
            </p>
          </div>
        ) : (
          <>
            {sampleCount > 0 && (
              <div className="mt-6  border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-3 text-xs leading-relaxed text-[#456c5f]">
                <span className="font-bold uppercase tracking-[0.14em] text-[#0e5c41]">
                  Pipeline preview ·{" "}
                </span>
                {liveFetchFailed
                  ? "SAM.gov was unreachable just now and we don't have a cached snapshot yet, so we filled in representative samples for your NAICS so you can see the kind of work that's out there."
                  : inboxDisplay.length === 0 && livePreview.length === 0
                    ? "Your weekly radar runs every Monday — until then, here are representative samples for your NAICS so you can see the kind of work that's out there."
                    : "We filled the bottom of the list with representative samples for your NAICS so you always see at least four. Real matches will replace them as the radar finds them."}
              </div>
            )}
            {staleSamFetch && livePreview.length > 0 && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#a06b1a]">
                SAM.gov was briefly unreachable — showing the last cached snapshot of your live matches.
              </p>
            )}
            {livePreview.length > 0 && (
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
                Live preview from SAM.gov · matched to your NAICS
              </p>
            )}
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {display.map((r) => (
                <li
                  key={r.key}
                  className="flex flex-col  border border-[#cfe3d9] bg-white p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#456c5f]">
                    {r.department ? <span>{r.department}</span> : null}
                    {r.posted_date ? (
                      <>
                        <span>·</span>
                        <span>Posted {r.posted_date}</span>
                      </>
                    ) : null}
                  </div>
                  <h3 className="mt-2 font-serif text-base font-bold leading-snug">
                    {r.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.is_sample ? (
                      <span
                        title="Representative sample for your NAICS — not a live SAM.gov notice. Real matches will replace it as the weekly radar finds them."
                        className="inline-block  border border-[#a06b1a] bg-[#fff7eb] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#a06b1a]"
                      >
                        Sample
                      </span>
                    ) : null}
                    {r.type ? (
                      <span className="inline-block  bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]">
                        {r.type}
                      </span>
                    ) : null}
                    {r.set_aside ? (
                      <span className="inline-block  bg-[#f1f6f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#456c5f]">
                        {r.set_aside}
                      </span>
                    ) : null}
                    {/* Value badge: prefer the real award_amount when SAM
                        returns one (only on award notices); otherwise show
                        a NAICS-derived "typical range" so every card has a
                        scale anchor. The label is intentionally honest —
                        "Typical range" is a heuristic, not an estimate. */}
                    {r.award_amount ? (
                      <span
                        title="Awarded contract value reported by SAM.gov"
                        className="inline-block  bg-[#0e5c41] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
                      >
                        Awarded {r.award_amount}
                      </span>
                    ) : (() => {
                      const range = typicalRangeForNaics(r.naics_code);
                      return range ? (
                        <span
                          title={`Typical small-business award range for NAICS ${r.naics_code}. Heuristic from FPDS historicals — not the agency's actual ceiling.`}
                          className="inline-block  border border-[#cfe3d9] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]"
                        >
                          Typical {range.label}
                        </span>
                      ) : null;
                    })()}
                    {r.response_deadline ? (
                      <span className="inline-block  border border-[#a06b1a] bg-[#fff7eb] px-2 py-0.5 text-[11px] font-bold text-[#a06b1a]">
                        Response due {formatDate(r.response_deadline)}
                      </span>
                    ) : null}
                  </div>

                  {r.summary ? (
                    <p className="mt-3 text-sm leading-relaxed text-[#456c5f]">
                      {r.summary}
                    </p>
                  ) : null}

                  {/* Structured detail rows. Award amount only renders on
                      award notices; active solicitations don't expose a
                      contract value via the public API. */}
                  <dl className="mt-3 grid grid-cols-1 gap-y-1 text-xs text-[#456c5f]">
                    {r.naics_code ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
                          NAICS
                        </dt>
                        <dd className="font-mono text-[#10231d]">
                          {r.naics_code}
                        </dd>
                      </div>
                    ) : null}
                    {r.solicitation_number ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
                          Solicitation
                        </dt>
                        <dd className="break-all font-mono text-[#10231d]">
                          {r.solicitation_number}
                        </dd>
                      </div>
                    ) : null}
                    {r.place_of_performance ? (
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 font-semibold uppercase tracking-[0.08em] text-[#7a9c90]">
                          Location
                        </dt>
                        <dd className="text-[#10231d]">
                          {r.place_of_performance}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {/* Spacer pushes the action row to the bottom of the card so
                      a 2-up grid lines up cleanly even with uneven copy. */}
                  <div className="mt-4 flex-1" />

                  <div className="mt-2 border-t border-[#eef3f0] pt-3">
                    {r.is_sample ? (
                      <span
                        title="This is a representative sample, not a live SAM.gov notice. Real matches arrive every Monday."
                        aria-disabled="true"
                        className="block w-full cursor-not-allowed select-none  border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]"
                      >
                        Sample preview &mdash; live notices arrive every Monday
                      </span>
                    ) : isAttested ? (
                      r.sam_url ? (
                        <a
                          href={r.sam_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block w-full  bg-[#10231d] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0e2a23]"
                        >
                          View on SAM.gov →
                        </a>
                      ) : (
                        <span className="block w-full cursor-not-allowed  border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]">
                          No SAM.gov link on file
                        </span>
                      )
                    ) : (
                      <span
                        title="Sign your CMMC L1 affirmation (step 4) to unlock viewing this opportunity on SAM.gov."
                        aria-disabled="true"
                        className="block w-full cursor-not-allowed select-none  border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]"
                      >
                        🔒 View on SAM.gov &mdash; finish CMMC L1 to unlock
                      </span>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {isAttested && r.id ? (
                        <Link
                          href={`/opportunities/${r.id}/tailor`}
                          className="font-semibold text-[#10231d] hover:underline"
                        >
                          ✨ Tailor packet for this
                        </Link>
                      ) : null}
                      {r.id ? (
                        <form
                          action={dismissOpportunityAction}
                          className="ml-auto"
                        >
                          <input
                            type="hidden"
                            name="opportunityId"
                            value={r.id}
                          />
                          <button
                            type="submit"
                            className="text-[#456c5f] hover:text-[#b03a2e]"
                          >
                            Dismiss
                          </button>
                        </form>
                      ) : (
                        <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[#7a9c90]">
                          Live preview
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
