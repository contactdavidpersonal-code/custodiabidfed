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
  controlsMissingEvidence,
  createAssessmentForOrg,
  deleteRemediationPlan,
  ensureOrgForUser,
  evidenceReviewBlockers,
  getAssessmentForUser,
  getBusinessProfile,
  listEvidenceForAssessment,
  listResponsesForAssessment,
  setArtifactCarryStatus,
  setResponseCarryStatus,
  tagArtifactPractice,
  untagArtifactPractice,
  upsertRemediationPlan,
} from "@/lib/assessment";
import { stampFreshnessOnInsert } from "@/lib/freshness";
import {
  carryForwardStatuses,
  remediationStatuses,
  type CarryForwardStatus,
  type RemediationStatus,
} from "@/lib/db";
import { playbookById } from "@/lib/playbook";
import { reviewEvidenceArtifact } from "@/lib/ai/evidence-review";
import {
  generateArtifactDraft,
  formatProfileFacts,
} from "@/lib/ai/artifact-generation";
import { signAttestation } from "@/lib/security/attestation-signature";
import { recordAuditEvent } from "@/lib/security/audit-log";

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

/**
 * Update the org-level federal registration fields. SAM UEI is 12 alphanumeric;
 * CAGE is 5 alphanumeric; NAICS codes are 6-digit numeric. We sanity-check the
 * length only — full validation against SAM.gov happens out of band.
 */
export async function saveFederalRegistrationAction(formData: FormData) {
  const userId = await requireUserId();
  const samUei = String(formData.get("samUei") ?? "").trim().toUpperCase();
  const cageCode = String(formData.get("cageCode") ?? "").trim().toUpperCase();
  const naicsRaw = String(formData.get("naicsCodes") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "").trim();

  const naicsCodes = naicsRaw
    .split(/[,\s]+/)
    .map((c) => c.trim())
    .filter((c) => /^\d{6}$/.test(c));

  if (samUei && !/^[A-Z0-9]{12}$/.test(samUei)) {
    throw new Error("SAM UEI must be 12 letters/numbers.");
  }
  if (cageCode && !/^[A-Z0-9]{5}$/.test(cageCode)) {
    throw new Error("CAGE code must be 5 letters/numbers.");
  }

  const org = await ensureOrgForUser(userId);
  const sql = getSql();
  await sql`
    UPDATE organizations
    SET sam_uei = ${samUei || null},
        cage_code = ${cageCode || null},
        naics_codes = ${naicsCodes}::text[],
        entity_type = ${entityType || null},
        updated_at = NOW()
    WHERE id = ${org.id}
  `;

  revalidatePath("/assessments");
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
  const questionId = String(formData.get("questionId") ?? "").trim();

  if (!playbookById[controlId]) throw new Error("Unknown control");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a file to upload");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File too large — 25 MB max per upload");
  }

  // MIME allowlist for FCI-grade evidence. Refuse executables, scripts,
  // unknown types, and archives (which can hide malicious content from
  // the vision-review step). Block at the action layer so a bypassed
  // client-side accept attribute can't sneak something through.
  const ALLOWED_MIME = new Set<string>([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]);
  const declaredMime = (file.type || "").toLowerCase();
  if (!declaredMime || !ALLOWED_MIME.has(declaredMime)) {
    const ctx = await getAssessmentForUser(assessmentId, userId);
    await recordAuditEvent({
      action: "evidence.rejected_mime",
      userId,
      organizationId: ctx?.organization.id ?? null,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: {
        controlId,
        filename: file.name,
        declaredMime: declaredMime || "(empty)",
        sizeBytes: file.size,
      },
    });
    throw new Error(
      `File type "${declaredMime || "unknown"}" is not allowed. Upload a screenshot (PNG/JPEG), PDF, plain text, CSV, or Office document.`,
    );
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // Evidence is now per-practice, not per-question. We keep the `questionId`
  // form field for backwards compatibility (older clients still send it) but
  // do NOT prepend a `[q:<id>]__` tag — uploads land under the raw filename
  // and apply to the whole practice. Older artifacts uploaded with the legacy
  // prefix continue to render correctly because the wizard strips the tag
  // for display.
  void questionId;
  const taggedName = file.name;
  const safeName = taggedName.replace(/[^a-zA-Z0-9._\[\]:-]+/g, "_");
  const pathname = `evidence/${assessmentId}/${controlId}/${Date.now()}-${safeName}`;

  // `addRandomSuffix: true` injects ~21 bytes of url-safe entropy into the
  // returned URL so it can't be enumerated even if an attacker knows the
  // org/assessment/control structure. The URL itself is still treated as
  // server-side secret — clients only ever see /api/evidence/{id}.
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "application/octet-stream",
  });

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes, uploaded_by_user_id)
    VALUES
      (${assessmentId}, ${controlId}, ${taggedName}, ${blob.url},
       ${file.type || null}, ${file.size}, ${userId})
    RETURNING id
  `) as Array<{ id: string }>;
  const artifactId = inserted[0].id;

  // Mirror the (assessment, practice) tag into the join table so the new
  // per-objective query path returns this artifact. Cross-practice reuse
  // (PR3) appends additional rows; the legacy `control_id` column on the
  // artifact stays as the primary upload home.
  await sql`
    INSERT INTO evidence_artifact_practices
      (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
    VALUES
      (${artifactId}, ${assessmentId}, ${controlId}, '{}'::text[], ${userId})
    ON CONFLICT (artifact_id, assessment_id, control_id) DO NOTHING
  `;

  await recordAuditEvent({
    action: "evidence.uploaded",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: {
      assessmentId,
      controlId,
      filename: file.name,
      mimeType: declaredMime,
      sizeBytes: file.size,
      blobUrl: blob.url,
    },
  });

  // Tag freshness class + default valid_until based on the filename / mime
  // type so the watchtower cron can email the user before this artifact
  // expires. Best-effort: a failure here is logged but does not block the
  // upload.
  try {
    await stampFreshnessOnInsert({
      artifactId,
      filename: file.name,
      mimeType: file.type || null,
    });
  } catch (err) {
    console.error("stampFreshnessOnInsert threw:", err);
  }

  // Every upload is reviewed immediately — see feedback_evidence_gating.md.
  // We block the action until the review returns so the user sees the verdict
  // inline rather than discovering it later at attestation time.
  const profile = await getBusinessProfile(ctx.organization.id);
  const companyContext = summarizeBusinessContext(
    ctx.organization.name,
    ctx.organization.scoped_systems,
    profile?.data,
  );
  try {
    await reviewEvidenceArtifact({
      artifactId,
      claimedControlId: controlId,
      blobUrl: blob.url,
      mimeType: file.type || null,
      filename: file.name,
      companyContext,
    });
  } catch (err) {
    // Review persistence already wraps its own errors; this catches any
    // outer failure. Leave the row in 'pending review' state (null verdict)
    // so the UI prompts a retry.
    console.error("reviewEvidenceArtifact threw:", err);
  }

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

/**
 * Charlie-drafted artifact: synthesize a Markdown policy / roster / procedure
 * from the org's onboarding profile, upload it as evidence, and tag it to the
 * current practice. The draft always includes a "[REVIEW BEFORE SUBMITTING]"
 * banner and bracketed `[FILL IN: ...]` placeholders for facts Charlie does
 * not have, so the user must review/edit before it can pass attestation.
 *
 * The vision-review pipeline returns 'unclear' for markdown (it only handles
 * images/PDFs), which is exactly what we want — the user has to look at it.
 */
export async function generateArtifactAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");

  const practice = playbookById[controlId];
  if (!practice) throw new Error("Unknown control");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const profile = await getBusinessProfile(ctx.organization.id);

  // Strip the non-serializable suggestedNarrative function before passing
  // to the generator (matches the page.tsx server/client boundary pattern).
  const { suggestedNarrative: _suggestedNarrative, ...practiceForGen } = practice;
  void _suggestedNarrative;

  const markdown = await generateArtifactDraft({
    practice: practiceForGen,
    companyName: ctx.organization.name,
    scopedSystems: ctx.organization.scoped_systems ?? "",
    naicsCodes: ctx.organization.naics_codes,
    entityType: ctx.organization.entity_type,
    profileFacts: formatProfileFacts(profile?.data ?? {}),
  });

  const filename = `${controlId}-charlie-draft-${Date.now()}.md`;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pathname = `evidence/${assessmentId}/${controlId}/${safeName}`;
  const blob = await put(pathname, markdown, {
    access: "public",
    addRandomSuffix: true,
    contentType: "text/markdown",
  });

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes, uploaded_by_user_id)
    VALUES
      (${assessmentId}, ${controlId}, ${filename}, ${blob.url},
       ${"text/markdown"}, ${markdown.length}, ${userId})
    RETURNING id
  `) as Array<{ id: string }>;
  const artifactId = inserted[0].id;

  await sql`
    INSERT INTO evidence_artifact_practices
      (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
    VALUES
      (${artifactId}, ${assessmentId}, ${controlId}, '{}'::text[], ${userId})
    ON CONFLICT (artifact_id, assessment_id, control_id) DO NOTHING
  `;

  await recordAuditEvent({
    action: "evidence.generated",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: {
      assessmentId,
      controlId,
      filename,
      sizeBytes: markdown.length,
      blobUrl: blob.url,
    },
  });

  try {
    await stampFreshnessOnInsert({
      artifactId,
      filename,
      mimeType: "text/markdown",
    });
  } catch (err) {
    console.error("stampFreshnessOnInsert (generated) threw:", err);
  }

  // Run the vision-review pipeline so the row gets a verdict in the UI
  // (will return 'unclear' for markdown, which is the correct signal that
  // a human must read the draft before it counts toward attestation).
  try {
    await reviewEvidenceArtifact({
      artifactId,
      claimedControlId: controlId,
      blobUrl: blob.url,
      mimeType: "text/markdown",
      filename,
    });
  } catch (err) {
    console.error("reviewEvidenceArtifact (generated) threw:", err);
  }

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function reReviewEvidenceAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  const rows = (await sql`
    SELECT id, control_id, blob_url, mime_type, filename
    FROM evidence_artifacts
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
    LIMIT 1
  `) as Array<{
    id: string;
    control_id: string;
    blob_url: string;
    mime_type: string | null;
    filename: string;
  }>;
  if (rows.length === 0) throw new Error("Artifact not found");
  const row = rows[0];

  const profile = await getBusinessProfile(ctx.organization.id);
  const companyContext = summarizeBusinessContext(
    ctx.organization.name,
    ctx.organization.scoped_systems,
    profile?.data,
  );

  await reviewEvidenceArtifact({
    artifactId: row.id,
    claimedControlId: row.control_id,
    blobUrl: row.blob_url,
    mimeType: row.mime_type,
    filename: row.filename,
    companyContext,
  });

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

function summarizeBusinessContext(
  orgName: string,
  scopedSystems: string | null,
  profileData: Record<string, unknown> | undefined,
): string {
  const parts: string[] = [`Organization: ${orgName}.`];
  if (scopedSystems) parts.push(`Scope: ${scopedSystems}.`);
  if (profileData && Object.keys(profileData).length > 0) {
    parts.push(`Business profile: ${JSON.stringify(profileData)}`);
  }
  return parts.join(" ");
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

  await recordAuditEvent({
    action: "evidence.deleted",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: { assessmentId, controlId, blobUrl: rows[0].blob_url },
  });

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

/**
 * Cross-tag an existing artifact to ANOTHER practice in the same assessment.
 * Does not move or copy the artifact — both practices share the same file.
 * Idempotent (safe to click twice). Used by the reuse picker on the practice
 * page so a single uploaded screenshot can satisfy multiple CMMC practices.
 */
export async function tagArtifactPracticeAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  if (!playbookById[controlId]) throw new Error("Unknown control");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // Confirm the artifact actually belongs to this assessment before tagging.
  const sql = getSql();
  const owns = (await sql`
    SELECT 1 FROM evidence_artifacts
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
    LIMIT 1
  `) as Array<{ "?column?": number }>;
  if (owns.length === 0) throw new Error("Artifact not found");

  await tagArtifactPractice({
    artifactId,
    assessmentId,
    controlId,
    objectives: [],
    userId,
  });

  await recordAuditEvent({
    action: "evidence.tagged",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: { assessmentId, controlId },
  });

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

/**
 * Remove a cross-practice tag. Does NOT delete the artifact — the artifact
 * stays on its original practice. No-op if the tag matches the artifact's
 * primary `control_id` (you can't untag from the home practice).
 */
export async function untagArtifactPracticeAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  const rows = (await sql`
    SELECT control_id FROM evidence_artifacts
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
    LIMIT 1
  `) as Array<{ control_id: string }>;
  if (rows.length === 0) return;
  // Block untagging from the artifact's primary practice — that would
  // orphan the file. The user must use Remove from the home practice.
  if (rows[0].control_id === controlId) {
    throw new Error("Cannot untag from primary practice; use Remove instead.");
  }

  await untagArtifactPractice({ artifactId, assessmentId, controlId });

  await recordAuditEvent({
    action: "evidence.untagged",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: { assessmentId, controlId },
  });

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
  const notApplicable = responses.filter(
    (r) => r.status === "not_applicable",
  ).length;

  if (unanswered > 0) {
    throw new Error("Answer every practice before signing");
  }
  if (notMet > 0 || partial > 0) {
    throw new Error(
      "All practices must be Met or N/A before signing. Fix any Not met or Partial answers first.",
    );
  }

  // Carry-forward gate: any imported response/artifact still in pending_review
  // must be resolved before this cycle counts as a clean affirmation.
  const pendingResponses = responses.filter(
    (r) => r.carry_forward_status === "pending_review",
  );
  if (pendingResponses.length > 0) {
    throw new Error(
      `Review last year's imported answers first — ${pendingResponses.length} practice${pendingResponses.length === 1 ? "" : "s"} still pending review.`,
    );
  }

  // Evidence gate: every uploaded artifact must have passed AI review. See
  // feedback_evidence_gating.md. No cat-pic affirmations.
  const evidence = await listEvidenceForAssessment(assessmentId);
  const blockers = evidenceReviewBlockers(
    evidence.filter((e) => e.carry_forward_status !== "removed"),
  );
  if (blockers.length > 0) {
    const sample = blockers
      .slice(0, 3)
      .map((b) => `${b.filename} — ${b.reason}`)
      .join("; ");
    const more = blockers.length > 3 ? ` (+${blockers.length - 3} more)` : "";
    throw new Error(
      `Evidence review not complete. Resolve these before signing: ${sample}${more}`,
    );
  }

  // Min-evidence gate: a "Met" answer with zero passing artifacts and no
  // narrative justification is a paper claim. Block at sign-time.
  const missingEvidence = controlsMissingEvidence(responses, evidence);
  if (missingEvidence.length > 0) {
    const ids = missingEvidence
      .slice(0, 5)
      .map((m) => m.control_id)
      .join(", ");
    const more =
      missingEvidence.length > 5 ? ` (+${missingEvidence.length - 5} more)` : "";
    throw new Error(
      `Practices marked Met need at least one passing artifact (or a 200+ char narrative explaining why none applies): ${ids}${more}`,
    );
  }

  // CMMC L1 affirmation is binary: implements all 17, yes/no. We track the
  // outcome on `implements_all_17`. The legacy `sprs_score` column is only
  // populated for L2/DFARS-7012 cycles which use NIST 800-171 110-point
  // scoring; for L1 it stays NULL.
  const allAccountedFor = met + notApplicable === total;
  const implementsAll17 =
    ctx.assessment.framework === "cmmc_l1" ? allAccountedFor : null;

  const sql = getSql();
  // CMMC L1 / FAR 52.204-21 evidentiary integrity: produce an HMAC-SHA-256
  // signature over the canonical attestation payload. Stored alongside the
  // canonical JSON so the legal artifact can be re-verified at any time.
  const signed = signAttestation({
    version: 1,
    framework: ctx.assessment.framework as "cmmc_l1" | "cmmc_l2",
    assessmentId,
    organizationId: ctx.organization.id,
    organizationName: ctx.organization.name,
    samUei: ctx.organization.sam_uei ?? null,
    cageCode: ctx.organization.cage_code ?? null,
    fiscalYear: ctx.assessment.fiscal_year ?? null,
    implementsAll17: implementsAll17 ?? false,
    signerName,
    signerTitle,
    signerUserId: userId,
    signedAt: new Date().toISOString(),
    responses: [...responses]
      .sort((a, b) => a.control_id.localeCompare(b.control_id))
      .map((r) => ({
        controlId: r.control_id,
        status: r.status,
        notes: r.narrative ?? null,
      })),
    evidence: [...evidence]
      .filter((e) => e.carry_forward_status !== "removed")
      .sort(
        (a, b) =>
          a.control_id.localeCompare(b.control_id) || a.id.localeCompare(b.id),
      )
      .map((e) => ({
        controlId: e.control_id,
        artifactId: e.id,
        filename: e.filename,
        mimeType: e.mime_type ?? null,
        sizeBytes: e.size_bytes ?? null,
        blobUrl: e.blob_url,
      })),
  });

  await sql`
    UPDATE assessments
    SET status = 'attested',
        submitted_at = NOW(),
        affirmed_at = NOW(),
        affirmed_by_name = ${signerName},
        affirmed_by_title = ${signerTitle},
        sprs_score = NULL,
        implements_all_17 = ${implementsAll17},
        attestation_canonical = ${signed.canonical},
        attestation_payload_sha256 = ${signed.payloadSha256Hex},
        attestation_signature = ${signed.signatureHex},
        attestation_signature_key_version = ${signed.keyVersion},
        updated_at = NOW()
    WHERE id = ${assessmentId}
  `;

  await recordAuditEvent({
    action: "assessment.attested",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "assessment",
    resourceId: assessmentId,
    metadata: {
      framework: ctx.assessment.framework,
      fiscalYear: ctx.assessment.fiscal_year,
      signerName,
      signerTitle,
      implementsAll17,
      payloadSha256: signed.payloadSha256Hex,
      keyVersion: signed.keyVersion,
      evidenceCount: evidence.length,
      responseCount: responses.length,
    },
  });

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  redirect(`/assessments/${assessmentId}?signed=1`);
}

export async function upsertRemediationPlanAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const gapSummary = String(formData.get("gapSummary") ?? "").trim();
  const plannedActions = String(formData.get("plannedActions") ?? "").trim();
  const targetCloseDate = String(formData.get("targetCloseDate") ?? "").trim();
  const status = String(formData.get("status") ?? "open") as RemediationStatus;

  if (!gapSummary) throw new Error("Describe the gap");
  if (!plannedActions) throw new Error("Describe the planned actions");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetCloseDate)) {
    throw new Error("Target close date must be YYYY-MM-DD");
  }
  if (!remediationStatuses.includes(status)) {
    throw new Error("Invalid remediation status");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");
  if (!playbookById[controlId]) throw new Error("Unknown control");

  await upsertRemediationPlan({
    assessmentId,
    controlId,
    gapSummary,
    plannedActions,
    targetCloseDate,
    status,
  });

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
}

export async function deleteRemediationPlanAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  await deleteRemediationPlan(assessmentId, controlId);

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
}

export async function decideCarryForwardResponseAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const decision = String(formData.get("decision") ?? "") as CarryForwardStatus;

  if (!carryForwardStatuses.includes(decision)) {
    throw new Error("Invalid carry-forward decision");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // 'needs_replacement' resets the response so the user re-answers this cycle.
  if (decision === "needs_replacement") {
    const sql = getSql();
    await sql`
      UPDATE control_responses
      SET status = 'unanswered',
          narrative = NULL,
          carry_forward_status = 'needs_replacement',
          updated_at = NOW()
      WHERE assessment_id = ${assessmentId}::uuid AND control_id = ${controlId}
    `;
  } else {
    await setResponseCarryStatus(assessmentId, controlId, decision);
  }

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
}

export async function decideCarryForwardArtifactAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const decision = String(formData.get("decision") ?? "") as CarryForwardStatus;

  if (!carryForwardStatuses.includes(decision)) {
    throw new Error("Invalid carry-forward decision");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // Confirm the artifact actually belongs to this assessment before mutating.
  const sql = getSql();
  const owner = (await sql`
    SELECT control_id FROM evidence_artifacts
    WHERE id = ${artifactId}::uuid AND assessment_id = ${assessmentId}::uuid
    LIMIT 1
  `) as Array<{ control_id: string }>;
  if (owner.length === 0) throw new Error("Artifact not found");

  await setArtifactCarryStatus(artifactId, decision);
  // 'kept' triggers a re-review since the artifact applies to a new fiscal
  // year (currency check). The current pipeline runs review on upload only;
  // we mark the row to surface "needs re-review" in UI without re-fetching
  // the blob here.
  if (decision === "kept") {
    await sql`
      UPDATE evidence_artifacts
      SET ai_review_verdict = NULL,
          ai_review_summary = NULL,
          ai_reviewed_at = NULL
      WHERE id = ${artifactId}::uuid
    `;
  }

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/controls/${owner[0].control_id}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
}
