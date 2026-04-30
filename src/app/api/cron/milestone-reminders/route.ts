import { NextResponse } from "next/server";
import {
  appendMessage,
  getOrCreateWorkspaceConversation,
} from "@/lib/ai/conversations";
import { initDb } from "@/lib/db";
import {
  daysUntil,
  dueRemindersAcrossOrgs,
  markMilestonesReminded,
  type MilestoneRow,
} from "@/lib/fiscal";
import { auditContextFromRequest, recordAuditEvent } from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron. For each org with upcoming (≤14d) or overdue milestones that
 * haven't been reminded in the last 6 days, posts a single consolidated
 * assistant message into the workspace conversation so the officer rail
 * surfaces it the next time the user opens the app.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "milestone-reminders",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();
  const groups = await dueRemindersAcrossOrgs();

  const posted: Array<{
    organization_id: string;
    milestone_count: number;
  }> = [];

  for (const group of groups) {
    try {
      const conv = await getOrCreateWorkspaceConversation(group.organization_id);
      const text = buildReminderText(group.milestones);
      await appendMessage({
        conversationId: conv.id,
        role: "assistant",
        content: [{ type: "text", text }],
        model: "system:reminder-cron",
        stopReason: "end_turn",
      });
      await markMilestonesReminded(group.milestones.map((m) => m.id));
      posted.push({
        organization_id: group.organization_id,
        milestone_count: group.milestones.length,
      });
    } catch (err) {
      console.error(
        `[milestone-reminders] failed for org ${group.organization_id}:`,
        err,
      );
    }
  }

  return NextResponse.json({ posted });
}

function buildReminderText(milestones: MilestoneRow[]): string {
  const overdue = milestones.filter((m) => daysUntil(m.due_date) < 0);
  const soon = milestones.filter((m) => {
    const d = daysUntil(m.due_date);
    return d >= 0 && d <= 14;
  });

  const lines: string[] = [];
  if (overdue.length > 0) {
    lines.push(
      `Heads up — ${overdue.length} milestone${overdue.length === 1 ? " is" : "s are"} overdue:`,
    );
    for (const m of overdue) {
      const d = Math.abs(daysUntil(m.due_date));
      lines.push(`• ${m.title} — ${d} day${d === 1 ? "" : "s"} past due`);
    }
    if (soon.length > 0) lines.push("");
  }
  if (soon.length > 0) {
    lines.push(
      `Coming up in the next two weeks:`,
    );
    for (const m of soon) {
      const d = daysUntil(m.due_date);
      lines.push(
        `• ${m.title} — ${d === 0 ? "due today" : `${d} day${d === 1 ? "" : "s"} out`}`,
      );
    }
  }
  lines.push("");
  lines.push(
    "Want me to pick one to work through right now, or snooze what's not urgent?",
  );
  return lines.join("\n");
}
