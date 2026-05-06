import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  getOrCreatePracticeConversation,
  runPracticeTurn,
  verifyPracticeObjectives,
} from "@/lib/cmmc/practice-chat";
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";
import { ensureDbReady } from "@/lib/db";
import { enforceCharlieBudget } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LEN = 8_000;

type Params = { params: Promise<{ id: string; controlId: string }> };

export async function GET(_req: Request, context: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDbReady();

  const { id, controlId } = await context.params;
  const spec = getPracticeSpec(controlId);
  if (!spec) return new NextResponse("Practice not in hybrid flow", { status: 404 });

  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const conv = await getOrCreatePracticeConversation(id, controlId);
  return NextResponse.json({
    messages: conv.messages,
    objectiveVerdicts: conv.objective_verdicts,
    locked: !!conv.locked_at,
  });
}

export async function POST(req: Request, context: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDbReady();

  const { id, controlId } = await context.params;
  const spec = getPracticeSpec(controlId);
  if (!spec) return new NextResponse("Practice not in hybrid flow", { status: 404 });

  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const blocked = await enforceCharlieBudget({ scope: "practice-chat", userId });
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim();
  if (!message) return new NextResponse("Empty message", { status: 400 });
  if (message.length > MAX_MESSAGE_LEN)
    return new NextResponse("Message too long", { status: 413 });

  const { assistantText } = await runPracticeTurn({
    assessmentId: id,
    controlId,
    userMessage: message,
  });

  // Refresh the objective verdicts after each turn. Best-effort: a failure
  // here should not break the chat reply.
  let objectiveVerdicts: Record<string, unknown> = {};
  try {
    objectiveVerdicts = await verifyPracticeObjectives({
      assessmentId: id,
      controlId,
    });
  } catch (err) {
    console.warn("verifyPracticeObjectives failed", err);
  }

  return NextResponse.json({ assistantText, objectiveVerdicts });
}
