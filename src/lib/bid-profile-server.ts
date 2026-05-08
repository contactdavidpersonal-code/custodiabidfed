import "server-only";
import {
  ensureBusinessProfile,
  getBusinessProfile,
  updateBusinessProfile,
  type BusinessProfileRow,
} from "@/lib/assessment";
import { normalizeBidProfile, type BidProfile } from "@/lib/bid-profile";

/**
 * Server-only loaders/savers for the bid profile. Kept out of bid-profile.ts so
 * that file can be safely pulled into client components for its pure types and
 * utility functions without dragging Clerk server / node:async_hooks into the
 * client bundle.
 */

export async function loadBidProfile(
  organizationId: string,
): Promise<BidProfile> {
  await ensureBusinessProfile(organizationId);
  const row = await getBusinessProfile(organizationId);
  const data = (row?.data ?? {}) as Record<string, unknown>;
  return normalizeBidProfile(data.bid_ready);
}

export async function saveBidProfile(
  organizationId: string,
  next: BidProfile,
): Promise<void> {
  await ensureBusinessProfile(organizationId);
  const row: BusinessProfileRow | null = await getBusinessProfile(organizationId);
  const existing = (row?.data ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    bid_ready: { ...next, updated_at: new Date().toISOString() },
  };
  await updateBusinessProfile(
    organizationId,
    merged,
    row?.completeness_score ?? 0,
    "user",
  );
}
