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
import { listPracticeProgressForAssessment } from "@/lib/cmmc/practice-progress-server";
import type { PracticeProgress } from "@/lib/cmmc/practice-progress";
import { getConnectorTokenStatus } from "@/lib/connectors/storage";
import type { ConnectorTokenRow } from "@/lib/connectors/storage";

// CMMC L1 v2.13 has three terminal states per the Assessment Guide: MET,
// NOT MET, NOT APPLICABLE. In the guided 4-layer working model the user
// never explicitly chooses "NOT MET" — a practice walks Not started →
// Partial (intake answered, evidence missing) → MET. The legacy `no` row
// only exists for back-compat with the old yes/no/partial answer schema,
// so we fold it into Partial for the dashboard pill + row pill (it still
// counts as a blocker for signing — see computeProgress + sign/page.tsx).
const statusLabels: Record<ControlResponseRow["status"], string> = {
  unanswered: "Not started",
  yes: "MET",
  partial: "Partial",
  no: "Partial",
  not_applicable: "N/A",
};

const statusDotStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#cfe3d9]",
  yes: "bg-[#2f8f6d]",
  partial: "bg-[#7ba87f]",
  no: "bg-[#7ba87f]",
  not_applicable: "bg-[#5a7d70]",
};

const statusPillStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
  yes: "bg-[#eaf3ee] text-[#0e2a23] ring-[#bde0cc]",
  partial: "bg-[#eef6ea] text-[#3d6b3a] ring-[#cfe3c2]",
  no: "bg-[#eef6ea] text-[#3d6b3a] ring-[#cfe3c2]",
  not_applicable: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
};

// Per-practice progress for the small bar at the bottom of each card.
// The number comes from `listPracticeProgressForAssessment` — the SAME
// computation the practice page itself runs. We only fall back to this
// status-bucket map when the user has never touched the practice at all
// (no chat conversation row, no evidence) — for everything else we render
// the fine-grained percent so the overview and the practice page never
// disagree.
const statusPercent: Record<ControlResponseRow["status"], number> = {
  unanswered: 0,
  yes: 100,
  partial: 50,
  no: 25,
  not_applicable: 100,
};

/**
 * Roll up the per-legacy-control percents into a single percent for the
 * parent L1 requirement. Most requirements are 1:1; PE.L1-b.1.ix bundles
 * three. For multi-legacy bundles we average — every sub-control must
 * advance for the parent to hit 100%, which matches the user's mental
 * model ("all three pieces of physical security must be done").
 */
function rollupRequirementPercent(
  progressByControl: Map<string, PracticeProgress>,
  legacyIds: string[],
  fallbackPercent: number,
): number {
  const percents = legacyIds.map(
    (id) => progressByControl.get(id)?.percent,
  );
  const known = percents.filter((p): p is number => typeof p === "number");
  if (known.length === 0) return fallbackPercent;
  // If only some sub-controls have progress data, treat the rest as 0 so
  // the parent can't read higher than reality.
  const sum = known.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / legacyIds.length);
}

const statusBarColor: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#cfe3d9]",
  yes: "bg-[#2f8f6d]",
  partial: "bg-[#7ba87f]",
  no: "bg-[#7ba87f]",
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
  practiceProgress: Map<string, PracticeProgress>,
): ControlResponseRow["status"] {
  const statuses = legacyIds.map(
    (id) => responses.get(id)?.status ?? "unanswered",
  );
  if (statuses.includes("no")) return "no";
  if (statuses.includes("partial")) return "partial";
  // New 4-layer working model: the legacy yes/no/partial answer is never
  // touched until the user finalizes. So a requirement where the user has
  // answered intake questions / generated verdicts / uploaded evidence still
  // reads as "unanswered" in the legacy table. Promote it to "partial" so
  // the dashboard shows real in-flight work instead of NOT STARTED.
  const anyTouched = legacyIds.some(
    (id) => practiceProgress.get(id)?.touched === true,
  );
  if (statuses.includes("unanswered")) {
    return anyTouched ? "partial" : "unanswered";
  }
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

  const [responses, carryForward, practiceProgress] = await Promise.all([
    listResponsesForAssessment(id),
    listCarryForwardPending(id),
    listPracticeProgressForAssessment(id),
  ]);
  const connectorTokens = await getConnectorTokenStatus(ctx.organization.id);
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const progress = computeProgress(responses);
  // Count requirements that are still legacy-unanswered but where the user
  // has touched the practice (intake answers / verdicts / evidence). These
  // shift from "Not started" to "Partial" on the dashboard pills so the
  // counts stay consistent with the per-row pills below, which already use
  // the touched signal via rollupRequirementStatus.
  const touchedUnansweredCount = cmmcL1Requirements.filter((reqId) => {
    const legacyIds = requirementToLegacy[reqId];
    const statuses = legacyIds.map(
      (id) => responseByControl.get(id)?.status ?? "unanswered",
    );
    if (!statuses.includes("unanswered")) return false;
    if (statuses.includes("no") || statuses.includes("partial")) return false;
    return legacyIds.some(
      (id) => practiceProgress.get(id)?.touched === true,
    );
  }).length;
  const displayPartial = progress.partial + progress.notMet + touchedUnansweredCount;
  const displayUnanswered = Math.max(0, progress.unanswered - touchedUnansweredCount);
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

      {ctx.assessment.material_change_required_reassessment && !attested && (
        <MaterialChangeReassessBanner
          assessmentId={ctx.assessment.id}
          reviewedAt={ctx.assessment.material_change_reviewed_at}
        />
      )}

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

      {/* Status pills — 4 buckets, not 5. CMMC L1 only has three terminal
          states (MET / NOT MET / N/A); during the guided walk a practice is
          Not started → Partial → MET (or N/A). "NOT MET" is folded into
          Partial because both mean "work remaining" — see statusLabels above.
          The full breakdown still lives in `progress` for signing checks. */}
      <section className="mb-12 grid gap-3 md:grid-cols-4">
        <ProgressPill label="Met" value={progress.met} tone="emerald" />
        <ProgressPill
          label="Partial"
          value={displayPartial}
          tone="amber"
        />
        <ProgressPill label="N/A" value={progress.notApplicable} tone="sky" />
        <ProgressPill
          label="Not started"
          value={displayUnanswered}
          tone="slate"
        />
      </section>

      <ConnectorHealthCard tokens={connectorTokens} />

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
                practiceProgress,
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
                    // Same number the practice page shows in its "THIS
                    // PRACTICE — N%" header. Falls back to the coarse
                    // status bucket only when the user has never opened
                    // the practice (no conversation row + no evidence).
                    const percent = rollupRequirementPercent(
                      practiceProgress,
                      legacyIds,
                      statusPercent[status],
                    );
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

function MaterialChangeReassessBanner({
  assessmentId,
  reviewedAt,
}: {
  assessmentId: string;
  reviewedAt: string | null;
}) {
  const when = reviewedAt
    ? new Date(reviewedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  return (
    <div className="mb-6 border-l-4 border-[#a06b1a] bg-[#fff7e8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a06b1a]">
            Material change &mdash; re-affirmation required
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-[#0e2a23]">
            Your scope changed. You must re-walk every practice and sign a
            fresh affirmation.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#0c4a3a]">
            {when ? <>On {when} you </> : <>You </>}
            confirmed an architectural, boundary, or scope change since the
            last affirmation. Under 32 CFR &sect; 170.22(a)(2), a material
            change to the in-scope FCI environment voids the prior annual
            affirmation. The previous answers were cleared &mdash; please
            verify each practice and have your senior official sign again
            before relying on this status with primes or DoD.
          </p>
        </div>
        <Link
          href={`/assessments/${assessmentId}/material-change`}
          className="border border-[#a06b1a] bg-white px-4 py-2.5 text-sm font-bold text-[#7a2e1c] transition-colors hover:bg-[#fff7e8]"
        >
          Review change details
        </Link>
      </div>
    </div>
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
    <div className="mb-6 border border-[#cfe3d9] bg-[#f1f6f3] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f8f6d]">
            Carry-forward review required
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-[#0e2a23]">
            {total} item{total === 1 ? "" : "s"} need a quick currency check.
          </h2>
          <p className="mt-1 text-sm text-[#0c4a3a]">
            {pendingResponseCount > 0 && (
              <>
                {pendingResponseCount} answer
                {pendingResponseCount === 1 ? "" : "s"} carried over from last
                cycle.{" "}
              </>
            )}
            {pendingArtifactCount > 0 && (
              <>
                {pendingArtifactCount} evidence file
                {pendingArtifactCount === 1 ? "" : "s"} need re-confirmation.{" "}
              </>
            )}
            Nothing rolls forward silently &mdash; the rule under{" "}
            32 CFR &sect; 170.22(a) is that you must affirmatively review each
            practice every annual cycle. Walk them, confirm or replace, then
            sign.
          </p>
        </div>
        {firstControlId && (
          <Link
            href={`/assessments/${assessmentId}/controls/${firstControlId}`}
            className="bg-[#0e2a23] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#10342a]"
          >
            Start reviewing &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

const PROVIDER_LABEL: Record<ConnectorTokenRow["provider"], string> = {
  m365: "Microsoft 365",
  google_workspace: "Google Workspace",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "unknown";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ConnectorHealthCard({
  tokens,
}: {
  tokens: ReadonlyArray<ConnectorTokenRow>;
}) {
  // Show all known providers — a missing one is itself a useful signal.
  const providers: Array<ConnectorTokenRow["provider"]> = [
    "m365",
    "google_workspace",
  ];
  const rows = providers.map((p) => {
    const row = tokens.find((t) => t.provider === p);
    return { provider: p, row };
  });
  const anyConnected = rows.some(
    (r) => r.row && !r.row.revoked_at,
  );
  return (
    <section className="mb-12 border border-[#cfe3d9] bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f8f6d]">
            Connector health
          </div>
          <h2 className="mt-1 font-serif text-2xl font-normal tracking-tight text-[#063f2e]">
            Evidence freshness at a glance.
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#5a7d70]">
            Stale connectors mean stale evidence. If a prime asks for proof
            that your MFA enforcement is still on, the answer should come
            from data pulled this week &mdash; not last quarter.
          </p>
        </div>
        <Link
          href="/connectors"
          className="border border-[#0e2a23] bg-white px-4 py-2 text-sm font-bold text-[#0e2a23] transition-colors hover:bg-[#f1f6f3]"
        >
          {anyConnected ? "Manage connectors" : "Connect a tenant"}
        </Link>
      </div>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map(({ provider, row }) => {
          let dot = "#cfe3d9";
          let status = "Not connected";
          let detail = "Connect to keep evidence fresh.";
          if (row?.revoked_at) {
            dot = "#7a2e1c";
            status = "Revoked";
            detail = `Re-authorize to resume syncs (revoked ${formatRelative(row.revoked_at)}).`;
          } else if (row) {
            const lastUse = row.last_used_at ?? row.connected_at;
            const hours = (Date.now() - new Date(lastUse).getTime()) / 3_600_000;
            if (hours <= 24) {
              dot = "#2f8f6d";
              status = "Fresh";
            } else if (hours <= 72) {
              dot = "#a06b1a";
              status = "Stale";
            } else {
              dot = "#7a2e1c";
              status = "Action needed";
            }
            detail = `Last sync ${formatRelative(lastUse)}${row.account_label ? ` · ${row.account_label}` : ""}`;
          }
          return (
            <li
              key={provider}
              className="flex items-start gap-3 border border-[#e5efe9] bg-[#f8fbf9] p-4"
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: dot }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-[#0e2a23]">
                    {PROVIDER_LABEL[provider]}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
                    {status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
                  {detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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
