import { auth, clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  controlsMissingEvidence,
  enforceStepOrder,
  evidenceReviewBlockers,
  getAssessmentForUser,
  listEvidenceForAssessment,
  listRemediationPlansForAssessment,
  listResponsesForAssessment,
} from "@/lib/assessment";
import { computeExceptionCoverage } from "@/lib/cmmc/objectives";
import {
  assembleBoundaryView,
  validateBoundary,
} from "@/lib/cmmc/boundary";
import { BoundaryDocument, BOUNDARY_CSS, BoundaryPreviewModal } from "@/components/boundary";
import { getSamEntityStatus, summarizeSamStatus } from "@/lib/sam-entity";
import { AffirmForm } from "./AffirmForm";

export default async function SignPage(
  props: PageProps<"/assessments/[id]/sign">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "sign");

  // Already attested? Don't kick the user away — they may have edited a
  // practice, uploaded new evidence, or fixed a boundary item and want to
  // re-affirm so the packet reflects the latest state. submitAffirmation
  // UPDATEs the row in place (refreshes signature/payload/affirmed_at);
  // status stays 'attested'. We just surface a banner so they know they're
  // re-signing rather than signing for the first time.
  const alreadyAttested = ctx.assessment.status === "attested";

  const search = await props.searchParams;
  const submitError = (() => {
    const e = search?.error;
    if (Array.isArray(e)) return e[0] ?? null;
    return typeof e === "string" ? e : null;
  })();

  const [responses, evidence, remediationPlans] = await Promise.all([
    listResponsesForAssessment(id),
    listEvidenceForAssessment(id),
    listRemediationPlansForAssessment(id),
  ]);
  const progress = computeProgress(responses);

  // SAM Entity freshness — soft, cached lookup. We surface a warning
  // banner when the user's SAM registration is inactive/not found so
  // they don't sign a CMMC affirmation that primes can't find in SPRS.
  // Never blocks the sign button; the action records the snapshot in
  // audit metadata as well.
  let samWarning: string | null = null;
  if (ctx.organization.sam_uei?.trim()) {
    try {
      const samStatus = await getSamEntityStatus(
        ctx.organization.sam_uei.trim(),
      );
      samWarning = summarizeSamStatus(samStatus);
    } catch (err) {
      console.error("[sign] SAM freshness lookup failed (non-blocking)", err);
    }
  }

  // CMMC L1 v2.13 + DFARS final: every affirmation must be backed by a
  // documented FCI boundary (SSP § 1.2). We assemble the read-only view
  // here so the official sees exactly what they're signing for. Wrapped in
  // try/catch so any data-shape issue degrades to a notice rather than
  // taking down the entire /sign page.
  let boundaryView: Awaited<ReturnType<typeof assembleBoundaryView>> | null =
    null;
  let boundaryAssemblyError: string | null = null;
  if (ctx.assessment.framework === "cmmc_l1") {
    try {
      boundaryView = await assembleBoundaryView({
        organizationId: ctx.organization.id,
        legalEntity: {
          id: ctx.organization.id,
          name: ctx.organization.name,
          cage: ctx.organization.cage_code ?? null,
          uei: ctx.organization.sam_uei ?? null,
          naics: ctx.organization.naics_codes ?? [],
        },
      });
    } catch (e) {
      boundaryAssemblyError =
        e instanceof Error ? e.message : String(e);
      console.error("[sign] assembleBoundaryView failed", e);
    }
  }
  let boundaryFindings: ReturnType<typeof validateBoundary> = [];
  if (boundaryView) {
    try {
      boundaryFindings = validateBoundary(boundaryView);
    } catch (e) {
      console.error("[sign] validateBoundary failed", e);
      boundaryAssemblyError =
        boundaryAssemblyError ??
        (e instanceof Error ? e.message : String(e));
    }
  }
  // Same gate the server action enforces — surface here so the page tells
  // the user *exactly* why we won't sign before they ever click submit.
  const boundaryBlockers = boundaryFindings.filter(
    (f) => f.level === "fail" || f.level === "warn",
  );
  // v2.13: legacy not-met/partial answers are still affirmation-eligible if
  // the practice has a documented Enduring Exception or a Temporary Deficiency
  // with at least one operational POA&M milestone. Mirror the gate the
  // server action enforces (controlsBlockingAffirmation).
  const coverage =
    ctx.assessment.framework === "cmmc_l1"
      ? await computeExceptionCoverage(id)
      : new Map<string, { covered: boolean }>();
  const blockingNotMet = responses.filter(
    (r) => r.status === "no" && !coverage.get(r.control_id)?.covered,
  ).length;
  const blockingPartial = responses.filter(
    (r) => r.status === "partial" && !coverage.get(r.control_id)?.covered,
  ).length;
  const profileDone = Boolean(
    ctx.organization.name &&
      ctx.organization.name !== "My Organization" &&
      ctx.organization.scoped_systems,
  );
  const evidenceBlockers = evidenceReviewBlockers(
    evidence.filter((e) => e.carry_forward_status !== "removed"),
  );
  const missingEvidence = controlsMissingEvidence(responses, evidence);
  const pendingCarryForward = responses.filter(
    (r) => r.carry_forward_status === "pending_review",
  );
  const openRemediation = remediationPlans.filter(
    (p) => p.status !== "closed" && p.status !== "abandoned",
  );
  const ready =
    profileDone &&
    progress.unanswered === 0 &&
    blockingNotMet === 0 &&
    blockingPartial === 0 &&
    evidenceBlockers.length === 0 &&
    missingEvidence.length === 0 &&
    pendingCarryForward.length === 0 &&
    boundaryBlockers.length === 0;

  // 32 CFR § 170.21(a)(2) — the affirmation is a personal act by the
  // designated Senior Official. Contributors can see this page (so they
  // know the readiness state and can prep the workspace), but the sign
  // form is replaced with a read-only banner directing them to nudge the
  // SO. The server action also enforces this — UI is informational.
  const isSeniorOfficial =
    ctx.organization.senior_official_user_id === userId;
  let seniorOfficialLabel: string | null = null;
  let seniorOfficialEmail: string | null = null;
  let currentUserLabel: string | null = null;
  let currentUserEmail: string | null = null;
  if (isSeniorOfficial) {
    try {
      const cc = await clerkClient();
      const me = await cc.users.getUser(userId);
      const composed = [me.firstName, me.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      currentUserEmail = me.primaryEmailAddress?.emailAddress ?? null;
      currentUserLabel = composed || currentUserEmail;
    } catch (err) {
      console.error("[sign] failed to load current user identity", err);
    }
  }
  if (!isSeniorOfficial && ctx.organization.senior_official_user_id) {
    try {
      const cc = await clerkClient();
      const so = await cc.users.getUser(
        ctx.organization.senior_official_user_id,
      );
      const composed = [so.firstName, so.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      seniorOfficialEmail =
        so.primaryEmailAddress?.emailAddress ?? null;
      seniorOfficialLabel = composed || seniorOfficialEmail;
    } catch (err) {
      console.error("[sign] failed to load senior official identity", err);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6">
        <Link
          href={`/assessments/${id}`}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          &larr; Back to overview
        </Link>
      </div>

      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
          Step 5 of 8 · Sign &amp; affirm
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          {alreadyAttested
            ? "Re-affirm your CMMC Level 1 compliance"
            : "Affirm your CMMC Level 1 compliance"}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          A senior official signs below on behalf of{" "}
          <strong>{ctx.organization.name}</strong>.{" "}
          {alreadyAttested
            ? "This assessment is already signed. Re-submitting refreshes the affirmation memo, payload hash, and signature with whatever changes you've made — your bid-ready packet will regenerate on the next download."
            : "This generates your affirmation memo and locks the assessment. You can download your SSP and affirmation immediately after."}
        </p>
      </header>

      {alreadyAttested && (
        <div className="mb-8 border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
            Already signed
          </h2>
          <p className="mt-2 text-sm text-emerald-900">
            {ctx.assessment.affirmed_at ? (
              <>
                Last affirmed{" "}
                <strong>
                  {new Date(ctx.assessment.affirmed_at).toLocaleString(
                    "en-US",
                    {
                      dateStyle: "long",
                      timeStyle: "short",
                    },
                  )}
                </strong>
                {ctx.assessment.affirmed_by_name ? (
                  <>
                    {" "}by{" "}
                    <strong>{ctx.assessment.affirmed_by_name}</strong>
                    {ctx.assessment.affirmed_by_title ? (
                      <>, {ctx.assessment.affirmed_by_title}</>
                    ) : null}
                  </>
                ) : null}
                .{" "}
              </>
            ) : null}
            You only need to re-sign if you updated answers, evidence, the
            boundary, or the signer details. Otherwise{" "}
            <Link
              href={`/assessments/${id}/bid-packet`}
              className="underline font-medium"
            >
              go to your bid-ready packet
            </Link>
            .
          </p>
        </div>
      )}

      {submitError && (
        <noscript>
          <div className="mb-8 border border-rose-300 bg-rose-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-800">
              Couldn&rsquo;t sign
            </h2>
            <p className="mt-2 text-sm text-rose-900">{submitError}</p>
          </div>
        </noscript>
      )}

      {!ready && (
        <div className="mb-8  border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-800">
            Not ready to sign yet
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-rose-900 space-y-1">
            {!profileDone && <li>Complete your business profile.</li>}
            {progress.unanswered > 0 && (
              <li>
                {progress.unanswered} practice
                {progress.unanswered === 1 ? "" : "s"} still need an answer.
              </li>
            )}
            {progress.notMet > 0 && (
              <li>
                {blockingNotMet > 0 ? (
                  <>
                    {blockingNotMet} practice
                    {blockingNotMet === 1 ? " is" : "s are"} marked Not met
                    without a documented Enduring Exception or Temporary
                    Deficiency. Either remediate, mark N/A, or document an
                    EE/TD on the{" "}
                    <Link
                      href={`/assessments/${id}/exceptions`}
                      className="underline"
                    >
                      exceptions page
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    {progress.notMet} Not met practice
                    {progress.notMet === 1 ? "" : "s"} covered by an Enduring
                    Exception or Temporary Deficiency — affirmation-eligible.
                  </>
                )}
              </li>
            )}
            {progress.partial > 0 && (
              <li>
                {blockingPartial > 0 ? (
                  <>
                    {blockingPartial} practice
                    {blockingPartial === 1 ? " is" : "s are"} marked Partial
                    without a documented Enduring Exception or Temporary
                    Deficiency. Either fully implement, mark N/A, or document
                    an EE/TD on the{" "}
                    <Link
                      href={`/assessments/${id}/exceptions`}
                      className="underline"
                    >
                      exceptions page
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    {progress.partial} Partial practice
                    {progress.partial === 1 ? "" : "s"} covered by an Enduring
                    Exception or Temporary Deficiency — affirmation-eligible.
                  </>
                )}
              </li>
            )}
            {pendingCarryForward.length > 0 && (
              <li>
                {pendingCarryForward.length} answer
                {pendingCarryForward.length === 1 ? "" : "s"} carried over
                from last cycle still need review:{" "}
                <span className="font-mono text-xs">
                  {pendingCarryForward
                    .slice(0, 5)
                    .map((r) => r.control_id)
                    .join(", ")}
                  {pendingCarryForward.length > 5
                    ? ` +${pendingCarryForward.length - 5} more`
                    : ""}
                </span>
              </li>
            )}
            {evidenceBlockers.length > 0 && (
              <li>
                {evidenceBlockers.length} evidence artifact
                {evidenceBlockers.length === 1 ? "" : "s"} not passing Platform
                review:
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {evidenceBlockers.slice(0, 3).map((b) => (
                    <li key={b.id} className="text-xs">
                      <span className="font-mono">{b.filename}</span> —{" "}
                      {b.reason}
                    </li>
                  ))}
                  {evidenceBlockers.length > 3 && (
                    <li className="text-xs italic">
                      +{evidenceBlockers.length - 3} more
                    </li>
                  )}
                </ul>
              </li>
            )}
            {missingEvidence.length > 0 && (
              <li>
                {missingEvidence.length} practice
                {missingEvidence.length === 1 ? "" : "s"} marked Met without
                proof on file. Either upload an artifact or add a 200+
                character narrative including the phrase &ldquo;no
                artifact&rdquo;:{" "}
                <span className="font-mono text-xs">
                  {missingEvidence
                    .slice(0, 5)
                    .map((m) => m.control_id)
                    .join(", ")}
                  {missingEvidence.length > 5
                    ? ` +${missingEvidence.length - 5} more`
                    : ""}
                </span>
              </li>
            )}
            {boundaryBlockers.length > 0 && (
              <li>
                FCI boundary is incomplete &mdash; {boundaryBlockers.length}{" "}
                finding{boundaryBlockers.length === 1 ? "" : "s"} on the SSP
                §&nbsp;1.2 page (the contracting officer sees this exact
                page):
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {boundaryBlockers.slice(0, 4).map((f) => (
                    <li key={f.code} className="text-xs">
                      <span className="font-bold">
                        {f.level === "fail" ? "BLOCKER" : "MISSING"}
                      </span>{" "}
                      &mdash; {f.message}
                      {f.control_refs && f.control_refs.length > 0 && (
                        <span className="ml-1 text-[10px] text-rose-700">
                          ({f.control_refs.join(", ")})
                        </span>
                      )}
                    </li>
                  ))}
                  {boundaryBlockers.length > 4 && (
                    <li className="text-xs italic">
                      +{boundaryBlockers.length - 4} more
                    </li>
                  )}
                </ul>
                <Link
                  href="/assessments/boundary"
                  className="mt-2 inline-block text-xs font-bold uppercase tracking-wider text-rose-900 underline hover:text-rose-700"
                >
                  Fix on the Boundary page &rarr;
                </Link>
              </li>
            )}
          </ul>
          <Link
            href={`/assessments/${id}`}
            className="mt-4 inline-block  bg-rose-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-800"
          >
            Back to overview
          </Link>
        </div>
      )}

      {openRemediation.length > 0 && (
        <div className="mb-8  border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
            Open remediation plans
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            CMMC L1 affirmation is binary — every practice must be Met or N/A.
            These plans give you a tracked roadmap to closure but do not
            unblock signing.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {openRemediation.map((p) => (
              <li
                key={p.id}
                className=" border border-amber-200 bg-white px-3 py-2"
              >
                <span className="font-mono text-xs font-bold">
                  {p.control_id}
                </span>{" "}
                · target close{" "}
                <span className="font-semibold">{p.target_close_date}</span> ·{" "}
                <span className="capitalize">{p.status.replace("_", " ")}</span>
                <div className="mt-1 text-xs text-amber-800">{p.gap_summary}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8  border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Compliance summary
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Summary label="Met" value={progress.met} tone="emerald" />
          <Summary label="N/A" value={progress.notApplicable} tone="sky" />
          <Summary label="Not met" value={progress.notMet} tone="rose" />
          <Summary label="Partial" value={progress.partial} tone="amber" />
        </dl>
      </section>

      <section className="mb-8  border border-indigo-200 bg-indigo-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-900">
          What you&apos;re actually signing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950">
          By submitting this affirmation, your CMMC Status posts to SPRS as{" "}
          <span className="font-semibold">Final Level 1 (Self)</span> for the
          12 months that follow. Per <span className="font-semibold">DFARS
          252.204-7021</span>, contracting officers must verify that status
          before award on any solicitation that includes the clause; per{" "}
          <span className="font-semibold">DFARS 252.204-7025</span>, you
          represent that status at proposal time. A lapse must be reported to
          the contracting officer within 72 hours.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950">
          The 15 basic safeguarding requirements (FAR 52.204-21(b)(1)(i)–
          (b)(1)(xv)) decompose into 59 NIST SP 800-171A assessment objectives.
          Per <span className="font-semibold">32 CFR § 170.24</span>, every
          objective must be MET or NOT APPLICABLE for the parent requirement
          to be MET; one NOT MET fails the whole requirement. Documented
          Enduring Exceptions (in your system security plan) and Temporary
          Deficiencies (with milestones) score as MET.
        </p>
      </section>

      {boundaryAssemblyError && (
        <div className="mb-8 border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
            Boundary preview unavailable
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            We couldn&rsquo;t render the FCI boundary preview on this page.
            You can still review and edit it on the{" "}
            <Link href="/assessments/boundary" className="underline">
              Boundary page
            </Link>
            . This does not block signing if the boundary itself is complete.
          </p>
          <p className="mt-2 font-mono text-[11px] text-amber-700">
            {boundaryAssemblyError}
          </p>
        </div>
      )}

      {boundaryView && (
        <section className="mb-8 border border-[#cfe3d9] bg-white p-6 shadow-sm">
          <style dangerouslySetInnerHTML={{ __html: BOUNDARY_CSS }} />
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                SSP § 1.2 · FCI Boundary
              </div>
              <h2 className="font-serif text-xl font-bold tracking-tight text-[#10231d]">
                What&rsquo;s in scope, what&rsquo;s out, and who signs
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
                This is the boundary diagram and inventory that ships with your
                System Security Plan. Review it before affirming &mdash; the
                contracting officer will see this exact page in your packet.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/assessments/boundary"
                className="inline-flex items-center gap-2 border border-[#cfe3d9] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#10231d] hover:bg-[#f1f6f3]"
              >
                Edit boundary
              </Link>
              <a
                href="/api/boundary/render?print=1"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-[#2f8f6d] bg-[#2f8f6d] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#247a5b]"
              >
                Download PDF
              </a>
              <a
                href="/api/boundary/render"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-[#0e2a23] bg-[#0e2a23] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#10231d]"
              >
                Open standalone HTML
              </a>
            </div>
          </div>
          <BoundaryPreviewModal>
            <BoundaryDocument view={boundaryView} findings={boundaryFindings} />
          </BoundaryPreviewModal>
        </section>
      )}

      {samWarning && (
        <div className="mb-8 border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
            SAM registration warning
          </h2>
          <p className="mt-2 text-sm text-amber-900">{samWarning}</p>
          <p className="mt-2 text-xs text-amber-800">
            This is a heads-up, not a block — you can still sign. But primes
            looking you up in SPRS by CAGE/UEI will see &ldquo;Inactive&rdquo; until you
            renew at{" "}
            <a
              href="https://sam.gov"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              sam.gov
            </a>
            .
          </p>
        </div>
      )}

      {!isSeniorOfficial && (
        <div className="mb-8 rounded-lg border border-[#cfe3d9] bg-[#0e2a23] p-6 text-[#bdf2cf]">
          <p className="font-serif text-xs tracking-[0.2em] uppercase text-[#bdf2cf]/80">
            Contributor view · sign-only restriction
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-white">
            Only the Senior Official can sign this affirmation
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#bdf2cf]/90">
            32 CFR § 170.21(a)(2) requires the CMMC Level 1 affirmation to be made
            personally by a designated Senior Official — it is not a corporate
            act and cannot be delegated. You can keep editing practices,
            evidence, and the boundary; only the signature itself is locked.
          </p>
          {seniorOfficialLabel ? (
            <p className="mt-4 rounded-md border border-[#bdf2cf]/30 bg-[#10231d] px-4 py-3 text-sm">
              <span className="font-serif text-xs tracking-[0.2em] uppercase text-[#bdf2cf]/70">
                Designated signer
              </span>
              <br />
              <span className="font-semibold text-white">{seniorOfficialLabel}</span>
              {seniorOfficialEmail && seniorOfficialEmail !== seniorOfficialLabel ? (
                <span className="ml-2 text-[#bdf2cf]/80">· {seniorOfficialEmail}</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-4 text-sm text-[#bdf2cf]/80">
              No Senior Official is currently designated for this workspace.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/settings/team"
              className="inline-flex items-center rounded-md bg-[#bdf2cf] px-4 py-2 text-sm font-semibold text-[#0e2a23] hover:bg-white"
            >
              Open team settings
            </Link>
            {seniorOfficialEmail ? (
              <a
                href={`mailto:${seniorOfficialEmail}?subject=${encodeURIComponent(
                  `CMMC L1 affirmation ready for your signature — ${ctx.organization.name}`,
                )}&body=${encodeURIComponent(
                  "The workspace is ready for your CMMC L1 affirmation. Sign in and visit the sign step to complete it.",
                )}`}
                className="inline-flex items-center rounded-md border border-[#bdf2cf]/40 px-4 py-2 text-sm font-semibold text-[#bdf2cf] hover:bg-[#10231d]"
              >
                Email the Senior Official
              </a>
            ) : null}
          </div>
        </div>
      )}

      {isSeniorOfficial && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-[#cfe3d9] bg-[#f1f6f3] p-4">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2f8f6d] text-xs font-bold text-white"
          >
            &#10003;
          </span>
          <div className="text-sm text-[#10231d]">
            <div className="font-serif text-[11px] tracking-[0.2em] uppercase text-[#2f8f6d]">
              Signing as designated Senior Official
            </div>
            <div className="mt-1">
              <span className="font-semibold">
                {currentUserLabel ?? "You"}
              </span>
              {currentUserEmail && currentUserEmail !== currentUserLabel ? (
                <span className="ml-1 text-[#456c5f]">· {currentUserEmail}</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[#456c5f]">
              Per 32 CFR § 170.21(a)(2), this affirmation is a personal act
              by the designated Senior Official for {ctx.organization.name}.
            </p>
          </div>
        </div>
      )}

      <AffirmForm
        assessmentId={id}
        organizationName={ctx.organization.name}
        disabled={!ready || !isSeniorOfficial}
        submitError={submitError}
        hidden={!isSeniorOfficial}
      />
    </main>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={` border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
