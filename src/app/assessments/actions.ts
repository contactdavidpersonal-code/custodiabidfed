"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { del, get, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  controlResponseStatuses,
  type ControlResponseStatus,
  getSql,
} from "@/lib/db";
import {
  controlsMissingEvidence,
  controlsMissingNaJustification,
  createAssessmentForOrg,
  deleteRemediationPlan,
  ensureOrgForUser,
  evidenceReviewBlockers,
  getAssessmentForUser,
  getBusinessProfile,
  listEvidenceForAssessment,
  listResponsesForAssessment,
  materialChangeQuestionKeys,
  recordMaterialChangeReview,
  setArtifactCarryStatus,
  setResponseCarryStatus,
  tagArtifactPractice,
  untagArtifactPractice,
  updateBusinessProfile,
  upsertRemediationPlan,
  type MaterialChangeAnswers,
  type MaterialChangeQuestionKey,
} from "@/lib/assessment";
import { stampFreshnessOnInsert } from "@/lib/freshness";
import {
  getSamEntityStatus,
  summarizeSamStatus,
  type SamEntityStatus,
} from "@/lib/sam-entity";
import {
  carryForwardStatuses,
  remediationStatuses,
  type CarryForwardStatus,
  type RemediationStatus,
} from "@/lib/db";
import { playbookById } from "@/lib/playbook";
import {
  controlsBlockingAffirmation,
  syncLegacyStatusToObjectives,
} from "@/lib/cmmc/objectives";
import {
  assembleBoundaryView,
  validateBoundary,
} from "@/lib/cmmc/boundary";
import { reviewEvidenceArtifact } from "@/lib/ai/evidence-review";
import {
  appendMessage,
  getOrCreateWorkspaceConversation,
} from "@/lib/ai/conversations";
import {
  generateArtifactDraft,
  formatProfileFacts,
} from "@/lib/ai/artifact-generation";
import { signAttestation } from "@/lib/security/attestation-signature";
import { sha256HexBytes } from "@/lib/security/crypto";
import { recordAuditEvent } from "@/lib/security/audit-log";
import {
  checkRateLimit,
  rateLimitKey,
} from "@/lib/security/rate-limit";
import {
  encryptBytes,
  encryptField,
  tryDecryptBytes,
} from "@/lib/security/field-encryption";
import { sendSprsFiledEmail } from "@/lib/email/sprs-filed";
import {
  provisionTrustPageForFiling,
  publishTrustPage,
  unpublishTrustPage,
  rotateTrustSlug,
  updateTrustPageContentAction,
} from "@/lib/trust-page";
import {
  buildPracticeSnapshot,
  createPracticeAffirmation,
} from "@/lib/cmmc/affirmation";
import {
  getOrCreatePracticeConversation,
} from "@/lib/cmmc/practice-chat";
import { getPracticeSpec, personalizeSpec } from "@/lib/cmmc/practice-spec";
import { listEvidenceForControl } from "@/lib/assessment";

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
 *
 * If the form posts an `assessmentId` and the save leaves the org with both a
 * UEI and at least one NAICS code (the bar for unlocking the practices step),
 * we forward the user straight to the assessment overview so they can start
 * working through the 15 safeguarding requirements without an extra click.
 */
export async function saveFederalRegistrationAction(formData: FormData) {
  const userId = await requireUserId();
  const samUei = String(formData.get("samUei") ?? "").trim().toUpperCase();
  const cageCode = String(formData.get("cageCode") ?? "").trim().toUpperCase();
  const naicsRaw = String(formData.get("naicsCodes") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "").trim();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();

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

  // Live SAM Entity validation. Soft check: confirm the UEI exists in
  // SAM and the registered legal business name reasonably matches the
  // company name on file. Record the result on the audit log either
  // way. A mismatch raises a non-blocking warning surfaced via query
  // param on the registration page; a SAM outage degrades to silence.
  // (Plan: sprs-readiness-upgrades.md #19; sam-entity.ts JSDoc.)
  let samWarning: "ok" | "not_found" | "inactive" | "name_mismatch" | null = null;
  if (samUei) {
    try {
      const status = await getSamEntityStatus(samUei);
      if (status.kind === "active") {
        const samName = (status.legalBusinessName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const orgName = org.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        // First-time org name is the literal "My Organization" stub;
        // skip the comparison in that case so we don't flag every new user.
        if (samName.length > 0 && orgName.length > 0 && orgName !== "myorganization" && !samName.includes(orgName) && !orgName.includes(samName)) {
          samWarning = "name_mismatch";
        } else {
          samWarning = "ok";
        }
      } else if (status.kind === "inactive") {
        samWarning = "inactive";
      } else if (status.kind === "not_found") {
        samWarning = "not_found";
      }
      await recordAuditEvent({
        userId,
        organizationId: org.id,
        action: "organization.sam_uei_validated",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { uei: samUei, status: status.kind, result: samWarning },
      });
    } catch (err) {
      console.error("[sam-entity] validation failed during registration save", err);
    }
  }

  revalidatePath("/assessments");
  if (assessmentId) {
    revalidatePath(`/assessments/${assessmentId}`);
    revalidatePath(`/assessments/${assessmentId}/registration`);
  }

  // Forward to the scope inventory step once the registration step is
  // complete (UEI + at least one NAICS). The Scoping Guide L1 § 170.19(b)(3)
  // requires People / Technology / Facility / ESP inventory before any
  // practice work is meaningful, so we deliberately route to /scope here
  // rather than the practices overview. Otherwise stay on the registration
  // page so the user can finish filling things in.
  const registrationComplete = Boolean(samUei) && naicsCodes.length > 0;
  if (assessmentId && registrationComplete) {
    if (samWarning && samWarning !== "ok") {
      redirect(`/assessments/${assessmentId}/registration?sam_warning=${samWarning}`);
    }
    redirect(`/assessments/${assessmentId}/scope`);
  }
  if (assessmentId && samWarning && samWarning !== "ok") {
    redirect(`/assessments/${assessmentId}/registration?sam_warning=${samWarning}`);
  }
}

/**
 * Material-change interview (Scoping Guide L1 v2.13 § 170.19 p. 4). Required
 * on carried-forward cycles before the user can walk the practices step.
 * If any answer is "yes" we wipe the carried responses and force a fresh
 * walk. If all "no" we record the review and let the carried draft stand
 * (annual affirmation only).
 */
export async function submitMaterialChangeReviewAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim();

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found.");
  if (!ctx.assessment.carried_forward_from) {
    // Defensive: only carry-forward cycles need this interview.
    redirect(`/assessments/${assessmentId}`);
  }

  const answers = {} as MaterialChangeAnswers;
  let anyYes = false;
  for (const key of materialChangeQuestionKeys) {
    const raw = String(formData.get(key) ?? "").trim().toLowerCase();
    if (raw !== "yes" && raw !== "no") {
      return {
        error:
          "Answer every question with yes or no — Scoping Guide L1 v2.13 § 170.19 p. 4 requires a complete review.",
      };
    }
    const val = raw === "yes";
    answers[key as MaterialChangeQuestionKey] = val;
    if (val) anyYes = true;
  }

  if (anyYes && rationale.length < 40) {
    return {
      error:
        "When any answer is yes, describe what changed in at least 40 characters so the audit trail captures the trigger.",
    };
  }

  await recordMaterialChangeReview({
    assessmentId,
    answers,
    rationale: rationale || null,
    requiredReassessment: anyYes,
  });

  await recordAuditEvent({
    action: "assessment.material_change_reviewed",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "assessment",
    resourceId: assessmentId,
    metadata: {
      requiredReassessment: anyYes,
      answers,
    },
  });

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/material-change`);
  redirect(`/assessments/${assessmentId}`);
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

  // Mirror the legacy single-status into the v2.13 per-objective table so
  // the 15-requirement rollup stays in sync. Untouched objectives (those
  // the user has not explicitly edited via the per-objective UI) follow.
  if (ctx.assessment.framework === "cmmc_l1") {
    await syncLegacyStatusToObjectives({
      assessmentId,
      controlId,
      legacyStatus: status,
    });
  }

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

  // Per-user upload throttle. 60/hr is generous for legitimate evidence
  // collection (a thorough CMMC L1 cycle is ~30 artifacts) but blunts a
  // compromised session being used for abuse, blob-storage cost attacks,
  // or rapid AI review cost amplification.
  const rl = await checkRateLimit(
    rateLimitKey({ scope: "evidence-upload", userId }),
    { max: 60, windowSec: 3600 },
  );
  if (!rl.allowed) {
    await recordAuditEvent({
      action: "rate_limit.exceeded",
      userId,
      resourceType: "upload",
      metadata: { scope: "evidence-upload", retryAfterSec: rl.retryAfterSec },
    });
    throw new Error(
      `Too many uploads. Please wait ${rl.retryAfterSec}s and try again.`,
    );
  }

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
  // For the hybrid practice flow we DO want to bind an upload to a specific
  // evidence slot (e.g. `authorized_users_roster`). The PracticeChat per-slot
  // upload form sends `slotKey` so the EvidencePanel can show "1/5 collected"
  // and route the artifact to the right card.
  const slotKey = String(formData.get("slotKey") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const taggedName = slotKey
    ? `[slot:${slotKey}]__${file.name}`
    : file.name;
  const safeName = taggedName.replace(/[^a-zA-Z0-9._\[\]:-]+/g, "_");
  const pathname = `evidence/${assessmentId}/${controlId}/${Date.now()}-${safeName}`;

  // `addRandomSuffix: true` injects ~21 bytes of url-safe entropy into the
  // returned URL so it can't be enumerated even if an attacker knows the
  // org/assessment/control structure. The URL itself is still treated as
  // server-side secret — clients only ever see /api/evidence/{id}.
  //
  // Tier 1 zero-trust: encrypt the bytes BEFORE handing them to the blob
  // store. AAD binds the ciphertext to (orgId, assessmentId, controlId) so a
  // ciphertext swap across tenants or practices fails decryption. The DB
  // still records the original mime/size for downstream UX; the bytes on
  // disk are AES-256-GCM with a per-upload IV.
  const plaintextBytes = Buffer.from(await file.arrayBuffer());
  const encryptedBytes = await encryptBytes(plaintextBytes, {
    organizationId: ctx.organization.id,
    field: `evidence:${assessmentId}:${controlId}`,
  });
  const blob = await put(pathname, encryptedBytes, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
  });

  const sql = getSql();
  // CMMC AG L1 v2.13 §§ 5–7 assessment method (optional). Stored on the
  // artifact so the SSP can render the per-method tally per practice.
  const methodRaw = String(formData.get("method") ?? "").trim().toLowerCase();
  const method =
    methodRaw === "examine" || methodRaw === "interview" || methodRaw === "test"
      ? methodRaw
      : null;
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes, uploaded_by_user_id, assessment_method)
    VALUES
      (${assessmentId}, ${controlId}, ${taggedName}, ${blob.url},
       ${file.type || null}, ${file.size}, ${userId}, ${method})
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

  // Charlie's review is opt-in for the legacy wizard flow (the artifact
  // lands with `ai_review_verdict = NULL` and the user clicks "Ask Charlie
  // to review" when ready). But the hybrid chat flow sends `slotKey` — in
  // that flow the user just dropped a screenshot into a specific slot
  // expecting Charlie to verify it lives up to the assessor expectation.
  // Auto-run the review in-band so the verdict is on the row by the time
  // the page revalidates. Best-effort: if the model call fails we still
  // return success and the user can click "Re-review" manually.
  if (slotKey) {
    try {
      const profile = await getBusinessProfile(ctx.organization.id);
      const companyContext = summarizeBusinessContext(
        ctx.organization.name,
        ctx.organization.scoped_systems,
        profile?.data,
      );
      // Bug 4 fix: thread the slot's label/hint/satisfies into the
      // reviewer so it judges against the SLOT's narrow purpose, not
      // the parent practice's full requirement. Resolve via the
      // PERSONALIZED spec so dynamic slots (e.g. BYOD) are found.
      let slotContext: {
        key: string;
        label: string;
        hint: string;
        satisfies: string[];
      } | undefined;
      const baseSpec = getPracticeSpec(controlId);
      if (baseSpec) {
        let effSpec: typeof baseSpec = baseSpec;
        try {
          const convRows = (await sql`
            SELECT intake_answers
            FROM practice_conversations
            WHERE assessment_id = ${assessmentId}
              AND control_id = ${controlId}
            LIMIT 1
          `) as Array<{ intake_answers: Record<string, string> | null }>;
          const intake = convRows[0]?.intake_answers ?? null;
          const personalized = personalizeSpec(baseSpec, intake);
          if (personalized) effSpec = personalized;
        } catch {
          // Personalization is a refinement; fall back silently.
        }
        const slot = effSpec.evidenceSlots.find((s) => s.key === slotKey);
        if (slot) {
          slotContext = {
            key: slot.key,
            label: slot.label,
            hint: slot.hint,
            satisfies: slot.satisfies,
          };
        }
      }
      await reviewEvidenceArtifact({
        artifactId,
        claimedControlId: controlId,
        blobUrl: blob.url,
        mimeType: file.type || null,
        filename: taggedName,
        companyContext,
        organizationId: ctx.organization.id,
        assessmentId,
        slotContext,
      });
    } catch (err) {
      console.error("auto-review on slot upload failed:", err);
    }
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
  // Encrypt bytes at rest — same envelope/AAD scheme as user uploads.
  const encryptedDraftBytes = await encryptBytes(
    Buffer.from(markdown, "utf8"),
    {
      organizationId: ctx.organization.id,
      field: `evidence:${assessmentId}:${controlId}`,
    },
  );
  const blob = await put(pathname, encryptedDraftBytes, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
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

  // Charlie's review is opt-in (same pattern as user uploads). The draft
  // lands as "not yet reviewed" so the user reviews it manually and clicks
  // "Ask Charlie to review" once they've filled in the [FILL IN: …] slots.

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
}

/**
 * Vault entry — turn a structured form (rows of key/value cells the user
 * filled inline in the practice quiz) into a CSV artifact stored as
 * evidence. Identical lifecycle to a user upload: lands as
 * "Not yet reviewed", clickable "Ask Charlie to review" gives a verdict.
 *
 * Body: assessmentId, controlId, title, filenameStem, headers (JSON string
 *       of column labels), rows (JSON string of string[][]).
 */
export async function submitVaultEntryAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const title = String(formData.get("title") ?? "Vault entry").slice(0, 120);
  const filenameStem = String(formData.get("filenameStem") ?? "vault-entry")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 80) || "vault-entry";

  let headers: string[] = [];
  let rows: string[][] = [];
  try {
    const h = JSON.parse(String(formData.get("headers") ?? "[]"));
    const r = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(h) || !Array.isArray(r)) throw new Error("bad shape");
    headers = h.map((s) => String(s).slice(0, 200));
    rows = r.map((row: unknown) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "").slice(0, 1000)) : [],
    );
  } catch {
    throw new Error("Vault entry was malformed.");
  }
  if (headers.length === 0 || rows.length === 0) {
    throw new Error("Vault entry needs at least one row.");
  }

  if (!playbookById[controlId]) throw new Error("Unknown control");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // Build CSV with proper escaping for quotes / commas / newlines.
  const escape = (s: string) =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const csvLines = [
    `# ${title}`,
    `# Captured by ${ctx.organization.name} on ${new Date().toISOString().slice(0, 10)}`,
    `# Practice: ${controlId}`,
    headers.map(escape).join(","),
    ...rows.map((row) =>
      headers.map((_, i) => escape(row[i] ?? "")).join(","),
    ),
  ];
  const csv = csvLines.join("\r\n") + "\r\n";

  const filename = `${filenameStem}-${Date.now()}.csv`;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pathname = `evidence/${assessmentId}/${controlId}/${safeName}`;
  // Encrypt bytes at rest — same envelope/AAD scheme as user uploads.
  const encryptedCsvBytes = await encryptBytes(Buffer.from(csv, "utf8"), {
    organizationId: ctx.organization.id,
    field: `evidence:${assessmentId}:${controlId}`,
  });
  const blob = await put(pathname, encryptedCsvBytes, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
  });

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes, uploaded_by_user_id)
    VALUES
      (${assessmentId}, ${controlId}, ${filename}, ${blob.url},
       ${"text/csv"}, ${csv.length}, ${userId})
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
    action: "evidence.vault_entry",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: {
      assessmentId,
      controlId,
      filename,
      title,
      rowCount: rows.length,
      sizeBytes: csv.length,
      blobUrl: blob.url,
    },
  });

  try {
    await stampFreshnessOnInsert({
      artifactId,
      filename,
      mimeType: "text/csv",
    });
  } catch (err) {
    console.error("stampFreshnessOnInsert (vault) threw:", err);
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

  // Bug 4 fix: when an artifact's filename is prefixed with [slot:KEY]__,
  // resolve the slot from the personalized spec so the re-review judges
  // against the slot's narrow purpose rather than the parent practice.
  let slotContext:
    | { key: string; label: string; hint: string; satisfies: string[] }
    | undefined;
  const slotMatch = /^\[slot:([a-z0-9_]+)\]__/i.exec(row.filename);
  if (slotMatch) {
    const slotKey = slotMatch[1].toLowerCase();
    const baseSpec = getPracticeSpec(row.control_id);
    if (baseSpec) {
      let effSpec: typeof baseSpec = baseSpec;
      try {
        const convRows = (await sql`
          SELECT intake_answers
          FROM practice_conversations
          WHERE assessment_id = ${assessmentId}
            AND control_id = ${row.control_id}
          LIMIT 1
        `) as Array<{ intake_answers: Record<string, string> | null }>;
        const intake = convRows[0]?.intake_answers ?? null;
        const personalized = personalizeSpec(baseSpec, intake);
        if (personalized) effSpec = personalized;
      } catch {
        // fall through with base spec
      }
      const slot = effSpec.evidenceSlots.find((s) => s.key === slotKey);
      if (slot) {
        slotContext = {
          key: slot.key,
          label: slot.label,
          hint: slot.hint,
          satisfies: slot.satisfies,
        };
      }
    }
  }

  await reviewEvidenceArtifact({
    artifactId: row.id,
    claimedControlId: row.control_id,
    blobUrl: row.blob_url,
    mimeType: row.mime_type,
    filename: row.filename,
    companyContext,
    organizationId: ctx.organization.id,
    assessmentId,
    slotContext,
  });

  // Mirror the review into the workspace chat so the user can ask
  // follow-up questions ("why insufficient?", "what would pass?") in
  // Charlie's rail. We re-pull the freshly-written verdict to use the
  // canonical persisted text.
  try {
    const verdictRows = (await sql`
      SELECT ai_review_verdict, ai_review_summary
      FROM evidence_artifacts
      WHERE id = ${row.id}
      LIMIT 1
    `) as Array<{
      ai_review_verdict: string | null;
      ai_review_summary: string | null;
    }>;
    const verdict = verdictRows[0]?.ai_review_verdict ?? "unclear";
    const summary =
      verdictRows[0]?.ai_review_summary ??
      "I finished the review but didn't get a written summary back.";

    const practice = playbookById[row.control_id];
    const practiceLabel = practice
      ? `${practice.id} — ${practice.shortName}`
      : row.control_id;

    const conv = await getOrCreateWorkspaceConversation(ctx.organization.id);

    await appendMessage({
      conversationId: conv.id,
      role: "user",
      content: `Charlie, can you review **${row.filename}** for ${practiceLabel}?`,
    });

    const verdictHeading: Record<string, string> = {
      sufficient: "✅ Sufficient — this is good evidence, you can move on.",
      insufficient: "⚠️ Insufficient — close, but it needs a fix.",
      unclear: "❓ Unclear — I need a bit more context.",
      not_relevant: "🚫 Not relevant — this doesn't evidence the practice.",
    };
    const heading =
      verdictHeading[verdict] ?? `Verdict: ${verdict}`;
    const assistantText = `**Reviewing ${row.filename}** against ${practiceLabel}…\n\n${heading}\n\n${summary}\n\n_Want me to explain anything, or suggest what to add?_`;

    await appendMessage({
      conversationId: conv.id,
      role: "assistant",
      content: assistantText,
      model: "evidence-review",
    });
  } catch (err) {
    // Chat mirroring is best-effort. The verdict is already persisted on
    // the artifact row, so don't fail the action if chat write fails.
    console.error("review chat-mirror failed:", err);
  }

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
 * Tag an artifact with the CMMC AG L1 v2.13 §§ 5–7 assessment method the
 * (self-)assessor used to verify it: Examine (read the doc), Interview
 * (talk to the responsible person), or Test (operate the control). The
 * SSP renders this per artifact so a prime can see the method mix.
 * Optional metadata — empty/unset is fine.
 */
export async function setEvidenceMethodAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const methodRaw = String(formData.get("method") ?? "").trim().toLowerCase();
  const method =
    methodRaw === "examine" || methodRaw === "interview" || methodRaw === "test"
      ? methodRaw
      : null;

  if (!playbookById[controlId]) throw new Error("Unknown control");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET assessment_method = ${method}
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
  `;

  await recordAuditEvent({
    action: "evidence.method_set",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: { assessmentId, controlId, method },
  });

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
}

/**
 * Mark a Charlie-drafted (or otherwise unfinished) artifact as a FINAL
 * adopted policy of record. CMMC AG L1 v2.13 p. 7 + § 170.24 require
 * "final form" evidence — drafts auto-fail the AI vision gate by design.
 * The override path: the user names an adopter (typically the AO or
 * ISSM) and an adoption date; the artifact is then accepted as MET
 * regardless of the vision verdict, and the SSP renders an explicit
 * adoption disclosure ("Final policy adopted YYYY-MM-DD by <name>").
 *
 * Refuses to override an artifact the AI actively flagged `insufficient`
 * or `not_relevant` — those need a replacement, not a stamp.
 */
export async function markEvidenceAsFinalAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const artifactId = String(formData.get("artifactId") ?? "");
  const adoptedBy = String(formData.get("adoptedBy") ?? "").trim();
  const adoptedAtRaw = String(formData.get("adoptedAt") ?? "").trim();

  if (!playbookById[controlId]) throw new Error("Unknown control");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  if (adoptedBy.length < 2) {
    return { error: "Adopter name is required (the senior official who signed off on this policy)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(adoptedAtRaw)) {
    return { error: "Adoption date is required (YYYY-MM-DD)." };
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT ai_review_verdict
    FROM evidence_artifacts
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
    LIMIT 1
  `) as Array<{ ai_review_verdict: string | null }>;
  if (rows.length === 0) throw new Error("Artifact not found");
  const verdict = rows[0].ai_review_verdict;
  if (verdict === "insufficient" || verdict === "not_relevant") {
    return {
      error:
        "This artifact was flagged by the auto-reviewer as insufficient or not relevant. Replace it instead of marking it final — the prime will see the same flags.",
    };
  }

  await sql`
    UPDATE evidence_artifacts
    SET is_final_policy = TRUE,
        final_adopted_at = ${adoptedAtRaw}::timestamptz,
        final_adopted_by = ${adoptedBy}
    WHERE id = ${artifactId} AND assessment_id = ${assessmentId}
  `;

  await recordAuditEvent({
    action: "evidence.marked_final",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    metadata: { assessmentId, controlId, adoptedBy, adoptedAt: adoptedAtRaw },
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
  // bail() returns the user back to the sign page with an inline error
  // instead of crashing into error.tsx. Next 16 server actions surface any
  // thrown Error as an opaque 500 with a digest — useless to the user. We
  // never want validation failures to look like "the platform broke".
  function bail(msg: string): never {
    redirect(
      `/assessments/${assessmentId}/sign?error=${encodeURIComponent(msg)}`,
    );
  }
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerTitle = String(formData.get("signerTitle") ?? "").trim();
  const affirmingOfficialEmail = String(
    formData.get("affirmingOfficialEmail") ?? "",
  )
    .trim()
    .toLowerCase();
  // CMMC L1 v2.13 + SPRS Quick Entry Guide v4.0: the *assessment date*
  // (the day the self-assessment work was completed) is a distinct SPRS
  // field from the affirmation date (today). User may have completed the
  // work earlier and only now be tracking down the AO to sign. Accept an
  // optional yyyy-mm-dd; default to today when omitted.
  const selfAssessmentCompletedRaw = String(
    formData.get("selfAssessmentCompletedAt") ?? "",
  ).trim();
  const acknowledged = formData.get("acknowledged") === "on";
  // PIEE / SPRS readiness self-attestation (P1 #11). The user can sign a
  // perfectly correct affirmation memo and still be unable to file it in
  // SPRS if they don't have PIEE provisioned with the SPRS Cyber Vendor
  // User role and a CAM-activated CAGE. Cuts the "I signed but I can't
  // file" cohort. We can't verify these from the outside — the gate is a
  // hard self-attestation.
  const pieeAcct = formData.get("pieeAcct") === "on";
  const pieeRole = formData.get("pieeRole") === "on";
  const pieeSeesCage = formData.get("pieeSeesCage") === "on";
  if (!signerName) bail("Signer name is required");
  if (!signerTitle) bail("Signer title is required");
  // AO email is REQUIRED for CMMC L1: SPRS's "Transfer to AO" flow uses
  // email as the only routing channel when the AO isn't logged in. The
  // affirming-official email also appears verbatim on the canonical
  // attestation packet and in the annual renewal reminder we send. A
  // missing or invalid address is a hard block at sign time.
  if (!affirmingOfficialEmail) {
    bail("Affirming Official email is required — SPRS routes the affirmation to this address");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(affirmingOfficialEmail)) {
    bail("Affirming Official email is not a valid address");
  }
  // Reject obvious shared/role inboxes — the AO must be the senior
  // official, not a distribution list. 32 CFR § 170.22 + DFARS
  // 252.204-7021 frame this as a personal affirmation.
  const localPart = affirmingOfficialEmail.split("@")[0] ?? "";
  const sharedInboxPattern = /^(info|hello|contact|sales|support|admin|noreply|no-reply|team|office|help|hr|billing)$/;
  if (sharedInboxPattern.test(localPart)) {
    bail(
      "Affirming Official email must be the senior official's personal work address, not a shared inbox (info@, hello@, etc.)",
    );
  }
  if (!acknowledged) {
    bail("You must acknowledge the affirmation statement");
  }

  // Validate the optional assessment completion date. Empty string ⇒ use
  // affirmation timestamp (today). yyyy-mm-dd format only, must not be in
  // the future, must be within the past 366 days (we don't accept stale
  // work — re-assess if the work is more than a year old per
  // 32 CFR § 170.15(c)(2)).
  let selfAssessmentCompletedAt: Date | null = null;
  if (selfAssessmentCompletedRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selfAssessmentCompletedRaw)) {
      bail("Assessment completion date must be in YYYY-MM-DD format");
    }
    const parsed = new Date(`${selfAssessmentCompletedRaw}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      bail("Assessment completion date is not a valid date");
    }
    const now = Date.now();
    if (parsed.getTime() > now + 24 * 60 * 60 * 1000) {
      bail("Assessment completion date cannot be in the future");
    }
    if (parsed.getTime() < now - 366 * 24 * 60 * 60 * 1000) {
      bail(
        "Assessment completion date is more than a year old — re-run the assessment before signing",
      );
    }
    selfAssessmentCompletedAt = parsed;
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) bail("Assessment not found");

  // Stale-affirmation hard gate. Per 32 CFR § 170.15(c)(2), L1
  // affirmations are an annual obligation — a Senior Official cannot
  // legitimately "refresh" a memo signed 14 months ago and pretend it's
  // current. If the user is re-signing the SAME assessment row whose
  // previous affirmation lapsed past 365 days, refuse and force them to
  // create a new fiscal-year cycle (which carries forward evidence but
  // re-walks every objective). Brand-new cycles are not affected.
  if (
    ctx.assessment.affirmed_at &&
    Date.now() - new Date(ctx.assessment.affirmed_at).getTime() >
      365 * 24 * 60 * 60 * 1000
  ) {
    bail(
      "This affirmation lapsed more than 365 days ago. Per 32 CFR § 170.15(c)(2) you must start a new fiscal-year cycle to re-affirm — open the assessment list and click 'Start FY' to begin a fresh annual walk.",
    );
  }

  if (!ctx.organization.scoped_systems) {
    bail("Complete your business profile before signing");
  }

  // CAGE gate: SPRS keys every CMMC assessment record on the CAGE code
  // (SPRS CMMC Quick Entry Guide v4.0 — CAGE hierarchy is imported from
  // SAM and the "Add New Level 1 CMMC Self-Assessment" form requires a
  // CAGE under the selected HLO). Without a CAGE on file the user cannot
  // actually post their affirmation in SPRS, so refuse to sign here — a
  // signed-but-unfileable memo is the worst possible outcome.
  if (
    ctx.assessment.framework === "cmmc_l1" &&
    !ctx.organization.cage_code?.trim()
  ) {
    bail(
      "Add your CAGE code on the registration step before signing — SPRS keys every CMMC affirmation on CAGE, so without one your affirmation can't be posted.",
    );
  }

  // PIEE / SPRS readiness self-attestation (P1 #11). The user can sign a
  // perfectly correct affirmation memo and still be unable to file it in
  // SPRS if they don't have PIEE provisioned with the SPRS Cyber Vendor
  // User role and a CAM-activated CAGE. Cuts the "I signed but I can't
  // file" cohort. We can't verify these from the outside — the gate is a
  // hard self-attestation.
  if (ctx.assessment.framework === "cmmc_l1") {
    if (!pieeAcct) {
      bail(
        "Confirm you have a PIEE account before signing — see /sprs-guide.",
      );
    }
    if (!pieeRole) {
      bail(
        "Confirm your PIEE account has the SPRS Cyber Vendor User role (or your CAM has activated the request) before signing.",
      );
    }
    if (!pieeSeesCage) {
      bail(
        "Confirm you can see your CAGE in the SPRS Cyber Reports hierarchy before signing.",
      );
    }
  }

  // SAM Entity freshness — SOFT warning, never a block. SAM registration
  // expires annually; an expired SAM registration silently flips SPRS
  // lookups for this CAGE/UEI to "Inactive," which means contracting
  // officers searching for cleared subcontractors won't find this vendor
  // even though the CMMC record itself is MET. We record any negative
  // status in the audit metadata so the user has a paper trail of "we
  // told you." We never block here: a SAM API outage cannot prevent a
  // valid CMMC affirmation from being signed.
  let samStatusWarning: string | null = null;
  let samStatusKind: SamEntityStatus["kind"] = "unknown";
  if (ctx.organization.sam_uei?.trim()) {
    try {
      const samStatus = await getSamEntityStatus(ctx.organization.sam_uei.trim());
      samStatusKind = samStatus.kind;
      samStatusWarning = summarizeSamStatus(samStatus);
    } catch (err) {
      console.error("[sign] SAM Entity freshness check failed (non-blocking)", err);
    }
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
    bail("Answer every practice before signing");
  }

  // CMMC AG v2.13: Not Met / Partial practices are acceptable when covered
  // by an Enduring Exception (documented in the SSP) or a Temporary
  // Deficiency (with at least one operational POA&M milestone). Anything
  // else blocks affirmation. See 32 CFR § 170.24 + AG v2.13 Findings.
  if (ctx.assessment.framework === "cmmc_l1") {
    const blockers = await controlsBlockingAffirmation(assessmentId, responses);
    if (blockers.length > 0) {
      const sample = blockers
        .slice(0, 3)
        .map((b) => `${b.controlId} — ${b.reason}`)
        .join("; ");
      const more =
        blockers.length > 3 ? ` (+${blockers.length - 3} more)` : "";
      bail(
        `Cannot sign: ${blockers.length} practice${blockers.length === 1 ? "" : "s"} still block the affirmation. ${sample}${more}`,
      );
    }
  } else if (notMet > 0 || partial > 0) {
    bail(
      "All practices must be Met or N/A before signing. Fix any Not met or Partial answers first.",
    );
  }

  // Carry-forward gate: any imported response/artifact still in pending_review
  // must be resolved before this cycle counts as a clean affirmation.
  const pendingResponses = responses.filter(
    (r) => r.carry_forward_status === "pending_review",
  );
  if (pendingResponses.length > 0) {
    bail(
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
    bail(
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
    bail(
      `Practices marked Met need at least one passing artifact (or a 200+ char narrative explaining why none applies): ${ids}${more}`,
    );
  }

  // N/A justification gate (CMMC AG L1 v2.13 p. 8): every requirement
  // marked Not Applicable must carry a written narrative explaining why
  // it doesn't apply to the CMMC Assessment Scope. AG p. 8 treats N/A
  // as equivalent to MET, which means a contracting officer reading the
  // SSP needs to see the reasoning — otherwise they can't tell a
  // legitimate N/A from a user clicking the wrong radio.
  const missingNa = controlsMissingNaJustification(responses);
  if (missingNa.length > 0) {
    const ids = missingNa
      .slice(0, 5)
      .map((m) => m.control_id)
      .join(", ");
    const more =
      missingNa.length > 5 ? ` (+${missingNa.length - 5} more)` : "";
    bail(
      `Practices marked Not Applicable need at least a 120-char written justification (CMMC AG L1 v2.13 p. 8): ${ids}${more}`,
    );
  }

  // FCI Boundary gate (CMMC L1 v2.13 + DFARS final): the affirmation memo
  // packages the boundary diagram, inventory, flows, out-of-scope items,
  // and Affirming-Official acknowledgement. Block on any `fail`-level
  // finding (missing AO, AO not acknowledged, public-sharing on FCI assets,
  // missing entity name) AND on the structural `warn`-level findings the
  // contracting officer will see in the rendered SSP § 1.2 page (no
  // inbound/outbound flow, empty out-of-scope list, no ESPs, no people
  // or storage in scope). The dashboard already surfaces these — refusing
  // here makes "I can't sign because the affirmation memo would be
  // incomplete" actionable instead of "your data is safe but the page
  // crashed".
  if (ctx.assessment.framework === "cmmc_l1") {
    try {
      const boundaryView = await assembleBoundaryView({
        organizationId: ctx.organization.id,
        legalEntity: {
          id: ctx.organization.id,
          name: ctx.organization.name,
          cage: ctx.organization.cage_code ?? null,
          uei: ctx.organization.sam_uei ?? null,
          naics: ctx.organization.naics_codes ?? [],
        },
      });
      const boundaryFindings = validateBoundary(boundaryView);
      const blockingBoundary = boundaryFindings.filter(
        (f) => f.level === "fail" || f.level === "warn",
      );
      if (blockingBoundary.length > 0) {
        const sample = blockingBoundary
          .slice(0, 3)
          .map((f) => f.message.replace(/\s+/g, " ").trim())
          .join(" · ");
        const more =
          blockingBoundary.length > 3
            ? ` (+${blockingBoundary.length - 3} more)`
            : "";
        bail(
          `Cannot sign: FCI boundary is incomplete (${blockingBoundary.length} finding${blockingBoundary.length === 1 ? "" : "s"}). Resolve on the Boundary tab. ${sample}${more}`,
        );
      }
    } catch (e) {
      // bail() throws NEXT_REDIRECT — must propagate. Anything else (DB
      // shape mismatch, etc.) is swallowed so the affirmation can still
      // proceed; the boundary is reviewable on its own page.
      const digest = (e as { digest?: string } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      console.error("[submitAffirmation] boundary gate skipped", e);
    }
  }

  // CMMC L1 affirmation is binary: all 15 v2.13 requirements MET, yes/no.
  // Under the hood the 15 requirements roll up from 59 NIST 800-171A
  // objectives across the 17 legacy NIST 800-171 r2 controls; we track the
  // outcome on `implements_all_17`. We reach this point only if the
  // affirmation gate above passed — meaning every practice is either MET,
  // N/A, or covered by a documented Enduring Exception / Temporary
  // Deficiency-with-milestones (32 CFR § 170.24, AG v2.13 Findings).
  // The legacy `sprs_score` column is only populated for L2/DFARS-7012
  // cycles which use NIST 800-171 110-point scoring; for L1 it stays NULL.
  const allAccountedFor = met + notApplicable === total;
  const implementsAll17 =
    ctx.assessment.framework === "cmmc_l1"
      ? true // gate above guarantees v2.13 MET-equivalent for every practice
      : allAccountedFor
        ? true
        : null;

  const sql = getSql();

  // Post-validation infra block: blob fingerprinting, encryption, DB write.
  // Any failure here is an infrastructure issue (blob 403, KMS down,
  // Postgres timeout) — we route the user back to the sign page with a
  // friendly message rather than crashing the route. The signed redirect
  // at the very end is outside this try (its NEXT_REDIRECT must propagate).
  try {
    // Per-artifact byte-level fingerprint. Captured at sign time so the
    // canonical payload is tamper-evident even if a blob is later replaced
    // or rotated. Failure to fetch any artifact aborts the affirmation —
    // we will not sign over an incomplete fingerprint set.
    const liveEvidence = evidence.filter(
    (e) => e.carry_forward_status !== "removed",
  );
  const evidenceFingerprints = await Promise.all(
    liveEvidence.map(async (e) => {
      // Blobs are stored privately — a raw fetch on `blob_url` returns 403.
      // Use the SDK `get()` which sends BLOB_READ_WRITE_TOKEN, mirroring the
      // /api/evidence proxy.
      let upstream: Awaited<ReturnType<typeof get>>;
      try {
        upstream = await get(e.blob_url, { access: "private", useCache: false });
      } catch (err) {
        throw new Error(
          `Failed to fetch evidence ${e.filename} for fingerprinting: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!upstream || upstream.statusCode !== 200 || !upstream.stream) {
        throw new Error(
          `Failed to fetch evidence ${e.filename} (HTTP ${upstream?.statusCode ?? "unknown"})`,
        );
      }
      const reader = upstream.stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        chunks.push(value);
      }
      const rawBuf = Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
      // Bytes on disk are AES-256-GCM-encrypted (Tier 1). Decrypt before
      // hashing so the canonical attestation continues to fingerprint the
      // PLAINTEXT content the user attested to. Legacy plaintext-on-disk
      // artifacts pass through unchanged via tryDecryptBytes().
      const plainBuf = await tryDecryptBytes(rawBuf, {
        organizationId: ctx.organization.id,
        field: `evidence:${assessmentId}:${e.control_id}`,
      });
      return { id: e.id, sha256Hex: sha256HexBytes(plainBuf) };
    }),
  );
  const fingerprintById = new Map(
    evidenceFingerprints.map((f) => [f.id, f.sha256Hex]),
  );

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
    evidence: [...liveEvidence]
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
        sha256Hex: fingerprintById.get(e.id) ?? "",
      })),
  });

  // Tier 1 zero-trust: encrypt the signer identity + the canonical
  // attestation packet at rest. The HMAC signature, payload SHA-256, and
  // key version stay plaintext so re-verification only needs the signed
  // canonical (which we decrypt on read). AAD binds each value to
  // (orgId, column) so a row-swap across tenants fails decryption.
  const orgId = ctx.organization.id;
  const [encSignerName, encSignerTitle, encCanonical] = await Promise.all([
    encryptField(signerName, {
      organizationId: orgId,
      field: "assessments.affirmed_by_name",
    }),
    encryptField(signerTitle, {
      organizationId: orgId,
      field: "assessments.affirmed_by_title",
    }),
    encryptField(signed.canonical, {
      organizationId: orgId,
      field: "assessments.attestation_canonical",
    }),
  ]);

  await sql`
    UPDATE assessments
    SET status = 'attested',
        submitted_at = NOW(),
        affirmed_at = NOW(),
        affirmed_by_name = ${encSignerName},
        affirmed_by_title = ${encSignerTitle},
        affirming_official_email = ${affirmingOfficialEmail || null},
        self_assessment_completed_at = COALESCE(
          ${selfAssessmentCompletedAt ? selfAssessmentCompletedAt.toISOString() : null}::timestamptz,
          NOW()
        ),
        cmmc_status = ${ctx.assessment.framework === "cmmc_l1" && implementsAll17 ? "Final Level 1 (Self)" : null},
        sprs_score = NULL,
        implements_all_17 = ${implementsAll17},
        attestation_canonical = ${encCanonical},
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
      // SAM Entity freshness snapshot taken at sign time (P1 #10). Soft
      // warning only — recorded for the paper trail when an inactive SAM
      // registration would have caused SPRS to show this vendor as
      // unreachable to primes.
      samEntityStatus: samStatusKind,
      samStatusWarning: samStatusWarning,
    },
  });
  } catch (e) {
    // Bubble up redirects (NEXT_REDIRECT digest) so success/bail still
    // navigate. Anything else is an infrastructure failure — log it and
    // bail to /sign?error=... rather than crashing into error.tsx.
    const digest = (e as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    console.error("[submitAffirmation] infra failure", e);
    bail(
      `Couldn't complete the affirmation: ${e instanceof Error ? e.message : "unknown error"}. Try again or contact support.`,
    );
  }

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
  redirect(`/assessments/${assessmentId}/bid-packet?signed=1`);
}

/**
 * Record the user's SPRS filing for an attested assessment.
 *
 * After the user signs their annual affirmation memo we walk them to
 * https://piee.eb.mil → SPRS → Cyber Reports → CMMC Assessments tab →
 * "Add New Level 1 CMMC Self-Assessment" (per SPRS CMMC Quick Entry Guide
 * v4.0, DEC 2024). The user enters the assessment, transfers to the
 * Affirming Official if needed, the AO clicks Affirm, and SPRS returns a
 * CMMC Status Date (the posting date — SPRS does NOT issue a separate
 * confirmation number). They paste that posting date / status reference
 * back here. This action persists that filing, fires an audit event, and
 * emails the user a "you're done" receipt with their next re-affirmation
 * due date and a link to their Statement of Compliance.
 *
 * Guardrails:
 *   - Assessment must be in `attested` status (i.e. memo signed first).
 *   - The CMMC Status Date is required and must be a real date that is not
 *     in the future and not absurdly far from the affirmation timestamp.
 *   - The optional `confirmationNumber` field is an internal/customer-side
 *     reference only — SPRS does NOT issue a confirmation number. We accept
 *     it for users who want to log a screenshot ID, ticket number, or
 *     PIEE workflow handle alongside the federal CMMC Status Date.
 *   - Email send failures do NOT roll back the DB write; the filing record
 *     is the legal artifact, the email is just a courtesy receipt.
 */
export async function recordSprsFilingAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const statusDateRaw = String(formData.get("statusDate") ?? "").trim();
  const confirmationNumberRaw = String(
    formData.get("confirmationNumber") ?? "",
  ).trim();

  if (!assessmentId) throw new Error("Missing assessment id");
  if (!statusDateRaw) {
    throw new Error(
      "Enter the CMMC Status Date SPRS returned (the posting date on your assessment record)",
    );
  }
  // The CMMC Status Date is the federal artifact. SPRS shows it on the
  // assessment record after Affirm / Transfer-to-AO completes. Accept an
  // ISO yyyy-mm-dd from <input type="date"> and validate it's a real,
  // non-future date within the last 365 days. Anything else is almost
  // certainly a typo or a paste from the wrong field.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statusDateRaw)) {
    throw new Error(
      "CMMC Status Date must look like YYYY-MM-DD (use the date picker)",
    );
  }
  const statusDate = new Date(`${statusDateRaw}T00:00:00Z`);
  if (Number.isNaN(statusDate.getTime())) {
    throw new Error("CMMC Status Date is not a valid date");
  }
  const todayUtc = new Date();
  if (statusDate.getTime() > todayUtc.getTime() + 24 * 60 * 60 * 1000) {
    throw new Error("CMMC Status Date cannot be in the future");
  }
  if (
    statusDate.getTime() <
    todayUtc.getTime() - 366 * 24 * 60 * 60 * 1000
  ) {
    throw new Error(
      "CMMC Status Date looks too old — SPRS posting dates should be within the last year",
    );
  }
  // Internal reference is optional. If supplied, sanitize it the same way
  // we used to sanitize the old fictional confirmation number so the value
  // is safe to round-trip into emails and PDFs.
  let confirmationNumber: string | null = null;
  if (confirmationNumberRaw) {
    if (confirmationNumberRaw.length > 64) {
      throw new Error("Internal reference looks too long (64 chars max)");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(confirmationNumberRaw)) {
      throw new Error(
        "Internal reference can only contain letters, numbers, dashes, or underscores",
      );
    }
    confirmationNumber = confirmationNumberRaw.toUpperCase();
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");
  if (ctx.assessment.status !== "attested") {
    throw new Error(
      "Sign your annual affirmation memo before recording the SPRS filing",
    );
  }
  if (ctx.assessment.sprs_filed_at) {
    // Idempotent re-save: same status date + same internal reference is a
    // no-op.
    const sameDate =
      ctx.assessment.sprs_status_date === statusDateRaw;
    const sameRef =
      (ctx.assessment.sprs_confirmation_number ?? null) === confirmationNumber;
    if (sameDate && sameRef) {
      revalidatePath(`/assessments/${assessmentId}`);
      revalidatePath(`/assessments/${assessmentId}/bid-packet`);
      return;
    }
    // Amend the saved status date / internal reference — small-business
    // contractors occasionally mistype on first paste. We log the change
    // in the audit trail (old + new) so the legal record is still
    // defensible.
    const sql = getSql();
    const previousStatusDate = ctx.assessment.sprs_status_date;
    const previousReference = ctx.assessment.sprs_confirmation_number;
    await sql`
      UPDATE assessments
      SET sprs_status_date = ${statusDateRaw}::date,
          sprs_confirmation_number = ${confirmationNumber},
          updated_at = NOW()
      WHERE id = ${assessmentId}
    `;
    await recordAuditEvent({
      action: "assessment.sprs_filing_amended",
      userId,
      organizationId: ctx.organization.id,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: {
        previousStatusDate,
        newStatusDate: statusDateRaw,
        previousInternalReference: previousReference,
        newInternalReference: confirmationNumber,
      },
    });
    revalidatePath(`/assessments/${assessmentId}`);
    revalidatePath(`/assessments/${assessmentId}/bid-packet`);
    return;
  }

  const filedAt = new Date();
  const sql = getSql();
  await sql`
    UPDATE assessments
    SET sprs_filed_at = ${filedAt.toISOString()}::timestamptz,
        sprs_status_date = ${statusDateRaw}::date,
        sprs_confirmation_number = ${confirmationNumber},
        updated_at = NOW()
    WHERE id = ${assessmentId}
  `;

  // Provision the Custodia Verified page (private until the user opts in
  // from the offer card on the assessment overview). Failures here must
  // NOT roll back the SPRS filing — the legal record is what matters.
  // We compute deterministic public IDs (verification slug + CUST-V-XXXXXX)
  // from (org, assessment, filed_at) so no private federal-record detail
  // (CMMC Status Date or internal reference) is mixed into the public
  // artifact.
  let custodiaVerificationId: string | null = null;
  try {
    const provisioned = await provisionTrustPageForFiling({
      organizationId: ctx.organization.id,
      assessmentId,
      sprsFiledAtIso: filedAt.toISOString(),
      userId,
    });
    custodiaVerificationId = provisioned.identifiers.custodiaVerificationId;
    await sql`
      UPDATE assessments
      SET sprs_attestation_hash = ${provisioned.identifiers.attestationHash},
          custodia_verification_id = ${provisioned.identifiers.custodiaVerificationId},
          updated_at = NOW()
      WHERE id = ${assessmentId}
    `;
  } catch (err) {
    await recordAuditEvent({
      action: "trust_page.provisioned",
      userId,
      organizationId: ctx.organization.id,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: {
        error: err instanceof Error ? err.message : String(err),
        provisioningFailed: true,
      },
    });
  }

  // Refresh the live health snapshot so the offer card reflects current
  // state immediately. Failure to recompute is non-fatal.
  try {
    const { recomputeTrustStatus } = await import("@/lib/trust-status");
    await recomputeTrustStatus(ctx.organization.id);
  } catch (err) {
    console.error("[recordSprsFilingAction] trust-status recompute failed", err);
  }

  await recordAuditEvent({
    action: "assessment.sprs_filed",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "assessment",
    resourceId: assessmentId,
    metadata: {
      framework: ctx.assessment.framework,
      fiscalYear: ctx.assessment.fiscal_year,
      sprsStatusDate: statusDateRaw,
      internalReference: confirmationNumber,
      filedAt: filedAt.toISOString(),
      custodiaVerificationId,
    },
  });

  // Best-effort confirmation email. Failures are logged via audit but never
  // surfaced to the user — the filing itself is what matters legally.
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    if (email) {
      // Next re-affirmation: Sep 30 of the next federal fiscal year. If the
      // current cycle is FY2026 (ends Sep 30 2026), we filed late if it's
      // already past Sep 30 — but in either case the next deadline is the
      // following FY's Sep 30.
      const nextFy = (ctx.assessment.fiscal_year ?? new Date().getUTCFullYear()) + 1;
      const nextDue = new Date(Date.UTC(nextFy, 8, 30));
      const workspaceUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com";
      await sendSprsFiledEmail({
        toEmail: email,
        firstName: user.firstName ?? null,
        organizationName: ctx.organization.name,
        statusDate,
        internalReference: confirmationNumber,
        filedAt,
        nextReaffirmDueDate: nextDue,
        workspaceUrl,
        assessmentId,
      });
    }
  } catch (err) {
    await recordAuditEvent({
      action: "email.sprs_filed.failed",
      userId,
      organizationId: ctx.organization.id,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }

  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath("/assessments");
}

/**
 * Publish the org's Custodia Verified page. Idempotent — a republish on an
 * already-public page is a no-op (besides bumping `updated_at`). The
 * trust_page row is auto-provisioned at SPRS filing time, so this action
 * just flips `is_public = TRUE`.
 */
export async function publishVerifiedPageAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  if (!assessmentId) throw new Error("Missing assessment id");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");
  if (!ctx.assessment.sprs_filed_at) {
    throw new Error("Record your SPRS filing before publishing the Verified page");
  }

  await publishTrustPage({
    organizationId: ctx.organization.id,
    userId,
  });
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/verified`);
}

export async function unpublishVerifiedPageAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  if (!assessmentId) throw new Error("Missing assessment id");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");

  await unpublishTrustPage({
    organizationId: ctx.organization.id,
    userId,
  });
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/verified`);
}

/**
 * Owner-controlled content + display toggles for the Verified page. Each
 * field is optional in the form payload — unsubmitted fields fall through
 * to COALESCE-on-existing in the SQL.
 */
export async function updateVerifiedPageAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  if (!assessmentId) throw new Error("Missing assessment id");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");

  const customAboutRaw = formData.get("customAbout");
  const contactEmailRaw = formData.get("contactEmail");
  const customAbout =
    customAboutRaw == null ? undefined : String(customAboutRaw).slice(0, 500);
  const contactEmail =
    contactEmailRaw == null ? undefined : String(contactEmailRaw).trim();

  if (contactEmail !== undefined && contactEmail !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new Error("Contact email looks invalid");
    }
  }

  const toggle = (name: string): boolean | undefined => {
    // If the form rendered this toggle (marker present), an absent checkbox
    // means "off"; otherwise (marker missing) we leave the field untouched.
    const present = formData.get(`${name}__present`);
    if (present == null) {
      const v = formData.get(name);
      if (v == null) return undefined;
      return v === "on" || v === "true" || v === "1";
    }
    const v = formData.get(name);
    return v === "on" || v === "true" || v === "1";
  };

  await updateTrustPageContentAction({
    organizationId: ctx.organization.id,
    userId,
    customAbout,
    contactEmail,
    showContinuousMonitoring: toggle("showContinuousMonitoring"),
    showConnectors: toggle("showConnectors"),
    showSprsLink: toggle("showSprsLink"),
    showSetAsides: toggle("showSetAsides"),
  });
  revalidatePath(`/assessments/${assessmentId}/verified`);
}

/**
 * Rotate the slug + Custodia Verification ID. Breaks all existing badges /
 * embeds — used when a customer suspects compromise or wants a fresh public
 * identifier. Re-derives from the same SPRS filing but bumps an internal
 * version counter.
 */
export async function rotateVerifiedPageSlugAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  if (!assessmentId) throw new Error("Missing assessment id");

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");
  if (!ctx.assessment.sprs_filed_at) {
    throw new Error("No SPRS filing to derive a Verified page from");
  }

  const ids = await rotateTrustSlug({
    organizationId: ctx.organization.id,
    assessmentId,
    sprsFiledAtIso: ctx.assessment.sprs_filed_at,
    userId,
  });
  // Also update the assessment row so badge endpoints lookup the new ID.
  const sql = getSql();
  await sql`
    UPDATE assessments
    SET sprs_attestation_hash = ${ids.attestationHash},
        custodia_verification_id = ${ids.custodiaVerificationId},
        updated_at = NOW()
    WHERE id = ${assessmentId}
  `;
  revalidatePath(`/assessments/${assessmentId}/verified`);
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


/**
 * Manual edit of the business profile + locked org fields from the
 * /assessments/[id]/profile page. Lets a user override what the AI captured
 * during onboarding -- legal name, entity type, scoped systems, and the
 * free-form profile fields (what they do, customers, team size, workspace,
 * IT identity, where data lives).
 */
export async function updateBusinessProfileManualAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Assessment not found");

  const legalName = String(formData.get("legalName") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "").trim();
  const scopedSystems = String(formData.get("scopedSystems") ?? "").trim();

  const profileFields = [
    "what_they_do",
    "customers",
    "team_size",
    "physical_workspace",
    "it_identity",
    "data_location",
    // Optional ISSM (Information System Security Manager) — distinct from
    // the Affirming Official. Not required for L1 / SPRS but commonly
    // requested by primes on intake; rendered in the SSP § 3 roles table.
    "issm_name",
    "issm_email",
    // Brand fields — surfaced on customer-facing deliverables (SSP,
    // affirmation memo, zipped HTML header bars).
    "website",
    "phone",
    "customer_facing_email",
    "street_address",
    "street_address_2",
    "city",
    "state",
    "zip",
  ] as const;

  const existing = (await getBusinessProfile(ctx.organization.id))?.data ?? {};
  const merged: Record<string, unknown> = { ...existing };
  for (const k of profileFields) {
    const v = String(formData.get(k) ?? "").trim();
    if (v) merged[k] = v;
    else delete merged[k];
  }

  // Logo upload — public Vercel Blob so it can render inside the HTML
  // deliverables (which are downloaded standalone). Size + MIME gated.
  const logoFile = formData.get("logo");
  const removeLogo = String(formData.get("remove_logo") ?? "") === "1";
  if (removeLogo) {
    delete merged.logo_url;
  }
  if (logoFile instanceof File && logoFile.size > 0) {
    const MAX = 2 * 1024 * 1024;
    if (logoFile.size > MAX) {
      redirect(
        `/assessments/${assessmentId}/profile?logo_error=size`,
      );
    }
    if (!/^image\//.test(logoFile.type)) {
      redirect(
        `/assessments/${assessmentId}/profile?logo_error=type`,
      );
    }
    const extFromName = logoFile.name.split(".").pop()?.toLowerCase() ?? "";
    const ext = /^[a-z0-9]+$/.test(extFromName)
      ? extFromName
      : logoFile.type.split("/")[1] ?? "png";
    const pathname = `org-branding/${ctx.organization.id}/logo-${Date.now()}.${ext}`;
    const blob = await put(pathname, logoFile, {
      access: "public",
      contentType: logoFile.type,
      addRandomSuffix: false,
    });
    merged.logo_url = blob.url;
  }

  const captured = [
    legalName,
    entityType,
    scopedSystems,
    ...profileFields.map((k) => String(merged[k] ?? "")),
  ].filter((v) => v.trim().length > 0).length;
  const completeness = Math.min(
    100,
    Math.round((captured / (3 + profileFields.length)) * 100),
  );

  const sql = getSql();
  await sql`
    UPDATE organizations
    SET name = ${legalName || ctx.organization.name},
        entity_type = ${entityType || null},
        scoped_systems = ${scopedSystems || null},
        updated_at = NOW()
    WHERE id = ${ctx.organization.id}
  `;

  await updateBusinessProfile(
    ctx.organization.id,
    merged,
    completeness,
    "user",
  );

  revalidatePath("/assessments");
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/profile`);
  revalidatePath(`/assessments/${assessmentId}/ssp`);
  revalidatePath(`/assessments/${assessmentId}/affirmation`);
  redirect(`/assessments/${assessmentId}/profile?saved=1`);
}

/**
 * Affirm a single practice. Captures a tamper-evident snapshot of
 * (intake answers + objective verdicts + tagged evidence ids), signs it
 * with the user's typed name, and stores the SHA-256 hash. The SPRS
 * deliverable refuses to render until the LATEST affirmation's hash
 * matches the current snapshot — that's how we surface drift.
 *
 * Tenant-gated via getAssessmentForUser. Caller is responsible for
 * client-side validation of the signed name (we re-validate here as a
 * defense-in-depth check).
 */
export async function affirmPracticeAction(formData: FormData) {
  const userId = await requireUserId();
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const controlId = String(formData.get("controlId") ?? "");
  const signedName = String(formData.get("signedName") ?? "").trim();
  const acknowledged = String(formData.get("acknowledged") ?? "") === "on";

  if (!signedName || signedName.length < 2 || signedName.length > 120) {
    throw new Error("Signed name must be between 2 and 120 characters");
  }
  if (!acknowledged) {
    throw new Error("You must acknowledge the attestation to sign");
  }

  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");

  // Pull current state. The conversation row holds intake answers and
  // objective verdicts; the evidence list holds artifact ids tagged to
  // this control (legacy single-tag + cross-tagged via join table).
  const [conv, evidence] = await Promise.all([
    getOrCreatePracticeConversation(assessmentId, controlId),
    listEvidenceForControl(assessmentId, controlId),
  ]);

  const snapshot = buildPracticeSnapshot({
    controlId,
    intakeAnswers: conv.intake_answers,
    verdicts: conv.objective_verdicts,
    evidenceIds: evidence.map((e) => e.id),
  });

  await createPracticeAffirmation({
    assessmentId,
    controlId,
    signedByUserId: userId,
    signedName,
    snapshot,
  });

  revalidatePath(`/assessments/${assessmentId}/controls/${controlId}`);
  revalidatePath(`/assessments/${assessmentId}`);
  revalidatePath(`/assessments/${assessmentId}/sign`);
  revalidatePath(`/assessments/${assessmentId}/bid-packet`);
}
