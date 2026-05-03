/**
 * SPRS-filed transactional email.
 *
 * Sent when a user records their SPRS confirmation number on the platform —
 * the moment they finish the federal-side step of their CMMC L1 annual
 * affirmation. This is the customer-facing "you're done for this cycle"
 * receipt. Includes the confirmation number, the date filed, the next
 * re-affirmation deadline, and a link back to download their Statement of
 * Compliance.
 *
 * Reality check: CMMC Level 1 is annual self-attestation under FAR 52.204-21
 * and 32 CFR Part 170. There is no third-party certificate. The defensible
 * artifacts are: (1) the SSP, (2) the signed annual affirmation memo, and
 * (3) the SPRS confirmation number. This email is the receipt for #3.
 */

import { getFromAddress, getReplyToAddress, getResend } from "./client";

export type SprsFiledEmailInput = {
  toEmail: string;
  firstName?: string | null;
  organizationName: string;
  confirmationNumber: string;
  filedAt: Date;
  /** Sep 30 of the next federal fiscal year — when re-affirmation is due. */
  nextReaffirmDueDate: Date;
  workspaceUrl: string;
  assessmentId: string;
};

export async function sendSprsFiledEmail(
  input: SprsFiledEmailInput,
): Promise<string> {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const subject = "Your CMMC Level 1 SPRS affirmation is on file";

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderHtml({ ...input, greeting }),
    text: renderText({ ...input, greeting }),
    headers: {
      "X-Entity-Ref-ID": "custodia-sprs-filed-v1",
    },
  });

  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) {
    throw new Error("Resend returned no message id");
  }
  return result.data.id;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderText(input: SprsFiledEmailInput & { greeting: string }): string {
  const statementUrl = `${input.workspaceUrl}/assessments/${input.assessmentId}/statement`;
  return `${input.greeting}

You've filed your CMMC Level 1 annual affirmation in SPRS. ${input.organizationName}
is now self-attested compliant with FAR 52.204-21 for this fiscal year and
eligible to bid on (and continue performing under) federal contracts that
require Federal Contract Information (FCI) protections.

Filing details
--------------
Organization:        ${input.organizationName}
SPRS confirmation #: ${input.confirmationNumber}
Filed on:            ${fmtDate(input.filedAt)}
Next re-affirmation: ${fmtDate(input.nextReaffirmDueDate)}

What you should keep on file (in case of a contracting officer audit):
  1. Your System Security Plan (SSP) — covers all 17 practices
  2. Your signed annual affirmation memo
  3. This SPRS confirmation number

You can download your Statement of Compliance — a one-page summary you can
attach to prime questionnaires and capability statements — here:
${statementUrl}

What happens between now and ${fmtDate(input.nextReaffirmDueDate)}
- Custodia monitors your connected Microsoft 365 / Google Workspace tenants
  for control drift and pushes evidence-freshness reminders so nothing
  goes stale.
- Your virtual Compliance Officer is on call year-round — open a ticket from
  inside the platform any time a contracting officer or prime asks for proof.
- We'll nudge you 60, 30, and 14 days before your next annual re-affirmation
  deadline so you're never caught off-guard.

Important: CMMC Level 1 is annual self-attestation, not third-party
certification. There is no government-issued certificate. The SPRS
confirmation number above is the federal record that you've affirmed.

— The Custodia team
Pittsburgh, PA · ${input.workspaceUrl}
`;
}

function renderHtml(input: SprsFiledEmailInput & { greeting: string }): string {
  const statementUrl = `${input.workspaceUrl}/assessments/${input.assessmentId}/statement`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#10231d;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f7f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3ece8;">
        <tr><td style="padding:28px 32px 8px 32px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#2f8f6d;">CMMC Level 1 — Filed</div>
          <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;color:#10231d;">Your annual affirmation is on file with SPRS.</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;font-size:14px;line-height:1.55;color:#2c3e36;">
          <p style="margin:0 0 12px 0;">${escapeHtml(input.greeting)}</p>
          <p style="margin:0 0 12px 0;">${escapeHtml(input.organizationName)} is now self-attested compliant with FAR 52.204-21 for this fiscal year and eligible to bid on (and continue performing under) federal contracts that require Federal Contract Information (FCI) protections.</p>
        </td></tr>
        <tr><td style="padding:8px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eaf3ee;border:1px solid #bde0cc;border-radius:10px;">
            <tr><td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#10231d;">
              <div><strong style="color:#5a7d70;font-weight:600;">Organization:</strong> ${escapeHtml(input.organizationName)}</div>
              <div><strong style="color:#5a7d70;font-weight:600;">SPRS confirmation #:</strong> <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.confirmationNumber)}</span></div>
              <div><strong style="color:#5a7d70;font-weight:600;">Filed on:</strong> ${fmtDate(input.filedAt)}</div>
              <div><strong style="color:#5a7d70;font-weight:600;">Next re-affirmation due:</strong> ${fmtDate(input.nextReaffirmDueDate)}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 8px 32px;font-size:14px;line-height:1.55;color:#2c3e36;">
          <p style="margin:0 0 8px 0;font-weight:600;">Keep these three artifacts on file in case of a contracting officer audit:</p>
          <ol style="margin:0 0 0 18px;padding:0;">
            <li>Your System Security Plan (SSP) — covers all 17 practices</li>
            <li>Your signed annual affirmation memo</li>
            <li>This SPRS confirmation number</li>
          </ol>
        </td></tr>
        <tr><td align="center" style="padding:20px 32px;">
          <a href="${escapeHtml(statementUrl)}" style="display:inline-block;background:#facc15;color:#10231d;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">Download your Statement of Compliance</a>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;font-size:13px;line-height:1.55;color:#2c3e36;">
          <p style="margin:0 0 6px 0;font-weight:600;">Between now and ${fmtDate(input.nextReaffirmDueDate)}:</p>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li>We monitor your connected Microsoft 365 / Google Workspace tenants and push evidence-freshness reminders.</li>
            <li>Your virtual Compliance Officer is on call year-round — open a ticket inside the platform any time a contracting officer or prime asks for proof.</li>
            <li>We'll nudge you 60, 30, and 14 days before your next annual re-affirmation.</li>
          </ul>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="border-top:1px solid #e3ece8;padding-top:14px;font-size:12px;line-height:1.5;color:#5a7d70;">
            CMMC Level 1 is annual self-attestation under FAR 52.204-21 and 32 CFR Part 170 — not third-party certification. There is no government-issued certificate. The SPRS confirmation number above is the federal record that you've affirmed.
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;font-size:12px;color:#5a7d70;">
          — The Custodia team · Pittsburgh, PA<br/>
          <a href="${escapeHtml(input.workspaceUrl)}" style="color:#2f8f6d;">${escapeHtml(input.workspaceUrl)}</a>
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
