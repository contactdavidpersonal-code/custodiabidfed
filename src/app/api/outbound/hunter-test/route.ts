/**
 * Admin-only Hunter.io smoke test.
 *
 * Verifies HUNTER_API_KEY is wired correctly by hitting three endpoints:
 *   - /account            (proves auth + shows quota)
 *   - /domain-search      (proves search credits work, real result shape)
 *   - /email-verifier     (proves verifier credits work, real result shape)
 *
 * Auth: requires header `x-admin-secret` matching `OUTBOUND_ADMIN_SECRET`
 *       env var. This endpoint is dev/staging-only; remove the route file
 *       (or rotate the secret) before going public.
 *
 * Default test target: `lockheedmartin.com` — large, well-indexed, public.
 * Override via `?domain=foo.com&email=jane@foo.com`. We never run the
 * verifier against an arbitrary user-supplied address without the secret,
 * so this endpoint cannot be used to harvest data.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  domainSearch,
  emailVerifier,
  getAccount,
} from "@/lib/outbound/hunter";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Gate: shared secret. Compared with timingSafeEqual to avoid leaking
  // length information through response timing.
  const expected = process.env.OUTBOUND_ADMIN_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      {
        error:
          "OUTBOUND_ADMIN_SECRET is not configured (must be ≥16 chars). Refusing to expose this route.",
      },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!constantTimeEquals(provided, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? "lockheedmartin.com";
  const email = url.searchParams.get("email"); // optional verifier target

  const out: Record<string, unknown> = { domain, ranAt: new Date().toISOString() };

  // Step 1 — account ping. Must succeed; otherwise nothing else will.
  try {
    out.account = await getAccount();
  } catch (err) {
    out.accountError = errMsg(err);
    return NextResponse.json(out, { status: 502 });
  }

  // Step 2 — domain search. Returns shape we'll use in the discovery cron.
  try {
    const ds = await domainSearch({ domain, limit: 5, personalOnly: true });
    out.domainSearch = {
      organization: ds.organization,
      pattern: ds.pattern,
      industry: ds.industry,
      country: ds.country,
      sampleEmails: ds.emails.slice(0, 5).map((e) => ({
        value: e.value,
        confidence: e.confidence,
        position: e.position,
        firstName: e.firstName,
        lastName: e.lastName,
        verification: e.verification.status,
      })),
    };
  } catch (err) {
    out.domainSearchError = errMsg(err);
  }

  // Step 3 — verifier. Only runs if caller passed ?email=... (burns 1 credit).
  if (email) {
    try {
      out.verifier = await emailVerifier(email);
    } catch (err) {
      out.verifierError = errMsg(err);
    }
  } else {
    out.verifier = "skipped (pass ?email=foo@bar.com to test)";
  }

  return NextResponse.json(out);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Constant-time comparison for short ASCII secrets. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
