import { getFromAddress, getReplyToAddress, getResend } from "./client";
import { truncateDescription } from "@/lib/sam-radar";

export type OpportunityDigestRow = {
  id: string;
  notice_id: string;
  title: string;
  department: string | null;
  naics_code: string | null;
  set_aside: string | null;
  response_deadline: string | null;
  sam_url: string | null;
  description: string | null;
};

export type OpportunityDigestInput = {
  toEmail: string;
  firstName: string | null;
  orgName: string;
  rows: OpportunityDigestRow[];
  workspaceUrl: string;
};

export async function sendOpportunityDigest(
  input: OpportunityDigestInput,
): Promise<string> {
  const subject = `${input.rows.length} new SAM.gov opportunit${input.rows.length === 1 ? "y" : "ies"} for ${input.orgName}`;
  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderHtml(input),
    text: renderText(input),
    headers: { "X-Entity-Ref-ID": "custodia-sam-radar-v1" },
  });
  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) throw new Error("Resend returned no message id");
  return result.data.id;
}

function renderText(input: OpportunityDigestInput): string {
  const greet = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const lines: string[] = [];
  lines.push(greet);
  lines.push("");
  lines.push(
    `${input.rows.length} new federal opportunit${input.rows.length === 1 ? "y" : "ies"} matched ${input.orgName}'s NAICS this week:`,
  );
  lines.push("");
  for (const r of input.rows) {
    lines.push(`• ${r.title}`);
    const meta = [r.department, r.naics_code, r.set_aside]
      .filter(Boolean)
      .join(" · ");
    if (meta) lines.push(`  ${meta}`);
    if (r.response_deadline) lines.push(`  Due ${r.response_deadline}`);
    const desc = truncateDescription(r.description, 200);
    if (desc) lines.push(`  ${desc}`);
    if (r.sam_url) lines.push(`  SAM.gov: ${r.sam_url}`);
    lines.push("");
  }
  lines.push(
    `Open your inbox for one-click tailored packets: ${input.workspaceUrl}/opportunities`,
  );
  lines.push("");
  lines.push("— The Custodia team");
  return lines.join("\n");
}

function renderHtml(input: OpportunityDigestInput): string {
  const greet = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const renderRow = (r: OpportunityDigestRow) => {
    const meta = [r.department, r.naics_code, r.set_aside]
      .filter(Boolean)
      .map((m) => escapeHtml(m as string))
      .join(" · ");
    const desc = escapeHtml(truncateDescription(r.description, 240));
    const due = r.response_deadline
      ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#fff7eb;border:1px solid #a06b1a;color:#a06b1a;font-size:11px;font-weight:600;">Due ${escapeHtml(r.response_deadline)}</span>`
      : "";
    return `
      <tr><td style="padding:14px 0;border-bottom:1px solid #e3eee8;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#456c5f;">${meta}</div>
        <div style="margin-top:6px;font-size:15px;color:#10231d;font-weight:700;">${escapeHtml(r.title)}${due}</div>
        ${desc ? `<div style="margin-top:6px;font-size:13px;color:#456c5f;">${desc}</div>` : ""}
        <div style="margin-top:10px;">
          ${r.sam_url ? `<a href="${escapeAttr(r.sam_url)}" style="display:inline-block;margin-right:14px;font-size:12px;color:#456c5f;text-decoration:none;">View on SAM.gov →</a>` : ""}
          <a href="${input.workspaceUrl}/opportunities/${r.id}/tailor" style="display:inline-block;font-size:12px;color:#2f8f6d;text-decoration:none;font-weight:700;">✨ Tailor packet for this →</a>
        </div>
      </td></tr>`;
  };

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>SAM.gov radar</title></head>
<body style="margin:0;padding:0;background:#f7fcf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10231d;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7fcf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #cfe3d9;">
        <tr><td style="background:#10231d;padding:20px 28px;color:#bdf2cf;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Custodia · SAM.gov Radar</div>
          <div style="margin-top:4px;font-size:14px;color:#cfe3d9;">${escapeHtml(input.orgName)} · weekly digest</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px 0;font-size:16px;">${escapeHtml(greet)}</p>
          <p style="margin:0 0 8px 0;font-size:15px;">
            <strong>${input.rows.length} new federal opportunit${input.rows.length === 1 ? "y" : "ies"}</strong> matched your NAICS this week.
            One click below tailors your bid-ready packet to the agency's language.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${input.rows.map(renderRow).join("")}
          </table>
          <p style="margin:24px 0 0 0;text-align:center;">
            <a href="${input.workspaceUrl}/opportunities" style="display:inline-block;background:#10231d;color:#bdf2cf;padding:11px 18px;font-size:13px;font-weight:700;text-decoration:none;">Open opportunity inbox →</a>
          </p>
        </td></tr>
        <tr><td style="background:#f7fcf9;padding:18px 28px;border-top:1px solid #cfe3d9;font-size:11px;color:#456c5f;">
          Tune which NAICS you watch on your <a href="${input.workspaceUrl}/profile/bid-ready" style="color:#2f8f6d;">Bid-Ready Profile</a>. Reply with feedback any time. Custodia · Pittsburgh, PA · Veteran-owned.
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
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
