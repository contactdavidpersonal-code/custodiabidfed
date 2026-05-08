"use client";

/**
 * OrgSwitcher — header dropdown that lets one signed-in user switch between
 * the businesses they manage (Clerk Organizations). Same UI primitive Slack,
 * Linear, and Vercel use.
 *
 * Visibility rules:
 * - Renders on every protected workspace header (assessments, opportunities,
 *   profile, onboard, etc.).
 * - Hidden when the user has zero Clerk Organizations AND we don't want to
 *   advertise the feature on the marketing surface — pass `hideUntilJoined`
 *   for those callsites if you want a soft rollout.
 *
 * The Clerk session cookie tracks the active org per browser tab. Server
 * code reads `auth().orgId` and resolves the matching DB row via
 * `getActiveOrgFromAuth()` (see src/lib/assessment.ts).
 */

import { OrganizationSwitcher, useOrganizationList } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  /** Tailwind classes for the wrapper (controls spacing in the header). */
  className?: string;
  /**
   * If true, the switcher only renders for users who already belong to at
   * least one Clerk Organization. Useful on the public marketing header
   * where we don't want to confuse solo users with org concepts.
   */
  hideUntilJoined?: boolean;
};

type CapStatus = {
  ok: boolean;
  limit: number;
  current: number;
  plan: "msp_platoon_20" | "custodia_squad" | "cmmc_lv1_full_access" | "free";
};

export function OrgSwitcher({ className, hideUntilJoined = false }: Props) {
  const { isLoaded, userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  });

  const [cap, setCap] = useState<CapStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/managed-orgs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CapStatus | null) => {
        if (!cancelled && data) setCap(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (hideUntilJoined) {
    if (!isLoaded) return null;
    if (!userMemberships?.data || userMemberships.data.length === 0) {
      return null;
    }
  }

  // MSP-only feature: only Squad/Platoon plans see the multi-org switcher.
  // Solo (`cmmc_lv1_full_access`) and free users never see this UI — they
  // operate on their personal Clerk account exclusively.
  const isMspPlan =
    cap?.plan === "custodia_squad" || cap?.plan === "msp_platoon_20";
  if (!isMspPlan) return null;

  const atCap = cap !== null && cap.limit > 0 && cap.current >= cap.limit;

  return (
    <div className={className}>
      {atCap ? (
        <Link
          href="/upgrade"
          className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          title={`You're managing ${cap?.current}/${cap?.limit} client businesses. Upgrade to Platoon for more capacity.`}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          {cap?.current}/{cap?.limit} &middot; At capacity
        </Link>
      ) : null}
      <OrganizationSwitcher
        // Hide the user's Clerk personal account from the switcher: MSPs operate
        // exclusively on client-business orgs. Their personal account is just
        // the login identity, not a workspace.
        hidePersonal
        // Modal create flow is friendlier inside an existing app shell.
        createOrganizationMode="modal"
        // Land on the workspace after switching so the user sees data for the
        // org they just selected.
        afterSelectOrganizationUrl="/assessments"
        // New client business → walk through onboarding (which seeds the row
        // from the Clerk org name on first server hit).
        afterCreateOrganizationUrl="/onboard"
        // Hard-block creation past the plan cap by hiding Clerk's create button.
        appearance={{
          elements: {
            organizationSwitcherTrigger:
              "px-3 py-1.5 rounded-full border border-[#cfe3d9] bg-white hover:bg-[#f1f6f3] text-sm font-medium text-[#10231d]",
            organizationPreviewMainIdentifier__organizationSwitcherTrigger:
              "font-semibold tracking-tight",
            ...(atCap
              ? {
                  organizationSwitcherPopoverActionButton__createOrganization: {
                    display: "none",
                  },
                }
              : {}),
          },
        }}
      />
    </div>
  );
}
