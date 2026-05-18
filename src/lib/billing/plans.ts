/**
 * Plan + feature registry for the Custodia billing surface.
 *
 * Public plans (May 2026):
 *   - bidfedcmmc_self_service                  — $149/mo ($139/mo annual). No human officer.
 *   - bidfedcmmc_self_service_custodia_officer — $297/mo ($289/mo annual). Adds `custodia_officer` feature.
 *
 * Legacy (no longer offered, but grandfathered):
 *   - cmmc_lv1_full_access — old flat $449/mo plan; included officer access.
 *
 * The "Ask a Custodia Compliance Officer" surfaces (ticket UI, escalation
 * tool, etc.) are gated by the `custodia_officer` Clerk feature. New
 * self-service-only ($149) accounts do NOT have it; the +officer plan and
 * the legacy $449 plan do.
 */

import type { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

export const PLAN_SELF_SERVICE = "bidfedcmmc_self_service_" as const;
export const PLAN_SELF_SERVICE_OFFICER =
  "bidfedcmmc_self_service_custodia_officer_" as const;
export const PLAN_LEGACY_FULL_ACCESS = "cmmc_lv1_full_access" as const;

export const OFFICER_FEATURE = "custodia_officer" as const;

/** Slugs that grant access to the workspace. */
export const SOLO_PLAN_SLUGS = [
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
  PLAN_LEGACY_FULL_ACCESS,
] as const;

type HasFn = Awaited<ReturnType<typeof auth>>["has"];

/** True if the caller is on any active plan (paid or trialing). */
export function hasSoloAccess(has: HasFn): boolean {
  if (!has) return false;
  return SOLO_PLAN_SLUGS.some((slug) => has({ plan: `user:${slug}` }));
}

/**
 * Alias for hasSoloAccess. Retained as the workspace gate so callers can
 * keep semantically referring to "do they have access to the workspace?"
 * even though there is only one product tier family now.
 */
export function hasWorkspaceAccess(has: HasFn): boolean {
  return hasSoloAccess(has);
}

/**
 * True if the caller can open tickets / talk to a credentialed human
 * Custodia Compliance Officer.
 *
 * Granted by:
 *   - the `custodia_officer` feature flag (the new $297 plan), OR
 *   - the legacy $449 plan that historically bundled officer access.
 */
export function hasOfficerFeature(has: HasFn): boolean {
  if (!has) return false;
  if (has({ feature: OFFICER_FEATURE })) return true;
  if (has({ plan: `user:${PLAN_LEGACY_FULL_ACCESS}` })) return true;
  return false;
}

/**
 * Source-of-truth subscription check via Clerk's Billing Backend API.
 *
 * The session-token `has({ plan })` check used by `hasWorkspaceAccess`
 * is fast but lags by a few seconds after a fresh checkout (the JWT in
 * the browser cookie still carries the pre-trial claim set). When the
 * lag bounces a brand-new trialer back to `/upgrade` we ask Clerk's
 * Billing API directly — it has no JWT cache and reflects the
 * subscription the instant Clerk's checkout finishes writing it.
 *
 * Returns `true` if the user has an active subscription item (paid or
 * trialing) on any of our workspace plan slugs.
 */
export async function hasActiveSoloSubscription(
  userId: string,
): Promise<boolean> {
  try {
    const client = await clerkClient();
    // @ts-expect-error — Billing API is experimental in @clerk/backend 3.x
    const sub = await client.billing.getUserBillingSubscription(userId);
    const items: Array<{
      status: string;
      plan?: { slug?: string | null } | null;
    }> =
      (sub as { subscriptionItems?: unknown })?.subscriptionItems &&
      Array.isArray((sub as { subscriptionItems: unknown }).subscriptionItems)
        ? (sub as { subscriptionItems: Array<{ status: string; plan?: { slug?: string | null } | null }> })
            .subscriptionItems
        : [];
    return items.some(
      (item) =>
        item.status === "active" &&
        !!item.plan?.slug &&
        (SOLO_PLAN_SLUGS as readonly string[]).includes(item.plan.slug),
    );
  } catch {
    // Treat any failure (404 = no subscription, 5xx = transient) as "no access"
    // so the caller falls back to the upgrade gate. The Clerk JWT path is the
    // happy-path anyway.
    return false;
  }
}
