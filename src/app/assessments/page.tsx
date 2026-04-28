import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
  listAssessmentsWithProgress,
  type AssessmentWithProgress,
} from "@/lib/assessment";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { defaultCycleLabel, fiscalYearOf, listMilestonesForOrg } from "@/lib/fiscal";
import { listActiveEscalationsForOrg } from "@/lib/escalations";
import { practiceCount } from "@/lib/playbook";
import { createAssessmentAction } from "./actions";
import { FiscalCompass } from "./FiscalCompass";
import { OfficerUpsellBanner } from "./OfficerUpsellBanner";

const statusCopy: Record<
  AssessmentWithProgress["status"],
  { label: string; tone: "active" | "review" | "attested" | "archived" }
> = {
  in_progress: { label: "In progress", tone: "active" },
  officer_review: { label: "Officer review", tone: "review" },
  customer_review: { label: "Your review", tone: "review" },
  attested: { label: "Attested", tone: "attested" },
  archived: { label: "Archived", tone: "archived" },
};

const toneStyles = {
  active: "bg-[#eaf3ee] text-[#0e2a23] ring-[#cfe3d9]",
  review: "bg-[#fff4e0] text-[#a06b1a] ring-[#f1d9a5]",
  attested: "bg-[#e6f4ec] text-[#1f6648] ring-[#bde0cc]",
  archived: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
} as const;

export default async function AssessmentsIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  await ensureWelcomeEmailSent(org.id, userId);
  const profile = await getBusinessProfile(org.id);
  if (!isOnboardingComplete(org, profile)) {
    redirect("/onboard");
  }
  const [assessments, milestones, escalations] = await Promise.all([
    listAssessmentsWithProgress(org.id),
    listMilestonesForOrg(org.id),
    listActiveEscalationsForOrg(org.id),
  ]);

  const defaultCycle = defaultCycleLabel(fiscalYearOf());

  const hasAnyAssessment = assessments.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Welcome to your workspace
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
          {hasAnyAssessment
            ? "Your CMMC Level 1 assessments"
            : "Let's get you bid-ready."}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#4a7164]">
          {hasAnyAssessment
            ? `Each assessment is one annual affirmation cycle covering all ${practiceCount} CMMC Level 1 practices. Open a cycle to keep working, or start a new one.`
            : `One cycle, ${practiceCount} practices, and a signed SPRS affirmation. We'll walk you through each step in plain English — the same way you'd do your taxes, except the prize is federal contracts.`}
        </p>
      </section>

      <OfficerUpsellBanner escalations={escalations} />

      {hasAnyAssessment && <FiscalCompass milestones={milestones} />}

      <section className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-serif text-xl font-bold tracking-tight text-[#10231d]">
              Cycles
            </h2>
            {hasAnyAssessment && (
              <span className="text-sm text-[#5a7d70]">
                {assessments.length} total
              </span>
            )}
          </div>

          {!hasAnyAssessment ? (
            <EmptyCyclesCard />
          ) : (
            <ul className="space-y-3">
              {assessments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/assessments/${a.id}`}
                    className="group block rounded-md border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04)] transition-all hover:border-[#2f8f6d] hover:shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-serif text-lg font-bold text-[#10231d]">
                            {a.cycle_label}
                          </h3>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="mt-1 text-sm text-[#5a7d70]">
                          Started{" "}
                          {new Date(a.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-serif text-3xl font-bold tabular-nums text-[#0e2a23]">
                          {a.percentAnswered}
                          <span className="text-lg font-semibold text-[#7a9c90]">%</span>
                        </div>
                        <div className="text-xs text-[#5a7d70]">
                          {a.answered} of {a.total} answered
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-sm bg-[#f1f6f3]">
                      <div
                        className="h-full rounded-sm bg-[#2f8f6d] transition-all"
                        style={{ width: `${a.percentAnswered}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-end text-sm font-semibold text-[#0e2a23] opacity-0 transition-opacity group-hover:opacity-100">
                      Continue &rarr;
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-md border border-[#0e2a23] bg-[#0e2a23] p-6 text-white shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.18)]">
            <h2 className="font-serif text-lg font-bold tracking-tight text-white">
              {hasAnyAssessment ? "Start a new cycle" : "Start your first cycle"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#cfe3d9]">
              Annual affirmation to SPRS is a year-long cycle. Name this one and
              we&apos;ll set up all {practiceCount} practices.
            </p>
            <form action={createAssessmentAction} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#bdf2cf]">
                  Cycle label
                </span>
                <input
                  type="text"
                  name="cycleLabel"
                  defaultValue={defaultCycle}
                  required
                  className="w-full rounded-sm border border-[#2f8f6d]/40 bg-[#10231d] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#7a9c90] focus:border-[#bdf2cf]"
                />
              </label>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#bdf2cf] px-4 py-3 text-sm font-bold tracking-tight text-[#0c2219] transition-colors hover:bg-white"
              >
                Start assessment &rarr;
              </button>
            </form>
          </div>

          <div className="rounded-md border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
            <h3 className="font-serif text-sm font-bold tracking-tight text-[#10231d]">
              How it works
            </h3>
            <ol className="mt-4 space-y-3">
              {[
                {
                  n: 1,
                  title: "Complete your business profile",
                  body: "Legal name, UEI, CAGE, and the systems in scope.",
                },
                {
                  n: 2,
                  title: `Answer all ${practiceCount} practices`,
                  body: "Status, narrative, and evidence for each — with provider-specific walkthroughs.",
                },
                {
                  n: 3,
                  title: "Review and sign",
                  body: "Senior official signs the SPRS annual affirmation.",
                },
                {
                  n: 4,
                  title: "Download & submit to SPRS",
                  body: "We generate your SSP and affirmation memo ready to file.",
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
                    {step.n}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#10231d]">
                      {step.title}
                    </div>
                    <div className="mt-0.5 text-xs text-[#5a7d70]">{step.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: AssessmentWithProgress["status"] }) {
  const { label, tone } = statusCopy[status];
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1 ring-inset ${toneStyles[tone]}`}
    >
      {label}
    </span>
  );
}

function EmptyCyclesCard() {
  return (
    <div className="rounded-md border border-dashed border-[#cfe3d9] bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[#eaf3ee] text-2xl text-[#0e2a23]">
        <span aria-hidden>&rarr;</span>
      </div>
      <h3 className="mt-4 font-serif text-lg font-bold tracking-tight text-[#10231d]">
        No cycles yet
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#5a7d70]">
        Start your first CMMC L1 cycle on the right. You can always come back
        and finish later — progress is saved as you go.
      </p>
    </div>
  );
}
