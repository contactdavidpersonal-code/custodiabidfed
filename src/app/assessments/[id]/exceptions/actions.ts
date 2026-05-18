"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  clearControlException,
  deleteMilestone,
  setControlException,
} from "@/lib/cmmc/objectives";
import { playbookById } from "@/lib/playbook";
import { recordAuditEvent } from "@/lib/security/audit-log";

const MAX_NOTES = 4000;

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

  // CMMC L1 (32 CFR § 170.15(b)) does not permit Plans of Action /
  // Temporary Deficiencies. Only Enduring Exceptions are valid coverage.
  if (typeRaw !== "enduring") {
    throw new Error(
      "CMMC Level 1 only permits Enduring Exceptions. Temporary Deficiencies (POA&Ms) are not allowed under 32 CFR § 170.15(b).",
    );
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
    exceptionType: "enduring",
    notes,
  });

  await recordAuditEvent({
    action: "exception.declared",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "control_objective_responses",
    resourceId: controlId,
    metadata: { exception_type: "enduring" },
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
  // CMMC L1 (32 CFR § 170.15(b)) prohibits Plans of Action & Milestones.
  // We keep the export so any cached form posts surface a clear error
  // instead of a 404. New milestones cannot be created at L1.
  void formData;
  throw new Error(
    "CMMC Level 1 does not permit Plans of Action & Milestones (32 CFR § 170.15(b)). Convert the practice to MET, mark N/A, or declare an Enduring Exception.",
  );
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
