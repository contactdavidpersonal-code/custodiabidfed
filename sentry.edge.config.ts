import * as Sentry from "@sentry/nextjs";

/**
 * Edge-runtime Sentry init. Loaded by `instrumentation.ts` when Next.js
 * boots middleware or edge route handlers. Same posture as the server
 * config but the edge runtime is more limited — keep it lean.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
