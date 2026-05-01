/**
 * Officer-ticket transactional email.
 *
 * Two flows:
 *  1. `sendTicketToOfficers` — fires when a user opens or replies to a ticket
 *     in the platform. Goes to the support inbox with a Reply-To carrying a
 *     signed token (see `lib/security/escalation-token`). The officer hits
 *     reply in their mail client; Resend Inbound forwards to our webhook;
 *     the reply lands in the thread.
 *  2. `sendOfficerReplyToUser` — fires when an officer's email reply arrives
 *     via the inbound webhook. Notifies the org owner with a deep link back
 *     to the platform thread.
 *
 * Address shape: `support+esc-<id>.<sig>@custodia.dev`. The `support@`
 * inbox stays human-friendly for direct mail; only plus-tagged messages
 * thread automatically.
 */

import type { EscalationRow } from "@/lib/escalations";
import { buildReplyAddress } from "@/lib/security/escalation-token";
import { getFromAddress, getResend } from "./client";

const SUPPORT_INBOX = process.env.OFFICER_SUPPORT_EMAIL ?? "support@custodia.dev";

function inboxLocalAndDomain(): { local: string; domain: string } {
  const at = SUPPORT_INBOX.indexOf("@");
  if (at < 0) {
    throw new Error(`OFFICER_SUPPORT_EMAIL is not a valid address: ${SUPPORT_INBOX}`);
  }
  return {
    local: SUPPORT_INBOX.slice(0, at),
    domain: SUPPORT_INBOX.slice(at + 1),
  };
}

const URGENCY_LABEL: Record<EscalationRow["urgency"], string> = {
  routine: "Routine (1 business day)",
  priority: "Priority (4 hours)",
  urgent: "Urgent (1 hour)",
};

export type SendTicketArgs = {
  escalation: EscalationRow;
  orgName: string;
  userEmail: string | null;
  userName: string | null;
  body: string;
  /** True if this is the first message in the thread. */
  isOpening: boolean;
};

export type SendOfficerReplyArgs = {
  toEmail: string;
  userFirstName: string | null;
  escalation: EscalationRow;
  body: string;
  workspaceUrl: string; // e.g. https://bidfedcmmc.com
};

/**
 * Email an officer ticket (or reply) to the support inbox. Returns the
 * Resend message id so the caller can persist it for thread stitching.
 * Throws on transport failure — caller decides whether to surface or swallow.
 */
export async function sendTicketToOfficers(args: SendTicketArgs): Promise<string> {
  const { local, domain } = inboxLocalAndDomain();
  const replyTo = buildReplyAddress(args.escalation.id, local, domain);

  const subjectPrefix = args.isOpening ? "[Custodia ticket]" : "[Custodia ticket — reply]";
  const subject = `${subjectPrefix} ${args.escalation.topic} — ${args.orgName}`;

  const fromUserLine = args.userEmail
    ? `${args.userName ?? "User"} <${args.userEmail}>`
    : (args.userName ?? "User");

  const text = [
    `Org: ${args.orgName}`,
    `From: ${fromUserLine}`,
    `Urgency: ${URGENCY_LABEL[args.escalation.urgency]}`,
    `Topic: ${args.escalation.topic}`,
    `Ticket ID: ${args.escalation.id}`,
    "",
    args.body,
    "",
    "—",
    `Reply directly to this email; your reply will be posted into the customer's`,
    `Custodia workspace as a thread message. Do not edit the To: address.`,
  ].join("\n");

  const html = renderOfficerHtml({
    ...args,
    fromUserLine,
    urgency: URGENCY_LABEL[args.escalation.urgency],
  });

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [SUPPORT_INBOX],
    replyTo,
    subject,
    text,
    html,
    headers: {
      "X-Entity-Ref-ID": `custodia-ticket-${args.escalation.id}`,
      // Best-effort threading hint for the officer's mail client. The real
      // thread anchor for our inbound parser is the plus-tagged Reply-To.
      "X-Custodia-Escalation": args.escalation.id,
    },
  });

  if (result.error) {
    throw new Error(
      `Resend error sending ticket: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) {
    throw new Error("Resend returned no message id for ticket email");
  }
  return result.data.id;
}

export async function sendOfficerReplyToUser(
  args: SendOfficerReplyArgs,
): Promise<string> {
  const greeting = args.userFirstName ? `Hi ${args.userFirstName},` : "Hi,";
  const ticketUrl = `${args.workspaceUrl.replace(/\/$/, "")}/assessments/tickets/${args.escalation.id}`;
  const subject = `Custodia officer replied: ${args.escalation.topic}`;

  const text = `${greeting}

A Custodia compliance officer replied to your ticket "${args.escalation.topic}":

${args.body}

Read the full thread and reply in the platform:
${ticketUrl}

— The Custodia team
`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:0.18em;color:#2f8f6d;text-transform:uppercase;">Officer reply</p>
    <h1 style="margin:0 0 12px 0;font-size:18px;color:#0e2a23;">${escapeHtml(args.escalation.topic)}</h1>
    <p style="margin:0 0 16px 0;color:#334155;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px 0;color:#334155;">A Custodia compliance officer replied to your ticket:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #2f8f6d;background:#f1f6f3;color:#10231d;white-space:pre-wrap;">${escapeHtml(args.body)}</blockquote>
    <p style="margin:24px 0;">
      <a href="${escapeAttr(ticketUrl)}" style="display:inline-block;padding:10px 18px;background:#0e2a23;color:#bdf2cf;text-decoration:none;border-radius:6px;font-weight:700;">Open the thread</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Reply in the platform to keep the thread together. — The Custodia team</p>
  </div>
</body></html>`;

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [args.toEmail],
    // Replies from this notification go straight to the support inbox so
    // anything the user shoots back also lands in front of an officer
    // (and, if they keep the threading intact, into the same ticket).
    replyTo: buildReplyAddress(
      args.escalation.id,
      inboxLocalAndDomain().local,
      inboxLocalAndDomain().domain,
    ),
    subject,
    text,
    html,
    headers: {
      "X-Entity-Ref-ID": `custodia-ticket-reply-${args.escalation.id}`,
      "X-Custodia-Escalation": args.escalation.id,
    },
  });

  if (result.error) {
    throw new Error(
      `Resend error sending officer reply notification: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) {
    throw new Error("Resend returned no message id for reply notification");
  }
  return result.data.id;
}

function renderOfficerHtml(input: {
  escalation: EscalationRow;
  orgName: string;
  body: string;
  fromUserLine: string;
  urgency: string;
  isOpening: boolean;
}): string {
  const banner = input.isOpening ? "New ticket" : "User reply";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.2em;color:#b03a2e;text-transform:uppercase;">${banner}</p>
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#0e2a23;">${escapeHtml(input.escalation.topic)}</h1>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;font-size:13px;">
      <tr><td style="padding:4px 8px 4px 0;color:#64748b;width:80px;">Org</td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(input.orgName)}</td></tr>
      <tr><td style="padding:4px 8px 4px 0;color:#64748b;">From</td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(input.fromUserLine)}</td></tr>
      <tr><td style="padding:4px 8px 4px 0;color:#64748b;">Urgency</td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(input.urgency)}</td></tr>
      <tr><td style="padding:4px 8px 4px 0;color:#64748b;">Ticket</td><td style="padding:4px 0;color:#64748b;font-family:ui-monospace,Menlo,monospace;font-size:12px;">${escapeHtml(input.escalation.id)}</td></tr>
    </table>
    <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;color:#0f172a;">${escapeHtml(input.body)}</div>
    <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;">
      Reply directly to this email — your reply posts into the customer's Custodia workspace as a thread message. Do not edit the To: address.
    </p>
  </div>
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
