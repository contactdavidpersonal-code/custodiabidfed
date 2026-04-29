"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  dismissOpportunity,
  markOpportunityViewed,
} from "@/lib/sam-radar";

async function requireOrgId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const org = await ensureOrgForUser(userId);
  return org.id;
}

export async function dismissOpportunityAction(formData: FormData) {
  const orgId = await requireOrgId();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) throw new Error("Missing opportunityId");
  await dismissOpportunity({
    organizationId: orgId,
    opportunityId,
  });
  revalidatePath("/opportunities");
}

export async function markOpportunityViewedAction(opportunityId: string) {
  const orgId = await requireOrgId();
  await markOpportunityViewed({
    organizationId: orgId,
    opportunityId,
  });
}
