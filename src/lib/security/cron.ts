import { timingSafeStringEqual } from "./crypto";

/**
 * Verify the Vercel-style `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Returns true if the request is authorized to run a cron route.
 * In non-production where CRON_SECRET is unset, returns true so local dev
 * isn't blocked. Production MUST set CRON_SECRET — `assertCronSecretSet()`
 * is called in production builds at boot to fail loudly if it's missing.
 */
export function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return timingSafeStringEqual(header, expected);
}

/** Best-effort client IP for cron audit logs. */
export function clientIpFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
