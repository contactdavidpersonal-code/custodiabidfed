"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  isFullyCovered,
  lockPractice,
  resetIntakeAnswers,
  saveIntakeAnswers,
  saveIntakeStep,
  autoStageAttestationsForControl,
  verifyPracticeObjectives,
  type ChatMessage,
  type ObjectiveVerdict,
} from "@/lib/cmmc/practice-chat";
import {
  getPracticeSpec,
  isIntakeComplete,
  type IntakeAnswers,
} from "@/lib/cmmc/practice-spec";

/**
 * Lock the practice as MET. Re-verifies the objectives server-side (don't
 * trust the client), checks that every required objective is covered, then
 * sets control_responses.status = 'yes' with a generated narrative summary
 * derived from the chat transcript and stamps practice_conversations.locked_at.
 *
 * If any objective is not covered, returns the current verdict map without
 * locking — the client surfaces the gap.
 */
export async function lockPracticeAction(args: {
  assessmentId: string;
  controlId: string;
}): Promise<{
  ok: boolean;
  reason?: string;
  objectiveVerdicts?: Record<string, ObjectiveVerdict>;
}> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Unauthorized" };

  const spec = getPracticeSpec(args.controlId);
  if (!spec) return { ok: false, reason: "Practice not in hybrid flow" };

  const ctx = await getAssessmentForUser(args.assessmentId, userId);
  if (!ctx) return { ok: false, reason: "Assessment not found" };

  // Server-side re-verification gate. Client cannot bypass.
  const verdicts = await verifyPracticeObjectives({
    assessmentId: args.assessmentId,
    controlId: args.controlId,
  });
  if (!isFullyCovered(verdicts, spec)) {
    return {
      ok: false,
      reason: "Not every assessment objective is covered yet.",
      objectiveVerdicts: verdicts,
    };
  }

  const narrative = await buildNarrativeFromChat({
    assessmentId: args.assessmentId,
    controlId: args.controlId,
    spec,
    verdicts,
    orgName: ctx.organization.name,
  });

  const sql = getSql();
  await sql`
    UPDATE control_responses
    SET status = 'yes',
        narrative = ${narrative},
        updated_at = NOW()
    WHERE assessment_id = ${args.assessmentId} AND control_id = ${args.controlId}
  `;
  await lockPractice(args.assessmentId, args.controlId);

  revalidatePath(`/assessments/${args.assessmentId}`);
  revalidatePath(`/assessments/${args.assessmentId}/controls/${args.controlId}`);
  return { ok: true, objectiveVerdicts: verdicts };
}

async function buildNarrativeFromChat(args: {
  assessmentId: string;
  controlId: string;
  spec: ReturnType<typeof getPracticeSpec>;
  verdicts: Record<string, ObjectiveVerdict>;
  orgName: string;
}): Promise<string> {
  const sql = getSql();
  const rows = (await sql`
    SELECT messages, intake_answers, intake_completed_at FROM practice_conversations
    WHERE assessment_id = ${args.assessmentId} AND control_id = ${args.controlId}
    LIMIT 1
  `) as Array<{
    messages: ChatMessage[];
    intake_answers: IntakeAnswers | null;
    intake_completed_at: string | null;
  }>;
  const messages = rows[0]?.messages ?? [];
  const intakeAnswers = rows[0]?.intake_answers ?? null;
  const intakeCompletedAt = rows[0]?.intake_completed_at ?? null;
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => `- ${m.text}`)
    .join("\n");
  const objectiveLines = args.spec
    ? args.spec.objectives
        .map((o) => {
          const v = args.verdicts[o.letter];
          return `[${o.letter}] ${o.text} — ${v?.status ?? "missing"}: ${v?.reason ?? ""}`;
        })
        .join("\n")
    : "";

  // Render the intake answers verbatim. The assessor sees exactly which
  // question was asked, the citation, the user's answer, and the date —
  // it's the audit trail for the personalization decisions the platform
  // made on the user's behalf.
  let intakeBlock = "";
  if (args.spec?.intake && intakeAnswers && isIntakeComplete(args.spec, intakeAnswers)) {
    const personalization = args.spec.intake.personalize(intakeAnswers);
    const lines: string[] = [
      `Pre-interview captured ${intakeCompletedAt ? `on ${intakeCompletedAt}` : ""}:`,
      personalization.situationSummary,
      ``,
      `Intake questions and answers (each question is grounded in NIST 800-171A or the CMMC L1 Self-Assessment Guide):`,
    ];
    for (const q of args.spec.intake.questions) {
      const ans = intakeAnswers[q.id];
      const opt = q.options.find((o) => o.value === ans);
      lines.push(
        `- ${q.regAnchor}`,
        `  Q: ${q.prompt}`,
        `  A: ${opt?.label ?? ans}`,
      );
    }
    intakeBlock = lines.join("\n") + "\n\n";
  }

  return [
    `${args.orgName} implements ${args.spec?.controlId} — ${args.spec?.shortName}.`,
    ``,
    `Practice statement: ${args.spec?.statement}`,
    ``,
    intakeBlock +
      `How we satisfy each NIST 800-171A assessment objective:`,
    objectiveLines,
    ``,
    `Captured during the guided assessment chat. User-described facts:`,
    userMessages,
  ].join("\n");
}

/**
 * Persist a SINGLE intake answer during the guided quiz flow. Tenant-checked,
 * validates the value against the question's allowed options, merges into
 * intake_answers JSONB without stamping completion. The completion stamp +
 * Charlie kickoff + auto-attestation only happen on the final saveIntakeAction.
 *
 * The page is NOT revalidated here — incremental saves are background-grade
 * persistence so a refresh restores quiz position without losing answers.
 * Full revalidation happens once at quiz finish.
 */
export async function saveIntakeStepAction(args: {
  assessmentId: string;
  controlId: string;
  questionId: string;
  value: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Unauthorized" };

  const spec = getPracticeSpec(args.controlId);
  if (!spec?.intake) {
    return { ok: false, reason: "This practice does not have an intake." };
  }
  const question = spec.intake.questions.find((q) => q.id === args.questionId);
  if (!question) {
    return { ok: false, reason: "Unknown question." };
  }
  const validValue = question.options.some((o) => o.value === args.value);
  if (!validValue) {
    return { ok: false, reason: "Invalid answer for this question." };
  }

  const ctx = await getAssessmentForUser(args.assessmentId, userId);
  if (!ctx) return { ok: false, reason: "Assessment not found" };

  await saveIntakeStep(args.assessmentId, args.controlId, args.questionId, args.value);
  return { ok: true };
}

/**
 * Save the per-practice intake answers. Tenant-scoped; re-runs the verifier
 * after save so any attestation-derived evidence credits its objective
 * immediately. Returns { ok, situationSummary? } so the client can render
 * the personalized summary card on success.
 */
export async function saveIntakeAction(args: {
  assessmentId: string;
  controlId: string;
  answers: IntakeAnswers;
}): Promise<{ ok: boolean; reason?: string; situationSummary?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Unauthorized" };

  const spec = getPracticeSpec(args.controlId);
  if (!spec?.intake) {
    return { ok: false, reason: "This practice does not have an intake." };
  }

  // Validate that every question has an answer that's one of the allowed
  // option values. Do NOT trust the client to send a clean payload.
  const cleaned: IntakeAnswers = {};
  for (const q of spec.intake.questions) {
    const ans = args.answers[q.id];
    if (typeof ans !== "string") {
      return { ok: false, reason: `Missing answer for "${q.prompt}"` };
    }
    const valid = q.options.some((o) => o.value === ans);
    if (!valid) {
      return { ok: false, reason: `Invalid answer for "${q.prompt}"` };
    }
    cleaned[q.id] = ans;
  }

  const ctx = await getAssessmentForUser(args.assessmentId, userId);
  if (!ctx) return { ok: false, reason: "Assessment not found" };

  await saveIntakeAnswers(args.assessmentId, args.controlId, cleaned);
  // Auto-stage intake-derived attestations. Under the single-signature
  // model, the user only signs once on the final Sign & Affirm page — but
  // any objective satisfied by a factual environment affirmation gets
  // stamped here so the slot covers immediately and the user can see
  // forward motion on the practice page.
  try {
    await autoStageAttestationsForControl({
      assessmentId: args.assessmentId,
      controlId: args.controlId,
      userId,
      answers: cleaned,
    });
  } catch (err) {
    console.warn("auto-stage attestations failed", err);
  }
  // Re-verify objectives so any environment-based evidence (e.g. existing
  // uploads tagged from before intake) gets re-scored with the personalized
  // slot list. Best-effort: don't fail the action if grading misfires.
  try {
    await verifyPracticeObjectives({
      assessmentId: args.assessmentId,
      controlId: args.controlId,
    });
  } catch {
    // Grading is a nice-to-have on intake save; the user can re-grade manually.
  }

  const personalization = spec.intake.personalize(cleaned);
  revalidatePath(`/assessments/${args.assessmentId}`);
  revalidatePath(`/assessments/${args.assessmentId}/controls/${args.controlId}`);
  return { ok: true, situationSummary: personalization.situationSummary };
}

/**
 * Clear the per-practice intake. The conversation transcript and any
 * uploaded evidence are preserved — only the intake answers + completed-at
 * stamp are reset, so the user can re-answer.
 */
export async function resetIntakeAction(args: {
  assessmentId: string;
  controlId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Unauthorized" };

  const ctx = await getAssessmentForUser(args.assessmentId, userId);
  if (!ctx) return { ok: false, reason: "Assessment not found" };

  await resetIntakeAnswers(args.assessmentId, args.controlId);
  revalidatePath(`/assessments/${args.assessmentId}`);
  revalidatePath(`/assessments/${args.assessmentId}/controls/${args.controlId}`);
  return { ok: true };
}

/**
 * Hard reset a single practice back to a clean slate so the user can
 * re-walk it from scratch and verify the flow end-to-end.
 *
 * What gets wiped (scoped to this assessment_id + control_id only):
 *   - All evidence artifacts (rows + join-table tags)
 *   - All chat messages with Charlie
 *   - Intake answers + intake_completed_at
 *   - Objective verdicts
 *   - locked_at (the practice un-locks)
 *   - control_responses row (status returns to 'unanswered')
 *   - Any remediation plans on this practice
 *   - Active practice_affirmations rows are marked superseded
 *
 * Note: the practice_conversations row itself is kept (its `id` keeps
 * referential integrity for older affirmation rows). Its contents are
 * zeroed out — fresh slate the next time the user opens the page.
 *
 * Locked or unlocked: this action works either way. Once Sign & Affirm
 * has been signed at the assessment level, signing again is required
 * before the SPRS packet renders.
 */
export async function hardResetPracticeAction(args: {
  assessmentId: string;
  controlId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Unauthorized" };

  const ctx = await getAssessmentForUser(args.assessmentId, userId);
  if (!ctx) return { ok: false, reason: "Assessment not found" };

  const sql = getSql();
  const { assessmentId, controlId } = args;

  // 1. Evidence join-table rows (must come before the artifact deletes so
  //    we don't depend on cascade ordering in edge cases).
  await sql`
    DELETE FROM evidence_artifact_practices
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
  // 2. Evidence artifacts themselves. The legacy single-control column
  //    decides ownership; cross-tagged copies remain owned by their
  //    primary control.
  await sql`
    DELETE FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
  // 3. Wipe the conversation: messages, intake, verdicts, lock state.
  await sql`
    UPDATE practice_conversations
    SET messages = '[]'::jsonb,
        intake_answers = NULL,
        intake_completed_at = NULL,
        objective_verdicts = '{}'::jsonb,
        verdict_updated_at = NOW(),
        locked_at = NULL,
        updated_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
  // 4. Wipe the SSP narrative + status for this control. We UPSERT rather
  //    than DELETE because the control page loader (`getResponse`) calls
  //    notFound() when the row is missing — the row must persist for the
  //    page to render. INSERT ... ON CONFLICT also self-heals any
  //    previously-broken assessments where a prior bad-reset DELETEd the
  //    row (those pages were 404'ing until this re-creates the row).
  await sql`
    INSERT INTO control_responses (assessment_id, control_id, status)
    VALUES (${assessmentId}, ${controlId}, 'unanswered')
    ON CONFLICT (assessment_id, control_id) DO UPDATE
    SET status = 'unanswered',
        narrative = NULL,
        officer_reviewed = FALSE,
        officer_reviewed_at = NULL,
        officer_reviewer_user_id = NULL,
        carry_forward_status = 'kept',
        updated_at = NOW()
  `;
  // 5. Clear any open POA&M / remediation plan for this practice.
  await sql`
    DELETE FROM remediation_plans
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
  // 6. Supersede any prior signed affirmation rows so the bid-packet gate
  //    forces a fresh signature once the user re-walks the practice.
  await sql`
    UPDATE practice_affirmations
    SET superseded_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
      AND superseded_at IS NULL
  `;

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
  revalidatePath(`/assessments/${assessmentId}/bid-packet`);
  return { ok: true };
}
