/**
 * Field-level envelope encryption — AES-256-GCM with per-record IV and
 * Additional Authenticated Data (AAD) bound to tenant + field name.
 *
 * Threat model (zero-trust by default):
 *   • DB compromise alone yields ciphertext only.
 *   • Vercel Blob token compromise alone yields ciphertext only.
 *   • Cross-tenant ciphertext swap fails verification because AAD includes
 *     the owning organization id.
 *   • An attacker who steals one tenant's DEK does not get the others (when
 *     per-tenant DEKs are layered on top — Tier 2; this file ships the
 *     single-KEK envelope that those DEKs slot into).
 *
 * Key source (priority order):
 *   1. FIELD_ENCRYPTION_KEY  (preferred — dedicated 32-byte key, hex/base64)
 *   2. ATTESTATION_SIGNING_KEY-derived via HKDF-SHA256, info="custodia.field.v1"
 *
 * Wire formats:
 *   String values:  fv1.<iv_b64url>.<ct+tag_b64url>
 *   Byte values  :  raw bytes prefixed with magic `cfb1` (4 bytes) +
 *                   IV (12 bytes) + ciphertext + GCM tag (16 bytes)
 *
 * Versioning lives in the wire format itself ("fv1" / "cfb1") so the key
 * material can be rotated by adding a new version while old records still
 * decrypt under the previous one.
 *
 * Migration discipline: every decrypt helper accepts legacy plaintext and
 * returns it untouched. Writes always produce ciphertext going forward.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const STRING_PREFIX = "fv1.";
const BYTES_MAGIC = Buffer.from("cfb1", "ascii"); // 4 bytes

let _cachedKey: Buffer | null = null;
let _cachedBlindKey: Buffer | null = null;
let _warnedFallback = false;

function decodeKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LEN * 2) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

function loadFieldKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw && raw.trim().length > 0) {
    const buf = decodeKeyMaterial(raw);
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `FIELD_ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`,
      );
    }
    _cachedKey = buf;
    return _cachedKey;
  }

  const fallback = process.env.ATTESTATION_SIGNING_KEY;
  if (!fallback) {
    throw new Error(
      "Neither FIELD_ENCRYPTION_KEY nor ATTESTATION_SIGNING_KEY is set; cannot encrypt sensitive fields.",
    );
  }
  if (!_warnedFallback && process.env.NODE_ENV === "production") {
    console.warn(
      "[field-encryption] FIELD_ENCRYPTION_KEY not set; deriving from ATTESTATION_SIGNING_KEY. Set FIELD_ENCRYPTION_KEY for separation-of-duties.",
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
  _cachedKey = Buffer.from(derived);
  return _cachedKey;
}

/**
 * Separate keyed input for blind indexes so an attacker who exfiltrates the
 * blind-index column cannot replay it as field ciphertext (different keys).
 * Derived once from the field key via HKDF info="blind-index.v1".
 */
function loadBlindIndexKey(): Buffer {
  if (_cachedBlindKey) return _cachedBlindKey;
  const derived = hkdfSync(
    "sha256",
    loadFieldKey(),
    Buffer.alloc(0),
    Buffer.from("custodia.blind-index.v1", "utf8"),
    KEY_LEN,
  );
  _cachedBlindKey = Buffer.from(derived);
  return _cachedBlindKey;
}

/**
 * AAD (additional authenticated data) is mixed into the GCM tag so a
 * ciphertext written for one (tenant, field) tuple cannot be decrypted under
 * a different (tenant, field) tuple. Defends against cross-tenant ciphertext
 * swap inside a compromised DB.
 */
export type FieldAad = {
  /** The owning organization's id. Required — this is the isolation boundary. */
  organizationId: string;
  /** A short, stable label naming the column / use-site (e.g. "signer_name"). */
  field: string;
};

function aadBytes(aad: FieldAad): Buffer {
  return Buffer.from(`${aad.organizationId}|${aad.field}`, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// String-valued fields (most DB columns)
// ─────────────────────────────────────────────────────────────────────────────

export function encryptField(plaintext: string, aad: FieldAad): string {
  const key = loadFieldKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(aadBytes(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ct, tag]);
  return `${STRING_PREFIX}${iv.toString("base64url")}.${combined.toString("base64url")}`;
}

/** True iff `value` looks like one of our ciphertext envelopes. */
export function isEncryptedField(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(STRING_PREFIX);
}

export function decryptField(value: string, aad: FieldAad): string {
  if (!isEncryptedField(value)) {
    throw new Error("decryptField called on plaintext value");
  }
  const parts = value.split(".");
  // "fv1" "<iv>" "<ct+tag>"
  if (parts.length !== 3) {
    throw new Error("malformed field ciphertext");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const combined = Buffer.from(parts[2], "base64url");
  const tag = combined.subarray(combined.length - TAG_LEN);
  const ct = combined.subarray(0, combined.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, loadFieldKey(), iv);
  decipher.setAAD(aadBytes(aad));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Decrypt-or-passthrough. Use on every read site so legacy plaintext rows
 * keep working while new writes produce ciphertext. Logs a one-line warning
 * the first time legacy data is observed (best-effort migration hint).
 */
let _warnedLegacy = false;
export function tryDecryptField(
  value: string | null | undefined,
  aad: FieldAad,
): string | null {
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
// Byte-valued payloads (evidence blobs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypt a raw byte payload. Returns the wire-format buffer:
 *   magic(4) | iv(12) | ciphertext | tag(16)
 * AAD binds the artifact to (organizationId, artifactId) so a swap of one
 * org's blob for another's fails decryption.
 */
export function encryptBytes(bytes: Uint8Array | Buffer, aad: FieldAad): Buffer {
  const key = loadFieldKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(aadBytes(aad));
  const ct = Buffer.concat([
    cipher.update(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([BYTES_MAGIC, iv, ct, tag]);
}

export function isEncryptedBytes(buf: Uint8Array | Buffer): boolean {
  if (buf.length < BYTES_MAGIC.length) return false;
  for (let i = 0; i < BYTES_MAGIC.length; i++) {
    if (buf[i] !== BYTES_MAGIC[i]) return false;
  }
  return true;
}

export function decryptBytes(
  buf: Uint8Array | Buffer,
  aad: FieldAad,
): Buffer {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (!isEncryptedBytes(b)) {
    throw new Error("decryptBytes called on non-encrypted payload");
  }
  const iv = b.subarray(BYTES_MAGIC.length, BYTES_MAGIC.length + IV_LEN);
  const tag = b.subarray(b.length - TAG_LEN);
  const ct = b.subarray(BYTES_MAGIC.length + IV_LEN, b.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, loadFieldKey(), iv);
  decipher.setAAD(aadBytes(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Decrypt-or-passthrough for byte payloads. Lets `/api/evidence/[id]` and
 * the AI review pipeline serve both newly-encrypted and legacy-plaintext
 * blobs during the migration window.
 */
export function tryDecryptBytes(
  buf: Uint8Array | Buffer,
  aad: FieldAad,
): Buffer {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (!isEncryptedBytes(b)) return b;
  return decryptBytes(b, aad);
}

// ─────────────────────────────────────────────────────────────────────────────
// Blind index — query-friendly HMAC fingerprint of a value.
// Use for columns we need to look up by exact value (email, UEI) but never
// want to store in plaintext. Index the blind-index column, query on
// blindIndex(value); the plaintext column stays encrypted.
// ─────────────────────────────────────────────────────────────────────────────

export function blindIndex(value: string): string {
  return createHmac("sha256", loadBlindIndexKey())
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// PII redaction for AI prompts.
//
// We must let Charlie review evidence content (rosters, narratives) to grade
// CMMC objectives — but we do not need to leak literal employee names, email
// addresses, phone numbers, or SSNs to the model provider. Run user-supplied
// text through `redactPiiForAi()` before it lands in a prompt. Structural
// signals (column headers, row counts, dates, control IDs) survive intact;
// individual identities become tokens like `[email]`, `[phone]`, `[ssn]`.
// ─────────────────────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Order matters — match longer/specific patterns first so an SSN that looks
  // like a phone number doesn't get bucketed as the wrong type.
  { name: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  // E.164-ish phone numbers and (xxx) xxx-xxxx forms.
  {
    name: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
  // Plausible RFC 5322-lite email matcher. Good enough for the redaction use.
  {
    name: "email",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  // 16-digit credit-card-like sequences (with optional separators).
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
