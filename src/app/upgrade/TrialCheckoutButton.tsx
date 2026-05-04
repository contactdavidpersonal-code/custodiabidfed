"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

type CheckoutOpener = (props: {
  planId: string;
  planPeriod?: "month" | "annual";
  newSubscriptionRedirectUrl?: string;
}) => void;

type ClerkWithCheckout = ReturnType<typeof useClerk> & {
  __internal_openCheckout?: CheckoutOpener;
};

/**
 * Opens Clerk's Checkout side panel for the CMMC L1 plan, defaulted to
 * monthly billing. Uses the experimental __internal_openCheckout API on the
 * Clerk instance because @clerk/nextjs ^7.2.x does not export CheckoutButton.
 */
export function TrialCheckoutButton({
  planId,
  className,
  children,
}: {
  planId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const clerk = useClerk() as ClerkWithCheckout;
  const [busy, setBusy] = useState(false);

  function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof clerk.__internal_openCheckout === "function") {
        clerk.__internal_openCheckout({
          planId,
          planPeriod: "month",
          newSubscriptionRedirectUrl: "/assessments",
        });
      } else {
        // Fallback: send to the Clerk-hosted billing page on the user profile.
        clerk.openUserProfile?.();
      }
    } finally {
      // Re-enable shortly so a closed-without-purchase user can retry.
      setTimeout(() => setBusy(false), 600);
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
