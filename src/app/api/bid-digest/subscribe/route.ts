import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSql, initDb } from "@/lib/db";
import { sendBidDigestConfirmEmail } from "@/lib/email/bid-digest-confirm";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// Hard cap to keep malicious payloads small.
const MAX_NAICS = 25;
const NAICS_REGEX = /^\d{2,6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SubscribePayload = {
  email?: unknown;
  naicsCodes?: unknown;
  source?: unknown;
};

function token(): string {
  // 32 bytes → 43 chars url-safe; far beyond brute-force range.
  return randomBytes(32).toString("base64url");
}

function bad(msg: string, code = 400): NextResponse {
  return NextResponse.json({ error: msg }, { status: code });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 5 attempts per IP per 10 minutes — generous for legitimate retries,
  // crushing for signup spam.
  const rl = await checkRateLimit(
    rateLimitKey({ scope: "bid-digest-subscribe", req }),
    { max: 5, windowSec: 600 },
  );
  if (!rl.allowed) return rateLimitResponse(rl) as unknown as NextResponse;

  let body: SubscribePayload;
  try {
    body = (await req.json()) as SubscribePayload;
  } catch {
    return bad("Invalid JSON body.");
  }

  // Validate email
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_REGEX.test(email) || email.length > 320) {
    return bad("Please enter a valid email address.");
  }

  // Validate NAICS codes (optional but capped + format-checked)
  let naicsCodes: string[] = [];
  if (Array.isArray(body.naicsCodes)) {
    naicsCodes = (body.naicsCodes as unknown[])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => NAICS_REGEX.test(c))
      .slice(0, MAX_NAICS);
  }

  const source =
    typeof body.source === "string" && body.source.length <= 64
      ? body.source.trim()
      : null;

  await initDb();
  const sql = getSql();
  const confirmToken = token();
  const unsubscribeToken = token();

  // Insert or refresh tokens for an existing unconfirmed row. We
  // deliberately don't reveal whether the email already exists — the
  // response is identical either way.
  type Row = {
    email: string;
    confirm_token: string;
    unsubscribe_token: string;
    confirmed_at: Date | null;
  };
  const rows = (await sql`
    INSERT INTO bid_digest_subscribers
      (email, naics_codes, source, confirm_token, unsubscribe_token)
    VALUES
      (${email}, ${naicsCodes}, ${source}, ${confirmToken}, ${unsubscribeToken})
    ON CONFLICT (email) DO UPDATE
    SET
      naics_codes = EXCLUDED.naics_codes,
      source = COALESCE(EXCLUDED.source, bid_digest_subscribers.source),
      confirm_token = CASE
        WHEN bid_digest_subscribers.confirmed_at IS NULL
          THEN EXCLUDED.confirm_token
          ELSE bid_digest_subscribers.confirm_token
      END
    RETURNING email, confirm_token, unsubscribe_token, confirmed_at
  `) as Row[];
  const row = rows[0];
  if (!row) {
    return bad("Could not save subscription. Please try again.", 500);
  }

  // If already confirmed, we still respond 200 but skip sending a new
  // confirm email — no value in spamming a confirmed subscriber.
  if (!row.confirmed_at) {
    try {
      await sendBidDigestConfirmEmail({
        toEmail: row.email,
        confirmToken: row.confirm_token,
        unsubscribeToken: row.unsubscribe_token,
      });
    } catch (err) {
      console.error("[bid-digest-subscribe] email send failed:", err);
      // We still return success — the row is saved; an ops backfill can
      // re-send. Leaking transport details to the client would help
      // attackers enumerate.
    }
  }

  return NextResponse.json({ ok: true });
}
