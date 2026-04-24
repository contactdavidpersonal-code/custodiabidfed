"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import { setEscalationStatus } from "@/lib/escalations";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function dismissEscalationAction(formData: FormData) {
  const userId = await requireUserId();
  const escalationId = String(formData.get("escalationId") ?? "");
  if (!escalationId) throw new Error("Escalation id required");

  const org = await ensureOrgForUser(userId);
  await setEscalationStatus(escalationId, org.id, "dismissed");

  revalidatePath("/assessments");
}
