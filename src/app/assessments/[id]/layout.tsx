import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  getAssessmentForUser,
  getBusinessProfile,
  getStepGate,
  listResponsesForAssessment,
  stepHref,
} from "@/lib/assessment";
import { CourseSidebar, type CourseSection, type SectionStatus } from "./CourseSidebar";

/**
 * Course shell. Wraps every page under /assessments/[id] with the collapsible
 * left sidebar that walks the user through the FCI-readiness curriculum:
 * profile → federal registration → 17 CMMC L1 practices → sign → deliverables.
 *
 * Section statuses are computed server-side per request so the sidebar
 * always reflects the user's true progress, including the locked state on
 * Sign and Deliverables until prerequisites are met.
 */
export default async function CourseLayout(
  props: LayoutProps<"/assessments/[id]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const [responses, profile] = await Promise.all([
    listResponsesForAssessment(id),
    getBusinessProfile(ctx.organization.id),
  ]);

  const progress = computeProgress(responses);
  const gate = getStepGate(ctx.organization, profile, responses, ctx.assessment);
  const profileComplete = gate.profileComplete;
  const registrationComplete = gate.registrationComplete;
  const practicesAllResolved = gate.practicesComplete;
  const attested = gate.attested;
  const currentStepHref = stepHref(id, gate.currentStep);

  const profileStatus: SectionStatus = profileComplete
    ? "complete"
    : "in_progress";

  const registrationStatus: SectionStatus = registrationComplete
    ? "complete"
    : profileComplete
      ? "in_progress"
      : "available";

  const practicesStatus: SectionStatus = practicesAllResolved
    ? "complete"
    : progress.met + progress.notApplicable > 0
      ? "in_progress"
      : "available";

  const signStatus: SectionStatus = attested
    ? "complete"
    : practicesAllResolved && profileComplete && registrationComplete
      ? "available"
      : "locked";

  const deliverablesStatus: SectionStatus = attested ? "available" : "locked";

  const sections: CourseSection[] = [
    {
      id: "profile",
      step: 1,
      href: `/assessments/${id}/profile`,
      title: "Business profile",
      subtitle: "Legal name, scope, contacts",
      status: profileStatus,
      match: "exact",
    },
    {
      id: "registration",
      step: 2,
      href: `/assessments/${id}/registration`,
      title: "Federal registration",
      subtitle: "SAM.gov UEI, CAGE, NAICS",
      status: registrationStatus,
      match: "exact",
    },
    {
      id: "practices",
      step: 3,
      href: `/assessments/${id}`,
      title: "CMMC Level 1 practices",
      subtitle: `${progress.met + progress.notApplicable} of ${
        progress.met +
        progress.partial +
        progress.notMet +
        progress.notApplicable +
        progress.unanswered
      } resolved`,
      status: practicesStatus,
      match: "exact",
    },
    {
      id: "sign",
      step: 4,
      href: `/assessments/${id}/sign`,
      title: "Sign & affirm",
      subtitle: attested
        ? "Affirmation locked"
        : signStatus === "locked"
          ? "Finish steps 1\u20133 first"
          : "Senior official signature",
      status: signStatus,
      match: "prefix",
    },
    {
      id: "bid-ready",
      step: 5,
      href: `/assessments/${id}/bid-packet`,
      title: "Bid-Ready Packet",
      subtitle: attested
        ? "Capability statement, past performance"
        : registrationComplete
          ? "Unlocks after signing"
          : "Finish steps 1\u20134 first",
      status: attested
        ? "available"
        : registrationComplete
          ? "locked"
          : "locked",
      match: "prefix",
    },
    {
      id: "deliverables",
      step: 6,
      href: `/assessments/${id}/deliverables`,
      title: "Deliverables",
      subtitle: attested
        ? "Download SSP, affirmation, package"
        : "Unlocks after signing",
      status: deliverablesStatus,
      match: "prefix",
    },
    {
      id: "opportunities",
      step: 7,
      href: `/opportunities`,
      title: "Find & submit bids",
      subtitle: attested
        ? "Charlie-sourced federal opportunities"
        : "Unlocks after signing",
      status: attested ? "available" : "locked",
      match: "prefix",
    },
  ];

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <CourseSidebar sections={sections} assessmentId={id} currentStepHref={currentStepHref} />
      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}
