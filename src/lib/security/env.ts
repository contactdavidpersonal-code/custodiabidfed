/**
 * Boot-time environment validation. Imported once from a top-level module
 * (currently `src/lib/db.ts`); throws in production if anything required
 * is missing, warns in dev.
 *
 * Required vs recommended split:
 *   REQUIRED — the app is unsafe / non-functional without these. Throw in prod.
 *   RECOMMENDED — security-relevant. Warn in prod.
 */

const REQUIRED_PROD = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "ANTHROPIC_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "ATTESTATION_SIGNING_KEY",
] as const;

const RECOMMENDED_PROD = ["CRON_SECRET", "RESEND_API_KEY"] as const;

let validated = false;

export function validateEnvOnce(): void {
  if (validated) return;
  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];

  for (const key of REQUIRED_PROD) {
    if (!process.env[key]) missingRequired.push(key);
  }
  for (const key of RECOMMENDED_PROD) {
    if (!process.env[key]) missingRecommended.push(key);
  }

  if (missingRequired.length > 0) {
    const msg = `Missing required env vars: ${missingRequired.join(", ")}`;
    if (isProd) throw new Error(msg);
    console.warn(`[env] ${msg} (allowed in dev, will fail in production)`);
  }
  if (missingRecommended.length > 0) {
    console.warn(
      `[env] Missing recommended env vars: ${missingRecommended.join(", ")}`,
    );
  }
}
