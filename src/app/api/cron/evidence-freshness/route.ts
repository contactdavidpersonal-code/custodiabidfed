import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  dueFreshnessNotifications,
  groupByOrg,
  markFreshnessNotified,
} from "@/lib/freshness";
import {
  resolveOwnerEmail,
  sendFreshnessDigest,
} from "@/lib/email/freshness";
import { auditContextFromRequest, recordAuditEvent } from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron — emails each org owner a digest of evidence artifacts that are
 * either overdue or expiring within 30 days, debounced to once every 6 days
 * per artifact. The retention pillar of the platform: an org that cancels
 * watches its packet rot, fast.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "evidence-freshness",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await initDb();

  const rows = await dueFreshnessNotifications();
  if (rows.length === 0) {
    return NextResponse.json({ sent: 0, orgs: 0 });
  }
  const groups = groupByOrg(rows);
  const workspaceUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://bidfedcmmc.com";

  let sent = 0;
  const skipped: Array<{ org: string; reason: string }> = [];
  for (const g of groups) {
    try {
      const owner = await resolveOwnerEmail(g.owner_user_id);
      if (!owner) {
        skipped.push({ org: g.organization_id, reason: "no_email" });
        continue;
      }
      await sendFreshnessDigest({
        toEmail: owner.email,
        firstName: owner.firstName,
        orgName: g.org_name,
        rows: g.rows,
        workspaceUrl,
      });
      await markFreshnessNotified(g.rows.map((r) => r.id));
      sent += 1;
    } catch (err) {
      console.error(
        `[evidence-freshness] org ${g.organization_id} failed:`,
        err,
      );
      skipped.push({
        org: g.organization_id,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ sent, orgs: groups.length, skipped });
}
