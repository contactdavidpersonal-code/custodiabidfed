"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser, getBusinessProfile } from "@/lib/assessment";
import {
  draftCapabilityStatement,
  draftDifferentiators,
} from "@/lib/ai/bid-drafting";
import {
  loadBidProfile,
  normalizeBidProfile,
  saveBidProfile,
  type BidProfile,
} from "@/lib/bid-profile";
import { setRadarEmailsEnabled } from "@/lib/sam-radar";

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

/**
 * Draft a capability statement from the user's onboarding profile + the
 * partial bid profile they have so far. Returns plain text — the form
 * pastes it into the textarea and lets the user edit before saving.
 *
 * The form sends the in-memory profile state in `payload` so we draft
 * against the user's current edits, not just the last-saved version.
 */
export async function draftCapabilityAction(
  formData: FormData,
): Promise<string> {
  const userId = await requireUserId();
  const payloadRaw = String(formData.get("payload") ?? "");
  let current: BidProfile;
  try {
    current = normalizeBidProfile(JSON.parse(payloadRaw));
  } catch {
    current = await loadBidProfile((await ensureOrgForUser(userId)).id);
  }

  const org = await ensureOrgForUser(userId);
  const businessProfile = await getBusinessProfile(org.id);

  return draftCapabilityStatement({
    orgName: org.name,
    entityType: org.entity_type,
    naicsCodes: org.naics_codes,
    scopedSystems: org.scoped_systems,
    businessProfileData:
      (businessProfile?.data as Record<string, unknown>) ?? {},
    current,
  });
}

/**
 * Draft differentiators (4-6 short bullets) from the same context. Returns
 * one bullet per line — the form pastes into the textarea.
 */
export async function draftDifferentiatorsAction(
  formData: FormData,
): Promise<string> {
  const userId = await requireUserId();
  const payloadRaw = String(formData.get("payload") ?? "");
  let current: BidProfile;
  try {
    current = normalizeBidProfile(JSON.parse(payloadRaw));
  } catch {
    current = await loadBidProfile((await ensureOrgForUser(userId)).id);
  }

  const org = await ensureOrgForUser(userId);
  const businessProfile = await getBusinessProfile(org.id);

  return draftDifferentiators({
    orgName: org.name,
    current,
    businessProfileData:
      (businessProfile?.data as Record<string, unknown>) ?? {},
  });
}

/**
 * Toggle the org's SAM.gov radar email subscription. The cron filters orgs
 * by this flag so flipping it OFF stops the next Monday digest entirely;
 * flipping it back ON resumes on the next cron run.
 */
export async function toggleRadarEmailsAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const enabled = String(formData.get("enabled") ?? "false") === "true";
  const org = await ensureOrgForUser(userId);
  await setRadarEmailsEnabled(org.id, enabled);
  revalidatePath("/profile/bid-ready");
}

