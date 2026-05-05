import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAssessmentForUser } from "@/lib/assessment";
import { verifyPracticeObjectives } from "@/lib/cmmc/practice-chat";
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";
import { ensureDbReady } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; controlId: string }> };

/**
 * Re-grade every objective letter for this practice. Called by the client
 * after evidence uploads / deletions, or on demand. Returns the same
 * verdict map shape as the chat POST response.
 */
export async function POST(_req: Request, context: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDbReady();

  const { id, controlId } = await context.params;
  const spec = getPracticeSpec(controlId);
  if (!spec) return new NextResponse("Practice not in hybrid flow", { status: 404 });

  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const verdicts = await verifyPracticeObjectives({
    assessmentId: id,
    controlId,
  });
  return NextResponse.json({ objectiveVerdicts: verdicts });
}
