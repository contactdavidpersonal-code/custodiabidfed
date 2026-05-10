/**
 * Field-level envelope encryption — AES-256-GCM with per-tenant Data
 * Encryption Keys (DEKs) wrapped under a platform Key Encryption Key (KEK).
 *
 * Architecture (Tier 2 zero-trust):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ KEK   (FIELD_ENCRYPTION_KEY env, 32 bytes; never touches data)   │
 *   │   │                                                              │
 *   │   ├── HKDF info="custodia.kek-wrap.v2" → kekWrapKey              │
 *   │   │       AES-256-GCM wraps every per-tenant DEK at rest         │
 *   │   │                                                              │
 *   │   ├── HKDF info="custodia.blind-index.v1" → blind-index key     │
 *   │   │                                                              │
 *   │   └── (legacy v1) raw KEK was used directly to encrypt fields.   │
 *   │       Tier 1 ciphertext (`fv1.*` / `cfb1`) still decrypts under  │
 *   │       this path so historical rows keep working post-rollout.    │
 *   │                                                                  │
 *   │ DEK   (organizations.wrapped_dek, 32 bytes per org, AES-256)     │
 *   │       Wrapped form on disk. Unwrapped in-memory (60 s cache).    │
 *   │       Encrypts ALL Tier 2 ciphertext (`fv2.*` / `cfb2`) for one  │
 *   │       and only one tenant.                                       │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Threat model upgrades over Tier 1:
 *   • KEK leak alone now reveals nothing — the wrapped DEKs are still
 *     encrypted under the KEK, and you also need the database row that
 *     holds them. Two systems must fall.
 *   • DB leak alone reveals nothing — wrapped DEKs are ciphertext, and
 *     decrypting them needs the KEK in the secret manager.
 *   • Per-tenant key separation: deleting a single
 *     `organizations.wrapped_dek` row "crypto-shreds" all of that
 *     tenant's v2 ciphertext, instantly and irreversibly.
 *   • Per-record AAD still binds (organizationId, field) so a column
 *     swap inside one tenant fails decryption.
 *
 * Wire formats:
 *   String values:  fv2.<iv_b64url>.<ct+tag_b64url>     (uses tenant DEK)
 *                   fv1.<iv_b64url>.<ct+tag_b64url>     (legacy: uses KEK)
 *   Byte values  :  magic("cfb2")(4) | iv(12) | ct | tag(16)   (DEK)
 *                   magic("cfb1")(4) | iv(12) | ct | tag(16)   (legacy KEK)
 *   Wrapped DEK :   iv(12) | wrapped_ct(32) | tag(16)          (60 bytes)
 *
 * NEW writes always emit v2. Decrypt branches on the wire-format prefix
 * so historical data never breaks. To migrate v1 → v2 in bulk, decrypt
 * each row and re-encrypt; the same `aad` shape is used either way.
 *
 * Tier 3 zero-trust (KMS-backed KEK): when KMS_KEK_CIPHERTEXT is set, the
 * KEK plaintext is no longer in env at all. The env holds the *KMS
 * ciphertext blob* of the same 32-byte KEK; on cold start the code calls
 * kms:Decrypt to materialize it in memory, where it lives behind the same
 * wrap/unwrap helpers used by Tier 2. The plaintext value is identical
 * to what was previously held in FIELD_ENCRYPTION_KEY, so all existing
 * v1/v2 ciphertext keeps working without a backfill. This collapses the
 * "two systems must fall" model to "three systems must fall" — KMS,
 * Vercel project, and the database — because reading the env var alone
 * is no longer enough.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  DecryptCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import { getSql } from "@/lib/db";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

const STRING_PREFIX_V1 = "fv1.";
const STRING_PREFIX_V2 = "fv2.";
const BYTES_MAGIC_V1 = Buffer.from("cfb1", "ascii");
const BYTES_MAGIC_V2 = Buffer.from("cfb2", "ascii");

// ─────────────────────────────────────────────────────────────────────────────
// KEK loading (the platform-wide key that wraps tenant DEKs).
// Same resolution chain as Tier 1 so existing deployments keep working.
// ─────────────────────────────────────────────────────────────────────────────

let _cachedKek: Buffer | null = null;
let _cachedKekWrap: Buffer | null = null;
let _cachedBlindKey: Buffer | null = null;
let _warnedFallback = false;
let _inflightKek: Promise<Buffer> | null = null;
let _kmsClient: KMSClient | null = null;

function getKmsClient(): KMSClient {
  if (!_kmsClient) {
    const region =
      (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-2").trim();
    _kmsClient = new KMSClient({ region });
  }
  return _kmsClient;
}

function decodeKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LEN * 2) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

/**
 * KMS-backed KEK loader. Reads the AWS-KMS-encrypted KEK ciphertext from
 * `KMS_KEK_CIPHERTEXT` (base64), asks KMS to decrypt it, caches the
 * plaintext for the process lifetime. The plaintext NEVER leaves this
 * function's scope and is never persisted anywhere on disk.
 *
 * Returns null if KMS mode is not configured (i.e. fall through to env-var KEK).
 */
async function loadKekFromKms(): Promise<Buffer | null> {
  const blobB64 = process.env.KMS_KEK_CIPHERTEXT;
  if (!blobB64 || blobB64.trim().length === 0) return null;
  const ciphertext = Buffer.from(blobB64.trim(), "base64");
  const out = await getKmsClient().send(
    new DecryptCommand({
      CiphertextBlob: ciphertext,
      // Pin the key id if provided so an attacker who swaps KMS_KEK_CIPHERTEXT
      // can't trick us into decrypting under a different key.
      KeyId: process.env.KMS_KEK_KEY_ID || undefined,
      // EncryptionContext must match the one used at Encrypt time
      // (scripts/bootstrap-kms-kek.ts). KMS includes this context as
      // additional authenticated data — a mismatch fails decryption.
      EncryptionContext: {
        app: "custodia-bidfed",
        purpose: "kek-wrap",
      },
    }),
  );
  if (!out.Plaintext) {
    throw new Error("KMS Decrypt returned no plaintext for KEK");
  }
  const buf = Buffer.from(out.Plaintext);
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `KMS-decrypted KEK has wrong length ${buf.length}; expected ${KEY_LEN}`,
    );
  }
  return buf;
}

function loadKekFromEnv(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw && raw.trim().length > 0) {
    const buf = decodeKeyMaterial(raw);
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `FIELD_ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`,
      );
    }
    return buf;
  }
  const fallback = process.env.ATTESTATION_SIGNING_KEY;
  if (!fallback) {
    throw new Error(
      "No KEK source configured. Set KMS_KEK_CIPHERTEXT (preferred) or FIELD_ENCRYPTION_KEY or ATTESTATION_SIGNING_KEY.",
    );
  }
  if (!_warnedFallback && process.env.NODE_ENV === "production") {
    console.warn(
      "[field-encryption] No KMS or FIELD_ENCRYPTION_KEY; deriving KEK from ATTESTATION_SIGNING_KEY. Set KMS_KEK_CIPHERTEXT for separation-of-duties.",
    );
    _warnedFallback = true;
  }
  const ikm = decodeKeyMaterial(fallback);
  const derived = hkdfSync(
    "sha256",
    ikm,
    Buffer.alloc(0),
    Buffer.from("custodia.field.v1", "utf8"),
    KEY_LEN,
  );
  return Buffer.from(derived);
}

/**
 * Async, single-flight KEK accessor. Resolves either from KMS (Tier 3)
 * or from the env-var fallback (Tier 2). The returned plaintext is
 * IDENTICAL across both paths because Tier 3 was bootstrapped by
 * encrypting the same env-var KEK under the CMK — so v1/v2 ciphertext
 * keeps decrypting after the migration.
 */
async function loadKekAsync(): Promise<Buffer> {
  if (_cachedKek) return _cachedKek;
  if (_inflightKek) return _inflightKek;
  _inflightKek = (async () => {
    const fromKms = await loadKekFromKms();
    const kek = fromKms ?? loadKekFromEnv();
    _cachedKek = kek;
    return kek;
  })().finally(() => {
    _inflightKek = null;
  });
  return _inflightKek;
}

/**
 * The actual key used to wrap DEKs. Derived from the KEK with a distinct
 * HKDF info so it cannot be replayed as a v1 field-encryption operation
 * against the same key material — the two purposes are cryptographically
 * domain-separated even though they share root entropy.
 */
async function loadKekWrapKey(): Promise<Buffer> {
  if (_cachedKekWrap) return _cachedKekWrap;
  const kek = await loadKekAsync();
  const derived = hkdfSync(
    "sha256",
    kek,
    Buffer.alloc(0),
    Buffer.from("custodia.kek-wrap.v2", "utf8"),
    KEY_LEN,
  );
  _cachedKekWrap = Buffer.from(derived);
  return _cachedKekWrap;
}

async function loadBlindIndexKey(): Promise<Buffer> {
  if (_cachedBlindKey) return _cachedBlindKey;
  const kek = await loadKekAsync();
  const derived = hkdfSync(
    "sha256",
    kek,
    Buffer.alloc(0),
    Buffer.from("custodia.blind-index.v1", "utf8"),
    KEY_LEN,
  );
  _cachedBlindKey = Buffer.from(derived);
  return _cachedBlindKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tenant DEK provisioning, caching, and wrap/unwrap.
// ─────────────────────────────────────────────────────────────────────────────

type CachedDek = { dek: Buffer; expires: number };
const DEK_CACHE_TTL_MS = 60_000;
const dekCache = new Map<string, CachedDek>();
const inflightDek = new Map<string, Promise<Buffer>>();

function dekWrapAad(orgId: string): Buffer {
  // Bind the wrapped DEK to its owning org so a wrapped-DEK row could not be
  // copy-pasted into another org's `wrapped_dek` column to make this org's
  // ciphertext suddenly readable as that org.
  return Buffer.from(`custodia.dek-wrap:v1:${orgId}`, "utf8");
}

async function wrapDek(plainDek: Buffer, orgId: string): Promise<Buffer> {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, await loadKekWrapKey(), iv);
  cipher.setAAD(dekWrapAad(orgId));
  const ct = Buffer.concat([cipher.update(plainDek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]);
}

async function unwrapDek(wrapped: Buffer, orgId: string): Promise<Buffer> {
  if (wrapped.length !== IV_LEN + KEY_LEN + TAG_LEN) {
    throw new Error(
      `wrapped DEK has wrong length ${wrapped.length}; expected ${IV_LEN + KEY_LEN + TAG_LEN}`,
    );
  }
  const iv = wrapped.subarray(0, IV_LEN);
  const ct = wrapped.subarray(IV_LEN, IV_LEN + KEY_LEN);
  const tag = wrapped.subarray(IV_LEN + KEY_LEN);
  const decipher = createDecipheriv(ALGO, await loadKekWrapKey(), iv);
  decipher.setAAD(dekWrapAad(orgId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Atomically read-or-create the per-tenant DEK. Two simultaneous first-uses
 * race-resolve via the COALESCE: only one INSERT-style write wins; either
 * way both callers decrypt the same canonical persisted value.
 */
async function loadOrCreateDek(orgId: string): Promise<Buffer> {
  const sql = getSql();
  const existing = (await sql`
    SELECT wrapped_dek, dek_shredded_at
    FROM organizations
    WHERE id = ${orgId}
    LIMIT 1
  `) as Array<{
    wrapped_dek: Buffer | Uint8Array | null;
    dek_shredded_at: string | null;
  }>;
  if (existing.length === 0) {
    throw new Error(`field-encryption: org ${orgId} not found`);
  }
  if (existing[0].dek_shredded_at) {
    throw new Error(
      `field-encryption: org ${orgId} has been crypto-shredded; data is permanently unreadable.`,
    );
  }

  const current = existing[0].wrapped_dek;
  if (current && current.length > 0) {
    return unwrapDek(Buffer.from(current), orgId);
  }

  // Lazy provision. Generate, wrap, and persist. The COALESCE guards against
  // a concurrent caller having raced past us between the SELECT and UPDATE.
  const fresh = randomBytes(KEY_LEN);
  const wrapped = await wrapDek(fresh, orgId);
  const updated = (await sql`
    UPDATE organizations
       SET wrapped_dek = COALESCE(wrapped_dek, ${wrapped})
     WHERE id = ${orgId}
       AND dek_shredded_at IS NULL
    RETURNING wrapped_dek
  `) as Array<{ wrapped_dek: Buffer | Uint8Array | null }>;
  const final = updated[0]?.wrapped_dek;
  if (!final) {
    throw new Error(
      `field-encryption: failed to provision DEK for org ${orgId}`,
    );
  }
  return unwrapDek(Buffer.from(final), orgId);
}

/**
 * Public DEK accessor. In-memory cache + single-flight so a burst of
 * encrypt calls during one request only does one DB round-trip + one
 * unwrap. After the TTL expires we re-fetch — useful if the DEK is
 * later rotated by an admin operation in another process.
 */
export async function getDek(orgId: string): Promise<Buffer> {
  const now = Date.now();
  const cached = dekCache.get(orgId);
  if (cached && cached.expires > now) return cached.dek;

  let p = inflightDek.get(orgId);
  if (!p) {
    p = loadOrCreateDek(orgId)
      .then((dek) => {
        dekCache.set(orgId, { dek, expires: Date.now() + DEK_CACHE_TTL_MS });
        inflightDek.delete(orgId);
        return dek;
      })
      .catch((err) => {
        inflightDek.delete(orgId);
        throw err;
      });
    inflightDek.set(orgId, p);
  }
  return p;
}

/** Drop a tenant's DEK from the in-memory cache. Call after rotation/shred. */
export function evictDekFromCache(orgId: string): void {
  dekCache.delete(orgId);
  inflightDek.delete(orgId);
}

// ─────────────────────────────────────────────────────────────────────────────
// AAD shape for the data-encryption layer (unchanged from Tier 1).
// Even though v2 already gets per-tenant isolation from the per-tenant DEK,
// AAD-binding the (orgId, field) tuple still defends against column-swap
// inside a single tenant's row and keeps the wire format identical for v1
// legacy decrypts.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldAad = {
  organizationId: string;
  field: string;
};

function aadBytes(aad: FieldAad): Buffer {
  return Buffer.from(`${aad.organizationId}|${aad.field}`, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// String-valued field encryption.
// ─────────────────────────────────────────────────────────────────────────────

export async function encryptField(
  plaintext: string,
  aad: FieldAad,
): Promise<string> {
  const dek = await getDek(aad.organizationId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, dek, iv);
  cipher.setAAD(aadBytes(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ct, tag]);
  return `${STRING_PREFIX_V2}${iv.toString("base64url")}.${combined.toString("base64url")}`;
}

export function isEncryptedField(value: string | null | undefined): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith(STRING_PREFIX_V1) || value.startsWith(STRING_PREFIX_V2))
  );
}

export async function decryptField(
  value: string,
  aad: FieldAad,
): Promise<string> {
  if (!isEncryptedField(value)) {
    throw new Error("decryptField called on plaintext value");
  }
  const parts = value.split(".");
  if (parts.length !== 3) {
    throw new Error("malformed field ciphertext");
  }
  const version = parts[0];
  const iv = Buffer.from(parts[1], "base64url");
  const combined = Buffer.from(parts[2], "base64url");
  const tag = combined.subarray(combined.length - TAG_LEN);
  const ct = combined.subarray(0, combined.length - TAG_LEN);

  // v1 = encrypted directly with the KEK (Tier 1 legacy data).
  // v2 = encrypted with the per-tenant DEK (Tier 2 default).
  const key =
    version === "fv1" ? await loadKekAsync() : await getDek(aad.organizationId);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(aadBytes(aad));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

let _warnedLegacy = false;
export async function tryDecryptField(
  value: string | null | undefined,
  aad: FieldAad,
): Promise<string | null> {
  if (value === null || value === undefined) return null;
  if (!isEncryptedField(value)) {
    if (!_warnedLegacy && process.env.NODE_ENV === "production") {
      console.warn(
        `[field-encryption] legacy plaintext observed for ${aad.field} (org=${aad.organizationId}); will be re-encrypted on next write.`,
      );
      _warnedLegacy = true;
    }
    return value;
  }
  return decryptField(value, aad);
}

// ─────────────────────────────────────────────────────────────────────────────
// Byte-valued payload encryption (evidence blobs).
// ─────────────────────────────────────────────────────────────────────────────

export async function encryptBytes(
  bytes: Uint8Array | Buffer,
  aad: FieldAad,
): Promise<Buffer> {
  const dek = await getDek(aad.organizationId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, dek, iv);
  cipher.setAAD(aadBytes(aad));
  const ct = Buffer.concat([
    cipher.update(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([BYTES_MAGIC_V2, iv, ct, tag]);
}

function bytesVersion(buf: Buffer): "v1" | "v2" | null {
  if (buf.length < BYTES_MAGIC_V1.length) return null;
  if (buf.subarray(0, 4).equals(BYTES_MAGIC_V2)) return "v2";
  if (buf.subarray(0, 4).equals(BYTES_MAGIC_V1)) return "v1";
  return null;
}

export function isEncryptedBytes(buf: Uint8Array | Buffer): boolean {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return bytesVersion(b) !== null;
}

export async function decryptBytes(
  buf: Uint8Array | Buffer,
  aad: FieldAad,
): Promise<Buffer> {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const version = bytesVersion(b);
  if (!version) {
    throw new Error("decryptBytes called on non-encrypted payload");
  }
  const iv = b.subarray(4, 4 + IV_LEN);
  const tag = b.subarray(b.length - TAG_LEN);
  const ct = b.subarray(4 + IV_LEN, b.length - TAG_LEN);
  const key = version === "v1" ? await loadKekAsync() : await getDek(aad.organizationId);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(aadBytes(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export async function tryDecryptBytes(
  buf: Uint8Array | Buffer,
  aad: FieldAad,
): Promise<Buffer> {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (!isEncryptedBytes(b)) return b;
  return decryptBytes(b, aad);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto-shred: destroy a tenant's wrapped DEK, rendering all of their v2
// ciphertext permanently unreadable. Stamps `dek_shredded_at` so this module
// refuses any further encrypt/decrypt for that org. Useful for account
// closure and right-to-be-forgotten requests — orders of magnitude cheaper
// than re-encrypting or zeroing every blob.
//
// Caller is responsible for downstream cleanup (deleting `audit_log` rows,
// removing blobs, etc.). This is the cryptographic half only.
// ─────────────────────────────────────────────────────────────────────────────

export async function cryptoShredOrg(orgId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE organizations
       SET wrapped_dek = NULL,
           dek_shredded_at = NOW()
     WHERE id = ${orgId}
  `;
  evictDekFromCache(orgId);
}

/**
 * Forward-only DEK rotation. Generates a fresh DEK and wraps it under the
 * KEK; subsequent writes use the new DEK. Existing ciphertext is NOT
 * re-encrypted automatically — that requires a backfill that reads each
 * row, decrypts under the OLD DEK, and re-writes under the new one.
 * Recommended pattern: rotate → backfill → optionally rotate again.
 */
export async function rotateOrgDek(orgId: string): Promise<void> {
  const sql = getSql();
  const fresh = randomBytes(KEY_LEN);
  const wrapped = await wrapDek(fresh, orgId);
  const rows = (await sql`
    UPDATE organizations
       SET wrapped_dek = ${wrapped}
     WHERE id = ${orgId}
       AND dek_shredded_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new Error(
      `rotateOrgDek: org ${orgId} not found or has been crypto-shredded.`,
    );
  }
  evictDekFromCache(orgId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Blind index — query-friendly HMAC fingerprint. Independent key material
// from both the KEK and any DEK so the index column cannot be replayed as
// ciphertext, and so a per-tenant DEK rotation does not invalidate indexes.
// ─────────────────────────────────────────────────────────────────────────────

export async function blindIndex(value: string): Promise<string> {
  return createHmac("sha256", await loadBlindIndexKey())
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// PII redaction for AI prompts (unchanged from Tier 1).
// ─────────────────────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    name: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
  {
    name: "email",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    name: "ccn",
    re: /\b(?:\d[ -]?){13,19}\b/g,
  },
];

export function redactPiiForAi(text: string): {
  redacted: string;
  counts: Record<string, number>;
} {
  let out = text;
  const counts: Record<string, number> = {};
  for (const { name, re } of PII_PATTERNS) {
    let n = 0;
    out = out.replace(re, () => {
      n += 1;
      return `[${name}]`;
    });
    if (n > 0) counts[name] = n;
  }
  return { redacted: out, counts };
}
