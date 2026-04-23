import { getSql, initDb, type AssessmentStatus, type ControlResponseStatus } from "@/lib/db";
import { playbook } from "@/lib/playbook";

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

  if (existing.length > 0) return existing[0];

  const inserted = (await sql`
    INSERT INTO organizations (owner_user_id, name, tier)
    VALUES (${userId}, ${"My Organization"}, 'solo')
    RETURNING id, owner_user_id, name, entity_type, cage_code, sam_uei,
              naics_codes, tier, scoped_systems, created_at, updated_at
  `) as OrganizationRow[];
  return inserted[0];
}

export async function listAssessmentsForOrg(
  organizationId: string,
): Promise<AssessmentRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, cycle_label, status, submitted_at, affirmed_at,
           affirmed_by_name, affirmed_by_title, sprs_score, created_at, updated_at
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
    SELECT a.id, a.organization_id, a.cycle_label, a.status, a.submitted_at,
           a.affirmed_at, a.affirmed_by_name, a.affirmed_by_title, a.sprs_score,
           a.created_at, a.updated_at,
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
): Promise<AssessmentRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO assessments (organization_id, cycle_label, status)
    VALUES (${organizationId}, ${cycleLabel}, 'in_progress')
    RETURNING id, organization_id, cycle_label, status, submitted_at, affirmed_at,
              affirmed_by_name, affirmed_by_title, sprs_score, created_at, updated_at
  `) as AssessmentRow[];
  const assessment = inserted[0];

  const controlIds = playbook.map((entry) => entry.id);
  await sql`
    INSERT INTO control_responses (assessment_id, control_id)
    SELECT ${assessment.id}::uuid, cid
    FROM UNNEST(${controlIds}::text[]) AS t(cid)
  `;

  return assessment;
}

export async function getAssessmentForUser(
  assessmentId: string,
  userId: string,
): Promise<{ assessment: AssessmentRow; organization: OrganizationRow } | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id AS a_id, a.organization_id, a.cycle_label, a.status AS a_status,
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
};

export async function listEvidenceForControl(
  assessmentId: string,
  controlId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type,
           size_bytes, captured_at, uploaded_by_user_id
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
           size_bytes, captured_at, uploaded_by_user_id
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}
    ORDER BY control_id, captured_at DESC
  `) as EvidenceArtifactRow[];
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
