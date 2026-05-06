import * as Sentry from "@sentry/nextjs";

/**
 * Server-runtime Sentry init. Loaded by `instrumentation.ts` on Node runtime.
 * DSN comes from the Vercel Sentry integration (NEXT_PUBLIC_SENTRY_DSN).
 *
 * Sampling: 100% errors, 10% performance traces. We're a low-traffic SaaS;
 * traces are cheap and useful for tail-latency diagnosis. Bump down if the
 * Sentry quota gets noisy.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Don't ship PII automatically. We have user-controlled inputs that may
  // contain emails, names, etc. — Sentry's `sendDefaultPii` would attach
  // them to events. Keep it off; we redact at the edges instead.
  sendDefaultPii: false,
  // Filter noisy expected errors.
  ignoreErrors: [
    // Clerk's auth() throws this when an unauthenticated user hits a
    // protected route — that's a redirect, not a bug.
    "Unauthenticated",
    // Anthropic 429s from the Charlie daily-cap path are expected.
    "Charlie daily limit",
  ],
});
