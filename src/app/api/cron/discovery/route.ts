import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { runDiscovery } from "@/lib/outbound/discovery-pipeline";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Daily discovery cron — agent fetches 10 fresh DoD-prime CMMC L1 leads
 * every morning at 12:30 UTC (8:30 ET). Idempotent via the prospects
 * unique index on (company_name, COALESCE(domain,'')).
 *
 * Skipped silently if HUNTER_API_KEY isn't set so dev/preview don't
 * burn credits.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "discovery",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: true,
      skipped_reason: "ANTHROPIC_API_KEY not set (AI review required)",
    });
  }
  await initDb();
  const result = await runDiscovery(10, "cron");
  return NextResponse.json({
    ok: result.ok,
    aiKept: result.ai.kept,
    prospectsWritten: result.prospects.written,
    contactsWritten: result.enrichment.contactsWritten,
    awardsFetched: result.awards.fetched,
    pagesScanned: result.awards.pagesScanned,
    durationMs: result.durationMs,
    error: result.awards.error ?? result.ai.error ?? result.enrichment.error,
  });
}
