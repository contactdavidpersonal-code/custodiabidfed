import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { renderBidPackageForAssessment } from "@/lib/cmmc/deliverables";
import { getAssessmentForUser, listEvidenceForControl } from "@/lib/assessment";
import { getSql } from "@/lib/db";
import { getStaleAffirmations } from "@/lib/cmmc/affirmation";
import { practiceSpecs } from "@/lib/cmmc/practice-spec";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bid-ready package export. Bundles SSP + affirmation memo + CSV inventories
 * + every evidence artifact organized by control into a single ZIP. Gated on
 * attested status — pass ?draft=1 for an unsigned preview. All rendering
 * lives in src/lib/cmmc/deliverables.ts; this route owns auth + audit only.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await context.params;

  // Tenant-scope check up front so we can return 404 before doing the
  // expensive render, AND so the audit-log error path knows the org.
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) {
    return new NextResponse("Not found", { status: 404 });
  }

  const forceDraft =
    new URL(req.url).searchParams.get("draft") === "1";
  if (ctx.assessment.status !== "attested" && !forceDraft) {
    return new NextResponse(
      "Assessment not attested. Add ?draft=1 to download an unsigned preview.",
      { status: 409 },
    );
  }

  // Per-practice signed-affirmation gate. Each chat-spec practice carries
  // a tamper-evident hash of (intake answers + verdicts + evidence). If
  // any practice is unsigned or its hash has drifted since signing, we
  // refuse to render the live packet — the user must re-affirm. Draft
  // exports bypass this so users can preview before signing.
  if (!forceDraft) {
    const sql = getSql();
    const convRows = (await sql`
      SELECT control_id, intake_answers, objective_verdicts
      FROM practice_conversations
      WHERE assessment_id = ${id}
    `) as Array<{
      control_id: string;
      intake_answers: Record<string, string> | null;
      objective_verdicts: Record<string, ObjectiveVerdict> | null;
    }>;
    const chatControlIds = new Set(Object.keys(practiceSpecs));
    const practicesForGate = await Promise.all(
      convRows
        .filter((r) => chatControlIds.has(r.control_id))
        .map(async (r) => {
          const evidence = await listEvidenceForControl(id, r.control_id);
          return {
            controlId: r.control_id,
            intakeAnswers: r.intake_answers,
            verdicts: r.objective_verdicts,
            evidenceIds: evidence.map((e) => e.id),
          };
        }),
    );
    const stale = await getStaleAffirmations({
      assessmentId: id,
      practices: practicesForGate,
    });
    if (stale.length > 0) {
      return new NextResponse(
        JSON.stringify({
          error: "stale_affirmations",
          message:
            "One or more practices need to be (re-)affirmed before the bid packet can render. Visit each practice page and sign the current snapshot.",
          stale,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const rendered = await renderBidPackageForAssessment(id, userId, {
    draft: forceDraft,
    includeEvidenceBinaries: true,
  });
  if (!rendered) {
    // Race: assessment vanished between auth check and render. Treat as 404.
    return new NextResponse("Not found", { status: 404 });
  }

  // Audit every export. The bid-package contains the full SSP, every
  // narrative, and every evidence file — it's the most concentrated form
  // of org-sensitive data we produce. Track who pulls it and when.
  const auditCtx = auditContextFromRequest(req);
  await recordAuditEvent({
    action: "bid_package.exported",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "assessment",
    resourceId: id,
    ip: auditCtx.ip,
    userAgent: auditCtx.userAgent,
    metadata: {
      draft: forceDraft,
      attested: ctx.assessment.status === "attested",
      evidenceCount: rendered.evidenceCount,
      sizeBytes: rendered.buffer.length,
    },
  });

  return new NextResponse(rendered.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${rendered.filename}"`,
      "Content-Length": String(rendered.buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
