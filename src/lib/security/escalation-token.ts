/**
 * Reply-To address tokens for officer-escalation tickets.
 *
 * Outbound mail goes to support@custodia.dev with a Reply-To of
 * `support+esc-<id>.<sig>@custodia.dev`. When an officer replies in their
 * mail client, Resend Inbound forwards the reply to our webhook with the
 * same `support+esc-<id>.<sig>@custodia.dev` in the To: line. We verify
 * `<sig>` against `<id>` so officers can't enumerate other tickets by
 * editing the address.
 *
 * Token shape: `<escalationId>.<base64url(hmac-sha256(id))[:16]>`
 *   - 36-char UUID + dot + 16-char hex truncated HMAC = 53 chars after `esc-`.
 *   - Plus-addressing keeps the recipient on the apex inbox so a single
 *     mailbox configuration on Resend captures every reply.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "esc-";

function getSecret(): string {
  // Reuse the attestation signing key (a high-entropy server secret already
  // required in prod by env validation). If you ever rotate it, in-flight
  // reply-to addresses become unverifiable — old threads will need a manual
  // address rewrite or a key-id versioning scheme.
  const key = process.env.ATTESTATION_SIGNING_KEY;
  if (!key) {
    throw new Error(
      "ATTESTATION_SIGNING_KEY is required to sign escalation reply tokens",
    );
  }
  return key;
}

function sign(escalationId: string): string {
  return createHmac("sha256", getSecret())
    .update(escalationId, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/** Build the local-part suffix: `esc-<id>.<sig>`. */
export function buildReplyLocalPart(escalationId: string): string {
  return `${PREFIX}${escalationId}.${sign(escalationId)}`;
}

/** Build the full reply-to address. */
export function buildReplyAddress(
  escalationId: string,
  inboxLocal: string,
  domain: string,
): string {
  return `${inboxLocal}+${buildReplyLocalPart(escalationId)}@${domain}`;
}

/**
 * Pull a verified escalation id out of an inbound `To:` address.
 * Returns null if no plus-token is present, the format is wrong, or the
 * signature doesn't verify.
 */
export function parseReplyAddress(toAddress: string): string | null {
  if (!toAddress) return null;
  // Strip display name + angle brackets if present: `"Name" <a@b>` → `a@b`.
  const angle = toAddress.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : toAddress).trim().toLowerCase();
  const at = addr.indexOf("@");
  if (at < 0) return null;
  const local = addr.slice(0, at);
  const plus = local.indexOf("+");
  if (plus < 0) return null;
  const tag = local.slice(plus + 1);
  if (!tag.startsWith(PREFIX)) return null;
  const rest = tag.slice(PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot < 0) return null;
  const escalationId = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  // UUID v4 lowercase shape — quick sanity gate before HMAC math.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      escalationId,
    )
  ) {
    return null;
  }
  const expected = sign(escalationId);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return escalationId;
}
