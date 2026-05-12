/**
 * Plan + feature registry for the Custodia billing surface.
 *
 * Two new public plans (May 2026):
 *   - bidfedcmmc_self_service                  — $149/mo ($139/mo annual). No human officer.
 *   - bidfedcmmc_self_service_custodia_officer — $297/mo ($289/mo annual). Adds `custodia_officer` feature.
 *
 * Legacy (no longer offered, but grandfathered):
 *   - cmmc_lv1_full_access — old flat $449/mo plan; included officer access.
 *
 * MSP plans (unchanged):
 *   - custodia_squad   — up to 5 client businesses, officer included
 *   - msp_platoon_20   — up to 20 client businesses, officer included
 *
 * The "Ask a Custodia Compliance Officer" surfaces (ticket UI, escalation
 * tool, etc.) are gated by the `custodia_officer` Clerk feature. New
 * self-service-only ($149) accounts do NOT have it; the +officer plan,
 * the legacy $449 plan, and both MSP plans do.
 */

import type { auth } from "@clerk/nextjs/server";

export const PLAN_SELF_SERVICE = "bidfedcmmc_self_service_" as const;
export const PLAN_SELF_SERVICE_OFFICER =
  "bidfedcmmc_self_service_custodia_officer_" as const;
export const PLAN_LEGACY_FULL_ACCESS = "cmmc_lv1_full_access" as const;
export const PLAN_SQUAD = "custodia_squad" as const;
export const PLAN_PLATOON = "msp_platoon_20" as const;

export const OFFICER_FEATURE = "custodia_officer" as const;

/** Slugs that grant access to the solo (single-business) workspace. */
export const SOLO_PLAN_SLUGS = [
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
  PLAN_LEGACY_FULL_ACCESS,
] as const;

/** Slugs that grant MSP multi-tenant access. */
export const MSP_PLAN_SLUGS = [PLAN_SQUAD, PLAN_PLATOON] as const;

type HasFn = Awaited<ReturnType<typeof auth>>["has"];

/** True if the caller is on any active solo plan (paid or trialing). */
export function hasSoloAccess(has: HasFn): boolean {
  if (!has) return false;
  return SOLO_PLAN_SLUGS.some((slug) => has({ plan: `user:${slug}` }));
}

/** True if the caller is on any active MSP plan. */
export function hasMspAccess(has: HasFn): boolean {
  if (!has) return false;
  return MSP_PLAN_SLUGS.some((slug) => has({ plan: `user:${slug}` }));
}

/** True if the caller has any active workspace plan. */
export function hasWorkspaceAccess(has: HasFn): boolean {
  return hasSoloAccess(has) || hasMspAccess(has);
}

/**
 * True if the caller can open tickets / talk to a credentialed human
 * Custodia Compliance Officer.
 *
 * Granted by:
 *   - the `custodia_officer` feature flag (the new $297 plan), OR
 *   - any legacy plan that historically bundled officer access
 *     (cmmc_lv1_full_access, custodia_squad, msp_platoon_20).
 */
export function hasOfficerFeature(has: HasFn): boolean {
  if (!has) return false;
  if (has({ feature: OFFICER_FEATURE })) return true;
  if (has({ plan: `user:${PLAN_LEGACY_FULL_ACCESS}` })) return true;
  if (has({ plan: `user:${PLAN_SQUAD}` })) return true;
  if (has({ plan: `user:${PLAN_PLATOON}` })) return true;
  return false;
}
