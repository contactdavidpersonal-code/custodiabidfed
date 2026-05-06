/**
 * Next.js instrumentation hook. Loads the right Sentry runtime config
 * based on which Next.js runtime is booting (Node vs edge). Also exports
 * `onRequestError` so server-side route errors are captured.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
