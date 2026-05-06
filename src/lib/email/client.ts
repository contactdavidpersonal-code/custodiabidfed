import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  _client = new Resend(apiKey);
  return _client;
}

/**
 * The verified sender. Resend requires a domain to be verified before it will
 * deliver mail from anything other than `onboarding@resend.dev`. Set
 * `RESEND_FROM_EMAIL` once `custodia.us` (or whichever domain we settle on) is
 * verified in the Resend dashboard. Falls back to the sandbox sender so dev
 * smoke tests work — that sender can only send to the Resend account owner's
 * email, which is fine for testing.
 */
export function getFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "Custodia <onboarding@resend.dev>"
  );
}

export function getReplyToAddress(): string {
  return process.env.RESEND_REPLY_TO ?? "officers@custodia.us";
}

/**
 * Resolve the public app base URL for links embedded in emails. In production
 * we refuse to fall back to localhost — emails with broken links are worse
 * than no email. Throws if neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is set
 * in production. In dev/preview, falls back to localhost so smoke tests work.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Email link base URL unresolved: set NEXT_PUBLIC_APP_URL (or VERCEL_URL) in production.",
    );
  }
  return "http://localhost:3000";
}
