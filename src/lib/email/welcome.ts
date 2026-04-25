import { clerkClient } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";
import { getFromAddress, getReplyToAddress, getResend } from "./client";

export type WelcomeEmailInput = {
  toEmail: string;
  firstName?: string | null;
  workspaceUrl: string;
};

/**
 * Sends the new-user welcome email. Fired once on first org creation; the
 * dedupe column `organizations.welcome_email_sent_at` prevents repeats.
 *
 * Returns the Resend message id on success, throws on transport failure. The
 * caller (ensureOrgForUser) wraps in try/catch so a Resend outage never blocks
 * sign-in. We intentionally do NOT mark the dedupe column on failure — the
 * next sign-in will retry.
 */
export async function sendWelcomeEmail(
  input: WelcomeEmailInput,
): Promise<string> {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Welcome,";
  const subject =
    "Welcome to Custodia — let's get you bidding on federal contracts";

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderWelcomeHtml({ greeting, workspaceUrl: input.workspaceUrl }),
    text: renderWelcomeText({ greeting, workspaceUrl: input.workspaceUrl }),
    headers: {
      "X-Entity-Ref-ID": "custodia-welcome-v1",
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

function renderWelcomeText(input: {
  greeting: string;
  workspaceUrl: string;
}): string {
  return `${input.greeting}

Welcome to Custodia. We built this platform to help small American businesses
working with the federal government get — and stay — secure.

Who we are: Custodia is a Pittsburgh, PA cybersecurity firm. Veteran-owned and
operated, founded by Carnegie Mellon graduates. We started this project to
support local businesses through the transition to CMMC Level 1 — the new
baseline every company that handles Federal Contract Information (FCI) has to
meet to keep bidding on (and performing under) federal contracts.

What you get inside:
- A plain-English walkthrough of all 17 CMMC L1 practices (FAR 52.204-21)
- An AI compliance officer that drafts narratives, reviews your evidence, and
  flags anything that won't pass a prime's questionnaire
- Quarterly check-ins to keep your evidence current — not just one big scramble
  every September
- A bid-ready ZIP package at the end: SSP, signed affirmation memo, and every
  artifact your prime might ask for, all in one file

Your next step is the onboarding chat — a 5-minute conversation about your
business so we can tailor the rest of the platform to your stack and contracts.

  ${input.workspaceUrl}

Reply to this email any time. A real human (officers@custodia.us) reads every
message.

— The Custodia team
Pittsburgh, PA · Veteran-owned · CMU built
`;
}

function renderWelcomeHtml(input: {
  greeting: string;
  workspaceUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Welcome to Custodia</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;color:#fbbf24;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Custodia</div>
              <div style="margin-top:4px;font-size:13px;color:#cbd5e1;">CMMC Level 1, made simple.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:16px;">${input.greeting}</p>
              <p style="margin:0 0 16px 0;font-size:16px;">
                Welcome to Custodia. We built this platform to help small American businesses
                working with the federal government get &mdash; and stay &mdash; secure.
              </p>

              <h2 style="margin:24px 0 8px 0;font-size:15px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:700;">Who we are</h2>
              <p style="margin:0 0 16px 0;font-size:15px;">
                Custodia is a Pittsburgh, PA cybersecurity firm. <strong>Veteran-owned and operated</strong>,
                founded by <strong>Carnegie Mellon graduates</strong>. We started this project to support
                local businesses through the transition to CMMC Level 1 &mdash; the new baseline every
                company that handles Federal Contract Information (FCI) has to meet to keep bidding on
                (and performing under) federal contracts.
              </p>

              <h2 style="margin:24px 0 8px 0;font-size:15px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:700;">What's inside</h2>
              <ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;">
                <li style="margin:6px 0;">A plain-English walkthrough of all <strong>17 CMMC L1 practices</strong> (FAR 52.204-21).</li>
                <li style="margin:6px 0;">An <strong>AI compliance officer</strong> that drafts narratives, reviews your evidence, and flags anything that won't pass a prime's questionnaire.</li>
                <li style="margin:6px 0;"><strong>Quarterly check-ins</strong> to keep your evidence current &mdash; not one big scramble every September.</li>
                <li style="margin:6px 0;">A <strong>bid-ready ZIP package</strong>: SSP, signed affirmation memo, every artifact your prime might ask for &mdash; all in one file.</li>
              </ul>

              <h2 style="margin:24px 0 8px 0;font-size:15px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;font-weight:700;">Your next step</h2>
              <p style="margin:0 0 24px 0;font-size:15px;">
                Hop into the onboarding chat &mdash; a 5-minute conversation about your business so we can
                tailor the rest of the platform to your stack and your contracts.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background:#fbbf24;border-radius:8px;">
                    <a href="${escapeAttr(input.workspaceUrl)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:700;color:#0f172a;text-decoration:none;">
                      Open my workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">
                Reply to this email any time &mdash; a real human reads every message
                (<a href="mailto:officers@custodia.us" style="color:#0f172a;">officers@custodia.us</a>).
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9;padding:18px 32px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
              <div>The Custodia team</div>
              <div style="margin-top:2px;">Pittsburgh, PA &middot; Veteran-owned &middot; CMU built</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

/**
 * Idempotent trigger: send the welcome email exactly once per organization.
 * Safe to call from any post-sign-in entry point (the dedupe column gates
 * duplicates). Never throws — a Resend outage must not block the page render.
 *
 * Set `RESEND_API_KEY` to enable. Without it this is a no-op so local dev and
 * preview deploys without secrets won't break.
 */
export async function ensureWelcomeEmailSent(
  organizationId: string,
  userId: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const sql = getSql();

  const rows = (await sql`
    SELECT welcome_email_sent_at
    FROM organizations
    WHERE id = ${organizationId}::uuid
    LIMIT 1
  `) as Array<{ welcome_email_sent_at: string | null }>;
  if (rows.length === 0 || rows[0].welcome_email_sent_at) return;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    const toEmail = primary?.emailAddress;
    if (!toEmail) {
      console.warn(
        `[welcome] no primary email for user ${userId}; skipping welcome send`,
      );
      return;
    }

    await sendWelcomeEmail({
      toEmail,
      firstName: user.firstName,
      workspaceUrl: `${appBaseUrl()}/onboard`,
    });

    await sql`
      UPDATE organizations
      SET welcome_email_sent_at = NOW()
      WHERE id = ${organizationId}::uuid
        AND welcome_email_sent_at IS NULL
    `;
  } catch (err) {
    // Never block UX on email failure. Logged and retried on the next
    // post-sign-in page load (dedupe column stays NULL).
    console.error(
      `[welcome] send failed for org ${organizationId}:`,
      err,
    );
  }
}
