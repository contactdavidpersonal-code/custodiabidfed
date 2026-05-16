// Per-practice tamper-evident affirmations.
//
// CMMC Level 1 self-assessment is an attestation regime: a Senior Official
// is on the hook for the accuracy of every claim. We let users do that one
// practice at a time — sign the snapshot of (intake answers + objective
// verdicts + final evidence) — and we hash that snapshot so the SPRS
// deliverable can refuse to render if anything drifted since the signature.
//
// Storage: src/lib/db.ts `practice_affirmations` table. One row per signing
// event. The "current" affirmation is the latest row for (assessment,
// control) where superseded_at IS NULL. Re-affirming inserts a new row
// and marks the previous row superseded.

import { createHash } from "node:crypto";

import { getSql } from "@/lib/db";

import type { ObjectiveVerdict } from "./practice-chat";
import type { IntakeAnswers } from "./practice-spec";

/**
 * The exact bytes we hash. Anything that materially changes the auditor's
 * read of this practice must be in here, and nothing else. Order-stable
 * keys (we sort before stringify) so the same logical snapshot always
 * produces the same hash.
 */
export type PracticeSnapshot = {
  controlId: string;
  /** Schema version — bump if we change what's hashed. */
  v: 1;
  intakeAnswers: IntakeAnswers;
  verdicts: Record<string, ObjectiveVerdict>;
  /**
   * Evidence artifact ids included in the snapshot, sorted ascending.
   * We store ids (UUIDs) rather than filenames/blob urls so renaming a
   * blob in storage doesn't break the hash, but adding/removing an
   * artifact does.
   */
  evidenceIds: string[];
};

export type AffirmationRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  content_hash: string;
  signed_at: string;
  signed_by_user_id: string;
  signed_name: string;
  snapshot_json: PracticeSnapshot;
  superseded_at: string | null;
};

/**
 * Canonicalize an arbitrary JSON value into a deterministic string. Object
 * keys are emitted in sorted order at every level so two semantically
 * equivalent snapshots always hash identically.
 */
function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k]))
      .join(",") +
    "}"
  );
}

/** SHA-256 hex digest of the canonical snapshot. */
export function computePracticeContentHash(snapshot: PracticeSnapshot): string {
  return createHash("sha256")
    .update(canonicalJSON(snapshot), "utf8")
    .digest("hex");
}

/**
 * Build the snapshot from the per-practice row + evidence artifacts.
 * We intentionally normalize empties (null intake → {}, empty verdicts →
 * {}) so a missing column and a present-but-empty column hash the same.
 */
export function buildPracticeSnapshot(args: {
  controlId: string;
  intakeAnswers: IntakeAnswers | null;
  verdicts: Record<string, ObjectiveVerdict> | null;
  evidenceIds: string[];
}): PracticeSnapshot {
  return {
    controlId: args.controlId,
    v: 1,
    intakeAnswers: args.intakeAnswers ?? {},
    verdicts: args.verdicts ?? {},
    evidenceIds: [...args.evidenceIds].sort(),
  };
}

/**
 * Insert a new affirmation row and supersede any prior current row in
 * the same transaction-ish window. Caller MUST tenant-check before
 * calling — we do not re-validate the assessmentId/userId pairing here.
 */
export async function createPracticeAffirmation(args: {
  assessmentId: string;
  controlId: string;
  signedByUserId: string;
  signedName: string;
  snapshot: PracticeSnapshot;
}): Promise<AffirmationRow> {
  const sql = getSql();
  const contentHash = computePracticeContentHash(args.snapshot);

  // Mark any existing current rows as superseded. Cheap, idempotent.
  await sql`
    UPDATE practice_affirmations
    SET superseded_at = NOW()
    WHERE assessment_id = ${args.assessmentId}
      AND control_id = ${args.controlId}
      AND superseded_at IS NULL
  `;

  const rows = (await sql`
    INSERT INTO practice_affirmations
      (assessment_id, control_id, content_hash, signed_by_user_id,
       signed_name, snapshot_json)
    VALUES (
      ${args.assessmentId},
      ${args.controlId},
      ${contentHash},
      ${args.signedByUserId},
      ${args.signedName},
      ${JSON.stringify(args.snapshot)}::jsonb
    )
    RETURNING id, assessment_id, control_id, content_hash, signed_at,
              signed_by_user_id, signed_name, snapshot_json, superseded_at
  `) as AffirmationRow[];
  return rows[0];
}

/**
 * Latest non-superseded affirmation for (assessment, control). Null when
 * the user has never signed this practice (or always-superseded — should
 * not happen, but we treat that as "needs re-affirm").
 */
export async function getLatestAffirmation(
  assessmentId: string,
  controlId: string,
): Promise<AffirmationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, content_hash, signed_at,
           signed_by_user_id, signed_name, snapshot_json, superseded_at
    FROM practice_affirmations
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
      AND superseded_at IS NULL
    ORDER BY signed_at DESC
    LIMIT 1
  `) as AffirmationRow[];
  return rows[0] ?? null;
}

/**
 * Latest affirmations for every control in an assessment, keyed by
 * control_id. Used by the affirm page (status grid) and the SPRS
 * deliverable gate.
 */
export async function getAllLatestAffirmations(
  assessmentId: string,
): Promise<Record<string, AffirmationRow>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ON (control_id)
      id, assessment_id, control_id, content_hash, signed_at,
      signed_by_user_id, signed_name, snapshot_json, superseded_at
    FROM practice_affirmations
    WHERE assessment_id = ${assessmentId}
      AND superseded_at IS NULL
    ORDER BY control_id, signed_at DESC
  `) as AffirmationRow[];
  const out: Record<string, AffirmationRow> = {};
  for (const r of rows) out[r.control_id] = r;
  return out;
}

/**
 * `true` when the current content_hash differs from the latest signed
 * affirmation — i.e. the user has changed evidence/answers since signing
 * and needs to re-affirm before shipping. Also true when there is no
 * affirmation yet.
 */
export function isAffirmationStale(
  latest: AffirmationRow | null,
  currentHash: string,
): boolean {
  if (!latest) return true;
  return latest.content_hash !== currentHash;
}

/**
 * Identify every chat-spec practice in an assessment whose CURRENT
 * snapshot hash doesn't match the latest signed affirmation. Used by the
 * SPRS bid-package route to refuse rendering when any per-practice
 * signature is missing or stale. Returns `{ controlId, reason }[]` —
 * reason is "unsigned" | "drift" — empty array means "ready to ship".
 */
export async function getStaleAffirmations(args: {
  assessmentId: string;
  practices: Array<{
    controlId: string;
    intakeAnswers: IntakeAnswers | null;
    verdicts: Record<string, ObjectiveVerdict> | null;
    evidenceIds: string[];
  }>;
}): Promise<Array<{ controlId: string; reason: "unsigned" | "drift" }>> {
  const latestByControl = await getAllLatestAffirmations(args.assessmentId);
  const out: Array<{ controlId: string; reason: "unsigned" | "drift" }> = [];
  for (const p of args.practices) {
    const snap = buildPracticeSnapshot(p);
    const currentHash = computePracticeContentHash(snap);
    const latest = latestByControl[p.controlId] ?? null;
    if (!latest) {
      out.push({ controlId: p.controlId, reason: "unsigned" });
      continue;
    }
    if (latest.content_hash !== currentHash) {
      out.push({ controlId: p.controlId, reason: "drift" });
    }
  }
  return out;
}
