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
