import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Baseline security headers applied to every response.
 *
 * CSP is shipped in Report-Only mode for now. Clerk + Vercel + Next.js all
 * inject inline scripts (telemetry, hydration), so we deliberately allow
 * 'unsafe-inline' on script-src and style-src — this matches Vercel's own
 * documented secure-by-default posture and is acceptable when paired with
 * strict X-Frame-Options DENY + frame-ancestors 'none' against clickjacking.
 *
 * Once we have ~2 weeks of clean CSP reports we'll flip the header name from
 * Content-Security-Policy-Report-Only to Content-Security-Policy.
 *
 * Connect-src must enumerate every host the browser is allowed to call
 * directly. Anthropic is intentionally NOT here — all model calls go
 * server-to-server through our /api routes.
 */
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://challenges.cloudflare.com",
    "https://va.vercel-scripts.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://img.clerk.com",
    "https://images.clerk.dev",
    "https://*.public.blob.vercel-storage.com",
  ],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk-telemetry.com",
    // Sentry ingest — required for browser-side error reporting.
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
  ],
  "frame-src": [
    "'self'",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
  ],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": [],
};

const cspValue = Object.entries(cspDirectives)
  .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
  .join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Cross-origin isolation: defends against Spectre-class side-channels and
  // window-target confusion. COOP same-origin makes window.opener relationships
  // safe; CORP same-site keeps our blob/asset responses from being embedded
  // in arbitrary cross-origin contexts.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
];

const nextConfig: NextConfig = {
  // PDFKit (used by src/lib/cmmc/pdf-deliverable.ts to render Charlie's
  // evidence artifacts as branded PDFs) loads its 14 built-in AFM fonts
  // via fs.readFileSync at runtime from `node_modules/pdfkit/js/data/`.
  // Next/Turbopack's automatic file tracing does NOT follow that dynamic
  // path, so without this hint the Vercel lambda is missing the fonts
  // and `doc.font("Times-Roman")` throws ENOENT — which is exactly the
  // "Charlie says 'Generating now…' and nothing happens" failure mode.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/chat/route": ["./node_modules/pdfkit/js/data/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // The standalone /pricing marketing page was retired in favor of the
  // in-flow /upgrade checkout drawer (one screen, trial-start CTA, Clerk
  // Checkout). Permanent redirect so any inbound link — emails, Google
  // results, old blog posts — lands on the live flow.
  async redirects() {
    return [
      { source: "/pricing", destination: "/upgrade", permanent: true },
    ];
  },
};

// Wrap with Sentry. The Vercel integration injects SENTRY_AUTH_TOKEN /
// SENTRY_ORG / SENTRY_PROJECT during build so source maps upload
// automatically. `silent` suppresses non-error build chatter; `widenClientFileUpload`
// gives us readable stacks for code-split chunks. `disableLogger` strips
// Sentry's own console output from prod bundles to keep the marketing
// pages clean.
export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  // Tunnel browser ingest through our own /monitoring path so ad blockers
  // don't drop client error reports. Sentry rewrites the requests at the
  // proxy level — no app code needed.
  tunnelRoute: "/monitoring",
});
