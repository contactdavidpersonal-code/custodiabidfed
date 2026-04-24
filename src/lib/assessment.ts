import {
  getSql,
  initDb,
  type AssessmentStatus,
  type ControlResponseStatus,
  type EvidenceVerdict,
  type Framework,
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
  updated_at: string;
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
           sprs_score, created_at, updated_at
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
           a.affirmed_by_title, a.sprs_score, a.created_at, a.updated_at,
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
              sprs_score, created_at, updated_at
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

export async function getAssessmentForUser(
  assessmentId: string,
  userId: string,
): Promise<{ assessment: AssessmentRow; organization: OrganizationRow } | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id AS a_id, a.organization_id, a.cycle_label, a.status AS a_status,
           a.framework, a.fiscal_year,
           a.submitted_at, a.affirmed_at, a.affirmed_by_name, a.affirmed_by_title,
           a.sprs_score, a.created_at AS a_created_at, a.updated_at AS a_updated_at,
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
           officer_reviewed_at, officer_reviewer_user_id, updated_at
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
};

export async function listEvidenceForControl(
  assessmentId: string,
  controlId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type,
           size_bytes, captured_at, uploaded_by_user_id,
           ai_review_verdict, ai_review_summary, ai_review_mapped_controls,
           ai_reviewed_at, ai_review_model
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    ORDER BY captured_at DESC
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
           ai_reviewed_at, ai_review_model
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}
    ORDER BY control_id, captured_at DESC
  `) as EvidenceArtifactRow[];
}

/**
 * An artifact counts toward attestation readiness only if the AI vision review
 * has rendered a non-insufficient, non-not_relevant verdict. See
 * feedback_evidence_gating.md.
 */
export function isEvidencePassing(row: EvidenceArtifactRow): boolean {
  return (
    row.ai_review_verdict === "sufficient" ||
    row.ai_review_verdict === "unclear"
  );
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
          ? "Pending AI review"
          : r.ai_review_verdict === "insufficient"
            ? "AI flagged insufficient — replace or supplement"
            : r.ai_review_verdict === "not_relevant"
              ? "AI could not map this artifact to any practice"
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
           officer_reviewed_at, officer_reviewer_user_id, updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as ControlResponseRow[];
  return rows[0] ?? null;
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
