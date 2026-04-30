import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser, listAssessmentsForOrg } from "@/lib/assessment";
import {
  listOpportunitiesForOrg,
  searchSamOpportunities,
  truncateDescription,
  type OpportunityRow,
} from "@/lib/sam-radar";
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
  naics_code: string | null;
  set_aside: string | null;
  posted_date: string | null;
  response_deadline: string | null;
  description: string | null;
  sam_url: string | null;
};

function rowToDisplay(r: OpportunityRow): DisplayOpportunity {
  return {
    key: `inbox:${r.id}`,
    id: r.id,
    title: r.title,
    department: r.department,
    naics_code: r.naics_code,
    set_aside: r.set_aside,
    posted_date: r.posted_date,
    response_deadline: r.response_deadline,
    description: r.description,
    sam_url: r.sam_url,
  };
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
            naics_code: o.naicsCode,
            set_aside: o.setAside,
            posted_date: o.postedDate,
            response_deadline: o.responseDeadline,
            description: o.description,
            sam_url: o.samUrl,
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
                    {r.naics_code ? (
                      <>
                        <span>·</span>
                        <span className="font-mono">NAICS {r.naics_code}</span>
                      </>
                    ) : null}
                    {r.set_aside ? (
                      <>
                        <span>·</span>
                        <span>{r.set_aside}</span>
                      </>
                    ) : null}
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
                  {r.response_deadline ? (
                    <div className="mt-2">
                      <span className="inline-block rounded-sm border border-[#a06b1a] bg-[#fff7eb] px-2 py-0.5 text-[11px] font-bold text-[#a06b1a]">
                        Response due {r.response_deadline}
                      </span>
                    </div>
                  ) : null}
                  {r.description ? (
                    <p className="mt-3 text-sm text-[#456c5f]">
                      {truncateDescription(r.description, 240)}
                    </p>
                  ) : null}

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
