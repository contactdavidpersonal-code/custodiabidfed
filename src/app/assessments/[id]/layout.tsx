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
import { computeExceptionCoverage } from "@/lib/cmmc/objectives";
import { listScopeItems, listEsps } from "@/lib/cmmc/scope";
import { CourseSidebar, type CourseSection, type SectionStatus } from "./CourseSidebar";

/**
 * Course shell. Wraps every page under /assessments/[id] with the collapsible
 * left sidebar that walks the user through the FCI-readiness curriculum:
 * profile → federal registration → 15 CMMC L1 safeguarding requirements → sign → deliverables.
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

  const [responses, profile, scopeItems, esps] = await Promise.all([
    listResponsesForAssessment(id),
    getBusinessProfile(ctx.organization.id),
    listScopeItems(ctx.organization.id),
    listEsps(ctx.organization.id),
  ]);

  // Scope step is "complete" when the operator has captured at least one
  // People row, one Technology row, one Facility row, and one ESP — the
  // minimum 32 CFR § 170.19 scope inventory an assessor would accept.
  const hasPeople = scopeItems.some((s) => s.kind === "people");
  const hasTech = scopeItems.some((s) => s.kind === "technology");
  const hasFacility = scopeItems.some((s) => s.kind === "facility");
  const hasEsp = esps.length > 0;
  const scopeComplete = hasPeople && hasTech && hasFacility && hasEsp;

  // EE/TD coverage so practices marked Not Met / Partial in the legacy table
  // but documented as Enduring Exceptions or Temporary Deficiencies (with
  // milestones) don't trap the user on the practices step. CMMC L1 only.
  let coverage: ReadonlySet<string> | undefined;
  if (ctx.assessment.framework === "cmmc_l1") {
    const map = await computeExceptionCoverage(id);
    const covered = new Set<string>();
    for (const [controlId, info] of map) {
      if (info.covered) covered.add(controlId);
    }
    coverage = covered;
  }

  const progress = computeProgress(responses);
  const gate = getStepGate(ctx.organization, profile, responses, ctx.assessment, coverage);
  const profileComplete = gate.profileComplete;
  const registrationComplete = gate.registrationComplete;
  const practicesAllResolved = gate.practicesComplete;
  const attested = gate.attested;
  const currentStepHref = stepHref(id, gate.currentStep);

  // Strict step-order locking. A step is "locked" until every step before it
  // is complete. The currently-active step is "in_progress"; completed steps
  // are "complete"; everything after the active step is "locked". This is the
  // single source of truth for the sidebar UI and matches the server-side
  // enforceStepOrder gate exactly.
  const profileStatus: SectionStatus = profileComplete ? "complete" : "in_progress";

  const registrationStatus: SectionStatus = !profileComplete
    ? "locked"
    : registrationComplete
      ? "complete"
      : "in_progress";

  const practicesStatus: SectionStatus = !profileComplete || !registrationComplete
    ? "locked"
    : practicesAllResolved
      ? "complete"
      : "in_progress";

  const signStatus: SectionStatus = attested
    ? "complete"
    : profileComplete && registrationComplete && practicesAllResolved
      ? "in_progress"
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
      subtitle: "Your federal ID number and contractor location code",
      status: registrationStatus,
      match: "exact",
    },
    {
      id: "scope",
      step: 3,
      href: `/assessments/${id}/scope`,
      title: "Scope inventory",
      subtitle: registrationComplete
        ? "People, technology, facilities, ESPs"
        : "Unlocks after registration",
      status: !registrationComplete
        ? "locked"
        : scopeComplete
          ? "complete"
          : "available",
      match: "prefix",
    },
    {
      id: "practices",
      step: 4,
      href: `/assessments/${id}`,
      title: "The 15 safeguarding requirements",
      subtitle: (() => {
        const total =
          progress.met +
          progress.partial +
          progress.notMet +
          progress.notApplicable +
          progress.unanswered;
        const resolved = progress.met + progress.notApplicable;
        // Weighted percent so partial / not-met counts move the bar.
        // (met + na) = 100%, partial = 50%, notMet = 25% (it's still
        // an answered cell — assessor asked, user replied "no").
        const weighted =
          total === 0
            ? 0
            : Math.round(
                ((progress.met +
                  progress.notApplicable +
                  0.5 * progress.partial +
                  0.25 * progress.notMet) /
                  total) *
                  100,
              );
        return practicesAllResolved
          ? `${resolved} of ${total} resolved`
          : `${weighted}% complete · ${resolved} of ${total} MET`;
      })(),
      status: practicesStatus,
      match: "exact",
    },
    {
      id: "sign",
      step: 5,
      href: `/assessments/${id}/sign`,
      title: "Sign and affirm",
      subtitle: attested
        ? "Yearly affirmation on file"
        : signStatus === "locked"
          ? "Finish steps 1\u20133 first"
          : "Senior official signature",
      status: signStatus,
      match: "prefix",
    },
    {
      id: "bid-ready",
      step: 6,
      href: `/assessments/${id}/bid-packet`,
      title: "Bid-ready packet",
      subtitle: attested
        ? "Capability statement, past performance"
        : "Unlocks after you sign",
      // Bid-ready has no separate completion gate — once the user has
      // signed, the packet is generated and ready. Mark it complete so the
      // sidebar shows the filled check when the user moves on to step 7.
      status: attested ? "complete" : "locked",
      match: "prefix",
    },
    {
      id: "deliverables",
      step: 7,
      href: `/assessments/${id}/deliverables`,
      title: "Deliverables",
      subtitle: attested
        ? "Download your security plan and affirmation"
        : "Unlocks after you sign",
      status: deliverablesStatus,
      match: "prefix",
    },
    {
      id: "opportunities",
      step: 8,
      href: `/opportunities`,
      title: "Find and submit bids",
      subtitle: attested
        ? "Daily federal opportunities matched to you"
        : "Unlocks after you sign",
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
