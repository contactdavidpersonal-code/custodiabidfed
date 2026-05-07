/**
 * Managed-orgs billing gate.
 *
 * MSPs subscribe to one of two User Plans in Clerk Billing:
 *   - msp_squad_5     — up to 5 client businesses
 *   - msp_platoon_20  — up to 20 client businesses
 *
 * Solo customers are on `cmmc_lv1_full_access` (1 business). Free tier = 0.
 *
 * Each plan has a matching feature key by the same name. We use Clerk's
 * `auth().has({ feature })` to determine the cap, then count the user's
 * Clerk org memberships to see if they have headroom.
 *
 * v1 = soft enforcement only. The OrgSwitcher renders an "at capacity"
 * nag when `canCreateAnotherOrg` returns ok=false; we do NOT block the
 * Clerk-side create flow yet. If/when abuse appears, add a webhook on
 * `organization.created` that rolls back over-cap creates.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";

export type ManagedOrgsStatus = {
  /** True if the user can add at least one more managed business. */
  ok: boolean;
  /** Their plan's cap. 0 = no paid plan. */
  limit: number;
  /** Current count of Clerk org memberships. Personal account NOT counted. */
  current: number;
  /** Which plan/feature granted the cap, for telemetry + nag copy. */
  plan: "msp_platoon_20" | "msp_squad_5" | "cmmc_lv1_full_access" | "free";
};

export async function getManagedOrgsLimit(): Promise<{
  limit: number;
  plan: ManagedOrgsStatus["plan"];
}> {
  const { has } = await auth();
  if (!has) return { limit: 0, plan: "free" };

  if (has({ feature: "msp_platoon_20" })) return { limit: 20, plan: "msp_platoon_20" };
  if (has({ feature: "msp_squad_5" })) return { limit: 5, plan: "msp_squad_5" };
  if (has({ feature: "cmmc_lv1_full_access" })) {
    return { limit: 1, plan: "cmmc_lv1_full_access" };
  }
  return { limit: 0, plan: "free" };
}

export async function getManagedOrgsStatus(
  userId: string,
): Promise<ManagedOrgsStatus> {
  const { limit, plan } = await getManagedOrgsLimit();
  const cc = await clerkClient();
  const memberships = await cc.users.getOrganizationMembershipList({ userId });
  const current = memberships.totalCount ?? memberships.data.length;
  return { ok: current < limit, limit, current, plan };
}
