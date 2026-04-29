import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
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
  const rows = await listOpportunitiesForOrg({
    organizationId: org.id,
  });

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Opportunity radar
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold">
              Federal opportunities matched to {org.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
              Active SAM.gov notices matching your NAICS codes. Each Monday
              we email a fresh digest. One click on any row tailors your
              bid-ready packet to the agency&apos;s exact language.
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
                  <Link
                    href={`/opportunities/${r.id}/tailor`}
                    className="rounded-sm bg-[#10231d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e2a23]"
                  >
                    ✨ Tailor packet for this
                  </Link>
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
