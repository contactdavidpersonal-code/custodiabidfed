"use client";

/**
 * OrgSwitcher — header dropdown that lets one signed-in user switch between
 * the businesses they belong to (Clerk Organizations). Most users have
 * exactly one (their own business); the switcher still surfaces so they
 * can manage teammates and any future business they're invited into.
 *
 * Visibility rules:
 * - Renders on every protected workspace header (assessments, opportunities,
 *   profile, onboard, etc.).
 * - Hidden until the user belongs to at least one Clerk Organization to
 *   avoid confusing solo accounts that never created one.
 *
 * The Clerk session cookie tracks the active org per browser tab. Server
 * code reads `auth().orgId` and resolves the matching DB row via
 * `getActiveOrgFromAuth()` (see src/lib/assessment.ts).
 */

import { OrganizationSwitcher, useOrganizationList } from "@clerk/nextjs";

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

export function OrgSwitcher({ className, hideUntilJoined = false }: Props) {
  const { isLoaded, userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  });

  if (hideUntilJoined) {
    if (!isLoaded) return null;
    if (!userMemberships?.data || userMemberships.data.length === 0) {
      return null;
    }
  }

  // Hide entirely when the user has no Clerk org yet — there's nothing to
  // switch between and the unstyled placeholder is noisy.
  const hasNoOrgs =
    isLoaded &&
    (!userMemberships?.data || userMemberships.data.length === 0);
  if (hasNoOrgs) return null;

  return (
    <div className={className}>
      <OrganizationSwitcher
        // Hide the user's Clerk personal account from the switcher: every
        // workspace is a business org. The personal account is just login
        // identity, not a workspace.
        hidePersonal
        // Land on the workspace after switching so the user sees data for the
        // org they just selected.
        afterSelectOrganizationUrl="/assessments"
        appearance={{
          elements: {
            // Subscriptions are per-business; one Clerk user = one business
            // org. Hide the "Create organization" action so a single paid
            // seat can't spin up CMMC L1 packages for additional companies.
            // Backstop: max-orgs-per-user is also enforced in the Clerk
            // dashboard (Configure → Organizations → Limits).
            organizationSwitcherPopoverActionButton__createOrganization:
              "hidden",
            organizationSwitcherTrigger:
              "px-3 py-1.5 rounded-full border border-[#cfe3d9] bg-white hover:bg-[#f1f6f3] text-sm font-medium text-[#10231d]",
            organizationPreviewMainIdentifier__organizationSwitcherTrigger:
              "font-semibold tracking-tight",
          },
        }}
      />
    </div>
  );
}
