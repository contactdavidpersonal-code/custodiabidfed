/**
 * 32 CFR § 170.22(d) — Material Change filings.
 *
 * The CMMC L1 affirmation is an annual obligation, but an interim
 * reaffirmation is required any time a "material change" affects the system
 * or its scope (new FCI flow, new ESP, new acquisition, scope expansion,
 * etc.). This module records those filings in the `material_changes` audit
 * table — one row per declared change, append-only.
 *
 * Distinct from `assessments.material_change_reviewed_at` which is a
 * once-per-cycle snapshot of the annual interview ("we reviewed for changes
 * and the answer was X"). That field stays as-is; this table is the
 * structured filing log Charlie writes when the user reports a change.
 */

import { getSql } from "@/lib/db";

export type MaterialChangeRow = {
  id: string;
  assessment_id: string;
  organization_id: string;
  reason: string;
  changes: Record<string, unknown>;
  filed_at: string;
  filed_by_user_id: string;
  requires_reassessment: boolean;
};

export type FileMaterialChangeInput = {
  assessmentId: string;
  organizationId: string;
  userId: string;
  reason: string;
  changes: Record<string, unknown>;
  requiresReassessment: boolean;
};

export async function fileMaterialChange(
  input: FileMaterialChangeInput,
): Promise<MaterialChangeRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO material_changes
      (assessment_id, organization_id, reason, changes,
       filed_by_user_id, requires_reassessment)
    VALUES
      (${input.assessmentId},
       ${input.organizationId},
       ${input.reason},
       ${JSON.stringify(input.changes)}::jsonb,
       ${input.userId},
       ${input.requiresReassessment})
    RETURNING id, assessment_id, organization_id, reason, changes,
              filed_at, filed_by_user_id, requires_reassessment
  `) as MaterialChangeRow[];
  return rows[0]!;
}

/**
 * Tenant-scoped list. Caller MUST pass organizationId from an authenticated
 * session, never from user input.
 */
export async function listMaterialChangesForAssessment(
  assessmentId: string,
  organizationId: string,
): Promise<MaterialChangeRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, organization_id, reason, changes,
           filed_at, filed_by_user_id, requires_reassessment
    FROM material_changes
    WHERE assessment_id = ${assessmentId}
      AND organization_id = ${organizationId}
    ORDER BY filed_at DESC
  `) as MaterialChangeRow[];
}
