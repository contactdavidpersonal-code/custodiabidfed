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
import { listEsps, listScopeItems } from "@/lib/cmmc/scope";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { defaultCycleLabel, fiscalYearOf } from "@/lib/fiscal";

/**
 * /assessments is the workspace root. There is exactly one active CMMC L1
 * affirmation per org — we auto-create it on first visit and forward straight
 * to whichever step the user still owes work on (business profile, federal
 * registration, the 15 safeguarding requirements, or signing the affirmation). The step gate
 * keeps the order strict: nobody can jump ahead.
 */
export default async function AssessmentsIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  await ensureWelcomeEmailSent(org.id, userId);

  // 32 CFR § 170.21(a)(2) acknowledgement gate. Pre-flight: if the
  // signed-in user is the designated Senior Official AND hasn't yet
  // confirmed they read the personal-liability summary, route them to
  // /welcome/senior-official before any assessment work begins. Other
  // users (contributors, viewers) skip this gate — only the SO needs
  // to read it. Pre-existing orgs were backfilled as already-acknow-
  // ledged at migration time, so this only fires for brand-new signups.
  if (
    org.senior_official_user_id === userId &&
    !org.senior_official_acknowledged_at
  ) {
    redirect("/welcome/senior-official");
  }

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

  // 32 CFR § 170.19(b)(3) scope inventory completeness — needed so the
  // index can route to /scope when the user owes that step. Matches the
  // logic in CourseLayout and enforceStepOrder.
  const [scopeItems, esps] = await Promise.all([
    listScopeItems(org.id),
    listEsps(org.id),
  ]);
  const scopeComplete =
    scopeItems.some((s) => s.kind === "people") &&
    scopeItems.some((s) => s.kind === "technology") &&
    scopeItems.some((s) => s.kind === "facility") &&
    esps.length > 0;

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
    undefined,
    scopeComplete,
  );

  redirect(stepHref(assessmentId, gate.currentStep));
}
