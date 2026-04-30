import { hmacSha256Hex, verifyHmacSha256Hex } from "./crypto";

/**
 * Canonical attestation payload — the legal artifact whose integrity must be
 * provable months/years after sign-off. The user's signature is computed over
 * the SHA-256-of-canonical-JSON of this object, so any tampering with stored
 * answers/evidence after the fact will fail verification.
 *
 * Order matters: keys are sorted lexicographically by JSON.stringify with
 * a deterministic replacer below.
 */
export type CanonicalAttestation = {
  version: 1;
  framework: "cmmc_l1" | "cmmc_l2";
  assessmentId: string;
  organizationId: string;
  organizationName: string;
  samUei: string | null;
  cageCode: string | null;
  fiscalYear: number | null;
  implementsAll17: boolean;
  signerName: string;
  signerTitle: string;
  signerUserId: string;
  signedAt: string; // ISO-8601
  /** All control responses, ordered by control_id ascending. */
  responses: Array<{
    controlId: string;
    status: string;
    notes: string | null;
  }>;
  /** Evidence fingerprints, ordered by control_id then artifact id. */
  evidence: Array<{
    controlId: string;
    artifactId: string;
    filename: string;
    mimeType: string | null;
    sizeBytes: number | null;
    blobUrl: string;
  }>;
};

/**
 * Stable JSON: sort keys recursively. Without this, two structurally identical
 * payloads with different key insertion order would produce different hashes.
 */
function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

export type SignedAttestation = {
  canonical: string;
  payloadSha256Hex: string;
  signatureHex: string;
  keyVersion: number;
};

export const CURRENT_ATTESTATION_KEY_VERSION = 1;

function getAttestationKey(): string {
  const key = process.env.ATTESTATION_SIGNING_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ATTESTATION_SIGNING_KEY is not set. Refusing to produce an unsigned attestation.",
      );
    }
    // Dev fallback — clearly marked so a dev key can never be mistaken for prod.
    return "dev-only-attestation-key-do-not-use-in-production";
  }
  return key;
}

/** Sign a canonical attestation payload. */
export function signAttestation(
  payload: CanonicalAttestation,
): SignedAttestation {
  const canonical = canonicalize(payload);
  const key = getAttestationKey();
  const signatureHex = hmacSha256Hex(key, canonical);
  // Payload hash is independent of the signing key — useful for change-detection
  // even if the key is ever rotated.
  const payloadSha256Hex = hmacSha256Hex(
    "custodia-payload-hash-v1",
    canonical,
  );
  return {
    canonical,
    payloadSha256Hex,
    signatureHex,
    keyVersion: CURRENT_ATTESTATION_KEY_VERSION,
  };
}

/** Verify a previously signed attestation. */
export function verifyAttestation(
  canonical: string,
  signatureHex: string,
  keyVersion: number,
): boolean {
  if (keyVersion !== CURRENT_ATTESTATION_KEY_VERSION) {
    // Future: look up historical key from a key ring.
    return false;
  }
  return verifyHmacSha256Hex(getAttestationKey(), canonical, signatureHex);
}
