import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  createAssessmentForOrg,
  ensureOrgForUser,
  getBusinessProfile,
  getStepGate,
  isOnboardingComplete,
  listAssessmentsWithProgress,
  listResponsesForAssessment,
  stepHref,
} from "@/lib/assessment";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { defaultCycleLabel, fiscalYearOf } from "@/lib/fiscal";

/**
 * /assessments is the workspace root. There is exactly one active CMMC L1
 * affirmation per org — we auto-create it on first visit and forward straight
 * to whichever step the user still owes work on (business profile, federal
 * registration, the 17 practices, or signing the affirmation). The step gate
 * keeps the order strict: nobody can jump ahead.
 */
export default async function AssessmentsIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  await ensureWelcomeEmailSent(org.id, userId);

  const profile = await getBusinessProfile(org.id);
  if (!isOnboardingComplete(org, profile)) {
    redirect("/onboard");
  }

  const existing = await listAssessmentsWithProgress(org.id);
  const active = existing.find((a) => a.status !== "archived") ?? existing[0];

  const assessmentId = active
    ? active.id
    : (
        await createAssessmentForOrg(
          org.id,
          defaultCycleLabel(fiscalYearOf()),
        )
      ).id;

  // Re-fetch the full assessment row + responses so the step gate reads from
  // the same shape getAssessmentForUser returns. listAssessmentsWithProgress
  // returns a summary view that omits attestation fields.
  const assessment = active
    ? {
        id: active.id,
        organization_id: org.id,
        status: active.status,
      }
    : null;

  const responses = assessment
    ? await listResponsesForAssessment(assessment.id)
    : [];

  // We only need the bare minimum to compute the gate. Cast through unknown
  // because computeProgress only reads `status` and getStepGate only reads
  // `status` off the assessment row.
  const gate = getStepGate(
    org,
    profile,
    responses,
    (assessment ?? {
      id: assessmentId,
      organization_id: org.id,
      status: "in_progress",
    }) as never,
  );

  redirect(stepHref(assessmentId, gate.currentStep));
}
