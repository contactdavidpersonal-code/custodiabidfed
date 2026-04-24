"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  markMilestoneCompleted,
  snoozeMilestone,
} from "@/lib/fiscal";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function completeMilestoneAction(formData: FormData) {
  const userId = await requireUserId();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!milestoneId) throw new Error("Milestone id required");

  const org = await ensureOrgForUser(userId);
  await markMilestoneCompleted(milestoneId, org.id);

  revalidatePath("/assessments");
}

export async function snoozeMilestoneAction(formData: FormData) {
  const userId = await requireUserId();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const days = Number(formData.get("days") ?? 7);
  if (!milestoneId) throw new Error("Milestone id required");
  if (!Number.isInteger(days) || days < 1 || days > 60) {
    throw new Error("Snooze between 1 and 60 days");
  }

  const org = await ensureOrgForUser(userId);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + days);
  await snoozeMilestone(milestoneId, org.id, until.toISOString().slice(0, 10));

  revalidatePath("/assessments");
}
