/**
 * Symmetric encryption for at-rest secrets — currently used for OAuth
 * connector tokens (Microsoft 365, Google Workspace). AES-256-GCM with a
 * 96-bit IV per record. Output is a single base64url string with the
 * format: v1.<iv_b64>.<ciphertext+tag_b64>.
 *
 * Key source (in priority order):
 *   1. CONNECTOR_TOKEN_KEY (preferred — dedicated key, hex or base64)
 *   2. ATTESTATION_SIGNING_KEY-derived (HKDF-SHA256, info="connector-tokens")
 *      — fallback so dev/staging works without an extra env var, but a
 *      warning fires once.
 *
 * Rotate by setting CONNECTOR_TOKEN_KEY to a new value; old records will
 * fail to decrypt and connectors will simply re-prompt for OAuth consent.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const VERSION = "v1";

let _cachedKey: Buffer | null = null;
let _warned = false;

function loadKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const raw = process.env.CONNECTOR_TOKEN_KEY;
  if (raw && raw.length > 0) {
    const buf = decodeKeyMaterial(raw);
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `CONNECTOR_TOKEN_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`,
      );
    }
    _cachedKey = buf;
    return _cachedKey;
  }

  const fallback = process.env.ATTESTATION_SIGNING_KEY;
  if (!fallback) {
    throw new Error(
      "Neither CONNECTOR_TOKEN_KEY nor ATTESTATION_SIGNING_KEY is set; cannot encrypt connector tokens.",
    );
  }
  if (!_warned && process.env.NODE_ENV === "production") {
    console.warn(
      "[connector-crypto] CONNECTOR_TOKEN_KEY not set; deriving from ATTESTATION_SIGNING_KEY. Rotate by setting CONNECTOR_TOKEN_KEY.",
    );
    _warned = true;
  }
  const ikm = decodeKeyMaterial(fallback);
  const derived = hkdfSync(
    "sha256",
    ikm,
    Buffer.alloc(0),
    Buffer.from("custodia.connector-tokens.v1", "utf8"),
    KEY_LEN,
  );
  _cachedKey = Buffer.from(derived);
  return _cachedKey;
}

function decodeKeyMaterial(raw: string): Buffer {
  // Accept hex, base64, or base64url. Hex is preferred (deterministic length).
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LEN * 2) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ct, tag]);
  return `${VERSION}.${iv.toString("base64url")}.${combined.toString("base64url")}`;
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error("Unrecognized ciphertext format");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const combined = Buffer.from(parts[2], "base64url");
  const tag = combined.subarray(combined.length - 16);
  const ct = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv(ALGO, loadKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
