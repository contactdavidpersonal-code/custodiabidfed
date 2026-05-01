import { NextResponse } from "next/server";
import { verifyCronSecret, clientIpFromRequest } from "@/lib/security/cron";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { runDueTasks } from "@/lib/scheduler";

// Side-effect import: registers all task handlers so the scheduler
// knows what to do when it picks up a row.
import "@/lib/scheduler/handlers";

/**
 * Generic per-customer task scheduler tick. Runs every 5 minutes via
 * vercel.json. Pulls every due row from `scheduled_tasks`, runs the
 * registered handler, and reschedules / retries.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    await recordAuditEvent({
      action: "cron.unauthorized",
      ip: clientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") ?? null,
      metadata: { route: "scheduler" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueTasks({ limit: 25 });
  await recordAuditEvent({
    action: "cron.executed",
    ip: clientIpFromRequest(req),
    metadata: { route: "scheduler", ...result },
  });
  return NextResponse.json({ ok: true, ...result });
}
