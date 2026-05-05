"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  isFullyCovered,
  lockPractice,
  verifyPracticeObjectives,
  type ChatMessage,
  type ObjectiveVerdict,
} from "@/lib/cmmc/practice-chat";
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";

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
    SELECT messages FROM practice_conversations
    WHERE assessment_id = ${args.assessmentId} AND control_id = ${args.controlId}
    LIMIT 1
  `) as Array<{ messages: ChatMessage[] }>;
  const messages = rows[0]?.messages ?? [];
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

  return [
    `${args.orgName} implements ${args.spec?.controlId} — ${args.spec?.shortName}.`,
    ``,
    `Practice statement: ${args.spec?.statement}`,
    ``,
    `How we satisfy each NIST 800-171A assessment objective:`,
    objectiveLines,
    ``,
    `Captured during the guided assessment chat. User-described facts:`,
    userMessages,
  ].join("\n");
}
