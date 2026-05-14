/**
 * Envelope encryption for `ai_messages.content` (JSONB) and any other
 * jsonb-shaped column that needs to ride through the same per-tenant DEK
 * pipeline as the rest of Charlie's sensitive data.
 *
 * Wire shape on disk:
 *   { "__enc": "fv2", "v": "fv2.<iv_b64url>.<combined_b64url>" }
 *
 * Detection: a jsonb object with a top-level `__enc` key is treated as
 * an envelope and decrypted. Anything else (arrays, plain strings, older
 * jsonb objects without `__enc`) is returned as-is — that's how legacy
 * plaintext rows continue to work without a forced migration.
 *
 * Why a jsonb envelope rather than converting the column to TEXT:
 *   1. No schema migration risk — the existing JSONB column accepts the
 *      envelope today, and rollback is trivial.
 *   2. Future fields (multi-version, key id, signing metadata) extend
 *      the object without another migration.
 *   3. Postgres can still index/inspect non-encrypted legacy rows during
 *      the transition without special handling.
 */

import {
  encryptField,
  tryDecryptField,
} from "@/lib/security/field-encryption";

const ENVELOPE_VERSION = "fv2" as const;

const AAD_FIELD = "ai_messages.content";

type Envelope = {
  __enc: typeof ENVELOPE_VERSION;
  v: string;
};

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "__enc" in (value as Record<string, unknown>) &&
    (value as Record<string, unknown>).__enc === ENVELOPE_VERSION &&
    typeof (value as Record<string, unknown>).v === "string"
  );
}

/**
 * Encrypt arbitrary message content (string or array of content blocks)
 * under the tenant's DEK. Returns the on-disk envelope object suitable
 * for inserting into a JSONB column.
 */
export async function encryptMessageContent(
  content: unknown,
  organizationId: string,
): Promise<Envelope> {
  const json = JSON.stringify(content ?? null);
  const ct = await encryptField(json, {
    organizationId,
    field: AAD_FIELD,
  });
  return { __enc: ENVELOPE_VERSION, v: ct };
}

/**
 * Decrypt envelope-shaped jsonb back to the original content value.
 * Legacy plaintext rows (arrays, strings, jsonb without `__enc`) pass
 * through unchanged. Never throws on legacy data — only throws if the
 * envelope itself is malformed or AAD-rejected, which indicates real
 * corruption rather than a routine read.
 */
export async function tryDecryptMessageContent(
  content: unknown,
  organizationId: string,
): Promise<unknown> {
  if (!isEnvelope(content)) return content;
  const plain = await tryDecryptField(content.v, {
    organizationId,
    field: AAD_FIELD,
  });
  if (plain === null) return content;
  try {
    return JSON.parse(plain);
  } catch {
    // The envelope decrypted to something that wasn't valid JSON — return
    // the raw string so the caller can at least display it.
    return plain;
  }
}
