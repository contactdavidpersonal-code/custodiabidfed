import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  enforceStepOrder,
  getAssessmentForUser,
  listCarryForwardPending,
  listResponsesForAssessment,
  type ControlResponseRow,
  type OrganizationRow,
} from "@/lib/assessment";
import {
  cmmcL1Requirements,
  controlDomains,
  requirementMeta,
  requirementToLegacy,
} from "@/lib/playbook";

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
  partial: "bg-[#7ba87f]",
  no: "bg-[#b03a2e]",
  not_applicable: "bg-[#5a7d70]",
};

const statusPillStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
  yes: "bg-[#eaf3ee] text-[#0e2a23] ring-[#bde0cc]",
  partial: "bg-[#eef6ea] text-[#3d6b3a] ring-[#cfe3c2]",
  no: "bg-[#fbe9e6] text-[#b03a2e] ring-[#f1c4bd]",
  not_applicable: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
};

// Per-practice progress for the small bar at the bottom of each card.
// `met` and `not_applicable` are 100% — the practice is resolved either way.
// `partial` is 50% — user has some evidence but not all six objectives.
// `no` is 25% — user has acknowledged the practice but hasn't fixed it.
// `unanswered` is 0%.
const statusPercent: Record<ControlResponseRow["status"], number> = {
  unanswered: 0,
  yes: 100,
  partial: 50,
  no: 25,
  not_applicable: 100,
};

const statusBarColor: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#cfe3d9]",
  yes: "bg-[#2f8f6d]",
  partial: "bg-[#7ba87f]",
  no: "bg-[#b03a2e]",
  not_applicable: "bg-[#5a7d70]",
};

// Domain titles taken verbatim from CMMC Assessment Guide – Level 1 v2.13
// (DoD-CIO-00002, Sept 2024), section headers on pp. 12, 22, 27, 29, 34, 39.
const domainLabels: Record<(typeof controlDomains)[number], string> = {
  AC: "Access Control",
  IA: "Identification and Authentication",
  MP: "Media Protection",
  PE: "Physical Protection",
  SC: "System and Communications Protection",
  SI: "System and Information Integrity",
};

/**
 * Roll up the underlying NIST 800-171 control statuses into a single status
 * for the parent CMMC L1 v2.13 requirement. Most requirements bundle one
 * legacy control (1:1); `PE.L1-b.1.ix` bundles three (3.10.3 / .4 / .5), so
 * we need a deterministic worst-case rollup so the user can never sign a
 * requirement while a sub-control is still unfinished.
 *
 * Priority order (worst → best):
 *   not_met  >  partial  >  unanswered  >  not_applicable  >  yes
 *
 * The user expects the parent to mirror the worst child — a "MET" rollup
 * with a hidden NOT_MET underneath would let someone attest to something
 * that isn't actually compliant.
 */
function rollupRequirementStatus(
  responses: Map<string, ControlResponseRow>,
  legacyIds: string[],
): ControlResponseRow["status"] {
  const statuses = legacyIds.map(
    (id) => responses.get(id)?.status ?? "unanswered",
  );
  if (statuses.includes("no")) return "no";
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("unanswered")) return "unanswered";
  if (statuses.every((s) => s === "not_applicable")) return "not_applicable";
  return "yes";
}

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
  await enforceStepOrder(ctx, "practices");

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
    <main className="relative mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
      <div className="relative">
        {justSigned && <CelebrationBanner assessmentId={ctx.assessment.id} />}

        <section className="mb-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#063f2e]/15 bg-white/70 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-[#063f2e] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#063f2e]" />
            CMMC Level 1 · FY{ctx.assessment.fiscal_year}
          </p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="font-serif text-5xl font-normal leading-[1.05] tracking-[-0.04em] text-[#063f2e] md:text-6xl">
                Your annual<br />affirmation.
              </h1>
              <p className="mt-5 text-base leading-[1.6] text-[#063f2e]/65 md:text-lg">
                {ctx.organization.name !== "My Organization"
                  ? `${ctx.organization.name} — work the 15 safeguarding requirements below to MET, then sign and file with SPRS.`
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
        answeredCount={progress.total - progress.unanswered}
        totalCount={progress.total}
        hasBlockers={hasBlockers}
        attested={attested}
        assessmentId={ctx.assessment.id}
      />

      <section className="mb-12 grid gap-3 md:grid-cols-5">
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

      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl font-normal leading-tight tracking-[-0.03em] text-[#063f2e]">
              The 15 safeguarding<br />requirements.
            </h2>
            <p className="mt-4 text-base leading-[1.6] text-[#063f2e]/65">
              Every practice must be MET or N/A before you can sign. Click any
              card to drop evidence into your vault and mark it MET.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {controlDomains.map((domain) => {
            const domainReqs = cmmcL1Requirements.filter(
              (reqId) => requirementMeta[reqId].domain === domain,
            );
            const domainRollups = domainReqs.map((reqId) => ({
              reqId,
              status: rollupRequirementStatus(
                responseByControl,
                requirementToLegacy[reqId],
              ),
            }));
            const answered = domainRollups.filter(
              (r) => r.status !== "unanswered",
            ).length;
            return (
              <section key={domain} className="relative">
                {/* Domain header — styled like the SAG TOC section header */}
                <header className="mb-5 flex items-baseline justify-between gap-4 border-b-2 border-[#063f2e]/15 pb-3">
                  <div className="flex items-baseline gap-3">
                    <span className="rounded-full bg-[#063f2e] px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.18em] text-[#bef4be]">
                      {domain}
                    </span>
                    <h3 className="font-serif text-2xl font-normal tracking-[-0.02em] text-[#063f2e]">
                      {domainLabels[domain]}
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#063f2e]/55">
                    {answered} of {domainReqs.length} done
                  </span>
                </header>

                {/* Requirement list — indented under the domain, TOC style with dotted leader */}
                <ol className="divide-y divide-[#063f2e]/8">
                  {domainRollups.map(({ reqId, status }) => {
                    const meta = requirementMeta[reqId];
                    const legacyIds = requirementToLegacy[reqId];
                    const firstLegacy = legacyIds[0];
                    const percent = statusPercent[status];
                    // Build a short [FCI Data] tag like the SAG TOC ("[FCI Data]"
                    // appears after every L1 practice — CMMC L1 is FCI scope only).
                    return (
                      <li key={reqId}>
                        <Link
                          href={`/assessments/${ctx.assessment.id}/controls/${firstLegacy}`}
                          className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 py-3 pl-6 pr-2 transition-colors hover:bg-[#bef4be]/12 sm:gap-x-4 sm:pl-8"
                        >
                          {/* Status dot — left rail like a bullet in the regulation */}
                          <span className="relative -ml-4 sm:-ml-6">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${statusDotStyles[status]} ring-2 ring-white`}
                              aria-hidden
                            />
                          </span>

                          {/* Practice ID + title — the "entry" text in the TOC.
                              Title always wraps below the FAR ID so every row reads
                              the same regardless of title length. Title never truncates;
                              the dotted leader fills whatever horizontal space remains
                              on the title's final line. */}
                          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="block w-full shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-[#2f8f6d]">
                              {reqId}
                            </span>
                            <span className="font-serif text-xl font-medium tracking-[-0.01em] text-[#063f2e] transition-colors group-hover:text-[#2f8f6d]">
                              {meta.shortName}
                            </span>
                            <span className="hidden shrink-0 font-serif text-[11px] italic tracking-[0.05em] text-[#063f2e]/45 sm:inline">
                              [FCI Data]
                            </span>
                            {/* Dotted leader — fills remaining horizontal space like a print TOC */}
                            <span
                              aria-hidden
                              className="hidden min-w-[2rem] flex-1 translate-y-[-3px] border-b border-dotted border-[#063f2e]/20 sm:block"
                            />
                          </span>

                          {/* Status pill — the "page number" slot in the TOC */}
                          <span className="flex shrink-0 items-center gap-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ring-1 ring-inset ${statusPillStyles[status]}`}
                            >
                              {statusLabels[status]}
                            </span>
                            <span className="hidden w-10 text-right font-mono text-[10px] tabular-nums text-[#063f2e]/45 sm:inline">
                              {percent}%
                            </span>
                          </span>
                        </Link>

                        {/* Sub-row for the FAR citation + bundled NIST controls — small print, sits under the title */}
                        <div className="pb-3 pl-6 pr-2 sm:pl-12">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#063f2e]/40">
                            <span>{meta.farClause}</span>
                            <span className="mx-2">·</span>
                            <span>
                              NIST 800-171 r2{" "}
                              {legacyIds
                                .map((id) => id.split("-")[1])
                                .join(", ")}
                            </span>
                            {legacyIds.length > 1 && (
                              <>
                                <span className="mx-2">·</span>
                                <span>
                                  {legacyIds.length} controls rolled up
                                </span>
                              </>
                            )}
                          </p>
                          <p className="mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-[1.55] text-[#063f2e]/65">
                            {meta.statement}
                          </p>
                          <div className="mt-2 h-[2px] w-full max-w-3xl overflow-hidden rounded-full bg-[#063f2e]/6">
                            <div
                              className={`h-full ${statusBarColor[status]} transition-[width] duration-500 ease-out`}
                              style={{ width: `${Math.max(2, percent)}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </section>
      </div>
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
    <div className="mb-6  border border-sky-300 bg-sky-50 p-5">
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
            Walk each practice to confirm or replace — one step at a time
            importing last year&apos;s return.
          </p>
        </div>
        {firstControlId && (
          <Link
            href={`/assessments/${assessmentId}/controls/${firstControlId}`}
            className=" bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-600"
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
    <div className="mb-8 overflow-hidden  border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm">
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
            className=" bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className=" border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className=" border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            Affirmation only
          </Link>
          <Link
            href="/opportunities"
            className=" bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Step 7 â†’ Find &amp; submit bids
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
    <div className="flex items-center gap-4 rounded-2xl border border-[#063f2e]/15 bg-white/80 px-6 py-4 shadow-[0_8px_30px_-12px_rgba(6,63,46,0.20)] backdrop-blur">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="5"
            fill="none"
            className="text-[#063f2e]/10"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-[#063f2e] transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-serif text-base font-normal tabular-nums tracking-tight text-[#063f2e]">
          {percent}%
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#063f2e]/55">
          Progress
        </div>
        <div className="mt-1 font-serif text-base font-normal tracking-[-0.01em] text-[#063f2e]">
          {percent === 100 ? "All answered" : "Keep going"}
        </div>
      </div>
    </div>
  );
}

function NextStepBanner({
  profileDone,
  allAnswered,
  answeredCount,
  totalCount,
  hasBlockers,
  attested,
  assessmentId,
}: {
  profileDone: boolean;
  allAnswered: boolean;
  answeredCount: number;
  totalCount: number;
  hasBlockers: boolean;
  attested: boolean;
  assessmentId: string;
}) {
  if (attested) {
    return (
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#063f2e]/20 bg-gradient-to-br from-[#bef4be] to-[#a8e8b0] p-7 text-[#063f2e] shadow-[0_20px_60px_-20px_rgba(6,63,46,0.35)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#063f2e] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#bef4be]">
            <span className="h-1 w-1 rounded-full bg-[#bef4be]" />
            Attested
          </div>
          <h2 className="mt-4 font-serif text-3xl font-normal leading-tight tracking-[-0.03em]">
            Signed and ready to file.
          </h2>
          <p className="mt-3 text-sm leading-[1.6] text-[#063f2e]/75">
            The bid-ready package bundles your SSP, signed affirmation, and
            every evidence artifact — everything a prime or SPRS filing might
            ask for.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/assessments/${assessmentId}/bid-package`}
            className="inline-flex items-center gap-2 rounded-full bg-[#063f2e] px-5 py-2.5 text-sm font-medium tracking-tight text-[#bef4be] transition-colors hover:bg-[#052e22]"
          >
            Download bid-ready package
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className="inline-flex items-center rounded-full border border-[#063f2e]/30 bg-white/60 px-5 py-2.5 text-sm font-medium text-[#063f2e] transition-colors hover:bg-white"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className="inline-flex items-center rounded-full border border-[#063f2e]/30 bg-white/60 px-5 py-2.5 text-sm font-medium text-[#063f2e] transition-colors hover:bg-white"
          >
            Affirmation only
          </Link>
        </div>
      </div>
    );
  }

  if (!profileDone) {
    return (
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#a06b1a]/20 bg-[#fff4e0] p-7 shadow-[0_10px_40px_-20px_rgba(160,107,26,0.20)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#a06b1a] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#fff4e0]">
            <span className="h-1 w-1 rounded-full bg-[#fff4e0]" />
            Action needed · Step 1 of 8
          </div>
          <h2 className="mt-4 font-serif text-3xl font-normal leading-tight tracking-[-0.03em] text-[#063f2e]">
            Tell the officer about your business.
          </h2>
          <p className="mt-3 text-sm leading-[1.6] text-[#063f2e]/70">
            Legal name, UEI/CAGE, and the systems in scope — captured through a
            quick chat, not a form.
          </p>
        </div>
        <Link
          href="/onboard"
          className="inline-flex items-center gap-2 rounded-full bg-[#063f2e] px-6 py-3 text-sm font-medium tracking-tight text-[#bef4be] transition-colors hover:bg-[#052e22]"
        >
          Open onboarding
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1.5 1.5L6 6l-4.5 4.5" />
          </svg>
        </Link>
      </div>
    );
  }

  if (!allAnswered) {
    return (
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#063f2e]/15 bg-gradient-to-br from-[#bef4be]/40 via-white to-white p-7 shadow-[0_10px_40px_-20px_rgba(6,63,46,0.25)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#063f2e] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#bef4be]">
            <span className="h-1 w-1 rounded-full bg-[#bef4be]" />
            {answeredCount === 0
              ? `${totalCount} requirements · You are here`
              : `${answeredCount} of ${totalCount} answered · Keep going`}
          </div>
          <h2 className="mt-4 font-serif text-3xl font-normal leading-tight tracking-[-0.03em] text-[#063f2e]">
            Answer the 15 requirements.
          </h2>
          <p className="mt-3 text-sm leading-[1.6] text-[#063f2e]/70">
            Click any practice below. We&apos;ll explain it in plain English and
            show exactly what evidence to capture.
          </p>
          <p className="mt-3 text-xs leading-[1.6] text-[#063f2e]/60">
            Can&apos;t fully meet a requirement?{" "}
            <Link
              href={`/assessments/${assessmentId}/exceptions`}
              className="font-medium text-[#063f2e] underline decoration-[#063f2e]/30 underline-offset-2 hover:decoration-[#063f2e]"
            >
              Document an Enduring Exception or Temporary Deficiency
            </Link>
            {" "}— per CMMC AG v2.13, both can roll up to MET when properly
            documented.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#063f2e]/20 bg-[#052e22] p-7 text-white shadow-[0_20px_60px_-20px_rgba(6,63,46,0.45)]">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#bef4be]/30 bg-[#063f2e]/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#bef4be]">
          <span className="h-1 w-1 rounded-full bg-[#bef4be]" />
          Ready for step 5 · Sign &amp; affirm
        </div>
        <h2 className="mt-4 font-serif text-3xl font-normal leading-tight tracking-[-0.03em]">
          {hasBlockers
            ? "All answered — but some practices need fixing first."
            : "You're ready to affirm."}
        </h2>
        <p className="mt-3 text-sm leading-[1.6] text-[#bef4be]/70">
          {hasBlockers
            ? "'Not met' or 'Partial' practices must become 'Met' or 'N/A' before you can sign the SPRS affirmation."
            : "A senior official signs the SPRS annual affirmation. This locks the assessment and generates your SSP."}
        </p>
      </div>
      {!hasBlockers && (
        <Link
          href={`/assessments/${assessmentId}/sign`}
          className="inline-flex items-center gap-2 rounded-full bg-[#bef4be] px-6 py-3 text-sm font-medium tracking-tight text-[#063f2e] transition-colors hover:bg-white"
        >
          Review &amp; sign
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1.5 1.5L6 6l-4.5 4.5" />
          </svg>
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
    emerald: "border-[#2f8f6d]/25 bg-[#eaf3ee] text-[#0e2a23]",
    amber: "border-[#a06b1a]/25 bg-[#fff4e0] text-[#a06b1a]",
    rose: "border-[#b03a2e]/25 bg-[#fbe9e6] text-[#b03a2e]",
    sky: "border-sky-300/40 bg-sky-50 text-sky-900",
    slate: "border-[#063f2e]/12 bg-white text-[#063f2e]",
  };
  return (
    <div className={`rounded-2xl border px-5 py-4 backdrop-blur transition-colors ${toneStyles[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-75">
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl font-normal tabular-nums tracking-[-0.03em]">
        {value}
      </div>
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
      className="mb-10 scroll-mt-20  border border-slate-200 bg-white p-6 shadow-sm"
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
            className=" border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Refine with officer
          </Link>
        </div>
      </div>
      <dl className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className=" border border-slate-200 bg-slate-50/60 px-4 py-3"
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
        <div className=" border border-slate-200 bg-slate-50/60 px-4 py-3 md:col-span-2">
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
