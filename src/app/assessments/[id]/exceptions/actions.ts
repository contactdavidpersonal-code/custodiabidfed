"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  addControlMilestone,
  clearControlException,
  deleteMilestone,
  setControlException,
} from "@/lib/cmmc/objectives";
import { playbookById } from "@/lib/playbook";
import { recordAuditEvent } from "@/lib/security/audit-log";

const MAX_NOTES = 4000;
const MAX_LABEL = 200;

async function requireCtx(assessmentId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");
  return { userId, ctx };
}

export async function declareExceptionAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const typeRaw = String(formData.get("exceptionType") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, MAX_NOTES);

  if (typeRaw !== "enduring" && typeRaw !== "temporary") {
    throw new Error("Invalid exception type");
  }
  if (!playbookById[controlId]) {
    throw new Error(`Unknown control: ${controlId}`);
  }
  if (!notes) {
    throw new Error("Documentation notes are required");
  }

  const { userId, ctx } = await requireCtx(assessmentId);

  await setControlException({
    assessmentId,
    controlId,
    exceptionType: typeRaw,
    notes,
  });

  await recordAuditEvent({
    action: "exception.declared",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "control_objective_responses",
    resourceId: controlId,
    metadata: { exception_type: typeRaw },
  });

  revalidatePath(`/assessments/${assessmentId}/exceptions`);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function clearExceptionAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const { userId, ctx } = await requireCtx(assessmentId);

  await clearControlException({ assessmentId, controlId });

  await recordAuditEvent({
    action: "exception.cleared",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "control_objective_responses",
    resourceId: controlId,
  });

  revalidatePath(`/assessments/${assessmentId}/exceptions`);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function addMilestoneAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, MAX_LABEL);
  const targetDate = String(formData.get("targetDate") ?? "");

  if (!label) throw new Error("Milestone label is required");
  // ISO date validation: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error("Target date must be YYYY-MM-DD");
  }
  if (!playbookById[controlId]) {
    throw new Error(`Unknown control: ${controlId}`);
  }

  const { userId, ctx } = await requireCtx(assessmentId);

  await addControlMilestone({ assessmentId, controlId, label, targetDate });

  await recordAuditEvent({
    action: "milestone.added",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "objective_milestones",
    resourceId: controlId,
    metadata: { target_date: targetDate },
  });

  revalidatePath(`/assessments/${assessmentId}/exceptions`);
}

export async function deleteMilestoneAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const { userId, ctx } = await requireCtx(assessmentId);

  await deleteMilestone(milestoneId, assessmentId);

  await recordAuditEvent({
    action: "milestone.deleted",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "objective_milestones",
    resourceId: milestoneId,
  });

  revalidatePath(`/assessments/${assessmentId}/exceptions`);
}
