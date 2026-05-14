import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getAssessmentForUser,
  listEvidenceForControl,
} from "@/lib/assessment";
import { ensureDbReady } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; controlId: string }> };

/**
 * Returns the live evidence list for a single practice. PracticeChat hits
 * this immediately after a Charlie tool call (`evidence-changed` event) so
 * the slot cards fill in without waiting for a full RSC refresh. Strips the
 * raw blob URL — clients fetch artifact bytes through `/api/evidence/{id}`,
 * which performs its own per-request auth + tenant + audit pass.
 */
export async function GET(_req: Request, context: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  await ensureDbReady();

  const { id, controlId } = await context.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const rows = await listEvidenceForControl(id, controlId);
  const evidence = rows.map((row) => {
    const { blob_url: _blobUrl, ...rest } = row;
    void _blobUrl;
    return rest;
  });
  return NextResponse.json({ evidence });
}
