import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { auditContextFromRequest, recordAuditEvent } from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — purges `audit_log` rows older than the federal retention
 * floor. FAR 4.703(a) requires contractors to retain records "involving
 * transactions related to the contract" for 3 years after final payment;
 * DFARS 252.204-7012(b)(3)(ii) extends the audit-trail retention requirement
 * for covered-defense-information incidents to 6 years; and 32 CFR
 * § 170.17(c)(2) ties CMMC affirmation records to the same 6-year window.
 * We pick the longest applicable floor — 6 years — and prune anything
 * older so the audit table doesn't grow unbounded while staying compliant.
 *
 * Pruning happens in capped batches (50k rows per run) so a never-pruned
 * legacy table doesn't blow up the cron execution budget. Steady-state, this
 * will purge zero or a handful of rows per day.
 */
const RETENTION_DAYS = 6 * 365 + 2; // 6 years incl. 2 leap days = 2192 days
const BATCH_LIMIT = 50_000;

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "audit-retention",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await initDb();
  const sql = getSql();

  const deleted = (await sql`
    WITH stale AS (
      SELECT id
      FROM audit_log
      WHERE created_at < NOW() - (${RETENTION_DAYS} || ' days')::interval
      ORDER BY created_at ASC
      LIMIT ${BATCH_LIMIT}
    )
    DELETE FROM audit_log
    WHERE id IN (SELECT id FROM stale)
    RETURNING id
  `) as Array<{ id: string }>;

  await recordAuditEvent({
    action: "cron.audit_retention.purged",
    resourceType: "cron",
    resourceId: "audit-retention",
    metadata: {
      deleted_count: deleted.length,
      retention_days: RETENTION_DAYS,
      batch_capped: deleted.length === BATCH_LIMIT,
    },
  });

  return NextResponse.json({
    deleted: deleted.length,
    retention_days: RETENTION_DAYS,
    batch_capped: deleted.length === BATCH_LIMIT,
  });
}
