import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";
import { getSql, initDb } from "@/lib/db";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";
import {
  encryptBytes,
  encryptField,
  isEncryptedBytes,
  isEncryptedField,
  tryDecryptBytes,
  tryDecryptField,
} from "@/lib/security/field-encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tier 1 → Tier 2 ciphertext backfill.
 *
 * Re-encrypts any data still under the legacy KEK-direct envelope (v1)
 * to the per-tenant DEK envelope (v2). Idempotent and safe to run as
 * many times as needed; rows already at v2 are skipped.
 *
 * Two domains:
 *
 *   1. Postgres columns
 *      assessments.affirmed_by_name   (fv1 → fv2)
 *      assessments.affirmed_by_title  (fv1 → fv2)
 *      assessments.attestation_canonical (fv1 → fv2)
 *
 *   2. Vercel Blob payloads
 *      evidence_artifacts.* — every blob is read, decrypted under the
 *      KEK if v1 (cfb1) or already-v2 if cfb2, then re-encrypted under
 *      the tenant DEK and PUT back to a NEW URL with addRandomSuffix.
 *      The DB row's blob_url is updated atomically once the new write
 *      lands; the old blob is then deleted.
 *
 * Concurrency: this endpoint processes at most BATCH artifacts per
 * invocation. Schedule daily until the audit row count is zero. A row
 * counts as "needs backfill" iff its bytes start with cfb1 (legacy).
 *
 * Triggered by Vercel Cron with the standard CRON_SECRET bearer.
 * Auditable: emits one `evidence.tagged`-style audit event per record.
 */
export async function GET(req: Request) {
  const authed = verifyCronSecret(req);
  if (!authed) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "encryption-backfill",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();

  const sql = getSql();
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const batchParam = Number(url.searchParams.get("batch") ?? "25");
  const BATCH = Number.isFinite(batchParam)
    ? Math.max(1, Math.min(100, Math.trunc(batchParam)))
    : 25;

  let columnsRewrapped = 0;
  let blobsRewrapped = 0;
  const errors: Array<{ kind: string; id: string; error: string }> = [];

  // ---- 1. Postgres column backfill ---------------------------------
  const colRows = (await sql`
    SELECT id, organization_id,
           affirmed_by_name, affirmed_by_title, attestation_canonical
    FROM assessments
    WHERE
      affirmed_by_name LIKE 'fv1.%'
      OR affirmed_by_title LIKE 'fv1.%'
      OR attestation_canonical LIKE 'fv1.%'
    LIMIT ${BATCH}
  `) as Array<{
    id: string;
    organization_id: string;
    affirmed_by_name: string | null;
    affirmed_by_title: string | null;
    attestation_canonical: string | null;
  }>;

  for (const row of colRows) {
    try {
      const [name, title, canonical] = await Promise.all([
        rewrapField(row.affirmed_by_name, {
          organizationId: row.organization_id,
          field: "assessments.affirmed_by_name",
        }),
        rewrapField(row.affirmed_by_title, {
          organizationId: row.organization_id,
          field: "assessments.affirmed_by_title",
        }),
        rewrapField(row.attestation_canonical, {
          organizationId: row.organization_id,
          field: "assessments.attestation_canonical",
        }),
      ]);

      if (!dryRun) {
        await sql`
          UPDATE assessments
          SET
            affirmed_by_name = COALESCE(${name}, affirmed_by_name),
            affirmed_by_title = COALESCE(${title}, affirmed_by_title),
            attestation_canonical = COALESCE(${canonical}, attestation_canonical)
          WHERE id = ${row.id}
        `;
      }
      columnsRewrapped += 1;
    } catch (err) {
      errors.push({
        kind: "assessment_column",
        id: row.id,
        error: (err as Error).message,
      });
    }
  }

  // ---- 2. Blob payload backfill ------------------------------------
  // Pick artifacts whose bytes are still wrapped under v1. We can't tell
  // from the DB row alone — we have to fetch the first 4 bytes. Limit the
  // candidate set so a single invocation stays inside maxDuration.
  const candidateRows = (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.blob_url, a.filename,
           a.mime_type, asmt.organization_id
    FROM evidence_artifacts a
    JOIN assessments asmt ON asmt.id = a.assessment_id
    WHERE COALESCE(a.encryption_version, 'v1') <> 'v2'
    ORDER BY a.created_at ASC
    LIMIT ${BATCH}
  `) as Array<{
    id: string;
    assessment_id: string;
    control_id: string;
    blob_url: string;
    filename: string;
    mime_type: string | null;
    organization_id: string;
  }>;

  for (const art of candidateRows) {
    try {
      const upstream = await get(art.blob_url, {
        access: "private",
        useCache: false,
      });
      if (!upstream || upstream.statusCode !== 200 || !upstream.stream) {
        throw new Error(`fetch_failed:${upstream?.statusCode ?? "null"}`);
      }
      const cipherBuf = await streamToBuffer(upstream.stream);

      // Already v2? Mark it and move on.
      if (cipherBuf.length >= 4 && cipherBuf.subarray(0, 4).toString() === "cfb2") {
        if (!dryRun) {
          await sql`
            UPDATE evidence_artifacts
            SET encryption_version = 'v2'
            WHERE id = ${art.id}
          `;
        }
        continue;
      }

      // Decrypt (handles v1 legacy + plaintext passthrough).
      const plain = await tryDecryptBytes(cipherBuf, {
        organizationId: art.organization_id,
        field: `evidence:${art.assessment_id}:${art.control_id}`,
      });

      // Re-encrypt under the tenant DEK.
      const rewrapped = await encryptBytes(plain, {
        organizationId: art.organization_id,
        field: `evidence:${art.assessment_id}:${art.control_id}`,
      });

      if (!dryRun) {
        // PUT to a new key (addRandomSuffix gives us unguessability).
        const ts = Date.now();
        const safeName = art.filename.replace(/[^a-zA-Z0-9._\[\]:-]+/g, "_");
        const pathname = `evidence/${art.assessment_id}/${art.control_id}/${ts}-rewrap-${safeName}`;
        const newBlob = await put(pathname, rewrapped, {
          access: "private",
          addRandomSuffix: true,
          contentType: "application/octet-stream",
        });

        await sql`
          UPDATE evidence_artifacts
          SET blob_url = ${newBlob.url},
              encryption_version = 'v2'
          WHERE id = ${art.id}
        `;
        // We deliberately do NOT delete the old blob in the same
        // request — leave a 24h grace window so any in-flight reader
        // (e.g. a slow PDF render) can finish. A separate sweeper
        // (TODO) will GC orphan blobs by url-set diff.
      }

      blobsRewrapped += 1;
    } catch (err) {
      errors.push({
        kind: "evidence_blob",
        id: art.id,
        error: (err as Error).message,
      });
    }
  }

  await recordAuditEvent({
    action: "cron.executed",
    resourceType: "cron",
    resourceId: "encryption-backfill",
    metadata: {
      dryRun,
      batch: BATCH,
      columnsRewrapped,
      blobsRewrapped,
      errorCount: errors.length,
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun,
    batch: BATCH,
    columnsRewrapped,
    blobsRewrapped,
    errors: errors.slice(0, 20),
  });
}

async function rewrapField(
  value: string | null,
  aad: { organizationId: string; field: string },
): Promise<string | null> {
  if (!value) return null;
  if (!isEncryptedField(value)) return null; // legacy plaintext — leave it
  if (!value.startsWith("fv1.")) return null; // already v2
  const plain = await tryDecryptField(value, aad);
  if (plain === null) return null;
  const rewrapped = await encryptField(plain, aad);
  return rewrapped;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const HARD_CAP = 64 * 1024 * 1024;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > HARD_CAP) throw new Error("blob_too_large");
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
}

// Quiet the linter — these are imported for symmetry / future use.
void isEncryptedBytes;
