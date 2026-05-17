import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";
import { resolveOwnerEmail } from "@/lib/email/freshness";
import {
  sendSprsRenewalReminderEmail,
  type RenewalReminderWindow,
} from "@/lib/email/sprs-renewal-reminder";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — emails the senior official (or the org owner as fallback) at
 * the 60-, 30-, and 14-day marks before their annual CMMC Level 1
 * affirmation expires.
 *
 * Window definition: CMMC Level 1 affirmation is annual under 32 CFR
 * § 170.22(a). We anchor the renewal date to `sprs_filed_at + 365 days`
 * (the CMMC Status Date recorded in SPRS is the authoritative timestamp).
 * For each attested assessment, we email if
 *   floor((due_date - now) / 1 day) ∈ {60, 30, 14}
 * with a ±1-day grace window so a missed daily run still catches the user.
 *
 * Idempotency: we dedupe against `audit_log` — before sending, we check
 * whether a `renewal_reminder.sent` row with the same assessment + window
 * already exists. The audit row is written after a successful send, so
 * Resend hiccups can be retried by the next daily run.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "sprs-renewal-reminders",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await initDb();

  const sql = getSql();
  const workspaceUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://bidfedcmmc.com";

  // Pull attested assessments with a SPRS filing that lands in one of our
  // three windows. We treat 60/30/14 ± 1 day as the catch zone so a missed
  // daily run still fires the reminder.
  // We compute the integer day-distance in JS to keep the SQL portable.
  const rows = (await sql`
    SELECT a.id AS assessment_id,
           a.organization_id,
           a.sprs_filed_at,
           a.affirming_official_email,
           a.affirmed_by_name,
           o.name AS org_name,
           o.owner_user_id
    FROM assessments a
    JOIN organizations o ON o.id = a.organization_id
    WHERE a.status = 'attested'
      AND a.sprs_filed_at IS NOT NULL
      AND a.sprs_filed_at >= NOW() - INTERVAL '420 days'
      AND a.sprs_filed_at <= NOW() - INTERVAL '290 days'
  `) as Array<{
    assessment_id: string;
    organization_id: string;
    sprs_filed_at: string;
    affirming_official_email: string | null;
    affirmed_by_name: string | null;
    org_name: string;
    owner_user_id: string | null;
  }>;

  const targetWindows: RenewalReminderWindow[] = [60, 30, 14];
  const now = Date.now();
  let sent = 0;
  const skipped: Array<{ assessment: string; reason: string }> = [];

  for (const r of rows) {
    const filedAt = new Date(r.sprs_filed_at);
    const dueAt = new Date(filedAt.getTime() + 365 * 86400_000);
    const daysRemaining = Math.round((dueAt.getTime() - now) / 86400_000);

    // Find the nearest exact-window match within ±1 day.
    const window = targetWindows.find(
      (w) => Math.abs(daysRemaining - w) <= 1,
    );
    if (!window) continue;

    // Dedupe — has this exact (assessment, window) reminder already fired?
    const existing = (await sql`
      SELECT 1
      FROM audit_log
      WHERE action = 'renewal_reminder.sent'
        AND resource_type = 'assessment'
        AND resource_id = ${r.assessment_id}
        AND metadata @> ${JSON.stringify({ window })}::jsonb
      LIMIT 1
    `) as Array<{ "?column?": number }>;
    if (existing.length > 0) {
      skipped.push({ assessment: r.assessment_id, reason: `already_sent_${window}d` });
      continue;
    }

    // Recipient: prefer the AO email on the assessment; fall back to the
    // org owner. If neither is resolvable, skip and audit a no-recipient row
    // so support can chase it.
    let toEmail = r.affirming_official_email ?? null;
    let firstName: string | null = r.affirmed_by_name ?? null;
    if (!toEmail && r.owner_user_id) {
      const owner = await resolveOwnerEmail(r.owner_user_id);
      if (owner) {
        toEmail = owner.email;
        firstName = firstName ?? owner.firstName;
      }
    }
    if (!toEmail) {
      skipped.push({ assessment: r.assessment_id, reason: "no_recipient" });
      continue;
    }

    try {
      await sendSprsRenewalReminderEmail({
        toEmail,
        firstName,
        organizationName: r.org_name,
        lastFiledAt: filedAt,
        dueDate: dueAt,
        daysRemaining: window,
        workspaceUrl,
        assessmentId: r.assessment_id,
      });
      await recordAuditEvent({
        action: "renewal_reminder.sent",
        organizationId: r.organization_id,
        resourceType: "assessment",
        resourceId: r.assessment_id,
        metadata: {
          window,
          daysRemaining,
          dueAt: dueAt.toISOString(),
          toEmail,
        },
      });
      sent += 1;
    } catch (err) {
      console.error(
        `[sprs-renewal-reminders] assessment ${r.assessment_id} window ${window}d failed:`,
        err,
      );
      skipped.push({
        assessment: r.assessment_id,
        reason: err instanceof Error ? err.message : "send_failed",
      });
    }
  }

  await recordAuditEvent({
    action: "cron.executed",
    resourceType: "cron",
    resourceId: "sprs-renewal-reminders",
    metadata: { sent, scanned: rows.length, skipped: skipped.length },
  });

  return NextResponse.json({ sent, scanned: rows.length, skipped });
}
