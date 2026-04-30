"use server";

import { auth } from "@clerk/nextjs/server";
import { tailorForOpportunity, type TailorResult } from "@/lib/ai/bid-drafting";
import { getAssessmentForUser } from "@/lib/assessment";
import { loadBidProfile } from "@/lib/bid-profile";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/**
 * Server action invoked by the tailor page when the user clicks
 * "Tailor with AI". Loads the user's master profile, calls Claude with the
 * solicitation text, and returns proposed overrides (capability statement +
 * differentiators) for the user to edit before generating the packet.
 *
 * We do NOT save these overrides anywhere — they live only in the form's
 * state and ultimately in the URL when the user opens the packet. That keeps
 * per-opportunity tailoring a stateless, infinitely-repeatable operation.
 */
export async function tailorOpportunityAction(
  formData: FormData,
): Promise<TailorResult> {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const opportunityText = String(formData.get("opportunity") ?? "").trim();

  if (!assessmentId) throw new Error("Missing assessment");
  if (opportunityText.length < 50) {
    throw new Error(
      "Paste at least a paragraph of the solicitation so Charlie (your vCO) has enough to tailor against.",
    );
  }
  if (opportunityText.length > 30000) {
    throw new Error(
      "Solicitation text too long — paste the most relevant sections (under 30,000 characters).",
    );
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const profile = await loadBidProfile(ctx.organization.id);

  return tailorForOpportunity({
    orgName: ctx.organization.name,
    naicsCodes: ctx.organization.naics_codes,
    profile,
    opportunityText,
  });
}
