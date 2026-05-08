/**
 * Connector evidence → CMMC L1 control auto-mapping with provenance.
 *
 * The flow:
 *   1. A connector (M365 Graph, Google Workspace, manual ingest) produces
 *      a payload — JSON, CSV, or PDF — for a known *kind* of evidence
 *      (e.g. "authorized_users_roster", "mfa_report").
 *   2. recordConnectorEvidence() hashes the bytes (SHA-256), encrypts at
 *      rest under the per-tenant DEK, uploads to Vercel Blob, and inserts
 *      one evidence_artifacts row PLUS one evidence_artifact_practices
 *      row per practice in the kind's mapping registry.
 *   3. The artifact carries source_provider / source_kind / source_run_id
 *      / data_hash / synced_at columns. An auditor can re-pull the bytes,
 *      recompute SHA-256, and compare against data_hash to prove the
 *      artifact has not been tampered with.
 *
 * Auto-mapping is opinionated and intentional: each kind is bound to the
 * exact set of CMMC L1 practices the artifact evidences (and the NIST
 * 800-171A objective letters within each practice). This is the same
 * mapping a human consultant would apply manually — we just do it
 * deterministically and stamp the source so it's audit-defensible.
 */

import { put } from "@vercel/blob";
import { ensureDbReady, getSql } from "@/lib/db";
import { encryptBytes } from "@/lib/security/field-encryption";
import { sha256HexBytes } from "@/lib/security/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Artifact kinds
// ─────────────────────────────────────────────────────────────────────────────

export const ARTIFACT_KINDS = [
  "authorized_users_roster",
  "mfa_report",
  "external_sharing_audit",
  "public_facing_shares",
  "patch_compliance",
  "defender_av_inventory",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export type PracticeMapping = {
  /** The legacy CMMC L1 practice ID (e.g. "AC.L1-3.1.1"). */
  practiceId: string;
  /**
   * NIST 800-171A objective letters this artifact evidences within this
   * practice (e.g. ["a","b"]). Empty array means "the practice as a whole".
   */
  objectives: string[];
};

export type ArtifactKindSpec = {
  /** Short label for UI. */
  label: string;
  /** One-line description shown next to the artifact in the evidence list. */
  description: string;
  /** Practices this artifact auto-maps to. */
  practices: ReadonlyArray<PracticeMapping>;
  /**
   * The "primary" practice — used for the legacy single-control_id column
   * on evidence_artifacts. The full mapping is recorded in
   * evidence_artifact_practices regardless. By convention this is the
   * first practice in `practices`.
   */
  primaryPracticeId: string;
  /** What MIME type the produced bytes will have (for blob/UI). */
  contentType: string;
  /** Filename suffix used when persisting (without extension dot). */
  extension: "json" | "csv" | "txt";
};

/**
 * The mapping registry. Each kind binds to the practices a competent
 * human reviewer would tag the artifact to. Keep these mappings narrow
 * and defensible — every entry must survive an assessor saying "why did
 * you tag THAT artifact to THAT control?"
 */
export const ARTIFACT_KIND_REGISTRY: Record<ArtifactKind, ArtifactKindSpec> = {
  authorized_users_roster: {
    label: "Authorized users roster",
    description:
      "List of every user/account authorized to access in-scope systems, with status and last sign-in.",
    practices: [
      // AC.L1-3.1.1 — Limit information system access to authorized users.
      { practiceId: "AC.L1-3.1.1", objectives: ["a", "b"] },
      // IA.L1-3.5.1 — Identify users (unique identifiers per person).
      { practiceId: "IA.L1-3.5.1", objectives: ["a"] },
    ],
    primaryPracticeId: "AC.L1-3.1.1",
    contentType: "application/json",
    extension: "json",
  },
  mfa_report: {
    label: "MFA / authenticator registration report",
    description:
      "Per-user authentication method registration status; demonstrates each authenticated user proves identity before access.",
    practices: [
      // IA.L1-3.5.2 — Authenticate (verify) the identities of users.
      { practiceId: "IA.L1-3.5.2", objectives: ["a"] },
    ],
    primaryPracticeId: "IA.L1-3.5.2",
    contentType: "application/json",
    extension: "json",
  },
  external_sharing_audit: {
    label: "External sharing audit",
    description:
      "Audit of files/sites shared with external parties; demonstrates control over information disclosed via interconnected systems.",
    practices: [
      // AC.L1-3.1.20 — Verify and control connections to/use of external systems.
      { practiceId: "AC.L1-3.1.20", objectives: ["a", "b"] },
    ],
    primaryPracticeId: "AC.L1-3.1.20",
    contentType: "application/json",
    extension: "json",
  },
  public_facing_shares: {
    label: "Public-facing shares scan",
    description:
      "Inventory of publicly accessible documents/folders; demonstrates control over information posted on publicly accessible systems.",
    practices: [
      // AC.L1-3.1.22 — Control information posted/processed on publicly accessible systems.
      { practiceId: "AC.L1-3.1.22", objectives: ["a", "b"] },
    ],
    primaryPracticeId: "AC.L1-3.1.22",
    contentType: "application/json",
    extension: "json",
  },
  patch_compliance: {
    label: "Patch compliance report",
    description:
      "Per-endpoint OS/application patch status with timestamps; demonstrates flaws are identified and remediated.",
    practices: [
      // SI.L1-3.14.1 — Identify, report, and correct system flaws in a timely manner.
      { practiceId: "SI.L1-3.14.1", objectives: ["a", "b", "c"] },
    ],
    primaryPracticeId: "SI.L1-3.14.1",
    contentType: "application/json",
    extension: "json",
  },
  defender_av_inventory: {
    label: "Endpoint AV / Defender inventory",
    description:
      "Per-endpoint anti-malware product, signature version, and last-scan timestamp; demonstrates protection from malicious code, signature currency, periodic scans, and real-time scans.",
    practices: [
      // SI.L1-3.14.2 — Provide protection from malicious code at appropriate locations.
      { practiceId: "SI.L1-3.14.2", objectives: ["a"] },
      // SI.L1-3.14.3 — Update malicious code protection mechanisms when new releases are available.
      { practiceId: "SI.L1-3.14.3", objectives: ["a"] },
      // SI.L1-3.14.4 — Update malicious code protection mechanisms when new releases are available (signatures).
      { practiceId: "SI.L1-3.14.4", objectives: ["a"] },
      // SI.L1-3.14.5 — Perform periodic scans of the system and real-time scans of files from external sources.
      { practiceId: "SI.L1-3.14.5", objectives: ["a", "b"] },
    ],
    primaryPracticeId: "SI.L1-3.14.2",
    contentType: "application/json",
    extension: "json",
  },
};

export function isArtifactKind(value: string): value is ArtifactKind {
  return (ARTIFACT_KINDS as ReadonlyArray<string>).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Connector run lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectorProviderTag =
  | "m365"
  | "google_workspace"
  | "manual_ingest";

export async function startConnectorRun(args: {
  organizationId: string;
  provider: ConnectorProviderTag;
  kind: ArtifactKind;
  triggeredBy?: "scheduler" | "manual" | "webhook";
}): Promise<string> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO connector_runs (organization_id, provider, kind, triggered_by)
    VALUES (
      ${args.organizationId}::uuid,
      ${args.provider},
      ${args.kind},
      ${args.triggeredBy ?? "scheduler"}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  return rows[0].id;
}

export async function completeConnectorRun(args: {
  runId: string;
  status: "success" | "partial" | "failed";
  rowCount?: number;
  rawHash?: string;
  error?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE connector_runs SET
      completed_at = NOW(),
      status = ${args.status},
      row_count = ${args.rowCount ?? null},
      raw_hash = ${args.rawHash ?? null},
      error = ${args.error ?? null}
    WHERE id = ${args.runId}::uuid
  `;
}

export type ConnectorRunRow = {
  id: string;
  organization_id: string;
  provider: string;
  kind: string;
  started_at: string;
  completed_at: string | null;
  status: "pending" | "success" | "partial" | "failed";
  row_count: number | null;
  error: string | null;
  raw_hash: string | null;
  triggered_by: string;
};

export async function listRecentConnectorRuns(
  organizationId: string,
  limit = 20,
): Promise<ConnectorRunRow[]> {
  await ensureDbReady();
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, provider, kind, started_at, completed_at,
           status, row_count, error, raw_hash, triggered_by
    FROM connector_runs
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY started_at DESC
    LIMIT ${limit}
  `) as ConnectorRunRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// recordConnectorEvidence — the core ingest function
// ─────────────────────────────────────────────────────────────────────────────

export type RecordConnectorEvidenceInput = {
  organizationId: string;
  assessmentId: string;
  provider: ConnectorProviderTag;
  kind: ArtifactKind;
  /** The exact bytes pulled from the upstream system. SHA-256 of these
   *  bytes is recorded as data_hash for tamper-detection. */
  payloadBytes: Uint8Array | Buffer;
  /** When the upstream API was queried (NOT when this row was created;
   *  the artifact may be persisted minutes later). Defaults to now. */
  syncedAt?: Date;
  /** Optional connector_runs row to link the artifact to. */
  runId?: string;
  /** Optional explicit row count for UI display (e.g. user count in a
   *  roster). Falls back to undefined if the kind is opaque (PDF). */
  rowCount?: number;
  /** Display name. Defaults to "<kind>-<isodate>.<ext>". */
  filename?: string;
  /** Override the default content type for the kind. */
  contentType?: string;
};

export type RecordConnectorEvidenceResult = {
  artifactId: string;
  blobUrl: string;
  dataHash: string;
  practicesTagged: number;
};

/**
 * Persist a connector-pulled artifact and auto-map it to every practice
 * the kind's registry entry declares. Idempotency: callers should check
 * data_hash before calling — passing the same bytes twice creates two
 * artifacts (we keep history rather than dedup, so an assessor can see
 * the timeline of pulls).
 */
export async function recordConnectorEvidence(
  input: RecordConnectorEvidenceInput,
): Promise<RecordConnectorEvidenceResult> {
  await ensureDbReady();
  const spec = ARTIFACT_KIND_REGISTRY[input.kind];
  if (!spec) {
    throw new Error(`unknown artifact kind: ${input.kind}`);
  }

  const bytes = Buffer.isBuffer(input.payloadBytes)
    ? input.payloadBytes
    : Buffer.from(input.payloadBytes);
  const dataHash = sha256HexBytes(bytes);
  const syncedAt = input.syncedAt ?? new Date();
  const filename =
    input.filename ??
    `${input.kind}-${syncedAt.toISOString().replace(/[:.]/g, "-")}.${spec.extension}`;
  const contentType = input.contentType ?? spec.contentType;
  const primaryControlId = spec.primaryPracticeId;

  // Encrypt the bytes with the per-tenant DEK before they touch the blob
  // store. AAD binds the ciphertext to (orgId, assessmentId, primary
  // practice) so a ciphertext swap across tenants or practices fails
  // decryption — same model as user uploads.
  const encryptedBytes = await encryptBytes(bytes, {
    organizationId: input.organizationId,
    field: `evidence:${input.assessmentId}:${primaryControlId}`,
  });

  const pathname = `evidence/${input.assessmentId}/${primaryControlId}/connector-${input.kind}-${dataHash.slice(0, 12)}`;
  const blob = await put(pathname, encryptedBytes, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
  });

  // System "user" stamp. Distinguished from human uploads by the
  // `connector:` prefix so audit log queries can filter cleanly.
  const uploadedByUserId = `connector:${input.provider}`;

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes,
       uploaded_by_user_id,
       source_provider, source_kind, source_run_id, data_hash, synced_at,
       ai_review_verdict, ai_review_summary, ai_reviewed_at, ai_review_model,
       ai_review_mapped_controls)
    VALUES
      (${input.assessmentId}, ${primaryControlId}, ${filename}, ${blob.url},
       ${contentType}, ${bytes.length},
       ${uploadedByUserId},
       ${input.provider}, ${input.kind},
       ${input.runId ?? null}::uuid, ${dataHash}, ${syncedAt.toISOString()},
       'sufficient',
       ${`Auto-mapped from ${input.provider} (${spec.label}). System-of-record artifact; SHA-256 recorded for tamper detection.`},
       NOW(), 'connector-auto-map',
       ${spec.practices.map((p) => p.practiceId)})
    RETURNING id
  `) as Array<{ id: string }>;
  const artifactId = inserted[0].id;

  // Tag to every practice in the kind's mapping. The legacy `control_id`
  // column on the artifact is the primary practice; cross-tags live in
  // evidence_artifact_practices with the per-practice objective list.
  let tagged = 0;
  for (const mapping of spec.practices) {
    await sql`
      INSERT INTO evidence_artifact_practices
        (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
      VALUES
        (${artifactId}, ${input.assessmentId}, ${mapping.practiceId},
         ${mapping.objectives}, ${uploadedByUserId})
      ON CONFLICT (artifact_id, assessment_id, control_id)
      DO UPDATE SET objectives = EXCLUDED.objectives
    `;
    tagged += 1;
  }

  return {
    artifactId,
    blobUrl: blob.url,
    dataHash,
    practicesTagged: tagged,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: canonical JSON serialization (deterministic byte output for
// reproducible hashes).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable JSON.stringify — sorts object keys recursively so the SHA-256 of
 * the same logical payload produced by two pulls is identical.
 */
export function canonicalJsonBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), "utf8");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}
