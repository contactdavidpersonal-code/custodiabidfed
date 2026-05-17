/**
 * Single source of truth for per-practice progress.
 *
 * Two consumers must show the SAME number for the same control:
 *   1. The overview page (/assessments/[id]) — the "15 safeguarding
 *      requirements" list with a percent next to each pill.
 *   2. The practice page (/assessments/[id]/controls/[controlId]) — the
 *      "THIS PRACTICE — N%" card at the top of the page.
 *
 * Both call `computePracticePercent` with the same inputs (objective
 * verdicts + tagged evidence + the practice's spec), so the two pages
 * can never disagree. If you change the weighting here, both surfaces
 * move together.
 */
import type {
  ClientPracticeSpec,
  PracticeSpec,
} from "@/lib/cmmc/practice-spec";
import { inferSlotKey } from "@/lib/cmmc/practice-spec";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";

export type PracticeProgress = {
  /** 0–100 integer percent — the headline number. */
  percent: number;
  /** Number of NIST 800-171A objective letters Charlie has graded `covered`. */
  coveredObjectives: number;
  /** Number graded `partial`. Counts as half toward the bar. */
  partialObjectives: number;
  /** Total objective letters in this practice. */
  totalObjectives: number;
  /** Required slots that have at least one `sufficient` artifact attached. */
  filledRequiredSlots: number;
  /** Total required slots in this practice (spec-driven). */
  totalRequiredSlots: number;
  /** All slots (required + optional) with a `sufficient` artifact attached. */
  filledSlots: number;
  /** Total slots in this practice (required + optional). */
  totalSlots: number;
  /**
   * True when the user has done *real* work on the practice beyond just
   * opening the page — answered at least one intake question, produced an
   * objective verdict, or uploaded evidence. The overview page uses this to
   * promote a still-unanswered legacy status from NOT STARTED → PARTIAL so
   * the dashboard reflects in-flight work. Set by the server batch loader;
   * the pure `computePracticePercent` helper leaves this undefined.
   */
  touched?: boolean;
};

type EvidenceLike = {
  filename: string;
  ai_review_verdict: string | null;
};

/**
 * Pure function — safe to call from both server and client. Mirror of the
 * formula PracticeChat used to inline; extracted here so the overview page
 * can produce the same number per-control without duplicating logic.
 *
 * Weighting (50/50):
 *   - objectiveScore = (covered + 0.5 × partial) / totalObjectives
 *   - evidenceScore  = filledRequiredSlots / totalRequiredSlots
 *   - percent        = round((objectiveScore × 0.5 + evidenceScore × 0.5) × 100)
 *
 * Empty-spec edge cases (no objectives or no required slots) score 1.0 on
 * that axis so a practice that's purely-attestation can still hit 100%.
 */
export function computePracticePercent(args: {
  spec: PracticeSpec | ClientPracticeSpec;
  verdicts: Record<string, ObjectiveVerdict>;
  evidence: EvidenceLike[];
}): PracticeProgress {
  const { spec, verdicts, evidence } = args;
  const totalObjectives = spec.objectives.length;
  const coveredObjectives = spec.objectives.filter(
    (o) => verdicts[o.letter]?.status === "covered",
  ).length;
  const partialObjectives = spec.objectives.filter(
    (o) => verdicts[o.letter]?.status === "partial",
  ).length;
  const slotIsFilled = (slotKey: string) =>
    evidence.some((ev) => {
      if (ev.ai_review_verdict !== "sufficient") return false;
      return inferSlotKey(ev.filename, spec) === slotKey;
    });
  const requiredSlots = spec.evidenceSlots.filter((s) => s.required);
  const totalRequiredSlots = requiredSlots.length;
  const filledRequiredSlots = requiredSlots.filter((s) =>
    slotIsFilled(s.key),
  ).length;
  const totalSlots = spec.evidenceSlots.length;
  const filledSlots = spec.evidenceSlots.filter((s) =>
    slotIsFilled(s.key),
  ).length;

  const objectiveScore =
    totalObjectives === 0
      ? 1
      : (coveredObjectives + 0.5 * partialObjectives) / totalObjectives;
  const evidenceScore =
    totalRequiredSlots === 0 ? 1 : filledRequiredSlots / totalRequiredSlots;
  const percent = Math.round(
    (objectiveScore * 0.5 + evidenceScore * 0.5) * 100,
  );

  return {
    percent,
    coveredObjectives,
    partialObjectives,
    totalObjectives,
    filledRequiredSlots,
    totalRequiredSlots,
    filledSlots,
    totalSlots,
  };
}
