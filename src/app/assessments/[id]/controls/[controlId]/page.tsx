import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  enforceStepOrder,
  getAssessmentForUser,
  getRemediationPlan,
  getResponse,
  getReuseCandidates,
  listEvidenceForControl,
  listResponsesForAssessment,
  suggestedNaJustification,
} from "@/lib/assessment";
import { getObjectives, playbook, playbookById, requirementMeta } from "@/lib/playbook";
import { getPracticeQuiz } from "@/lib/practice-quizzes";
import {
  deleteEvidenceAction,
  markEvidenceAsFinalAction,
  reReviewEvidenceAction,
  saveControlResponseAction,
  setEvidenceMethodAction,
  submitVaultEntryAction,
  tagArtifactPracticeAction,
  untagArtifactPracticeAction,
  uploadEvidenceAction,
  upsertRemediationPlanAction,
  useSuggestedNarrativeAction,
} from "../../../actions";
import { ConnectorHint } from "../../../_components/ConnectorHint";
import { PracticeWizard } from "./PracticeWizard";
import { PracticeQuiz } from "./PracticeQuiz";
import { PracticeChat } from "./PracticeChat";
import {
  getPracticeSpec,
  personalizeSpec,
  toClientPracticeSpec,
  toClientPersonalizedSpec,
} from "@/lib/cmmc/practice-spec";
import { getOrCreatePracticeConversation } from "@/lib/cmmc/practice-chat";
import { getConnectorTokenStatus } from "@/lib/connectors/storage";
import { providersCoveringControl } from "@/lib/connectors/registry";
import type { ConnectorProvider } from "@/lib/connectors/types";

export default async function ControlDetailPage(
  props: PageProps<"/assessments/[id]/controls/[controlId]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id, controlId } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "practices");

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

  // User-facing counter MUST be 15 requirements, not 17 legacy practice IDs.
  // CMMC Level 1 v2.13 = 15 safeguarding requirements across 6 domains
  // (FAR 52.204-21(b)(1)(i)–(xv)). The playbook has 17 rows because
  // PE.L1-b.1.ix decomposes into 3 legacy NIST 800-171 r2 controls
  // (3.10.3 / 3.10.4 / 3.10.5) — internal-only. Display the ordinal of the
  // parent v2.13 requirement so all three PE sub-pages show "Practice 9 of 15".
  const requirementOrder = Object.keys(
    requirementMeta,
  ) as Array<keyof typeof requirementMeta>;
  const totalRequirements = requirementOrder.length;
  const displayIdx = requirementOrder.indexOf(practice.requirementId);

  // Suppress unused linter — kept for future header enrichment.
  void allResponses;

  // Strip non-serializable function field before crossing the server/client
  // boundary. `suggestedNarrative` is invoked server-side by
  // `useSuggestedNarrativeAction`, so the client never needs it.
  const { suggestedNarrative: _suggestedNarrative, ...practiceForClient } =
    practice;
  void _suggestedNarrative;

  // Which connector providers does this org currently have a live token for?
  // Used by PracticeQuiz to render "Connected" vs "Connect" labels on the
  // evidence-path cards.
  const tokenStatus = await getConnectorTokenStatus(ctx.organization.id);
  const connectedProviders: ConnectorProvider[] = tokenStatus
    .filter((t) => !t.revoked_at)
    .map((t) => t.provider);

  // Hybrid chat+evidence flow prefetch. If this practice has a spec entry,
  // load (or seed) the per-practice conversation server-side so the
  // PracticeChat client component opens fully populated.
  const chatSpec = getPracticeSpec(controlId);
  const chatConv = chatSpec
    ? await getOrCreatePracticeConversation(id, controlId)
    : null;
  // Personalize server-side. The intake spec contains `personalize` /
  // `charlieBrief` function references which React Server Components cannot
  // serialize across the client boundary — so we run personalize() here and
  // pass only plain data forward via `toClientPracticeSpec` /
  // `toClientPersonalizedSpec` (those helpers strip the function fields).
  const chatSpecClient = chatSpec ? toClientPracticeSpec(chatSpec) : null;
  const personalizedClient =
    chatSpec && chatConv
      ? toClientPersonalizedSpec(
          personalizeSpec(chatSpec, chatConv.intake_answers),
        )
      : null;

  // Strip `connect`-type evidence destinations on this practice when the
  // listed providers don't actually cover this control in the connector
  // registry. Single source of truth: `CONNECTORS[*].controlsCovered`. Keeps
  // the per-slot "Connect Microsoft 365 / Google" buttons from showing up on
  // practices the OAuth integrations can't pull data for.
  const stripUnsupportedConnect = <T extends { evidenceSlots: Array<{ destinations: Array<{ type: string; providers?: ReadonlyArray<ConnectorProvider> }> }> } | null>(
    s: T,
  ): T => {
    if (!s) return s;
    return {
      ...s,
      evidenceSlots: s.evidenceSlots.map((slot) => ({
        ...slot,
        destinations: slot.destinations.flatMap((d) => {
          if (d.type !== "connect") return [d];
          const providers = providersCoveringControl(d.providers ?? [], controlId);
          if (providers.length === 0) return [];
          return [{ ...d, providers }];
        }),
      })),
    } as T;
  };
  const chatSpecClientFiltered = stripUnsupportedConnect(chatSpecClient);
  const personalizedClientFiltered = stripUnsupportedConnect(personalizedClient);

  return (
    <main>
      <div className="mx-auto max-w-4xl px-4 pt-4 md:px-6 md:pt-6">
        <ConnectorHint
          controlId={controlId}
          organizationId={ctx.organization.id}
        />
      </div>
      {(() => {
        // Hybrid chat+evidence flow: opt-in per practice via practice-spec.ts.
        // Today: AC.L1-3.1.1 only. The shape is identical for every other
        // practice — adding `IA.L1-3.5.1` etc. is a pure data edit in
        // `src/lib/cmmc/practice-spec.ts` (the chat UI/API auto-picks it up).
        if (chatSpec && chatConv && chatSpecClient) {
          return (
            <PracticeChat
              assessmentId={id}
              controlId={controlId}
              spec={chatSpecClientFiltered!}
              initialPersonalized={personalizedClientFiltered}
              initialVerdicts={chatConv.objective_verdicts}
              initiallyLocked={!!chatConv.locked_at}
              initialIntakeAnswers={chatConv.intake_answers}
              initialIntakeCompletedAt={chatConv.intake_completed_at}
              evidence={evidenceForClient}
              connectedProviders={connectedProviders}
              uploadEvidenceAction={uploadEvidenceAction}
              reReviewEvidenceAction={reReviewEvidenceAction}
              deleteEvidenceAction={deleteEvidenceAction}
              prevId={prevId}
              nextId={nextId}
              currentIdx={displayIdx}
              total={totalRequirements}
            />
          );
        }
        const quiz = getPracticeQuiz(controlId);
        if (quiz) {
          return (
            <PracticeQuiz
              assessmentId={id}
              controlId={controlId}
              practice={practiceForClient}
              quiz={quiz}
              connectedProviders={connectedProviders}
              evidence={evidenceForClient}
              prevId={prevId}
              nextId={nextId}
              currentIdx={displayIdx}
              total={totalRequirements}
              saveResponseAction={saveControlResponseAction}
              uploadEvidenceAction={uploadEvidenceAction}
              submitVaultEntryAction={submitVaultEntryAction}
              reReviewEvidenceAction={reReviewEvidenceAction}
              useSuggestedNarrativeAction={useSuggestedNarrativeAction}
            />
          );
        }
        return (
          <PracticeWizard
            assessmentId={id}
            controlId={controlId}
            practice={practiceForClient}
            objectives={getObjectives(controlId)}
            response={response}
            evidence={evidenceForClient}
            remediationPlan={remediationPlan}
            suggestedNa={suggestedNaJustification(controlId)}
            prevId={prevId}
            nextId={nextId}
            currentIdx={displayIdx}
            total={totalRequirements}
            reuseCandidates={reuseForClient}
            saveResponseAction={saveControlResponseAction}
            uploadEvidenceAction={uploadEvidenceAction}
            deleteEvidenceAction={deleteEvidenceAction}
            reReviewEvidenceAction={reReviewEvidenceAction}
            tagArtifactPracticeAction={tagArtifactPracticeAction}
            untagArtifactPracticeAction={untagArtifactPracticeAction}
            markEvidenceAsFinalAction={markEvidenceAsFinalAction}
            setEvidenceMethodAction={setEvidenceMethodAction}
            useSuggestedNarrativeAction={useSuggestedNarrativeAction}
            upsertRemediationPlanAction={upsertRemediationPlanAction}
          />
        );
      })()}
    </main>
  );
}
