/**
 * Managed-orgs billing gate.
 *
 * MSPs subscribe to one of two User Plans in Clerk Billing:
 *   - custodia_squad     — up to 5 client businesses
 *   - msp_platoon_20  — up to 20 client businesses
 *
 * Solo customers are on one of:
 *   - bidfedcmmc_self_service                  (new $149/mo)
 *   - bidfedcmmc_self_service_custodia_officer (new $297/mo)
 *   - cmmc_lv1_full_access                     (legacy $449, grandfathered)
 * Each grants a single managed business. Free tier = 0.
 *
 * Each MSP plan has a matching feature key by the same name. We use Clerk's
 * `auth().has({ feature })` to determine the cap, then count the user's
 * Clerk org memberships to see if they have headroom.
 *
 * v1 = soft enforcement only. The OrgSwitcher renders an "at capacity"
 * nag when `canCreateAnotherOrg` returns ok=false; we do NOT block the
 * Clerk-side create flow yet. If/when abuse appears, add a webhook on
 * `organization.created` that rolls back over-cap creates.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  PLAN_LEGACY_FULL_ACCESS,
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
} from "./plans";

export type ManagedOrgsStatus = {
  /** True if the user can add at least one more managed business. */
  ok: boolean;
  /** Their plan's cap. 0 = no paid plan. */
  limit: number;
  /** Current count of Clerk org memberships. Personal account NOT counted. */
  current: number;
  /** Which plan/feature granted the cap, for telemetry + nag copy. */
  plan:
    | "msp_platoon_20"
    | "custodia_squad"
    | "bidfedcmmc_self_service_custodia_officer"
    | "bidfedcmmc_self_service"
    | "cmmc_lv1_full_access"
    | "free";
};

export async function getManagedOrgsLimit(): Promise<{
  limit: number;
  plan: ManagedOrgsStatus["plan"];
}> {
  const { has } = await auth();
  if (!has) return { limit: 0, plan: "free" };

  if (has({ feature: "msp_platoon_20" })) return { limit: 20, plan: "msp_platoon_20" };
  if (has({ feature: "custodia_squad" })) return { limit: 5, plan: "custodia_squad" };
  if (has({ plan: `user:${PLAN_SELF_SERVICE_OFFICER}` })) {
    return { limit: 1, plan: PLAN_SELF_SERVICE_OFFICER };
  }
  if (has({ plan: `user:${PLAN_SELF_SERVICE}` })) {
    return { limit: 1, plan: PLAN_SELF_SERVICE };
  }
  if (has({ plan: `user:${PLAN_LEGACY_FULL_ACCESS}` })) {
    return { limit: 1, plan: PLAN_LEGACY_FULL_ACCESS };
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
