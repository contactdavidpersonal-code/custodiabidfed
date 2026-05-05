import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  appendPracticeMessages,
  getOrCreatePracticeConversation,
  verifyPracticeObjectives,
} from "@/lib/cmmc/practice-chat";
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";
import { ensureDbReady } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; controlId: string }> };

/**
 * Mirror a Charlie turn into the practice-scoped transcript and re-grade.
 * Called by ComplianceOfficerRail after a stream completes while the user
 * is on a /assessments/:id/controls/:controlId page that has a hybrid spec.
 *
 * Idempotent on duplicate calls within ~ms (no-op if the latest pair already
 * matches). No-ops entirely if the practice has no spec.
 */
export async function POST(req: Request, context: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDbReady();

  const { id, controlId } = await context.params;
  const spec = getPracticeSpec(controlId);
  if (!spec) return NextResponse.json({ skipped: true });

  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    userMessage?: string;
    assistantText?: string;
  };
  const userMessage = (body.userMessage ?? "").trim();
  const assistantText = (body.assistantText ?? "").trim();
  if (!userMessage && !assistantText) {
    return NextResponse.json({ skipped: true });
  }

  // Seed the conversation row if needed, then append the new turn.
  const conv = await getOrCreatePracticeConversation(id, controlId);
  const last = conv.messages[conv.messages.length - 1];
  const lastIsAssistant = last?.role === "assistant";
  const lastText = (last?.text ?? "").trim();
  // If the most recent message is the same assistant text we'd append, skip.
  if (lastIsAssistant && lastText === assistantText && !userMessage) {
    return NextResponse.json({ skipped: true });
  }

  const now = new Date().toISOString();
  const toAppend = [];
  if (userMessage) toAppend.push({ role: "user" as const, text: userMessage, at: now });
  if (assistantText)
    toAppend.push({ role: "assistant" as const, text: assistantText, at: now });
  if (toAppend.length > 0) {
    await appendPracticeMessages(id, controlId, toAppend);
  }

  let objectiveVerdicts: Record<string, unknown> = {};
  try {
    objectiveVerdicts = await verifyPracticeObjectives({
      assessmentId: id,
      controlId,
    });
  } catch (err) {
    console.warn("verifyPracticeObjectives (sync) failed", err);
  }
  return NextResponse.json({ ok: true, objectiveVerdicts });
}
