import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets (bearer tokens, HMAC sigs).
 * Different lengths short-circuit because timingSafeEqual requires equal-
 * length buffers; the length itself is not considered secret.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** HMAC-SHA-256 over UTF-8 payload, hex-encoded. */
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Verify an HMAC-SHA-256 hex signature in constant time. */
export function verifyHmacSha256Hex(
  secret: string,
  payload: string,
  signatureHex: string,
): boolean {
  return timingSafeStringEqual(hmacSha256Hex(secret, payload), signatureHex);
}
