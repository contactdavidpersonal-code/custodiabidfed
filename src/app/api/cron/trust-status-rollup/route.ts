import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";
import { recomputeAllPublishedTrustStatuses } from "@/lib/trust-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hourly cron — recomputes the trust-status snapshot for every org with a
 * published Verified page. Keeps the public health pill ("Healthy / Drift /
 * Action required") accurate even when no connector poll has fired since the
 * last visit. Synchronous recompute is also triggered by connector sync,
 * evidence freshness scan, drift open/resolve, and SPRS filing.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "trust-status-rollup",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await initDb();
  const result = await recomputeAllPublishedTrustStatuses();
  return NextResponse.json({ ok: true, ...result });
}
