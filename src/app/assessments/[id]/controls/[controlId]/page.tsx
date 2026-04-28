import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getRemediationPlan,
  getResponse,
  listEvidenceForControl,
  listResponsesForAssessment,
} from "@/lib/assessment";
import { playbook, playbookById } from "@/lib/playbook";
import {
  deleteEvidenceAction,
  reReviewEvidenceAction,
  saveControlResponseAction,
  uploadEvidenceAction,
  upsertRemediationPlanAction,
  useSuggestedNarrativeAction,
} from "../../../actions";
import { practiceQuizzes } from "@/lib/practice-quiz";
import { PracticeWizard } from "./PracticeWizard";

export default async function ControlDetailPage(
  props: PageProps<"/assessments/[id]/controls/[controlId]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id, controlId } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const practice = playbookById[controlId];
  if (!practice) notFound();

  const response = await getResponse(id, controlId);
  if (!response) notFound();

  const evidence = await listEvidenceForControl(id, controlId);
  const allResponses = await listResponsesForAssessment(id);
  const remediationPlan = await getRemediationPlan(id, controlId);
  const orderedIds = playbook.map((p) => p.id);
  const currentIdx = orderedIds.indexOf(controlId);
  const prevId = currentIdx > 0 ? orderedIds[currentIdx - 1] : null;
  const nextId =
    currentIdx >= 0 && currentIdx < orderedIds.length - 1
      ? orderedIds[currentIdx + 1]
      : null;

  // Suppress unused linter — kept for future header enrichment.
  void allResponses;

  const quiz = practiceQuizzes[controlId] ?? [];

  // Strip non-serializable function field before crossing the server/client
  // boundary. `suggestedNarrative` is invoked server-side by
  // `useSuggestedNarrativeAction`, so the client never needs it.
  const { suggestedNarrative: _suggestedNarrative, ...practiceForClient } =
    practice;
  void _suggestedNarrative;

  return (
    <main>
      <PracticeWizard
        assessmentId={id}
        controlId={controlId}
        practice={practiceForClient}
        response={response}
        evidence={evidence}
        remediationPlan={remediationPlan}
        quiz={quiz}
        prevId={prevId}
        nextId={nextId}
        currentIdx={currentIdx}
        total={orderedIds.length}
        saveResponseAction={saveControlResponseAction}
        uploadEvidenceAction={uploadEvidenceAction}
        deleteEvidenceAction={deleteEvidenceAction}
        reReviewEvidenceAction={reReviewEvidenceAction}
        useSuggestedNarrativeAction={useSuggestedNarrativeAction}
        upsertRemediationPlanAction={upsertRemediationPlanAction}
      />
    </main>
  );
}
