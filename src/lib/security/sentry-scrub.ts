/**
 * Sentry `beforeSend` scrubber. Strips high-risk identifiers and
 * Anthropic / chat / onboarding request bodies from breadcrumbs and
 * error reports before they leave the process.
 *
 * We already set `sendDefaultPii: false` in every Sentry init, which
 * keeps Sentry from auto-attaching headers, cookies, and IPs. This
 * scrubber is the second layer: it catches the cases where our OWN
 * code stuffs sensitive content into an `extra`, `tags`, or `request`
 * field — for example, a thrown error whose message contains a piece
 * of a Charlie chat turn.
 *
 * Strategy:
 *   - Walk every string field in the event and run the egress scrubber.
 *   - For any request URL that hits a chat / onboard / anthropic path,
 *     wipe the body entirely — Sentry never needs to know what the user
 *     typed in order to diagnose a 500.
 *   - For breadcrumbs (http, fetch, console), drop bodies/data on those
 *     same hot paths.
 */

import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";
import { scrubHighRiskEgress } from "@/lib/security/charlie-redaction";

const SENSITIVE_URL_PATTERNS = [
  /\/api\/chat(\b|\/|\?)/,
  /\/api\/onboard(\b|\/|\?)/,
  /\/api\/inbound-email(\b|\/|\?)/,
  /\/api\/intake\//,
  /api\.anthropic\.com/,
  /\/api\/charlie/,
];

function urlIsSensitive(url: string | undefined): boolean {
  if (!url) return false;
  return SENSITIVE_URL_PATTERNS.some((re) => re.test(url));
}

function scrubString(s: string): string {
  return scrubHighRiskEgress(s);
}

function deepScrubStrings<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return scrubString(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => deepScrubStrings(v, depth + 1)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepScrubStrings(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

export function scrubSentryEvent(
  event: ErrorEvent,
): ErrorEvent | null {
  // Request bodies on sensitive routes: wipe completely.
  if (event.request) {
    if (urlIsSensitive(event.request.url)) {
      event.request.data = "[redacted: sensitive route]";
      event.request.query_string = undefined;
    }
    if (event.request.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }
  }

  // Breadcrumbs: drop bodies on sensitive routes.
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((bc: Breadcrumb) => {
      const data = bc.data as Record<string, unknown> | undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      if (urlIsSensitive(url)) {
        return {
          ...bc,
          message: bc.message ? "[redacted]" : bc.message,
          data: { url, status_code: data?.status_code, method: data?.method },
        };
      }
      if (bc.message) {
        return { ...bc, message: scrubString(bc.message) };
      }
      return bc;
    });
  }

  // Scrub freeform PII patterns out of message / exception / extra.
  if (event.message) event.message = scrubString(event.message);
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex) => ({
      ...ex,
      value: ex.value ? scrubString(ex.value) : ex.value,
    }));
  }
  if (event.extra) event.extra = deepScrubStrings(event.extra);
  if (event.contexts) event.contexts = deepScrubStrings(event.contexts);
  if (event.tags) event.tags = deepScrubStrings(event.tags);

  return event;
}
