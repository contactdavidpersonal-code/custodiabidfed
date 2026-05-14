import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { renderBidPackageForAssessment } from "@/lib/cmmc/deliverables";
import { getAssessmentForUser } from "@/lib/assessment";
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
