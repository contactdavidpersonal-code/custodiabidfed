import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasActiveSoloSubscription } from "@/lib/billing/plans";
import { ActivatingClient } from "./ActivatingClient";

/**
 * Post-checkout interstitial.
 *
 * Clerk's `__internal_openCheckout` redirects here after the trial /
 * subscription is created. Two problems we have to solve before sending
 * the user to `/onboard`:
 *
 * 1. The browser's session token (JWT) still carries the pre-trial
 *    plan-claim set. The `auth().has({ plan })` check on `/onboard`
 *    would return false and bounce the user right back to `/upgrade`
 *    — that's the "stuck on /upgrade after starting trial" bug.
 *
 * 2. Clerk's subscription write is eventually-consistent. The Billing
 *    API can briefly 404 immediately after `openCheckout` finishes.
 *
 * Fix: server-side, poll the Billing API (no JWT cache) until we see
 * an `active` subscription item on one of our workspace plan slugs.
 * Then hand off to a tiny client component that forces a single
 * `clerk.session.reload()` so the next server render sees the fresh
 * plan claim, and finally navigates to `/onboard`.
 */

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const ATTEMPT_DELAY_MS = 750;

export default async function ActivatingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await hasActiveSoloSubscription(userId)) {
      return <ActivatingClient destination="/onboard" />;
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, ATTEMPT_DELAY_MS));
    }
  }

  // Backend never confirmed the subscription within ~6s. /onboard has
  // its own backend fallback check, so let it make the final decision
  // (it will redirect to /upgrade if there really is no subscription).
  return <ActivatingClient destination="/onboard" />;
}
