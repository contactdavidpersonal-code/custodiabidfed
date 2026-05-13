import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  enforceStepOrder,
  getAssessmentForUser,
  materialChangeQuestionKeys,
  type MaterialChangeQuestionKey,
} from "@/lib/assessment";
import { submitMaterialChangeReviewAction } from "../../actions";
import MaterialChangeForm from "./MaterialChangeForm";

/**
 * Material-change interview for carried-forward cycles. Implements
 * CMMC Scoping Guide L1 v2.13 § 170.19 p. 4:
 *
 *   "A new assessment is required if there are significant architectural or
 *    boundary changes to the previous CMMC Assessment Scope. Examples
 *    include, but are not limited to, expansions of networks or mergers
 *    and acquisitions."
 *
 * Fresh cycles redirect past this step. Once submitted, the answers and
 * outcome (carry-forward kept vs. forced re-walk) are persisted on the
 * assessment row and surfaced in audit logs.
 */
export default async function MaterialChangePage(
  props: PageProps<"/assessments/[id]/material-change">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  // Fresh (non-carried) cycles don't need this interview — bounce home.
  if (!ctx.assessment.carried_forward_from) {
    redirect(`/assessments/${id}`);
  }

  await enforceStepOrder(ctx, "material-change");

  const alreadyReviewed = Boolean(ctx.assessment.material_change_reviewed_at);
  const priorOutcome = ctx.assessment.material_change_required_reassessment;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Annual re-affirmation · Material-change review
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Has anything material changed since last year?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a7d70]">
          Before you re-affirm, the CMMC Scoping Guide for Level 1 (v2.13,
          § 170.19) requires you to confirm whether anything significant has
          changed about your business or the systems that handle Federal
          Contract Information. If something did, a fresh self-assessment is
          required — an annual affirmation alone is not enough.
        </p>
      </header>

      {alreadyReviewed && (
        <div className="mb-6 border border-[#cfe3d9] bg-[#f5f8f6] px-4 py-3 text-xs leading-relaxed text-[#10231d]">
          <p className="font-bold">
            You&apos;ve already completed this review for this cycle.
          </p>
          <p className="mt-1 text-[#5a7d70]">
            Outcome:{" "}
            {priorOutcome
              ? "a material change was identified — the carried responses were wiped and you walked the requirements fresh."
              : "no material change — last year's responses carried forward and you are completing the annual affirmation only."}{" "}
            You can re-submit this review if anything has changed since.
          </p>
        </div>
      )}

      <MaterialChangeForm
        assessmentId={id}
        action={submitMaterialChangeReviewAction}
        questions={[...materialChangeQuestionKeys] as MaterialChangeQuestionKey[]}
      />

      <aside className="mt-10 border-l-2 border-[#cfe3d9] bg-[#f5f8f6] px-4 py-3 text-xs leading-relaxed text-[#5a7d70]">
        <p className="font-bold uppercase tracking-[0.14em] text-[#10231d]">
          Why this matters
        </p>
        <p className="mt-1">
          The federal expectation is that L1 contractors re-assess when the
          assessment scope changes. Operational drift inside the existing
          scope (new hires, software updates, normal staff turnover) is fine
          — those are continuity items the annual affirmation already covers.
          Boundary or scope changes are what trigger a fresh walk.
        </p>
      </aside>
    </main>
  );
}
