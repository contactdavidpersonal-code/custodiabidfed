import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser, listAssessmentsForOrg } from "@/lib/assessment";
import { getAnthropic } from "@/lib/anthropic";
import {
  listOpportunitiesForOrg,
  searchSamOpportunities,
  type OpportunityRow,
} from "@/lib/sam-radar";
import { typicalRangeForNaics } from "@/lib/naics-ranges";
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
  id: string | null; // null = live preview, no inbox row yet
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
  };
}

/**
 * Fetch the noticedesc resource for a single opportunity. SAM.gov returns
 * `{ description: "<html>…</html>" }` for most notices. Best-effort: any
 * failure (auth, 404, timeout) yields `null` and the card just hides the
 * blurb instead of failing the whole render.
 */
async function fetchNoticeDescription(
  url: string | null,
  apiKey: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    let target = url;
    if (target.includes("{api_key}")) {
      target = target.replace("{api_key}", encodeURIComponent(apiKey));
    } else if (!/[?&]api_key=/.test(target)) {
      target += (target.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(apiKey)}`;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { description?: string };
    return json.description ?? null;
  } catch {
    return null;
  }
}

/**
 * One-sentence AI summary of what a SAM.gov notice is asking for. We feed the
 * raw description to Claude Haiku with a tight prompt that forces a single
 * plain-English sentence starting with a verb (e.g., "Provide…", "Supply…",
 * "Operate and maintain…"). Returns null on any error so the caller can
 * fall back to a plain-text excerpt.
 */
async function aiSummarize(
  title: string,
  rawDescription: string,
): Promise<string | null> {
  const cleaned = stripHtml(rawDescription).slice(0, 4000);
  if (!cleaned || cleaned.length < 40) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const client = getAnthropic();
    const resp = await client.messages.create(
      {
        model: "claude-haiku-4-5",
        max_tokens: 120,
        system:
          "You summarize U.S. federal contracting opportunity notices for a small business owner deciding whether to bid. Output ONE sentence (max 220 characters) describing what the agency is actually asking a contractor to do or supply. Start with an action verb (Provide, Supply, Maintain, Operate, Furnish, etc.). No preamble, no quotes, no markdown, no agency name, no contract numbers, no dates. Plain prose only.",
        messages: [
          {
            role: "user",
            content: `Title: ${title}\n\nNotice description:\n${cleaned}`,
          },
        ],
      },
      { signal: ctl.signal },
    );
    clearTimeout(timer);
    const block = resp.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const text = block.text.trim().replace(/^["']|["']$/g, "");
    return text.length > 0 ? text : null;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[opportunities] aiSummarize failed: ${msg}`);
    return null;
  }
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
  let liveFetchFailed = false;

  // Live SAM.gov preview is best-effort: ANY failure here (network, key,
  // parsing, library quirks) must never bubble up and 500 the page. We
  // explicitly log to stderr (visible in Vercel runtime logs) so we can
  // diagnose without taking down the route.
  const livePreviewEnabled =
    process.env.OPPORTUNITIES_LIVE_PREVIEW !== "off";
  if (
    livePreviewEnabled &&
    inboxDisplay.length < PREVIEW_TARGET &&
    naics.length > 0
  ) {
    const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
    if (apiKey) {
      try {
        const need = PREVIEW_TARGET - inboxDisplay.length;
        const live = await searchSamOpportunities({
          apiKey,
          naicsCodes: naics,
          postedFromDays: 30,
          limit: Math.max(need * 2, 8),
        });
        for (const o of live) {
          if (!o || !o.noticeId) continue;
          if (seenNotices.has(o.noticeId)) continue;
          seenNotices.add(o.noticeId);
          livePreview.push({
            key: `live:${o.noticeId}`,
            id: null,
            title: o.title ?? "(untitled)",
            department: o.department,
            type: o.type,
            naics_code: o.naicsCode,
            set_aside: o.setAside,
            posted_date: o.postedDate,
            response_deadline: o.responseDeadline,
            solicitation_number: o.solicitationNumber,
            place_of_performance: o.placeOfPerformance,
            award_amount: o.awardAmount,
            sam_url: o.samUrl,
            summary: null,
            description_url: o.description,
          });
          if (inboxDisplay.length + livePreview.length >= PREVIEW_TARGET) {
            break;
          }
        }
      } catch (err) {
        liveFetchFailed = true;
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(
          `[opportunities] live preview fetch failed (org=${org.id}, naics=${naics.join(",")}): ${msg}`,
        );
      }
    }
  }

  const display: DisplayOpportunity[] = [...inboxDisplay, ...livePreview];

  // Hydrate live-preview cards with a one-sentence "what they want" summary.
  // For each card we (a) fetch the SAM.gov noticedesc HTML, then (b) send it
  // through Claude Haiku for a tight rewrite. Both steps are best-effort and
  // bounded — the page never waits more than ~6s total and any failure just
  // leaves `summary` null on that single card.
  const apiKeyForSummaries =
    process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  if (apiKeyForSummaries && livePreview.length > 0) {
    await Promise.all(
      livePreview.map(async (card) => {
        if (card.summary || !card.description_url) return;
        const raw = await fetchNoticeDescription(
          card.description_url,
          apiKeyForSummaries,
        );
        if (!raw) return;
        // Try AI summary first; fall back to a plain truncated extract if
        // the model is unavailable or rate-limited.
        card.summary =
          (await aiSummarize(card.title, raw)) ?? summarizeDescription(raw);
      }),
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
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
            className="rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Workspace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {!isAttested && (
          <div className="mb-6 overflow-hidden rounded-md border border-[#a06b1a] bg-[#fff7e8] p-5 shadow-[0_2px_0_rgba(160,107,26,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
                  Preview &middot; Submitting bids is locked
                </p>
                <h2 className="mt-1 font-serif text-lg font-bold text-[#5a3d0a]">
                  Browse opportunities now &mdash; finish steps 1&ndash;6 to submit.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5a3d0a]">
                  We need a signed CMMC Level 1 affirmation on file before primes will accept your bid. The opportunity feed is fully visible during your 30-day trial; the &ldquo;Tailor packet&rdquo; and &ldquo;View on SAM.gov&rdquo; actions unlock the moment you finish step 4 (Sign &amp; affirm).
                </p>
              </div>
              <Link
                href={
                  inProgressAssessment
                    ? `/assessments/${inProgressAssessment.id}`
                    : `/assessments`
                }
                className="rounded-sm bg-[#0e2a23] px-4 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
              >
                Finish my CMMC L1 &rarr;
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-md border border-[#cfe3d9] bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-[0.14em] text-[#456c5f]">
              Watching NAICS:
            </span>
            {naics.length > 0 ? (
              naics.map((c) => (
                <span
                  key={c}
                  className="rounded-sm bg-[#f1f6f3] px-2 py-1 font-mono text-[11px] text-[#10231d]"
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
          <div className="mt-6 rounded-md border border-dashed border-[#cfe3d9] bg-white p-10 text-center text-sm text-[#456c5f]">
            <p className="font-semibold text-[#10231d]">
              No opportunities yet.
            </p>
            <p className="mt-1">
              {liveFetchFailed
                ? "Couldn't reach SAM.gov for a live preview right now — the radar runs every Monday morning and any new matches will appear here."
                : naics.length === 0
                  ? "Add at least one NAICS code on your bid profile to start receiving matches."
                  : "The radar runs every Monday morning. Any new SAM.gov notices matching your NAICS codes will appear here."}
            </p>
          </div>
        ) : (
          <>
            {livePreview.length > 0 && (
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
                Live preview from SAM.gov · matched to your NAICS
              </p>
            )}
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {display.map((r) => (
                <li
                  key={r.key}
                  className="flex flex-col rounded-md border border-[#cfe3d9] bg-white p-5"
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
                    {r.type ? (
                      <span className="inline-block rounded-sm bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]">
                        {r.type}
                      </span>
                    ) : null}
                    {r.set_aside ? (
                      <span className="inline-block rounded-sm bg-[#f1f6f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#456c5f]">
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
                        className="inline-block rounded-sm bg-[#0e5c41] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
                      >
                        Awarded {r.award_amount}
                      </span>
                    ) : (() => {
                      const range = typicalRangeForNaics(r.naics_code);
                      return range ? (
                        <span
                          title={`Typical small-business award range for NAICS ${r.naics_code}. Heuristic from FPDS historicals — not the agency's actual ceiling.`}
                          className="inline-block rounded-sm border border-[#cfe3d9] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0e5c41]"
                        >
                          Typical {range.label}
                        </span>
                      ) : null;
                    })()}
                    {r.response_deadline ? (
                      <span className="inline-block rounded-sm border border-[#a06b1a] bg-[#fff7eb] px-2 py-0.5 text-[11px] font-bold text-[#a06b1a]">
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
                    {isAttested ? (
                      r.sam_url ? (
                        <a
                          href={r.sam_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block w-full rounded-sm bg-[#10231d] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0e2a23]"
                        >
                          View on SAM.gov →
                        </a>
                      ) : (
                        <span className="block w-full cursor-not-allowed rounded-sm border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]">
                          No SAM.gov link on file
                        </span>
                      )
                    ) : (
                      <span
                        title="Sign your CMMC L1 affirmation (step 4) to unlock viewing this opportunity on SAM.gov."
                        aria-disabled="true"
                        className="block w-full cursor-not-allowed select-none rounded-sm border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2.5 text-center text-sm font-semibold text-[#7a9c90]"
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
