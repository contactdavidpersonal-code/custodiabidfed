import * as Sentry from "@sentry/nextjs";

/**
 * Client-runtime Sentry init. Next.js 15+ loads this automatically as
 * `instrumentation-client.ts`. Browser session replay and BrowserTracing
 * are intentionally off for now — we don't need session video, and the
 * extra payload hurts Lighthouse on the marketing pages. Errors only.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
  tracesSampleRate: 0,
  sendDefaultPii: false,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});

// Required for App Router navigation transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
