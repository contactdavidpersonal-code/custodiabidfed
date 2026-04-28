import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  createAssessmentForOrg,
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
  listAssessmentsWithProgress,
} from "@/lib/assessment";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { defaultCycleLabel, fiscalYearOf } from "@/lib/fiscal";

/**
 * /assessments is the workspace root. There is exactly one active CMMC L1
 * affirmation per org — we auto-create it on first visit and forward straight
 * to the 17-control workspace. No cycle list, no "start a cycle" UI: the user
 * just lands on their controls.
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

  if (active) {
    redirect(`/assessments/${active.id}`);
  }

  const created = await createAssessmentForOrg(
    org.id,
    defaultCycleLabel(fiscalYearOf()),
  );
  redirect(`/assessments/${created.id}`);
}
