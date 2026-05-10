import { auth } from "@clerk/nextjs/server";
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
import { submitAffirmationAction } from "../../actions";

export default async function SignPage(
  props: PageProps<"/assessments/[id]/sign">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "sign");

  if (ctx.assessment.status === "attested") {
    redirect(`/assessments/${id}`);
  }

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
          Affirm your CMMC Level 1 compliance
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          A senior official signs below on behalf of{" "}
          <strong>{ctx.organization.name}</strong>. This generates your
          affirmation memo and locks the assessment. You can download your SSP
          and affirmation immediately after.
        </p>
      </header>

      {submitError && (
        <div className="mb-8 border border-rose-300 bg-rose-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-800">
            Couldn&rsquo;t sign
          </h2>
          <p className="mt-2 text-sm text-rose-900">{submitError}</p>
        </div>
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

      <form
        action={submitAffirmationAction}
        className="space-y-6  border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="assessmentId" value={id} />

        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Affirming Official
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Per 32 CFR § 170.22, the Affirming Official must be a senior
            officer of the organization with authority to bind it. Their name,
            title, email, and the affirmation date are submitted to SPRS and
            visible to contracting officers under DFARS 252.204-7021.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Full legal name
            </span>
            <input
              type="text"
              name="signerName"
              required
              placeholder="Jane Doe"
              className="w-full  border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Title
            </span>
            <input
              type="text"
              name="signerTitle"
              required
              placeholder="Chief Executive Officer"
              className="w-full  border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Work email
            </span>
            <input
              type="email"
              name="affirmingOfficialEmail"
              required
              placeholder="ceo@yourcompany.com"
              className="w-full  border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              Used for the SPRS submission record and renewal reminders. Must
              match the Affirming Official, not a generic inbox.
            </span>
          </label>
        </div>

        <div className=" border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Affirmation statement
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            I affirm that <strong>{ctx.organization.name}</strong> implements
            all 15 CMMC Level 1 basic safeguarding requirements (FAR 52.204-21(b)(1)(i)–(b)(1)(xv)) as described in the
            accompanying System Security Plan, and that the information
            provided is accurate and complete as of today. I understand that
            this affirmation is a material representation of fact upon which
            the Government relies and that knowingly false statements may
            subject me and the organization to criminal and civil penalties
            under the False Claims Act and 18 U.S.C. § 1001.
          </p>
          <label className="mt-4 flex gap-3 text-sm">
            <input
              type="checkbox"
              name="acknowledged"
              required
              className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
            />
            <span className="text-slate-800">
              I have read the statement above and am authorized to affirm on
              behalf of <strong>{ctx.organization.name}</strong>.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <button
            type="submit"
            disabled={!ready}
            className=" bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign and affirm &rarr;
          </button>
          <Link
            href={`/assessments/${id}`}
            className=" border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
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
