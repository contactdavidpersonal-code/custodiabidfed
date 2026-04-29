import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser, listAssessmentsForOrg } from "@/lib/assessment";
import {
  listOpportunitiesForOrg,
  truncateDescription,
} from "@/lib/sam-radar";
import { dismissOpportunityAction } from "./actions";

export const dynamic = "force-dynamic";

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
                  We need a signed CMMC Level 1 affirmation on file before primes will accept your bid. The opportunity feed is fully visible during your 30-day trial; the &ldquo;Tailor packet&rdquo; action unlocks the moment you finish step 4 (Sign &amp; affirm).
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

        {rows.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-[#cfe3d9] bg-white p-10 text-center text-sm text-[#456c5f]">
            <p className="font-semibold text-[#10231d]">
              No opportunities yet.
            </p>
            <p className="mt-1">
              The radar runs every Monday morning. Any new SAM.gov notices
              matching your NAICS codes will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-[#cfe3d9] bg-white p-5"
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
                <h3 className="mt-2 font-serif text-base font-bold">
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
                    {truncateDescription(r.description, 320)}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  {isAttested ? (
                    <Link
                      href={`/opportunities/${r.id}/tailor`}
                      className="rounded-sm bg-[#10231d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e2a23]"
                    >
                      ✨ Tailor packet for this
                    </Link>
                  ) : (
                    <span
                      title="Sign your CMMC L1 affirmation (step 4) to unlock packet tailoring."
                      className="cursor-not-allowed rounded-sm border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-2 text-sm font-semibold text-[#7a9c90]"
                    >
                      🔒 Tailor packet (locked &mdash; finish step 4)
                    </span>
                  )}
                  {r.sam_url ? (
                    <a
                      href={r.sam_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-[#456c5f] hover:text-[#10231d]"
                    >
                      View on SAM.gov →
                    </a>
                  ) : null}
                  <form action={dismissOpportunityAction} className="ml-auto">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
