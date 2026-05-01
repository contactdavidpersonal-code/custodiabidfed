/**
 * Resend Inbound webhook — receives officer email replies and posts them
 * into the matching `officer_escalations` thread.
 *
 * Resend posts a JSON payload that includes the parsed email. We:
 *   1. Verify the webhook signature header (Svix-style; Resend uses Svix
 *      under the hood). If `RESEND_INBOUND_WEBHOOK_SECRET` is unset we
 *      refuse the request rather than fail-open.
 *   2. Resolve the escalation id from the To: address plus-token. If the
 *      token doesn't verify, we 200 OK and drop (so the provider doesn't
 *      retry forever) but log loudly.
 *   3. Strip quoted history from the body so we don't store the original
 *      message duplicated under every reply.
 *   4. Insert an `escalation_messages` row as sender_type='officer'.
 *   5. Email the org owner that there's a new reply waiting in the platform.
 *
 * Webhook URL: POST /api/inbound-email
 *   Configure in the Resend dashboard with the secret stored in
 *   RESEND_INBOUND_WEBHOOK_SECRET.
 */

import { NextRequest } from "next/server";
import { Webhook } from "svix";
import {
  appendMessage,
  getEscalationById,
  type EscalationRow,
} from "@/lib/escalations";
import { sendOfficerReplyToUser } from "@/lib/email/officer-ticket";
import { resolveOwnerEmail } from "@/lib/email/freshness";
import { getSql } from "@/lib/db";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { parseReplyAddress } from "@/lib/security/escalation-token";

export const runtime = "nodejs";

type InboundPayload = {
  // Resend nests the email under `data` in event payloads.
  data?: InboundEmail;
  // Some configurations post the email at the root.
  from?: InboundAddress | string;
  to?: Array<InboundAddress | string> | InboundAddress | string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string> | Array<{ name: string; value: string }>;
  message_id?: string;
};

type InboundEmail = {
  from?: InboundAddress | string;
  to?: Array<InboundAddress | string> | InboundAddress | string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string> | Array<{ name: string; value: string }>;
  message_id?: string;
};

type InboundAddress = { email?: string; address?: string; name?: string };

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[inbound-email] RESEND_INBOUND_WEBHOOK_SECRET unset; refusing request",
    );
    return new Response("Inbound webhook not configured", { status: 503 });
  }

  // We must read the raw body for signature verification, then parse it.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  let parsed: unknown;
  try {
    const wh = new Webhook(secret);
    parsed = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.warn("[inbound-email] signature verification failed:", err);
    await recordAuditEvent({
      action: "auth.unauthorized",
      metadata: { route: "/api/inbound-email", reason: "bad_signature" },
    });
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = parsed as InboundPayload;
  const email = payload.data ?? payload;

  const toAddress = pickPrimaryToAddress(email.to);
  const escalationId = toAddress ? parseReplyAddress(toAddress) : null;
  if (!escalationId) {
    console.warn(
      "[inbound-email] no verifiable escalation token in To:",
      toAddress,
    );
    // 200 so the provider doesn't keep retrying — this is operator config drift,
    // not a transient failure.
    return new Response(JSON.stringify({ ok: true, dropped: "no_token" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const escalation = await getEscalationById(escalationId);
  if (!escalation) {
    console.warn(
      `[inbound-email] token verified but escalation ${escalationId} not found`,
    );
    return new Response(
      JSON.stringify({ ok: true, dropped: "escalation_missing" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const fromAddress = pickAddress(email.from);
  const rawBody2 = (email.text ?? "").trim() || htmlToPlain(email.html ?? "");
  const cleaned = stripQuotedHistory(rawBody2);
  if (!cleaned) {
    console.warn(
      `[inbound-email] empty body for escalation ${escalationId} (from ${fromAddress})`,
    );
    return new Response(JSON.stringify({ ok: true, dropped: "empty_body" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messageId =
    pickHeader(email.headers, "Message-ID") ??
    pickHeader(email.headers, "Message-Id") ??
    email.message_id ??
    null;

  const inserted = await appendMessage({
    escalationId: escalation.id,
    senderType: "officer",
    senderEmail: fromAddress,
    body: cleaned,
    emailMessageId: messageId,
  });

  // Reopen if it had been dismissed/resolved — an officer chiming in means
  // it's live again.
  if (escalation.status === "dismissed" || escalation.status === "resolved") {
    const sql = getSql();
    await sql`
      UPDATE officer_escalations
      SET status = 'acknowledged', resolved_at = NULL
      WHERE id = ${escalation.id}::uuid
    `;
  } else if (escalation.status === "open") {
    const sql = getSql();
    await sql`
      UPDATE officer_escalations
      SET status = 'acknowledged'
      WHERE id = ${escalation.id}::uuid
    `;
  }

  await recordAuditEvent({
    action: "evidence.tagged", // closest existing audit action; no new column needed
    organizationId: escalation.organization_id,
    resourceType: "officer_escalation",
    resourceId: escalation.id,
    metadata: {
      kind: "inbound_officer_reply",
      from: fromAddress,
      message_row_id: inserted.id,
    },
  });

  // Notify the org owner — best-effort; webhook still succeeds if email fails.
  await notifyOwner(escalation, cleaned).catch((err) => {
    console.error("[inbound-email] owner notification failed:", err);
  });

  return new Response(JSON.stringify({ ok: true, message_id: inserted.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function notifyOwner(
  escalation: EscalationRow,
  body: string,
): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    SELECT owner_user_id FROM organizations
    WHERE id = ${escalation.organization_id}::uuid LIMIT 1
  `) as Array<{ owner_user_id: string }>;
  const ownerId = rows[0]?.owner_user_id;
  if (!ownerId) return;
  const owner = await resolveOwnerEmail(ownerId);
  if (!owner) return;
  const workspaceUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com";
  await sendOfficerReplyToUser({
    toEmail: owner.email,
    userFirstName: owner.firstName,
    escalation,
    body,
    workspaceUrl,
  });
}

function pickPrimaryToAddress(
  to: InboundEmail["to"] | undefined,
): string | null {
  if (!to) return null;
  if (Array.isArray(to)) {
    for (const entry of to) {
      const a = pickAddress(entry);
      if (a && a.includes("+esc-")) return a;
    }
    return pickAddress(to[0]);
  }
  return pickAddress(to);
}

function pickAddress(v: InboundAddress | string | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.email ?? v.address ?? null;
}

function pickHeader(
  headers: InboundEmail["headers"] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  if (Array.isArray(headers)) {
    const lower = name.toLowerCase();
    const hit = headers.find((h) => h.name?.toLowerCase() === lower);
    return hit?.value ?? null;
  }
  // Header maps from providers can be case-mixed; do a case-insensitive lookup.
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/**
 * Crude but effective: cut at the first quoted line ("On <date>, X wrote:")
 * or the first block of `>` lines. Mail clients vary; perfection is not the
 * goal — we just don't want every reply to grow geometrically.
 */
function stripQuotedHistory(body: string): string {
  if (!body) return "";
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  const onWrotePattern = /^\s*On\s.+\swrote:\s*$/i;
  const fromHeaderPattern = /^\s*(From|De|Von):\s/i;
  for (const line of lines) {
    if (onWrotePattern.test(line)) break;
    if (fromHeaderPattern.test(line)) break;
    if (/^>+/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?=\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
