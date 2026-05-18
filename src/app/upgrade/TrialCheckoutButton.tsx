"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

type CheckoutOpener = (props: {
  planId: string;
  planPeriod?: "month" | "annual";
  for?: "user" | "organization";
  newSubscriptionRedirectUrl?: string;
}) => void;

type BillingPlan = { id: string; slug: string };
type BillingNamespace = {
  getPlans: (params?: { for?: "user" | "organization" }) => Promise<{
    data: BillingPlan[];
  }>;
};

type ClerkWithCheckout = ReturnType<typeof useClerk> & {
  __internal_openCheckout?: CheckoutOpener;
  billing?: BillingNamespace;
};

/**
 * Opens Clerk's Checkout side panel for the CMMC L1 plan, defaulted to
 * monthly billing. Uses the experimental __internal_openCheckout API on the
 * Clerk instance because @clerk/nextjs ^7.2.x does not export CheckoutButton.
 *
 * Clerk's openCheckout expects the plan **id** (cplan_xxx), not the slug,
 * so we resolve the slug to an id via clerk.billing.getPlans() at click time.
 */
export function TrialCheckoutButton({
  planId: planSlug,
  className,
  children,
}: {
  /** The plan slug as configured in Clerk (e.g. "cmmc_lv1_full_access"). */
  planId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const clerk = useClerk() as ClerkWithCheckout;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (typeof clerk.__internal_openCheckout !== "function") {
        clerk.openUserProfile?.();
        return;
      }

      // Resolve the slug → cplan_xxx id Clerk expects. Clerk's checkout
      // is scoped per-payer (user vs organization), so we must request the
      // user-scoped plans here — that is the scope our `user:` plan checks
      // and trial subscriptions live under. Without `for: "user"` Clerk
      // defaults to organization scope and reports "Plan not found".
      let resolvedId: string | undefined;
      let availableSlugs: string[] = [];
      try {
        const plans = await clerk.billing?.getPlans({ for: "user" });
        availableSlugs = plans?.data?.map((p) => p.slug).filter(Boolean) ?? [];
        const match = plans?.data?.find((p) => p.slug === planSlug);
        resolvedId = match?.id;
      } catch {
        // fall through — resolvedId stays undefined
      }

      if (!resolvedId) {
        const detail = availableSlugs.length
          ? ` (available: ${availableSlugs.join(", ")})`
          : "";
        throw new Error(
          `Plan \"${planSlug}\" is not available on your account${detail}. Please contact support@custodia.dev.`,
        );
      }

      // Where to land the user once Clerk activates the subscription.
      // Officer upgrades almost always come from someone trying to open a
      // ticket — drop them straight on the ticket composer so the next
      // click is the one they were trying to make before they hit the
      // paywall. Everyone else goes through /onboard/activating, which
      // forces a session-token reload so the freshly-granted plan claim
      // is visible to server-side `has()` checks. Without that hop the
      // user bounces straight back to /upgrade because their JWT still
      // carries the pre-trial claim set.
      const isOfficerUpgrade = planSlug.includes("officer");
      const redirectUrl = isOfficerUpgrade
        ? "/assessments/tickets/new"
        : "/onboard/activating";

      clerk.__internal_openCheckout({
        planId: resolvedId,
        planPeriod: "month",
        for: "user",
        newSubscriptionRedirectUrl: redirectUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open checkout");
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={className}
      >
        {children}
      </button>
      {error ? (
        <p className="mt-2 text-center text-[11px] text-red-600">{error}</p>
      ) : null}
    </>
  );
}
