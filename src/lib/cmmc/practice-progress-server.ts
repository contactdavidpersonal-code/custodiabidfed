/**
 * Server-side batch loader for practice progress.
 *
 * Used by the assessment overview page (/assessments/[id]) to render the
 * same percent on every L1 requirement card that the practice page shows
 * in its "THIS PRACTICE — N%" header.
 *
 * One DB read per assessment instead of one per control:
 *   - `practice_conversations`: one query returning every row for the
 *     assessment (so we get every control's objective_verdicts at once).
 *   - `evidence_artifacts`:    one query via `listEvidenceForAssessment`
 *     returning every artifact for the assessment.
 *
 * Then we walk the in-memory rows and call the pure `computePracticePercent`
 * helper — same code path the practice page uses, so the two surfaces
 * cannot drift.
 */
import { getSql } from "@/lib/db";
import { listEvidenceForAssessment } from "@/lib/assessment";
import {
  getPracticeSpec,
  type PracticeSpec,
} from "@/lib/cmmc/practice-spec";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
import {
  computePracticePercent,
  type PracticeProgress,
} from "@/lib/cmmc/practice-progress";

/**
 * Load progress for every NIST 800-171 control that has either a practice
 * conversation row OR at least one evidence artifact in this assessment.
 * Controls with neither (user hasn't touched the practice) won't appear
 * in the map — caller should treat absence as 0%.
 */
export async function listPracticeProgressForAssessment(
  assessmentId: string,
): Promise<Map<string, PracticeProgress>> {
  const sql = getSql();

  type ConvRow = {
    control_id: string;
    objective_verdicts: Record<string, ObjectiveVerdict> | null;
  };
  const [convRows, evidenceRows] = await Promise.all([
    sql`
      SELECT control_id, objective_verdicts
      FROM practice_conversations
      WHERE assessment_id = ${assessmentId}
    ` as unknown as Promise<ConvRow[]>,
    listEvidenceForAssessment(assessmentId),
  ]);

  // Collect every control we have data for (any row in either table).
  const verdictsByControl = new Map<
    string,
    Record<string, ObjectiveVerdict>
  >();
  for (const row of convRows) {
    verdictsByControl.set(row.control_id, row.objective_verdicts ?? {});
  }
  const evidenceByControl = new Map<
    string,
    { filename: string; ai_review_verdict: string | null }[]
  >();
  for (const ev of evidenceRows) {
    if (!ev.control_id) continue;
    const list = evidenceByControl.get(ev.control_id) ?? [];
    list.push({
      filename: ev.filename,
      ai_review_verdict: ev.ai_review_verdict,
    });
    evidenceByControl.set(ev.control_id, list);
  }

  const controlIds = new Set<string>([
    ...verdictsByControl.keys(),
    ...evidenceByControl.keys(),
  ]);

  const out = new Map<string, PracticeProgress>();
  for (const controlId of controlIds) {
    const spec: PracticeSpec | null = getPracticeSpec(controlId);
    if (!spec) continue;
    const progress = computePracticePercent({
      spec,
      verdicts: verdictsByControl.get(controlId) ?? {},
      evidence: evidenceByControl.get(controlId) ?? [],
    });
    out.set(controlId, progress);
  }
  return out;
}
