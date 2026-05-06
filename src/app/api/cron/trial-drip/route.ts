import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { dispatchTrialDripDue } from "@/lib/email/trial-drip";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — fires the next due step of the 14-day trial drip for every
 * org whose `created_at` lands on a step's day-offset window. Idempotent
 * via `trial_drip_sends`. See src/lib/email/trial-drip.ts.
 *
 * Schedule: once per day. Time-of-day is set in vercel.json — picked to
 * land inside U.S. business hours so the day-12 / day-13 conversion
 * pushes hit inboxes when the user is at their desk, not at 3am.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "trial-drip",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();
  const result = await dispatchTrialDripDue();

  return NextResponse.json({
    ok: true,
    attempted: result.attempted,
    sent: result.sent.length,
    skipped: result.skipped.length,
    detail: result,
  });
}
