import {
  getSql,
  initDb,
  ensureDbReady,
  type AssessmentStatus,
  type CarryForwardStatus,
  type ControlResponseStatus,
  type EvidenceVerdict,
  type Framework,
  type RemediationStatus,
} from "@/lib/db";
import { getPlaybookForFramework } from "@/lib/playbook";
import { fiscalYearOf, seedMilestonesForAssessment } from "@/lib/fiscal";

export type OrganizationRow = {
  id: string;
  owner_user_id: string;
  name: string;
  entity_type: string | null;
  cage_code: string | null;
  sam_uei: string | null;
  naics_codes: string[];
  tier: "solo" | "bootcamp" | "command";
  scoped_systems: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentRow = {
  id: string;
  organization_id: string;
  cycle_label: string;
  status: AssessmentStatus;
  framework: Framework;
  fiscal_year: number;
  submitted_at: string | null;
  affirmed_at: string | null;
  affirmed_by_name: string | null;
  affirmed_by_title: string | null;
  sprs_score: number | null;
  implements_all_17: boolean | null;
  carried_forward_from: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlResponseRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  status: ControlResponseStatus;
  narrative: string | null;
  officer_reviewed: boolean;
  officer_reviewed_at: string | null;
  officer_reviewer_user_id: string | null;
  carry_forward_status: CarryForwardStatus;
  updated_at: string;
};

export type RemediationPlanRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  gap_summary: string;
  planned_actions: string;
  target_close_date: string;
  status: RemediationStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export async function ensureOrgForUser(userId: string): Promise<OrganizationRow> {
  await initDb();
  const sql = getSql();

  const existing = (await sql`
    SELECT id, owner_user_id, name, entity_type, cage_code, sam_uei,
           naics_codes, tier, scoped_systems, created_at, updated_at
    FROM organizations
    WHERE owner_user_id = ${userId}
    LIMIT 1
  `) as OrganizationRow[];

  if (existing.length > 0) {
    await ensureBusinessProfile(existing[0].id);
    return existing[0];
  }

  const inserted = (await sql`
    INSERT INTO organizations (owner_user_id, name, tier)
    VALUES (${userId}, ${"My Organization"}, 'solo')
    RETURNING id, owner_user_id, name, entity_type, cage_code, sam_uei,
              naics_codes, tier, scoped_systems, created_at, updated_at
  `) as OrganizationRow[];

  await ensureBusinessProfile(inserted[0].id);
  return inserted[0];
}

export type BusinessProfileRow = {
  organization_id: string;
  data: Record<string, unknown>;
  completeness_score: number;
  last_updated_at: string;
  last_updated_by: "user" | "ai";
};

/**
 * Ensures a business_profile row exists for an org. Empty JSON to start; the
 * conversational onboarding flow rewrites the `data` blob over time.
 */
export async function ensureBusinessProfile(
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO business_profile (organization_id)
    VALUES (${organizationId}::uuid)
    ON CONFLICT (organization_id) DO NOTHING
  `;
}

export async function getBusinessProfile(
  organizationId: string,
): Promise<BusinessProfileRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT organization_id, data, completeness_score, last_updated_at, last_updated_by
    FROM business_profile
    WHERE organization_id = ${organizationId}
    LIMIT 1
  `) as BusinessProfileRow[];
  return rows[0] ?? null;
}

/**
 * Onboarding is "complete enough" to drop the user into the workspace when the
 * business profile has any meaningful captured data AND the org has a real
 * legal name + a scoped_systems paragraph. The completeness_score threshold is
 * intentionally low (40) — the officer can keep enriching the profile inside
 * the workspace; we just need enough to personalize.
 */
export function isOnboardingComplete(
  org: OrganizationRow,
  profile: BusinessProfileRow | null,
): boolean {
  const hasLegalName =
    org.name.trim().length > 0 && org.name !== "My Organization";
  const hasScopedSystems =
    (org.scoped_systems ?? "").trim().length > 0;
  const hasProfile = (profile?.completeness_score ?? 0) >= 40;
  return hasLegalName && hasScopedSystems && hasProfile;
}

export async function updateBusinessProfile(
  organizationId: string,
  data: Record<string, unknown>,
  completenessScore: number,
  updatedBy: "user" | "ai",
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO business_profile
      (organization_id, data, completeness_score, last_updated_at, last_updated_by)
    VALUES (${organizationId}::uuid, ${JSON.stringify(data)}::jsonb,
            ${completenessScore}, NOW(), ${updatedBy})
    ON CONFLICT (organization_id) DO UPDATE
    SET data = EXCLUDED.data,
        completeness_score = EXCLUDED.completeness_score,
        last_updated_at = EXCLUDED.last_updated_at,
        last_updated_by = EXCLUDED.last_updated_by
  `;
}

export async function listAssessmentsForOrg(
  organizationId: string,
): Promise<AssessmentRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, cycle_label, status, framework, fiscal_year,
           submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
           sprs_score, implements_all_17, carried_forward_from,
           created_at, updated_at
    FROM assessments
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
  `) as AssessmentRow[];
}

export type AssessmentWithProgress = AssessmentRow & {
  answered: number;
  total: number;
  percentAnswered: number;
};

export async function listAssessmentsWithProgress(
  organizationId: string,
): Promise<AssessmentWithProgress[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id, a.organization_id, a.cycle_label, a.status, a.framework,
           a.fiscal_year, a.submitted_at, a.affirmed_at, a.affirmed_by_name,
           a.affirmed_by_title, a.sprs_score, a.implements_all_17,
           a.carried_forward_from, a.created_at, a.updated_at,
           COUNT(cr.*) FILTER (WHERE cr.status != 'unanswered')::int AS answered,
           COUNT(cr.*)::int AS total
    FROM assessments a
    LEFT JOIN control_responses cr ON cr.assessment_id = a.id
    WHERE a.organization_id = ${organizationId}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `) as Array<AssessmentRow & { answered: number; total: number }>;

  return rows.map((r) => ({
    ...r,
    percentAnswered: r.total === 0 ? 0 : Math.round((r.answered / r.total) * 100),
  }));
}

export async function createAssessmentForOrg(
  organizationId: string,
  cycleLabel: string,
  framework: Framework = "cmmc_l1",
  fiscalYear: number = fiscalYearOf(),
): Promise<AssessmentRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO assessments (organization_id, cycle_label, status, framework, fiscal_year)
    VALUES (${organizationId}, ${cycleLabel}, 'in_progress', ${framework}, ${fiscalYear})
    RETURNING id, organization_id, cycle_label, status, framework, fiscal_year,
              submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
              sprs_score, implements_all_17, carried_forward_from,
              created_at, updated_at
  `) as AssessmentRow[];
  const assessment = inserted[0];

  const controlIds = getPlaybookForFramework(framework).map((entry) => entry.id);
  await sql`
    INSERT INTO control_responses (assessment_id, control_id)
    SELECT ${assessment.id}::uuid, cid
    FROM UNNEST(${controlIds}::text[]) AS t(cid)
  `;

  await seedMilestonesForAssessment(organizationId, assessment.id, fiscalYear);

  return assessment;
}

/**
 * Annual rollover: create a new cycle that imports the prior cycle's responses
 * and evidence artifacts as drafts pending user review. The user must walk
 * each carried row to "kept" or "needs_replacement" before it counts toward
 * the new cycle's evidence gate. Mirrors TurboTax's "import last year's return"
 * — most fields are stable year-over-year, but the user has to confirm.
 */
export async function createAssessmentWithCarryForward(
  organizationId: string,
  cycleLabel: string,
  framework: Framework,
  fiscalYear: number,
  priorAssessmentId: string,
): Promise<AssessmentRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO assessments
      (organization_id, cycle_label, status, framework, fiscal_year, carried_forward_from)
    VALUES
      (${organizationId}, ${cycleLabel}, 'in_progress', ${framework},
       ${fiscalYear}, ${priorAssessmentId}::uuid)
    RETURNING id, organization_id, cycle_label, status, framework, fiscal_year,
              submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
              sprs_score, implements_all_17, carried_forward_from,
              created_at, updated_at
  `) as AssessmentRow[];
  const assessment = inserted[0];

  // Carry forward responses: every prior response copied with status preserved
  // EXCEPT 'no' / 'partial' / 'unanswered' — those reset to 'unanswered' so
  // the user must re-answer this year. 'yes' / 'not_applicable' carry over
  // but flagged 'pending_review'.
  await sql`
    INSERT INTO control_responses
      (assessment_id, control_id, status, narrative, carry_forward_status)
    SELECT ${assessment.id}::uuid,
           prior.control_id,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN prior.status
                ELSE 'unanswered'
           END,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN prior.narrative
                ELSE NULL
           END,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN 'pending_review'
                ELSE 'kept'
           END
    FROM control_responses prior
    WHERE prior.assessment_id = ${priorAssessmentId}::uuid
  `;

  // Backfill any practices that exist in the playbook but weren't in the prior
  // cycle (framework expansion). They start unanswered.
  const controlIds = getPlaybookForFramework(framework).map((entry) => entry.id);
  await sql`
    INSERT INTO control_responses (assessment_id, control_id)
    SELECT ${assessment.id}::uuid, cid
    FROM UNNEST(${controlIds}::text[]) AS t(cid)
    ON CONFLICT (assessment_id, control_id) DO NOTHING
  `;

  // Carry forward evidence artifacts pointing to the same blob URLs. Each new
  // row gets prior_artifact_id set and carry_forward_status='pending_review'.
  // AI verdicts are reset to NULL — vision review re-runs against the new
  // cycle for currency.
  await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes,
       captured_at, uploaded_by_user_id, ai_suggested_controls,
       prior_artifact_id, carry_forward_status)
    SELECT ${assessment.id}::uuid, prior.control_id, prior.filename,
           prior.blob_url, prior.mime_type, prior.size_bytes,
           prior.captured_at, prior.uploaded_by_user_id,
           prior.ai_suggested_controls, prior.id, 'pending_review'
    FROM evidence_artifacts prior
    WHERE prior.assessment_id = ${priorAssessmentId}::uuid
      AND prior.carry_forward_status != 'removed'
  `;

  await seedMilestonesForAssessment(organizationId, assessment.id, fiscalYear);
  return assessment;
}

export async function getAssessmentForUser(
  assessmentId: string,
  userId: string,
): Promise<{ assessment: AssessmentRow; organization: OrganizationRow } | null> {
  // Every assessment-area server component begins here, so this is the
  // single chokepoint that guarantees the schema migration (including the
  // PR1 evidence_artifact_practices join table) has run on this lambda
  // instance before any downstream read tries to JOIN against it. Cached
  // by ensureDbReady so it's a no-op after the first call per cold start.
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id AS a_id, a.organization_id, a.cycle_label, a.status AS a_status,
           a.framework, a.fiscal_year,
           a.submitted_at, a.affirmed_at, a.affirmed_by_name, a.affirmed_by_title,
           a.sprs_score, a.implements_all_17, a.carried_forward_from,
           a.created_at AS a_created_at, a.updated_at AS a_updated_at,
           o.id AS o_id, o.owner_user_id, o.name AS o_name, o.entity_type,
           o.cage_code, o.sam_uei, o.naics_codes, o.tier, o.scoped_systems,
           o.created_at AS o_created_at, o.updated_at AS o_updated_at
    FROM assessments a
    JOIN organizations o ON o.id = a.organization_id
    WHERE a.id = ${assessmentId} AND o.owner_user_id = ${userId}
    LIMIT 1
  `) as Array<Record<string, unknown>>;

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    assessment: {
      id: r.a_id as string,
      organization_id: r.organization_id as string,
      cycle_label: r.cycle_label as string,
      status: r.a_status as AssessmentStatus,
      framework: r.framework as Framework,
      fiscal_year: r.fiscal_year as number,
      submitted_at: r.submitted_at as string | null,
      affirmed_at: r.affirmed_at as string | null,
      affirmed_by_name: r.affirmed_by_name as string | null,
      affirmed_by_title: r.affirmed_by_title as string | null,
      sprs_score: r.sprs_score as number | null,
      implements_all_17: r.implements_all_17 as boolean | null,
      carried_forward_from: r.carried_forward_from as string | null,
      created_at: r.a_created_at as string,
      updated_at: r.a_updated_at as string,
    },
    organization: {
      id: r.o_id as string,
      owner_user_id: r.owner_user_id as string,
      name: r.o_name as string,
      entity_type: r.entity_type as string | null,
      cage_code: r.cage_code as string | null,
      sam_uei: r.sam_uei as string | null,
      naics_codes: (r.naics_codes as string[]) ?? [],
      tier: r.tier as OrganizationRow["tier"],
      scoped_systems: r.scoped_systems as string | null,
      created_at: r.o_created_at as string,
      updated_at: r.o_updated_at as string,
    },
  };
}

export async function listResponsesForAssessment(
  assessmentId: string,
): Promise<ControlResponseRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId}
    ORDER BY control_id
  `) as ControlResponseRow[];
}

export type EvidenceArtifactRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  filename: string;
  blob_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  captured_at: string;
  uploaded_by_user_id: string;
  ai_review_verdict: EvidenceVerdict | null;
  ai_review_summary: string | null;
  ai_review_mapped_controls: string[];
  ai_reviewed_at: string | null;
  ai_review_model: string | null;
  prior_artifact_id: string | null;
  carry_forward_status: CarryForwardStatus;
  /**
   * NIST 800-171A objective letters this artifact is tagged to FOR THE
   * CURRENT QUERY's practice. Empty array means "tagged to the practice as
   * a whole" (legacy behaviour). Only populated by `listEvidenceForControl`.
   */
  tagged_objectives: string[];
};

/**
 * List every artifact tagged to (assessmentId, controlId) — including
 * artifacts that were originally uploaded under a DIFFERENT practice but
 * have since been cross-tagged via `evidence_artifact_practices`. The
 * legacy `evidence_artifacts.control_id` column is treated as just one
 * tag among many; cross-tags from the join table are unioned in.
 */
export async function listEvidenceForControl(
  assessmentId: string,
  controlId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.filename, a.blob_url,
           a.mime_type, a.size_bytes, a.captured_at, a.uploaded_by_user_id,
           a.ai_review_verdict, a.ai_review_summary, a.ai_review_mapped_controls,
           a.ai_reviewed_at, a.ai_review_model,
           a.prior_artifact_id, a.carry_forward_status,
           COALESCE(eap.objectives, '{}'::text[]) AS tagged_objectives
    FROM evidence_artifacts a
    LEFT JOIN evidence_artifact_practices eap
      ON eap.artifact_id = a.id
     AND eap.assessment_id = ${assessmentId}
     AND eap.control_id = ${controlId}
    WHERE a.assessment_id = ${assessmentId}
      AND (
        a.control_id = ${controlId}
        OR eap.artifact_id IS NOT NULL
      )
    ORDER BY a.captured_at DESC
  `) as EvidenceArtifactRow[];
}

export async function listEvidenceForAssessment(
  assessmentId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type,
           size_bytes, captured_at, uploaded_by_user_id,
           ai_review_verdict, ai_review_summary, ai_review_mapped_controls,
           ai_reviewed_at, ai_review_model,
           prior_artifact_id, carry_forward_status,
           '{}'::text[] AS tagged_objectives
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}
    ORDER BY control_id, captured_at DESC
  `) as EvidenceArtifactRow[];
}

/**
 * Tag an existing artifact to a (practice, objectives[]) tuple. Idempotent:
 * subsequent calls with the same (artifact, practice) update the objectives
 * list. Returns true if a row was inserted or updated.
 */
export async function tagArtifactPractice(args: {
  artifactId: string;
  assessmentId: string;
  controlId: string;
  objectives: string[];
  userId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO evidence_artifact_practices
      (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
    VALUES
      (${args.artifactId}, ${args.assessmentId}, ${args.controlId},
       ${args.objectives}, ${args.userId})
    ON CONFLICT (artifact_id, assessment_id, control_id)
    DO UPDATE SET objectives = EXCLUDED.objectives
  `;
}

/**
 * Remove a (practice) tag from an artifact. Used when the user un-tags an
 * artifact they had previously cross-tagged. Does NOT delete the artifact
 * itself or its primary `evidence_artifacts.control_id` association.
 */
export async function untagArtifactPractice(args: {
  artifactId: string;
  assessmentId: string;
  controlId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM evidence_artifact_practices
    WHERE artifact_id = ${args.artifactId}
      AND assessment_id = ${args.assessmentId}
      AND control_id = ${args.controlId}
  `;
}

export type ReuseCandidate = EvidenceArtifactRow & {
  /** True if Charlie's prior vision review mapped this artifact to the
   * target control, i.e. it's a confident suggestion rather than just
   * "anything in the assessment". */
  suggested: boolean;
  /** The practice this artifact was originally uploaded for, used as the
   * grouping label in the picker. */
  source_control_id: string;
};

/**
 * Artifacts in this assessment that are NOT yet tagged to `controlId` and
 * could plausibly be reused. We surface every other-practice artifact so the
 * user always has the option, then sort suggested ones (where the AI vision
 * review already mapped the file to this control) to the top.
 */
export async function getReuseCandidates(
  assessmentId: string,
  controlId: string,
): Promise<ReuseCandidate[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.filename, a.blob_url,
           a.mime_type, a.size_bytes, a.captured_at, a.uploaded_by_user_id,
           a.ai_review_verdict, a.ai_review_summary, a.ai_review_mapped_controls,
           a.ai_reviewed_at, a.ai_review_model,
           a.prior_artifact_id, a.carry_forward_status,
           '{}'::text[] AS tagged_objectives,
           a.control_id AS source_control_id
    FROM evidence_artifacts a
    WHERE a.assessment_id = ${assessmentId}
      AND a.control_id <> ${controlId}
      AND NOT EXISTS (
        SELECT 1 FROM evidence_artifact_practices eap
        WHERE eap.artifact_id = a.id
          AND eap.assessment_id = ${assessmentId}
          AND eap.control_id = ${controlId}
      )
    ORDER BY a.captured_at DESC
  `) as Array<EvidenceArtifactRow & { source_control_id: string }>;
  return rows.map((r) => ({
    ...r,
    suggested:
      Array.isArray(r.ai_review_mapped_controls) &&
      r.ai_review_mapped_controls.includes(controlId),
  }));
}

/**
 * An artifact counts toward attestation readiness only if the AI vision review
 * actually reviewed it AND rendered a non-insufficient, non-not_relevant
 * verdict. See feedback_evidence_gating.md.
 *
 * Verdicts of `unclear` with `ai_review_model = 'none'` are reserved for
 * unsupported formats (CSV, Excel, Word, plain text) — those bypass the AI
 * entirely and would otherwise leak through the gate. We treat them as not
 * passing so the user is forced to re-upload as a screenshot or PDF (or wait
 * for an officer to manually clear them).
 */
export function isEvidencePassing(row: EvidenceArtifactRow): boolean {
  if (row.ai_review_verdict === "sufficient") return true;
  if (row.ai_review_verdict === "unclear" && row.ai_review_model !== "none") {
    return true;
  }
  return false;
}

export function evidenceReviewBlockers(
  rows: EvidenceArtifactRow[],
): Array<{ id: string; filename: string; reason: string }> {
  return rows
    .filter((r) => !isEvidencePassing(r))
    .map((r) => ({
      id: r.id,
      filename: r.filename,
      reason:
        r.ai_review_verdict === null
          ? "Pending Platform review"
          : r.ai_review_model === "none"
            ? "Format not auto-reviewable — re-upload as PNG, JPG, or PDF"
            : r.ai_review_verdict === "insufficient"
              ? "Platform flagged insufficient — replace or supplement"
              : r.ai_review_verdict === "not_relevant"
                ? "Platform could not map this artifact to any practice"
                : "Not passing",
    }));
}

export async function getResponse(
  assessmentId: string,
  controlId: string,
): Promise<ControlResponseRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as ControlResponseRow[];
  return rows[0] ?? null;
}

/**
 * Identifies practices marked "Met" that have no passing evidence on file.
 * CMMC L1 self-attestation does not legally require uploaded artifacts, but
 * a bid-ready package without proof is worthless to a prime — and a signer
 * who claims "Met" with zero evidence is one questionnaire away from
 * embarrassment. We treat this as a sign-time blocker. The user can override
 * by writing an explicit narrative justifying why no artifact applies.
 *
 * A response satisfies the gate if EITHER:
 *   - status is 'not_applicable' (N/A practices need no artifact)
 *   - status is 'unanswered'/'no'/'partial' (other gates fire first)
 *   - status is 'yes' AND it has at least one passing artifact
 *   - status is 'yes' AND the narrative contains an explicit no-evidence
 *     justification (>=200 chars including the phrase 'no artifact')
 */
export function controlsMissingEvidence(
  responses: ControlResponseRow[],
  evidence: EvidenceArtifactRow[],
): Array<{ control_id: string; reason: string }> {
  const passingByControl = new Map<string, number>();
  for (const e of evidence) {
    if (!isEvidencePassing(e)) continue;
    if (e.carry_forward_status === "pending_review") continue;
    if (e.carry_forward_status === "needs_replacement") continue;
    if (e.carry_forward_status === "removed") continue;
    passingByControl.set(
      e.control_id,
      (passingByControl.get(e.control_id) ?? 0) + 1,
    );
  }

  const missing: Array<{ control_id: string; reason: string }> = [];
  for (const r of responses) {
    if (r.status !== "yes") continue;
    const count = passingByControl.get(r.control_id) ?? 0;
    if (count > 0) continue;
    const narrative = (r.narrative ?? "").trim();
    const hasJustification =
      narrative.length >= 200 && /no artifact/i.test(narrative);
    if (hasJustification) continue;
    missing.push({
      control_id: r.control_id,
      reason:
        "Marked Met but has no passing evidence on file. Upload an artifact or write a narrative (200+ chars including 'no artifact') explaining why none applies.",
    });
  }
  return missing;
}

/**
 * Practices that need a remediation plan: any 'no' or 'partial' response.
 * Returns control IDs for the caller to surface in the UI. Sign-time gate
 * remains hard — partial/no still blocks affirmation — but this exposes the
 * roadmap in a structured way for prime questionnaires.
 */
export function controlsNeedingRemediation(
  responses: ControlResponseRow[],
): string[] {
  return responses
    .filter((r) => r.status === "no" || r.status === "partial")
    .map((r) => r.control_id);
}

export async function listRemediationPlansForAssessment(
  assessmentId: string,
): Promise<RemediationPlanRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, gap_summary, planned_actions,
           target_close_date::text AS target_close_date, status,
           created_at, updated_at, closed_at
    FROM remediation_plans
    WHERE assessment_id = ${assessmentId}
    ORDER BY target_close_date ASC, control_id ASC
  `) as RemediationPlanRow[];
}

export async function getRemediationPlan(
  assessmentId: string,
  controlId: string,
): Promise<RemediationPlanRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, gap_summary, planned_actions,
           target_close_date::text AS target_close_date, status,
           created_at, updated_at, closed_at
    FROM remediation_plans
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as RemediationPlanRow[];
  return rows[0] ?? null;
}

export async function upsertRemediationPlan(input: {
  assessmentId: string;
  controlId: string;
  gapSummary: string;
  plannedActions: string;
  targetCloseDate: string;
  status: RemediationStatus;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO remediation_plans
      (assessment_id, control_id, gap_summary, planned_actions,
       target_close_date, status, updated_at)
    VALUES
      (${input.assessmentId}::uuid, ${input.controlId},
       ${input.gapSummary}, ${input.plannedActions},
       ${input.targetCloseDate}::date, ${input.status}, NOW())
    ON CONFLICT (assessment_id, control_id) DO UPDATE
    SET gap_summary = EXCLUDED.gap_summary,
        planned_actions = EXCLUDED.planned_actions,
        target_close_date = EXCLUDED.target_close_date,
        status = EXCLUDED.status,
        updated_at = NOW(),
        closed_at = CASE
          WHEN EXCLUDED.status IN ('closed','abandoned')
            AND remediation_plans.closed_at IS NULL
            THEN NOW()
          WHEN EXCLUDED.status NOT IN ('closed','abandoned')
            THEN NULL
          ELSE remediation_plans.closed_at
        END
  `;
}

export async function deleteRemediationPlan(
  assessmentId: string,
  controlId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM remediation_plans
    WHERE assessment_id = ${assessmentId}::uuid AND control_id = ${controlId}
  `;
}

/**
 * Carry-forward decisions on imported responses + artifacts during annual
 * rollover review. The rollover step seeds rows as 'pending_review'; the user
 * walks through and marks each as 'kept', 'needs_replacement', or 'removed'.
 */
export async function setResponseCarryStatus(
  assessmentId: string,
  controlId: string,
  status: CarryForwardStatus,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE control_responses
    SET carry_forward_status = ${status}, updated_at = NOW()
    WHERE assessment_id = ${assessmentId}::uuid AND control_id = ${controlId}
  `;
}

export async function setArtifactCarryStatus(
  artifactId: string,
  status: CarryForwardStatus,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET carry_forward_status = ${status}
    WHERE id = ${artifactId}::uuid
  `;
}

/**
 * Items still pending user review during a rollover cycle. UI uses this to
 * drive the "review last year's work" panel on the assessment overview.
 */
export async function listCarryForwardPending(
  assessmentId: string,
): Promise<{
  responses: ControlResponseRow[];
  artifacts: EvidenceArtifactRow[];
}> {
  const sql = getSql();
  const responses = (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId}::uuid
      AND carry_forward_status = 'pending_review'
    ORDER BY control_id
  `) as ControlResponseRow[];
  const artifacts = (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type,
           size_bytes, captured_at, uploaded_by_user_id,
           ai_review_verdict, ai_review_summary, ai_review_mapped_controls,
           ai_reviewed_at, ai_review_model,
           prior_artifact_id, carry_forward_status,
           '{}'::text[] AS tagged_objectives
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}::uuid
      AND carry_forward_status = 'pending_review'
    ORDER BY control_id, captured_at DESC
  `) as EvidenceArtifactRow[];
  return { responses, artifacts };
}

export type ProgressBreakdown = {
  total: number;
  met: number;
  partial: number;
  notMet: number;
  notApplicable: number;
  unanswered: number;
  percentAnswered: number;
};

export function computeProgress(responses: ControlResponseRow[]): ProgressBreakdown {
  const total = responses.length;
  let met = 0,
    partial = 0,
    notMet = 0,
    notApplicable = 0,
    unanswered = 0;
  for (const r of responses) {
    switch (r.status) {
      case "yes":
        met++;
        break;
      case "partial":
        partial++;
        break;
      case "no":
        notMet++;
        break;
      case "not_applicable":
        notApplicable++;
        break;
      default:
        unanswered++;
    }
  }
  const answered = total - unanswered;
  return {
    total,
    met,
    partial,
    notMet,
    notApplicable,
    unanswered,
    percentAnswered: total === 0 ? 0 : Math.round((answered / total) * 100),
  };
}
