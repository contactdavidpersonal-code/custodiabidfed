import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  getAssessmentForUser,
  listCarryForwardPending,
  listResponsesForAssessment,
  type ControlResponseRow,
  type OrganizationRow,
} from "@/lib/assessment";
import { controlDomains, playbook } from "@/lib/playbook";

const statusLabels: Record<ControlResponseRow["status"], string> = {
  unanswered: "Not started",
  yes: "MET",
  partial: "Partial",
  no: "NOT MET",
  not_applicable: "N/A",
};

const statusDotStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#cfe3d9]",
  yes: "bg-[#2f8f6d]",
  partial: "bg-[#a06b1a]",
  no: "bg-[#b03a2e]",
  not_applicable: "bg-[#5a7d70]",
};

const statusPillStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
  yes: "bg-[#eaf3ee] text-[#0e2a23] ring-[#bde0cc]",
  partial: "bg-[#fff4e0] text-[#a06b1a] ring-[#f1d9a5]",
  no: "bg-[#fbe9e6] text-[#b03a2e] ring-[#f1c4bd]",
  not_applicable: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
};

const domainLabels: Record<(typeof controlDomains)[number], string> = {
  AC: "Access Control",
  IA: "Identification & Authentication",
  MP: "Media Protection",
  PE: "Physical Protection",
  SC: "System & Communications",
  SI: "System & Information Integrity",
};

function isProfileComplete(org: OrganizationRow): boolean {
  return Boolean(
    org.name && org.name !== "My Organization" && org.scoped_systems,
  );
}

export default async function AssessmentOverviewPage(
  props: PageProps<"/assessments/[id]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const [responses, carryForward] = await Promise.all([
    listResponsesForAssessment(id),
    listCarryForwardPending(id),
  ]);
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const progress = computeProgress(responses);
  const profileDone = isProfileComplete(ctx.organization);
  const allAnswered = progress.unanswered === 0;
  const hasBlockers = progress.notMet > 0 || progress.partial > 0;
  const attested = ctx.assessment.status === "attested";
  const search = await props.searchParams;
  const justSigned = search?.signed === "1" && attested;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {justSigned && <CelebrationBanner assessmentId={ctx.assessment.id} />}

      <section className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          CMMC Level 1 • FY{ctx.assessment.fiscal_year}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
              Your annual affirmation
            </h1>
            <p className="mt-2 text-sm text-[#5a7d70]">
              {ctx.organization.name !== "My Organization"
                ? `${ctx.organization.name} — work the 17 practices below to MET, then sign and file with SPRS.`
                : "Business profile not set yet"}
            </p>
          </div>
          <ProgressRing percent={progress.percentAnswered} />
        </div>
      </section>

      {(carryForward.responses.length > 0 ||
        carryForward.artifacts.length > 0) && (
        <CarryForwardReviewBanner
          assessmentId={ctx.assessment.id}
          pendingResponseCount={carryForward.responses.length}
          pendingArtifactCount={carryForward.artifacts.length}
          firstControlId={
            carryForward.responses[0]?.control_id ??
            carryForward.artifacts[0]?.control_id
          }
        />
      )}

      <NextStepBanner
        profileDone={profileDone}
        allAnswered={allAnswered}
        hasBlockers={hasBlockers}
        attested={attested}
        assessmentId={ctx.assessment.id}
      />

      <section className="mb-10 grid gap-3 md:grid-cols-5">
        <ProgressPill label="Met" value={progress.met} tone="emerald" />
        <ProgressPill label="Partial" value={progress.partial} tone="amber" />
        <ProgressPill label="Not met" value={progress.notMet} tone="rose" />
        <ProgressPill label="N/A" value={progress.notApplicable} tone="sky" />
        <ProgressPill
          label="Not started"
          value={progress.unanswered}
          tone="slate"
        />
      </section>

      <ProfileSection
        organization={ctx.organization}
        profileDone={profileDone}
      />

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-[#10231d]">
              The 17 practices
            </h2>
            <p className="mt-1 text-sm text-[#5a7d70]">
              Every practice must be MET or N/A before you can sign. Click any
              card to drop evidence into your vault and mark it MET.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {controlDomains.map((domain) => {
            const domainPractices = playbook.filter((p) => p.domain === domain);
            const answered = domainPractices.filter((p) => {
              const s = responseByControl.get(p.id)?.status ?? "unanswered";
              return s !== "unanswered";
            }).length;
            return (
              <div key={domain}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <span className="rounded-sm bg-[#0e2a23] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
                      {domain}
                    </span>
                    <h3 className="font-serif text-base font-bold text-[#10231d]">
                      {domainLabels[domain]}
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-[#5a7d70]">
                    {answered} of {domainPractices.length} done
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {domainPractices.map((practice) => {
                    const resp = responseByControl.get(practice.id);
                    const status = resp?.status ?? "unanswered";
                    return (
                      <Link
                        key={practice.id}
                        href={`/assessments/${ctx.assessment.id}/controls/${practice.id}`}
                        className="group block rounded-md border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)] transition-all hover:border-[#2f8f6d] hover:shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 h-2 w-2 flex-none rounded-sm ${statusDotStyles[status]}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-[#5a7d70]">
                                {practice.id}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1 ring-inset ${statusPillStyles[status]}`}
                              >
                                {statusLabels[status]}
                              </span>
                            </div>
                            <h4 className="mt-2 truncate font-serif font-bold text-[#10231d]">
                              {practice.shortName}
                            </h4>
                            <p className="mt-1.5 line-clamp-2 text-sm text-[#5a7d70]">
                              {practice.plainEnglish}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CarryForwardReviewBanner({
  assessmentId,
  pendingResponseCount,
  pendingArtifactCount,
  firstControlId,
}: {
  assessmentId: string;
  pendingResponseCount: number;
  pendingArtifactCount: number;
  firstControlId: string | undefined;
}) {
  const total = pendingResponseCount + pendingArtifactCount;
  return (
    <div className="mb-6 rounded-2xl border border-sky-300 bg-sky-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
            Last year&apos;s answers imported
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {total} item{total === 1 ? "" : "s"} need a quick currency check.
          </h2>
          <p className="mt-1 text-sm text-sky-900">
            {pendingResponseCount > 0 && (
              <>
                {pendingResponseCount} answer
                {pendingResponseCount === 1 ? "" : "s"} carried over.{" "}
              </>
            )}
            {pendingArtifactCount > 0 && (
              <>
                {pendingArtifactCount} evidence file
                {pendingArtifactCount === 1 ? "" : "s"} need re-confirmation.
              </>
            )}{" "}
            Walk each practice to confirm or replace — same as TurboTax
            importing last year&apos;s return.
          </p>
        </div>
        {firstControlId && (
          <Link
            href={`/assessments/${assessmentId}/controls/${firstControlId}`}
            className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-600"
          >
            Start reviewing &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

function CelebrationBanner({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            You&apos;re signed and bid-ready
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Congratulations — your affirmation is locked.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Download your bid-ready package below — it bundles your SSP,
            signed affirmation memo, control inventory, and every evidence
            artifact in one zip. File it in SPRS and you&apos;re CMMC Level 1
            compliant for this cycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/assessments/${assessmentId}/bid-package`}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            Affirmation only
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-slate-100"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-amber-400 transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-slate-900">
          {percent}%
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Progress
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {percent === 100 ? "All answered" : "Keep going"}
        </div>
      </div>
    </div>
  );
}

function NextStepBanner({
  profileDone,
  allAnswered,
  hasBlockers,
  attested,
  assessmentId,
}: {
  profileDone: boolean;
  allAnswered: boolean;
  hasBlockers: boolean;
  attested: boolean;
  assessmentId: string;
}) {
  if (attested) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Attested
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            This assessment is signed and ready to file.
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            The bid-ready package bundles your SSP, signed affirmation, and
            every evidence artifact — everything a prime or SPRS filing might
            ask for.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/assessments/${assessmentId}/bid-package`}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            Affirmation only
          </Link>
        </div>
      </div>
    );
  }

  if (!profileDone) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Step 1 of 3
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Finish telling the officer about your business
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Legal name, UEI/CAGE, and the systems in scope — captured through a
            quick chat, not a form.
          </p>
        </div>
        <Link
          href="/onboard"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          Open onboarding &rarr;
        </Link>
      </div>
    );
  }

  if (!allAnswered) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Step 2 of 3
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Answer the 17 practices
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Click any practice below. We&apos;ll explain it in plain English and
            show exactly what evidence to capture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Step 3 of 3 · Ready to sign
        </div>
        <h2 className="mt-1 text-lg font-bold">
          {hasBlockers
            ? "All answered — but some practices need fixing first"
            : "You're ready to affirm."}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {hasBlockers
            ? "'Not met' or 'Partial' practices must become 'Met' or 'N/A' before you can sign the SPRS affirmation."
            : "A senior official signs the SPRS annual affirmation. This locks the assessment and generates your SSP."}
        </p>
      </div>
      {!hasBlockers && (
        <Link
          href={`/assessments/${assessmentId}/sign`}
          className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-300"
        >
          Review & sign &rarr;
        </Link>
      )}
    </div>
  );
}

function ProgressPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "sky" | "slate";
}) {
  const toneStyles: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    slate: "border-slate-200 bg-white text-slate-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneStyles[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ProfileSection({
  organization,
  profileDone,
}: {
  organization: OrganizationRow;
  profileDone: boolean;
}) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Legal name", value: organization.name !== "My Organization" ? organization.name : null },
    { label: "Entity type", value: organization.entity_type },
    { label: "SAM UEI", value: organization.sam_uei },
    { label: "CAGE code", value: organization.cage_code },
    {
      label: "NAICS codes",
      value: organization.naics_codes.length > 0 ? organization.naics_codes.join(", ") : null,
    },
  ];
  return (
    <section
      id="profile"
      className="mb-10 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Business profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Captured conversationally through your officer. Ask them to update
            anything — no forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profileDone && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Complete
            </span>
          )}
          <Link
            href="/onboard"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Refine with officer
          </Link>
        </div>
      </div>
      <dl className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {r.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {r.value ?? (
                <span className="italic font-normal text-slate-400">
                  Not captured yet
                </span>
              )}
            </dd>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 md:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Systems in scope
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
            {organization.scoped_systems ?? (
              <span className="italic text-slate-400">Not captured yet</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
