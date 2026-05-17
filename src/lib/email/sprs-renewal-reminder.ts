/**
 * SPRS renewal reminder email.
 *
 * Fired by the daily `/api/cron/sprs-renewal-reminders` cron at the 60-,
 * 30-, and 14-day marks before an annual CMMC L1 affirmation expires.
 *
 * Why three nudges: 32 CFR § 170.22(a) requires an annual affirmation; if
 * the AO misses the renewal, the SPRS record decays from "Final Level 1
 * Self-Assessment" current to stale, and the org is no longer eligible to
 * bid on FCI work. The 60-day note is gentle ("plan your sign window"),
 * the 30-day note is urgent ("schedule the AO"), the 14-day note is
 * red-line ("expires soon — sign now").
 */

import { getFromAddress, getReplyToAddress, getResend } from "./client";

export type RenewalReminderWindow = 60 | 30 | 14;

export type SprsRenewalReminderInput = {
  toEmail: string;
  firstName?: string | null;
  organizationName: string;
  /** The CMMC Status Date previously posted to SPRS. */
  lastFiledAt: Date;
  /** Computed as lastFiledAt + 365 days. */
  dueDate: Date;
  daysRemaining: RenewalReminderWindow;
  workspaceUrl: string;
  assessmentId: string;
};

export async function sendSprsRenewalReminderEmail(
  input: SprsRenewalReminderInput,
): Promise<string> {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const subject =
    input.daysRemaining === 14
      ? `Sign now — your CMMC L1 affirmation expires in 14 days`
      : input.daysRemaining === 30
        ? `30 days left to re-affirm your CMMC Level 1 status`
        : `Your annual CMMC Level 1 re-affirmation opens in 60 days`;

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderHtml({ ...input, greeting }),
    text: renderText({ ...input, greeting }),
    headers: {
      "X-Custodia-Email": `sprs-renewal-${input.daysRemaining}d`,
    },
  });
  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name}: ${result.error.message}`,
    );
  }
  return result.data?.id ?? "";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderText(
  input: SprsRenewalReminderInput & { greeting: string },
): string {
  const signUrl = `${input.workspaceUrl}/assessments/${input.assessmentId}/sign`;
  return `${input.greeting}

Your CMMC Level 1 annual affirmation for ${input.organizationName} is due in ${input.daysRemaining} days (${fmtDate(input.dueDate)}).

Last filed: ${fmtDate(input.lastFiledAt)}
Renew by:   ${fmtDate(input.dueDate)}

${
  input.daysRemaining === 14
    ? "This is your final reminder. Once the 365-day window closes, your SPRS record decays from current and your eligibility to bid on (or continue performing under) FCI contracts pauses until you re-affirm."
    : input.daysRemaining === 30
      ? "Block 30 minutes with your senior official this week. Re-affirmation reuses last cycle's answers — you only need to review what's changed."
      : "Time to start your renewal window. Re-affirmation reuses last cycle's answers; the only thing that requires fresh AO attention is anything that's materially changed."
}

Walk the renewal: ${signUrl}

Under 32 CFR § 170.22(a) CMMC Level 1 is annual self-attestation. Custodia keeps your SSP, your prior affirmation memo, and the evidence vault carried over — you just walk what changed and sign.

— The Custodia team · Pittsburgh, PA
${input.workspaceUrl}
`;
}

function renderHtml(
  input: SprsRenewalReminderInput & { greeting: string },
): string {
  const signUrl = `${input.workspaceUrl}/assessments/${input.assessmentId}/sign`;
  const urgent = input.daysRemaining === 14;
  const eyebrow = urgent
    ? `Final reminder — ${input.daysRemaining} days left`
    : input.daysRemaining === 30
      ? `30 days to renew`
      : `Renewal window opens in 60 days`;
  const headline =
    input.daysRemaining === 14
      ? "Sign now — your CMMC Level 1 status expires soon."
      : input.daysRemaining === 30
        ? "Block 30 minutes with your senior official this week."
        : "Your annual re-affirmation window is opening.";
  const body =
    input.daysRemaining === 14
      ? "Once the 365-day window closes, your SPRS record stops counting as current. Primes and DoD will see a stale Level 1 status, and you&rsquo;ll be ineligible to bid on (or continue performing under) FCI work until you re-affirm."
      : input.daysRemaining === 30
        ? "Re-affirmation reuses last cycle&rsquo;s answers — you only need to review what&rsquo;s changed. The senior official has to sign in person; book the calendar time now."
        : "Re-affirmation reuses last cycle&rsquo;s answers and evidence vault. The only items that need fresh AO attention are anything that&rsquo;s materially changed: scope, boundary, tooling, or people.";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#e9efea;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#10231d;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#e9efea;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;overflow:hidden;border:1px solid #cfe3d9;">
        <tr><td style="padding:24px 32px 8px 32px;background:${urgent ? "#7a2e1c" : "#0e2a23"};">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${urgent ? "#fbe7e1" : "#bdf2cf"};">${eyebrow}</div>
          <h1 style="margin:6px 0 0 0;font-size:22px;line-height:1.3;color:#ffffff;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:20px 32px 8px 32px;font-size:14px;line-height:1.55;color:#10231d;">
          <p style="margin:0 0 12px 0;">${escapeHtml(input.greeting)}</p>
          <p style="margin:0 0 12px 0;">Your CMMC Level 1 annual affirmation for <strong>${escapeHtml(input.organizationName)}</strong> is due in <strong>${input.daysRemaining} days</strong> (${fmtDate(input.dueDate)}).</p>
          <p style="margin:0 0 12px 0;">${body}</p>
        </td></tr>
        <tr><td style="padding:8px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f6f3;border:1px solid #cfe3d9;">
            <tr><td style="padding:14px 18px;font-size:13px;line-height:1.6;color:#10231d;">
              <div><strong style="color:#5a7d70;font-weight:600;">Last filed:</strong> ${fmtDate(input.lastFiledAt)}</div>
              <div><strong style="color:#5a7d70;font-weight:600;">Renew by:</strong> ${fmtDate(input.dueDate)}</div>
              <div><strong style="color:#5a7d70;font-weight:600;">Days remaining:</strong> ${input.daysRemaining}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 32px;">
          <a href="${escapeHtml(signUrl)}" style="display:inline-block;background:#bdf2cf;color:#0e2a23;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;">Walk my renewal &rarr;</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <div style="border-top:1px solid #cfe3d9;padding-top:14px;font-size:12px;line-height:1.5;color:#5a7d70;">
            Under 32 CFR &sect; 170.22(a), CMMC Level 1 is annual self-attestation. Custodia keeps your SSP, your prior affirmation memo, and the evidence vault carried over &mdash; you just review what changed, get the senior official to sign, and file the CMMC Status Date back in SPRS.
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;font-size:12px;color:#5a7d70;">
          &mdash; The Custodia team &middot; Pittsburgh, PA<br/>
          <a href="${escapeHtml(input.workspaceUrl)}" style="color:#0c4a3a;">${escapeHtml(input.workspaceUrl)}</a>
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
