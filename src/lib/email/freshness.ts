import { clerkClient } from "@clerk/nextjs/server";
import { getFromAddress, getReplyToAddress, getResend } from "./client";
import {
  displayFilename,
  freshnessClassLabel,
  type FreshnessRow,
} from "@/lib/freshness";

export type FreshnessDigestInput = {
  toEmail: string;
  firstName: string | null;
  orgName: string;
  rows: FreshnessRow[];
  workspaceUrl: string; // base URL like https://bidfedcmmc.com
};

/**
 * Resolve the org owner's email via Clerk. Returns null if the user has no
 * primary email (rare, but possible during account deletion). The cron skips
 * those orgs.
 */
export async function resolveOwnerEmail(
  ownerUserId: string,
): Promise<{ email: string; firstName: string | null } | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerUserId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null;
    if (!email) return null;
    return { email, firstName: user.firstName ?? null };
  } catch (err) {
    console.error(
      `[freshness] resolveOwnerEmail(${ownerUserId}) failed:`,
      err,
    );
    return null;
  }
}

export async function sendFreshnessDigest(
  input: FreshnessDigestInput,
): Promise<string> {
  const overdue = input.rows.filter((r) => r.days_until < 0);
  const due = input.rows.filter(
    (r) => r.days_until >= 0 && r.days_until <= 30,
  );
  const subject = overdue.length
    ? `Action needed: ${overdue.length} CMMC artifact${overdue.length === 1 ? " is" : "s are"} expired`
    : `${input.orgName}: ${due.length} CMMC artifact${due.length === 1 ? "" : "s"} expiring soon`;

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderHtml(input, overdue, due),
    text: renderText(input, overdue, due),
    headers: { "X-Entity-Ref-ID": "custodia-freshness-v1" },
  });
  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) throw new Error("Resend returned no message id");
  return result.data.id;
}

function row(r: FreshnessRow): {
  label: string;
  filename: string;
  due: string;
  control: string;
  link: string;
  state: "overdue" | "soon";
} {
  const klass = freshnessClassLabel(r.freshness_class);
  const due =
    r.days_until < 0
      ? `${Math.abs(r.days_until)} day${Math.abs(r.days_until) === 1 ? "" : "s"} overdue`
      : r.days_until === 0
        ? "expires today"
        : `expires in ${r.days_until} day${r.days_until === 1 ? "" : "s"}`;
  return {
    label: klass,
    filename: displayFilename(r.filename),
    due,
    control: r.control_id,
    link: `/assessments/${r.assessment_id}/controls/${r.control_id}`,
    state: r.days_until < 0 ? "overdue" : "soon",
  };
}

function renderText(
  input: FreshnessDigestInput,
  overdue: FreshnessRow[],
  due: FreshnessRow[],
): string {
  const greet = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const lines: string[] = [];
  lines.push(greet);
  lines.push("");
  lines.push(
    `Quick note from Custodia — your CMMC evidence at ${input.orgName} needs a refresh.`,
  );
  lines.push("");
  if (overdue.length) {
    lines.push(`EXPIRED — replace before your next bid:`);
    for (const r of overdue) {
      const v = row(r);
      lines.push(`  • ${v.label}: ${v.filename} (${v.control}) — ${v.due}`);
      lines.push(`    ${input.workspaceUrl}${v.link}`);
    }
    lines.push("");
  }
  if (due.length) {
    lines.push(`Coming up in the next 30 days:`);
    for (const r of due) {
      const v = row(r);
      lines.push(`  • ${v.label}: ${v.filename} (${v.control}) — ${v.due}`);
      lines.push(`    ${input.workspaceUrl}${v.link}`);
    }
    lines.push("");
  }
  lines.push(
    "Stale evidence is the #1 reason a packet fails a prime's questionnaire.",
  );
  lines.push("Two clicks to re-upload — we'll review the new file instantly.");
  lines.push("");
  lines.push("— The Custodia team");
  return lines.join("\n");
}

function renderHtml(
  input: FreshnessDigestInput,
  overdue: FreshnessRow[],
  due: FreshnessRow[],
): string {
  const greet = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const renderRow = (r: FreshnessRow) => {
    const v = row(r);
    const color = v.state === "overdue" ? "#b03a2e" : "#a06b1a";
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e3eee8;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${color};">${escapeHtml(v.due)}</div>
          <div style="margin-top:4px;font-size:14px;color:#10231d;font-weight:600;">${escapeHtml(v.filename)}</div>
          <div style="margin-top:2px;font-size:12px;color:#456c5f;">${escapeHtml(v.label)} · ${escapeHtml(v.control)}</div>
          <a href="${input.workspaceUrl}${v.link}" style="display:inline-block;margin-top:8px;font-size:12px;color:#2f8f6d;text-decoration:none;font-weight:600;">Replace this file →</a>
        </td>
      </tr>`;
  };

  const overdueBlock = overdue.length
    ? `<h2 style="margin:24px 0 4px 0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#b03a2e;font-weight:700;">Expired — replace before your next bid</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${overdue.map(renderRow).join("")}</table>`
    : "";
  const dueBlock = due.length
    ? `<h2 style="margin:28px 0 4px 0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#a06b1a;font-weight:700;">Expiring in the next 30 days</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${due.map(renderRow).join("")}</table>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Evidence freshness</title></head>
<body style="margin:0;padding:0;background:#f7fcf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10231d;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7fcf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #cfe3d9;">
        <tr><td style="background:#10231d;padding:20px 28px;color:#bdf2cf;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Custodia · Evidence Watchtower</div>
          <div style="margin-top:4px;font-size:14px;color:#cfe3d9;">${escapeHtml(input.orgName)}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px 0;font-size:16px;">${escapeHtml(greet)}</p>
          <p style="margin:0 0 8px 0;font-size:15px;">
            Stale evidence is the #1 reason a CMMC packet gets bounced by a prime.
            ${overdue.length ? `<strong style="color:#b03a2e;">${overdue.length} artifact${overdue.length === 1 ? " is" : "s are"} already expired.</strong>` : `Heads up — a few artifacts are about to expire.`}
            Two clicks to replace, AI reviews it instantly.
          </p>
          ${overdueBlock}
          ${dueBlock}
          <p style="margin:28px 0 0 0;font-size:12px;color:#456c5f;">
            Your master Bid Profile auto-redacts expired evidence from the next packet —
            keeping it current is the easiest way to stay bid-ready year round.
          </p>
        </td></tr>
        <tr><td style="background:#f7fcf9;padding:18px 28px;border-top:1px solid #cfe3d9;font-size:11px;color:#456c5f;">
          Reply to this email and a real human reads it. Custodia · Pittsburgh, PA · Veteran-owned.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
