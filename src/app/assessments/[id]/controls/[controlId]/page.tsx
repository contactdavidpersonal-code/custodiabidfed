import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getRemediationPlan,
  getResponse,
  getReuseCandidates,
  listEvidenceForControl,
  listResponsesForAssessment,
} from "@/lib/assessment";
import { getObjectives, playbook, playbookById } from "@/lib/playbook";
import {
  deleteEvidenceAction,
  generateArtifactAction,
  reReviewEvidenceAction,
  saveControlResponseAction,
  tagArtifactPracticeAction,
  untagArtifactPracticeAction,
  uploadEvidenceAction,
  upsertRemediationPlanAction,
  useSuggestedNarrativeAction,
} from "../../../actions";
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
  // Strip the raw blob URL before crossing into the client component. Clients
  // load evidence through `/api/evidence/{id}` which performs auth + tenant +
  // audit on every read; the bare blob URL stays server-side.
  const evidenceForClient = evidence.map((e) => {
    const { blob_url: _blobUrl, ...rest } = e;
    void _blobUrl;
    return rest;
  });
  const reuseCandidates = await getReuseCandidates(id, controlId);
  const reuseForClient = reuseCandidates.map((c) => {
    const { blob_url: _blobUrl, ...rest } = c;
    void _blobUrl;
    return rest;
  });
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
        objectives={getObjectives(controlId)}
        response={response}
        evidence={evidenceForClient}
        remediationPlan={remediationPlan}
        prevId={prevId}
        nextId={nextId}
        currentIdx={currentIdx}
        total={orderedIds.length}
        reuseCandidates={reuseForClient}
        saveResponseAction={saveControlResponseAction}
        uploadEvidenceAction={uploadEvidenceAction}
        deleteEvidenceAction={deleteEvidenceAction}
        reReviewEvidenceAction={reReviewEvidenceAction}
        tagArtifactPracticeAction={tagArtifactPracticeAction}
        untagArtifactPracticeAction={untagArtifactPracticeAction}
        generateArtifactAction={generateArtifactAction}
        useSuggestedNarrativeAction={useSuggestedNarrativeAction}
        upsertRemediationPlanAction={upsertRemediationPlanAction}
      />
    </main>
  );
}
