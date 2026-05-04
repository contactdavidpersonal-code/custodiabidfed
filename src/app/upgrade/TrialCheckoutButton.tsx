"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

type CheckoutOpener = (props: {
  planId: string;
  planPeriod?: "month" | "annual";
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

      // Resolve the slug → cplan_xxx id Clerk expects.
      let resolvedId: string | undefined;
      try {
        const plans = await clerk.billing?.getPlans({ for: "user" });
        const match = plans?.data?.find((p) => p.slug === planSlug);
        resolvedId = match?.id ?? planSlug;
      } catch {
        resolvedId = planSlug;
      }

      clerk.__internal_openCheckout({
        planId: resolvedId,
        planPeriod: "month",
        newSubscriptionRedirectUrl: "/assessments",
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
