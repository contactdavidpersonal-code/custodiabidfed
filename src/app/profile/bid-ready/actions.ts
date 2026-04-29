"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  normalizeBidProfile,
  saveBidProfile,
  type BidProfile,
} from "@/lib/bid-profile";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/**
 * Save the master Bid Profile. Form posts a single hidden `payload` field
 * containing the full JSON-serialized BidProfile (the past_performance rows
 * are managed client-side; sending one big blob is simpler than parsing
 * 50+ FormData entries with array indices). We re-normalize on the server so
 * a tampered payload can't sneak invalid set-asides or unknown fields in.
 */
export async function saveBidProfileAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const payloadRaw = String(formData.get("payload") ?? "");
  if (!payloadRaw) throw new Error("Missing payload");

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    throw new Error("Invalid payload JSON");
  }

  const next: BidProfile = normalizeBidProfile(parsed);

  const org = await ensureOrgForUser(userId);
  await saveBidProfile(org.id, next);

  revalidatePath("/profile/bid-ready");
}
