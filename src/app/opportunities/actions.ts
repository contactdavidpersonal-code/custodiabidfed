"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import { setRadarEmailsEnabled } from "@/lib/sam-radar";

async function requireOrgId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const org = await ensureOrgForUser(userId);
  return org.id;
}

/**
 * Toggle the Monday weekly digest email for the current org. The toggle
 * lives on /opportunities so users can opt out of the email without
 * digging through profile settings.
 */
export async function setMondayDigestAction(formData: FormData) {
  const orgId = await requireOrgId();
  const enabled = formData.get("enabled") === "on";
  await setRadarEmailsEnabled(orgId, enabled);
  revalidatePath("/opportunities");
}
