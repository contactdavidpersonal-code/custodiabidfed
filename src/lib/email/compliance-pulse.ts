/**
 * Weekly Compliance Pulse — the dashboard, in your inbox.
 *
 * Renders a green/yellow/red status email summarizing:
 *   - assessment status (in-progress, signed, expiring soon)
 *   - open monitor alerts
 *   - controls still missing evidence
 *   - upcoming milestones (SAM expiry, annual re-affirm)
 *
 * Persists one row per (org, week_of) to `compliance_pulses` so we never
 * double-send and can show a history in the dashboard.
 */

import { ensureDbReady, getSql } from "@/lib/db";
import { getResend, getFromAddress, getReplyToAddress } from "./client";

export type PulseStatus = "green" | "yellow" | "red";

export type PulseSummary = {
  status: PulseStatus;
  headline: string;
  bullets: string[];
  cta: { label: string; href: string };
  metrics: {
    openAlerts: number;
    controlsCovered: number;
    controlsTotal: number;
    daysUntilAffirmDue: number | null;
  };
};

type PulseRecipient = {
  email: string;
  organizationName: string;
};

async function recipientFor(
  organizationId: string,
): Promise<PulseRecipient | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT o.name AS organization_name, c.email AS email
    FROM organizations o
    LEFT JOIN clients c ON c.owner_user_id = o.owner_user_id
    WHERE o.id = ${organizationId}::uuid
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1
  `) as Array<{ organization_name: string; email: string | null }>;
  const row = rows[0];
  if (!row || !row.email) return null;
  return { email: row.email, organizationName: row.organization_name };
}

async function buildSummary(organizationId: string): Promise<PulseSummary> {
  const sql = getSql();
  const [alertRow] = (await sql`
    SELECT COUNT(*)::int AS n
    FROM monitor_alerts
    WHERE organization_id = ${organizationId}::uuid
      AND resolved_at IS NULL
  `) as Array<{ n: number }>;
  const openAlerts = alertRow?.n ?? 0;

  const [responseRow] = (await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'met')::int AS met,
           COUNT(*)::int AS total
    FROM control_responses cr
    JOIN assessments a ON a.id = cr.assessment_id
    WHERE a.organization_id = ${organizationId}::uuid
      AND a.status IN ('in_progress', 'submitted', 'attested')
  `) as Array<{ met: number; total: number }>;
  const controlsCovered = responseRow?.met ?? 0;
  const controlsTotal = responseRow?.total ?? 0;

  // Days until next Sept 30 affirmation deadline.
  const today = new Date();
  const dueYear =
    today.getUTCMonth() < 9 ? today.getUTCFullYear() : today.getUTCFullYear() + 1;
  const due = new Date(Date.UTC(dueYear, 8, 30));
  const daysUntilAffirmDue = Math.max(
    0,
    Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const status: PulseStatus =
    openAlerts > 0 ? "red" : controlsCovered < controlsTotal ? "yellow" : "green";

  const headline =
    status === "green"
      ? "All clear this week."
      : status === "yellow"
        ? "A few controls still need evidence."
        : `${openAlerts} alert${openAlerts === 1 ? "" : "s"} need your attention.`;

  const bullets: string[] = [];
  if (openAlerts > 0) bullets.push(`${openAlerts} open monitor alert${openAlerts === 1 ? "" : "s"}`);
  if (controlsTotal > 0) bullets.push(`${controlsCovered} / ${controlsTotal} controls covered`);
  bullets.push(`${daysUntilAffirmDue} days until annual SPRS affirmation`);

  return {
    status,
    headline,
    bullets,
    cta: { label: "Open the dashboard", href: "/dashboard" },
    metrics: {
      openAlerts,
      controlsCovered,
      controlsTotal,
      daysUntilAffirmDue,
    },
  };
}

function renderHtml(summary: PulseSummary, organizationName: string): string {
  const dot =
    summary.status === "green"
      ? "#10b981"
      : summary.status === "yellow"
        ? "#f59e0b"
        : "#ef4444";
  const items = summary.bullets
    .map(
      (b) =>
        `<li style="margin:6px 0;color:#334155;font-size:14px;line-height:1.5;">${b}</li>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
  <tr><td style="padding:32px 32px 16px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#475569;">Custodia &middot; Weekly Compliance Pulse</div>
    <div style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dot};margin-top:18px;margin-right:8px;vertical-align:middle;"></div>
    <span style="font-size:22px;font-weight:700;color:#0f172a;vertical-align:middle;">${summary.headline}</span>
    <div style="margin-top:6px;color:#64748b;font-size:13px;">${organizationName}</div>
  </td></tr>
  <tr><td style="padding:8px 32px 24px;">
    <ul style="margin:0;padding:0 0 0 18px;">${items}</ul>
  </td></tr>
  <tr><td style="padding:8px 32px 32px;">
    <a href="${summary.cta.href}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">${summary.cta.label}</a>
  </td></tr>
  <tr><td style="padding:0 32px 24px;color:#94a3b8;font-size:11px;line-height:1.6;">
    You are receiving this weekly digest as part of your Custodia subscription. CMMC L1 compliance
    is a yearly cycle anchored to the federal fiscal year (Oct 1 &ndash; Sep 30); this email keeps
    you on the rhythm.
  </td></tr>
</table>
</body></html>`;
}

export async function sendCompliancePulse(opts: {
  organizationId: string;
  /** Override the recipient lookup (useful for previews / tests). */
  toEmail?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  await ensureDbReady();
  const summary = await buildSummary(opts.organizationId);
  const recipient = opts.toEmail
    ? { email: opts.toEmail, organizationName: "Custodia" }
    : await recipientFor(opts.organizationId);
  if (!recipient) return { ok: false, reason: "no_recipient" };

  // Idempotency: at most one pulse per org per ISO week.
  const sql = getSql();
  const weekOf = startOfWeekUtc(new Date());
  const existing = (await sql`
    SELECT id FROM compliance_pulses
    WHERE organization_id = ${opts.organizationId}::uuid
      AND week_of = ${weekOf.toISOString().slice(0, 10)}::date
    LIMIT 1
  `) as Array<{ id: string }>;
  if (existing[0]) return { ok: false, reason: "already_sent_this_week" };

  if (!process.env.RESEND_API_KEY) {
    console.warn("[compliance-pulse] RESEND_API_KEY not set; skipping send");
    return { ok: false, reason: "resend_not_configured" };
  }

  const html = renderHtml(summary, recipient.organizationName);
  const subject = `Compliance Pulse — ${summary.headline}`;

  const resend = getResend();
  await resend.emails.send({
    from: getFromAddress(),
    to: recipient.email,
    replyTo: getReplyToAddress(),
    subject,
    html,
  });

  await sql`
    INSERT INTO compliance_pulses
      (organization_id, week_of, status, summary)
    VALUES
      (${opts.organizationId}::uuid,
       ${weekOf.toISOString().slice(0, 10)}::date,
       ${summary.status},
       ${JSON.stringify(summary)}::jsonb)
    ON CONFLICT (organization_id, week_of) DO NOTHING
  `;

  return { ok: true };
}

function startOfWeekUtc(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = out.getUTCDay(); // 0 = Sun
  const diff = (dow + 6) % 7; // distance back to Monday
  out.setUTCDate(out.getUTCDate() - diff);
  return out;
}
