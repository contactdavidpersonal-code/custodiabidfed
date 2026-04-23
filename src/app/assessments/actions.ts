"use server";

import { auth } from "@clerk/nextjs/server";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  controlResponseStatuses,
  type ControlResponseStatus,
  getSql,
} from "@/lib/db";
import {
  createAssessmentForOrg,
  ensureOrgForUser,
  getAssessmentForUser,
  listResponsesForAssessment,
} from "@/lib/assessment";
import { playbookById } from "@/lib/playbook";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function createAssessmentAction(formData: FormData) {
  const userId = await requireUserId();
  const cycleLabel = String(formData.get("cycleLabel") ?? "").trim();
  if (!cycleLabel) throw new Error("Cycle label is required");

  const org = await ensureOrgForUser(userId);
  const assessment = await createAssessmentForOrg(org.id, cycleLabel);

  revalidatePath("/assessments");
  redirect(`/assessments/${assessment.id}`);
}

export async function updateOrgProfileAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "").trim();
  const cageCode = String(formData.get("cageCode") ?? "").trim();
  const samUei = String(formData.get("samUei") ?? "").trim();
  const naicsRaw = String(formData.get("naicsCodes") ?? "").trim();
  const scopedSystems = String(formData.get("scopedSystems") ?? "").trim();

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const naicsCodes = naicsRaw
    ? naicsRaw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const sql = getSql();
  await sql`
    UPDATE organizations
    SET name = ${name || ctx.organization.name},
        entity_type = ${entityType || null},
        cage_code = ${cageCode || null},
        sam_uei = ${samUei || null},
        naics_codes = ${naicsCodes},
        scoped_systems = ${scopedSystems || null},
        updated_at = NOW()
    WHERE id = ${ctx.organization.id}
  `;

  revalidatePath(`/assessments/${assessmentId}`);
}

export async function saveControlResponseAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const status = String(formData.get("status") ?? "") as ControlResponseStatus;
  const narrative = String(formData.get("narrative") ?? "").trim();

  if (!controlResponseStatuses.includes(status)) {
    throw new Error("Invalid status");
  }
  if (!playbookById[controlId]) {
    throw new Error("Unknown control");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  await sql`
    UPDATE control_responses
    SET status = ${status},
        narrative = ${narrative || null},
        updated_at = NOW()
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
  `;

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
}

export async function useSuggestedNarrativeAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");

  const entry = playbookById[controlId];
  if (!entry) throw new Error("Unknown control");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  const evidence = (await sql`
    SELECT filename FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    ORDER BY captured_at DESC
    LIMIT 1
  `) as Array<{ filename: string }>;

  const narrative = entry.suggestedNarrative({
    companyName: ctx.organization.name,
    scopedSystems: ctx.organization.scoped_systems || "the organization's information systems",
    capturedAt: new Date().toISOString().slice(0, 10),
    artifactFilename: evidence[0]?.filename ?? "[evidence pending]",
  });

  await sql`
    UPDATE control_responses
    SET narrative = ${narrative}, updated_at = NOW()
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
  `;

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
}

export async function uploadEvidenceAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const file = formData.get("file");

  if (!playbookById[controlId]) throw new Error("Unknown control");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a file to upload");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File too large — 25 MB max per upload");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pathname = `evidence/${assessmentId}/${controlId}/${Date.now()}-${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });

  const sql = getSql();
  await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes, uploaded_by_user_id)
    VALUES
      (${assessmentId}, ${controlId}, ${file.name}, ${blob.url},
       ${file.type || null}, ${file.size}, ${userId})
  `;

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function deleteEvidenceAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  const rows = (await sql`
    SELECT blob_url FROM evidence_artifacts
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
    LIMIT 1
  `) as Array<{ blob_url: string }>;

  if (rows.length === 0) return;

  try {
    await del(rows[0].blob_url);
  } catch {
    // Blob may already be gone; continue to remove the row anyway.
  }

  await sql`DELETE FROM evidence_artifacts WHERE id = ${artifactId}`;

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function submitAffirmationAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerTitle = String(formData.get("signerTitle") ?? "").trim();
  const acknowledged = formData.get("acknowledged") === "on";

  if (!signerName) throw new Error("Signer name is required");
  if (!signerTitle) throw new Error("Signer title is required");
  if (!acknowledged) {
    throw new Error("You must acknowledge the affirmation statement");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  if (!ctx.organization.scoped_systems) {
    throw new Error("Complete your business profile before signing");
  }

  const responses = await listResponsesForAssessment(assessmentId);
  const total = responses.length;
  const unanswered = responses.filter((r) => r.status === "unanswered").length;
  const notMet = responses.filter((r) => r.status === "no").length;
  const partial = responses.filter((r) => r.status === "partial").length;
  const met = responses.filter((r) => r.status === "yes").length;

  if (unanswered > 0) {
    throw new Error("Answer every practice before signing");
  }
  if (notMet > 0 || partial > 0) {
    throw new Error(
      "All practices must be Met or N/A before signing. Fix any Not met or Partial answers first.",
    );
  }

  const sprsScore = met === total ? 110 : null;

  const sql = getSql();
  await sql`
    UPDATE assessments
    SET status = 'attested',
        submitted_at = NOW(),
        affirmed_at = NOW(),
        affirmed_by_name = ${signerName},
        affirmed_by_title = ${signerTitle},
        sprs_score = ${sprsScore},
        updated_at = NOW()
    WHERE id = ${assessmentId}
  `;

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  redirect(`/assessments/${assessmentId}?signed=1`);
}
