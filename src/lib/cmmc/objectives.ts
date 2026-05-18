/**
 * CMMC L1 v2.13 — assessment-objective layer.
 *
 * The platform records findings at two levels:
 *   1. Legacy `control_responses` (one row per practice) — kept for backwards
 *      compatibility with the existing UI and SPRS export.
 *   2. New `control_objective_responses` (one row per NIST 800-171A objective)
 *      — the canonical source of truth under CMMC Assessment Guide v2.13.
 *
 * Per 32 CFR § 170.24, a requirement is MET iff every objective is MET or
 * NOT APPLICABLE; one NOT MET objective fails the entire requirement.
 *
 * IMPORTANT — CMMC LEVEL 1 IS BINARY (32 CFR § 170.15(b)).
 * Level 1 self-assessment does NOT permit Plans of Action & Milestones.
 * Every requirement MUST be MET (or N/A) at the moment the Senior Official
 * signs the annual affirmation under § 170.22. Therefore:
 *   • Enduring Exceptions (permanent architectural realities documented in
 *     the SSP) remain valid and roll up to MET.
 *   • Temporary Deficiencies — which are POA&Ms by another name — are
 *     NEVER accepted as MET at L1. The DB schema still permits the value
 *     for backward compatibility with rows that may exist, but every
 *     code path that touches the affirmation gate, rollup, or coverage
 *     treats `temporary` as NOT MET.
 *
 * Source: CMMC Assessment Guide – Level 1, Version 2.13 (Sept 2024) and
 * 32 CFR § 170 (CMMC Program final rule).
 */

import { getSql } from "@/lib/db";
import type {
  AssessmentMethod,
  ObjectiveExceptionType,
  ObjectiveStatus,
} from "@/lib/db";
import {
  cmmcL1Requirements,
  type CmmcL1RequirementId,
  legacyToRequirement,
  practiceObjectives,
  requirementToLegacy,
} from "@/lib/playbook";

export type ObjectiveResponseRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  requirement_id: CmmcL1RequirementId;
  objective_letter: string;
  status: ObjectiveStatus;
  narrative: string | null;
  na_justification: string | null;
  exception_type: ObjectiveExceptionType | null;
  exception_notes: string | null;
  esp_inherited_from: string | null;
  method: AssessmentMethod | null;
  updated_at: string;
};

/**
 * Idempotently seed an objective row for every (legacy control, objective
 * letter) under CMMC L1 for the given assessment. Safe to call repeatedly.
 */
export async function seedObjectiveRows(assessmentId: string): Promise<void> {
  const sql = getSql();
  // Build the seed list as parallel arrays so we can insert in one round-trip.
  const controlIds: string[] = [];
  const requirementIds: string[] = [];
  const letters: string[] = [];
  for (const [controlId, objectives] of Object.entries(practiceObjectives)) {
    const reqId = legacyToRequirement[controlId];
    if (!reqId) continue;
    for (const objective of objectives) {
      controlIds.push(controlId);
      requirementIds.push(reqId);
      letters.push(objective.letter);
    }
  }
  await sql`
    INSERT INTO control_objective_responses
      (assessment_id, control_id, requirement_id, objective_letter)
    SELECT ${assessmentId}::uuid, c, r, l
    FROM UNNEST(
      ${controlIds}::text[],
      ${requirementIds}::text[],
      ${letters}::text[]
    ) AS t(c, r, l)
    ON CONFLICT (assessment_id, control_id, objective_letter) DO NOTHING
  `;
}

export async function listObjectivesForAssessment(
  assessmentId: string,
): Promise<ObjectiveResponseRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, requirement_id, objective_letter,
           status, narrative, na_justification, exception_type, exception_notes,
           esp_inherited_from, method, updated_at
    FROM control_objective_responses
    WHERE assessment_id = ${assessmentId}
    ORDER BY requirement_id, control_id, objective_letter
  `) as ObjectiveResponseRow[];
}

export type ObjectiveUpdate = {
  status?: ObjectiveStatus;
  narrative?: string | null;
  naJustification?: string | null;
  exceptionType?: ObjectiveExceptionType | null;
  exceptionNotes?: string | null;
  espInheritedFrom?: string | null;
  method?: AssessmentMethod | null;
};

export async function setObjectiveResponse(args: {
  assessmentId: string;
  controlId: string;
  objectiveLetter: string;
  update: ObjectiveUpdate;
}): Promise<void> {
  const sql = getSql();
  const reqId = legacyToRequirement[args.controlId];
  if (!reqId) throw new Error(`Unknown legacy control: ${args.controlId}`);
  const u = args.update;
  await sql`
    INSERT INTO control_objective_responses
      (assessment_id, control_id, requirement_id, objective_letter,
       status, narrative, na_justification,
       exception_type, exception_notes, esp_inherited_from, method,
       updated_at)
    VALUES
      (${args.assessmentId}::uuid, ${args.controlId}, ${reqId},
       ${args.objectiveLetter},
       ${u.status ?? "unanswered"},
       ${u.narrative ?? null},
       ${u.naJustification ?? null},
       ${u.exceptionType ?? null},
       ${u.exceptionNotes ?? null},
       ${u.espInheritedFrom ?? null},
       ${u.method ?? null},
       NOW())
    ON CONFLICT (assessment_id, control_id, objective_letter) DO UPDATE SET
      status = COALESCE(EXCLUDED.status, control_objective_responses.status),
      narrative = COALESCE(EXCLUDED.narrative, control_objective_responses.narrative),
      na_justification = EXCLUDED.na_justification,
      exception_type = EXCLUDED.exception_type,
      exception_notes = EXCLUDED.exception_notes,
      esp_inherited_from = EXCLUDED.esp_inherited_from,
      method = EXCLUDED.method,
      updated_at = NOW()
  `;
}

/**
 * "Effective" status for an objective at CMMC Level 1:
 *  - MET                 → met
 *  - NOT_APPLICABLE      → met (32 CFR § 170.24)
 *  - NOT_MET + enduring  → met (Enduring Exception documented in SSP)
 *  - NOT_MET + temporary → NOT MET (POA&M is forbidden at L1, § 170.15(b))
 *  - everything else     → not_met / unanswered
 */
export function effectiveObjectiveStatus(
  row: Pick<ObjectiveResponseRow, "status" | "exception_type">,
): "met" | "not_met" | "unanswered" {
  if (row.status === "met" || row.status === "not_applicable") return "met";
  if (row.status === "unanswered") return "unanswered";
  // status is not_met — Enduring Exception is the ONLY accepted L1 cover.
  if (row.exception_type === "enduring") return "met";
  return "not_met";
}

export type RequirementRollup = {
  requirementId: CmmcL1RequirementId;
  total: number;
  met: number;
  notMet: number;
  unanswered: number;
  /** MET when no NOT_MET and no UNANSWERED. */
  status: "met" | "not_met" | "in_progress";
};

/**
 * Roll the 59 objective findings up to the 15 v2.13 requirements.
 * One NOT MET objective fails the entire requirement (32 CFR § 170.24).
 */
export function rollupRequirements(
  responses: ObjectiveResponseRow[],
): RequirementRollup[] {
  const buckets = new Map<CmmcL1RequirementId, ObjectiveResponseRow[]>();
  for (const r of responses) {
    const list = buckets.get(r.requirement_id as CmmcL1RequirementId) ?? [];
    list.push(r);
    buckets.set(r.requirement_id as CmmcL1RequirementId, list);
  }
  return cmmcL1Requirements.map((reqId) => {
    const rows = buckets.get(reqId) ?? [];
    let met = 0;
    let notMet = 0;
    let unanswered = 0;
    for (const r of rows) {
      const eff = effectiveObjectiveStatus(r);
      if (eff === "met") met++;
      else if (eff === "not_met") notMet++;
      else unanswered++;
    }
    let status: RequirementRollup["status"] = "in_progress";
    if (rows.length > 0 && notMet === 0 && unanswered === 0) status = "met";
    else if (notMet > 0) status = "not_met";
    return {
      requirementId: reqId,
      total: rows.length,
      met,
      notMet,
      unanswered,
      status,
    };
  });
}

/**
 * Are all 15 requirements MET? This is the legal precondition for the
 * Senior Official affirmation under 32 CFR § 170.22 + DFARS 252.204-7021.
 */
export function allRequirementsMet(rollups: RequirementRollup[]): boolean {
  return rollups.length > 0 && rollups.every((r) => r.status === "met");
}

/** Convenience: total objectives across all 15 requirements. */
export function totalObjectivesPlanned(): number {
  let total = 0;
  for (const reqId of cmmcL1Requirements) {
    for (const legacy of requirementToLegacy[reqId] ?? []) {
      total += (practiceObjectives[legacy] ?? []).length;
    }
  }
  return total; // 59
}

/**
 * Bridge from the legacy "yes/no/partial/not_applicable/unanswered" status on a
 * control row to per-objective status. Called from `saveControlResponseAction`
 * whenever the user updates the legacy status, so the new objective layer
 * stays in sync with the existing single-status UI without forcing every user
 * to answer 59 dropdowns at once.
 *
 * Only objectives that are still 'unanswered' OR were last set by this same
 * sync are touched — any objective the user has explicitly answered (e.g.
 * marked NOT_APPLICABLE with a justification) is preserved. We detect "set
 * by sync" by checking that narrative IS NULL — the per-objective UI always
 * writes a narrative or N/A justification.
 */
export async function syncLegacyStatusToObjectives(args: {
  assessmentId: string;
  controlId: string;
  legacyStatus: "yes" | "no" | "partial" | "not_applicable" | "unanswered";
}): Promise<void> {
  const sql = getSql();
  const { assessmentId, controlId, legacyStatus } = args;
  let next: ObjectiveStatus;
  if (legacyStatus === "yes") next = "met";
  else if (legacyStatus === "not_applicable") next = "not_applicable";
  else if (legacyStatus === "no" || legacyStatus === "partial") next = "not_met";
  else next = "unanswered";
  await sql`
    UPDATE control_objective_responses
    SET status = ${next}, updated_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
      AND narrative IS NULL
      AND na_justification IS NULL
      AND exception_type IS NULL
  `;
}

/**
 * Apply an Enduring Exception to every objective under a single legacy
 * control. The objectives table treats EE on a NOT_MET row as "rolls up
 * to MET" (see `effectiveObjectiveStatus`), so this is the operation that
 * lets a user document a defensible MET-equivalent at L1.
 *
 * Per Assessment Guide v2.13 + 32 CFR § 170.15(b): Level 1 forbids
 * Plans-of-Action/POA&M, so Temporary Deficiencies are NOT accepted. This
 * helper hard-rejects any non-enduring type to keep the affirmation gate
 * defensible.
 */
export async function setControlException(args: {
  assessmentId: string;
  controlId: string;
  exceptionType: ObjectiveExceptionType;
  notes: string;
}): Promise<void> {
  if (args.exceptionType !== "enduring") {
    throw new Error(
      "CMMC Level 1 does not permit Temporary Deficiencies (32 CFR § 170.15(b)). Only Enduring Exceptions may be declared.",
    );
  }
  const sql = getSql();
  await sql`
    UPDATE control_objective_responses
    SET exception_type = ${args.exceptionType},
        exception_notes = ${args.notes},
        status = CASE WHEN status = 'unanswered' THEN 'not_met' ELSE status END,
        updated_at = NOW()
    WHERE assessment_id = ${args.assessmentId}
      AND control_id = ${args.controlId}
  `;
}

/**
 * Remove any EE/TD declaration from every objective under a control.
 */
export async function clearControlException(args: {
  assessmentId: string;
  controlId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE control_objective_responses
    SET exception_type = NULL,
        exception_notes = NULL,
        updated_at = NOW()
    WHERE assessment_id = ${args.assessmentId}
      AND control_id = ${args.controlId}
  `;
  // Cascade-deletes any TD milestones because milestones FK to objectives
  // and we don't delete objective rows here — but milestones for cleared
  // exceptions become orphans semantically. Hard-delete them to keep the
  // POA&M tidy.
  await sql`
    DELETE FROM objective_milestones
    WHERE objective_response_id IN (
      SELECT id FROM control_objective_responses
      WHERE assessment_id = ${args.assessmentId} AND control_id = ${args.controlId}
    )
  `;
}

export type MilestoneRow = {
  id: string;
  objective_response_id: string;
  control_id: string;
  requirement_id: CmmcL1RequirementId;
  label: string;
  target_date: string;
  completed_at: string | null;
  created_at: string;
};

export async function listMilestonesForAssessment(
  assessmentId: string,
): Promise<MilestoneRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT m.id, m.objective_response_id, r.control_id, r.requirement_id,
           m.label, m.target_date, m.completed_at, m.created_at
    FROM objective_milestones m
    JOIN control_objective_responses r ON r.id = m.objective_response_id
    WHERE r.assessment_id = ${assessmentId}
    ORDER BY m.target_date ASC
  `) as MilestoneRow[];
}

/**
 * Add a milestone to the first objective of the given control. We attach to
 * the first objective because the EE/TD applies to the entire control; UI
 * surfaces them at the requirement level.
 */
export async function addControlMilestone(args: {
  assessmentId: string;
  controlId: string;
  label: string;
  targetDate: string;
}): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM control_objective_responses
    WHERE assessment_id = ${args.assessmentId} AND control_id = ${args.controlId}
    ORDER BY objective_letter ASC
    LIMIT 1
  `) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new Error(
      `No objective rows for ${args.controlId} on assessment ${args.assessmentId}`,
    );
  }
  await sql`
    INSERT INTO objective_milestones
      (objective_response_id, label, target_date)
    VALUES (${rows[0].id}::uuid, ${args.label}, ${args.targetDate}::date)
  `;
}

export async function deleteMilestone(
  milestoneId: string,
  assessmentId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM objective_milestones
    WHERE id = ${milestoneId}::uuid
      AND objective_response_id IN (
        SELECT id FROM control_objective_responses
        WHERE assessment_id = ${assessmentId}
      )
  `;
}

/**
 * Per-control coverage map for the v2.13 affirmation gate.
 *
 * For each legacy control_id, returns:
 *   - exceptionType: "enduring" | "temporary" | null  (if declared)
 *   - milestoneCount: number of operational POA&M milestones on file
 *   - covered: true if a NOT-MET legacy answer would still roll up to MET
 *              under v2.13. Enduring Exceptions cover unconditionally;
 *              Temporary Deficiencies require ≥1 milestone.
 *
 * Use to compute "practices effectively complete" without rejecting controls
 * that the user has legitimately documented as EE/TD.
 */
export async function computeExceptionCoverage(
  assessmentId: string,
): Promise<
  Map<
    string,
    {
      exceptionType: ObjectiveExceptionType | null;
      milestoneCount: number;
      covered: boolean;
    }
  >
> {
  const sql = getSql();
  const rows = (await sql`
    SELECT r.control_id,
           MAX(r.exception_type) AS exception_type,
           COUNT(m.id)::int AS milestone_count
    FROM control_objective_responses r
    LEFT JOIN objective_milestones m ON m.objective_response_id = r.id
    WHERE r.assessment_id = ${assessmentId}
    GROUP BY r.control_id
  `) as Array<{
    control_id: string;
    exception_type: ObjectiveExceptionType | null;
    milestone_count: number;
  }>;

  const out = new Map<
    string,
    {
      exceptionType: ObjectiveExceptionType | null;
      milestoneCount: number;
      covered: boolean;
    }
  >();
  for (const row of rows) {
    // CMMC L1 (32 CFR § 170.15(b)): only Enduring Exceptions count as
    // coverage. Temporary Deficiencies are POA&Ms and are forbidden at L1.
    const covered = row.exception_type === "enduring";
    out.set(row.control_id, {
      exceptionType: row.exception_type,
      milestoneCount: row.milestone_count,
      covered,
    });
  }
  return out;
}

/**
 * Identify controls that block the v2.13 self-assessment affirmation.
 *
 * A control blocks if its legacy status is `unanswered`, `no`, or `partial`
 * AND it does not have qualifying EE/TD coverage. Returns one entry per
 * blocking control with a human-readable reason.
 */
export type AffirmationBlocker = {
  controlId: string;
  status: "unanswered" | "no" | "partial";
  reason: string;
};

export async function controlsBlockingAffirmation(
  assessmentId: string,
  responses: Array<{ control_id: string; status: string }>,
): Promise<AffirmationBlocker[]> {
  const coverage = await computeExceptionCoverage(assessmentId);
  const blockers: AffirmationBlocker[] = [];
  for (const r of responses) {
    if (r.status !== "unanswered" && r.status !== "no" && r.status !== "partial") {
      continue;
    }
    const cov = coverage.get(r.control_id);
    if (cov?.covered) continue;
    let reason: string;
    if (r.status === "unanswered") {
      reason = "Practice has not been answered.";
    } else if (cov?.exceptionType === "temporary") {
      reason =
        "Temporary Deficiency on file. CMMC Level 1 does not permit POA&Ms (32 CFR § 170.15(b)) — convert to an Enduring Exception or remediate to MET before signing.";
    } else if (cov?.exceptionType === "enduring") {
      // Should not reach here because EE always covers; defensive only.
      reason = "Enduring Exception is in an inconsistent state.";
    } else {
      reason =
        r.status === "partial"
          ? "Marked Partial. Move to Met / N/A, or declare an Enduring Exception. POA&Ms are not permitted at CMMC L1."
          : "Marked Not met. Move to Met / N/A, or declare an Enduring Exception. POA&Ms are not permitted at CMMC L1.";
    }
    blockers.push({
      controlId: r.control_id,
      status: r.status as "unanswered" | "no" | "partial",
      reason,
    });
  }
  return blockers;
}
