import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  controlsMissingEvidence,
  evidenceReviewBlockers,
  getAssessmentForUser,
  listEvidenceForAssessment,
  listRemediationPlansForAssessment,
  listResponsesForAssessment,
} from "@/lib/assessment";
import { submitAffirmationAction } from "../../actions";

export default async function SignPage(
  props: PageProps<"/assessments/[id]/sign">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  if (ctx.assessment.status === "attested") {
    redirect(`/assessments/${id}`);
  }

  const [responses, evidence, remediationPlans] = await Promise.all([
    listResponsesForAssessment(id),
    listEvidenceForAssessment(id),
    listRemediationPlansForAssessment(id),
  ]);
  const progress = computeProgress(responses);
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
    progress.notMet === 0 &&
    progress.partial === 0 &&
    evidenceBlockers.length === 0 &&
    missingEvidence.length === 0 &&
    pendingCarryForward.length === 0;

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
          Step 4 of 7 · Sign &amp; affirm
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
                {progress.notMet} practice
                {progress.notMet === 1 ? " is" : "s are"} marked Not met.
                Remediate before signing.
              </li>
            )}
            {progress.partial > 0 && (
              <li>
                {progress.partial} practice
                {progress.partial === 1 ? " is" : "s are"} marked Partial.
                Fully implement before signing.
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

      <form
        action={submitAffirmationAction}
        className="space-y-6  border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="assessmentId" value={id} />

        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Senior official
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Must be an officer, owner, or executive with authority to bind the
            organization.
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
        </div>

        <div className=" border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Affirmation statement
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            I affirm that <strong>{ctx.organization.name}</strong> implements
            all 17 CMMC Level 1 security requirements as described in the
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
