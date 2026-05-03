/**
 * Trust page identifiers, provisioning, and lookups.
 *
 * Two public artifacts derive from one HMAC:
 *   - `verification_slug` — 16 hex chars, drives the public URL
 *     `/verified/<slug>`. Unguessable (2^64 search space). Stored on the
 *     `trust_pages` row.
 *   - `custodia_verification_id` — `CUST-V-XXXXXX`, 6 chars from a
 *     Crockford base32 alphabet (excluding I L O U) so it's case-insensitive
 *     and look-alike-safe. The customer-facing identifier shown on badges,
 *     emails, and capability statements. Stored on the `assessments` row
 *     (the cycle that owns it) AND denormalized onto `trust_pages` so the
 *     public page renderer can show it without a join.
 *
 * The SPRS confirmation number is NEVER part of either public artifact.
 * The HMAC seed mixes (organization_id || assessment_id || sprs_filed_at)
 * which makes the IDs deterministic for a given filing but reveals
 * nothing private if disclosed. Rotation: change the seed by setting a
 * `slug_version` and recomputing — handled by `rotateTrustSlug`.
 */

import { hmacSha256Hex } from "@/lib/security/crypto";
import { getSql, ensureDbReady } from "@/lib/db";
import { recordAuditEvent } from "@/lib/security/audit-log";

// Crockford base32, minus I, L, O, U (look-alikes / vulgar). 28 chars.
// 6 chars * log2(28) ≈ 28.8 bits ≈ 470M IDs — plenty for human-shareable IDs;
// the URL slug is the security-critical identifier, this is just a pretty
// label.
const VERIFY_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Resolve the HMAC key. Prefers `TRUST_SLUG_HMAC_KEY`, falls back to
 * `ATTESTATION_SIGNING_KEY` (which is required in prod) so deploys without
 * the dedicated key still produce stable IDs. Boot-time env validator
 * ensures at least one is set in prod.
 */
function getHmacKey(): string {
  const key =
    process.env.TRUST_SLUG_HMAC_KEY ?? process.env.ATTESTATION_SIGNING_KEY;
  if (!key) {
    throw new Error(
      "TRUST_SLUG_HMAC_KEY (or ATTESTATION_SIGNING_KEY fallback) is not set",
    );
  }
  return key;
}

export type TrustIdentifiers = {
  verificationSlug: string; // 16 hex
  custodiaVerificationId: string; // CUST-V-XXXXXX
  attestationHash: string; // full 64-hex HMAC, internal
};

/**
 * Compute deterministic IDs for a given filing. Same inputs → same outputs;
 * change `slugVersion` to rotate.
 */
export function computeTrustIdentifiers(input: {
  organizationId: string;
  assessmentId: string;
  sprsFiledAtIso: string;
  slugVersion?: number;
}): TrustIdentifiers {
  const v = input.slugVersion ?? 1;
  const payload = `v${v}:${input.organizationId}:${input.assessmentId}:${input.sprsFiledAtIso}`;
  const fullHmac = hmacSha256Hex(getHmacKey(), payload);
  const verificationSlug = fullHmac.slice(0, 16);

  // Derive a separate 6-char base32 ID from a different slice so leaking the
  // pretty ID doesn't immediately leak the URL slug (and vice versa).
  const idSeed = fullHmac.slice(16, 32); // 16 hex chars = 64 bits
  const custodiaVerificationId = `CUST-V-${base32From64Bits(idSeed)}`;

  return {
    verificationSlug,
    custodiaVerificationId,
    attestationHash: fullHmac,
  };
}

function base32From64Bits(hex16: string): string {
  // Take 30 bits out of the 64 (we only need 6 chars * 5 bits = 30).
  // BigInt to avoid 32-bit wraparound on the leading bytes.
  const big = BigInt("0x" + hex16);
  let n = Number(big & BigInt("0x3fffffff")); // 30 bits
  let out = "";
  for (let i = 0; i < 6; i++) {
    out = VERIFY_ID_ALPHABET[n & 0x1f] + out;
    n = n >>> 5;
  }
  return out;
}

export type TrustPageRow = {
  id: string;
  organization_id: string;
  slug: string;
  verification_slug: string | null;
  custodia_verification_id: string | null;
  is_public: boolean;
  headline: string | null;
  summary: string | null;
  custom_about: string | null;
  contact_email: string | null;
  show_continuous_monitoring: boolean;
  show_connectors: boolean;
  show_sprs_link: boolean;
  show_set_asides: boolean;
  fields: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
};

/**
 * Idempotently create-or-update the trust_pages row for an org after a
 * SPRS filing. Always sets `is_public = FALSE` on first creation — the
 * customer must explicitly opt in. Subsequent calls (e.g. re-filing on a
 * new cycle) refresh the verification IDs but preserve `is_public` and
 * customer-curated fields.
 */
export async function provisionTrustPageForFiling(input: {
  organizationId: string;
  assessmentId: string;
  sprsFiledAtIso: string;
  userId: string;
}): Promise<{
  trustPage: TrustPageRow;
  identifiers: TrustIdentifiers;
  isNew: boolean;
}> {
  await ensureDbReady();
  const sql = getSql();
  const ids = computeTrustIdentifiers(input);

  const existing = (await sql`
    SELECT id, organization_id, slug, verification_slug,
           custodia_verification_id, is_public, headline, summary,
           custom_about, contact_email,
           show_continuous_monitoring, show_connectors, show_sprs_link,
           show_set_asides, fields, published_at, updated_at
    FROM trust_pages
    WHERE organization_id = ${input.organizationId}
    LIMIT 1
  `) as TrustPageRow[];

  if (existing.length > 0) {
    const updated = (await sql`
      UPDATE trust_pages
      SET verification_slug = ${ids.verificationSlug},
          custodia_verification_id = ${ids.custodiaVerificationId},
          slug = ${ids.verificationSlug},
          updated_at = NOW()
      WHERE organization_id = ${input.organizationId}
      RETURNING id, organization_id, slug, verification_slug,
                custodia_verification_id, is_public, headline, summary,
                custom_about, contact_email,
                show_continuous_monitoring, show_connectors, show_sprs_link,
                show_set_asides, fields, published_at, updated_at
    `) as TrustPageRow[];
    await recordAuditEvent({
      action: "trust_page.provisioned",
      userId: input.userId,
      organizationId: input.organizationId,
      resourceType: "trust_page",
      resourceId: updated[0].id,
      metadata: {
        custodiaVerificationId: ids.custodiaVerificationId,
        rotated: true,
      },
    });
    return { trustPage: updated[0], identifiers: ids, isNew: false };
  }

  const inserted = (await sql`
    INSERT INTO trust_pages
      (organization_id, slug, verification_slug, custodia_verification_id,
       is_public, fields)
    VALUES
      (${input.organizationId}, ${ids.verificationSlug},
       ${ids.verificationSlug}, ${ids.custodiaVerificationId},
       FALSE, '{}'::jsonb)
    RETURNING id, organization_id, slug, verification_slug,
              custodia_verification_id, is_public, headline, summary,
              custom_about, contact_email,
              show_continuous_monitoring, show_connectors, show_sprs_link,
              show_set_asides, fields, published_at, updated_at
  `) as TrustPageRow[];

  await recordAuditEvent({
    action: "trust_page.provisioned",
    userId: input.userId,
    organizationId: input.organizationId,
    resourceType: "trust_page",
    resourceId: inserted[0].id,
    metadata: {
      custodiaVerificationId: ids.custodiaVerificationId,
      rotated: false,
    },
  });

  return { trustPage: inserted[0], identifiers: ids, isNew: true };
}

export async function loadTrustPageForOrg(
  organizationId: string,
): Promise<TrustPageRow | null> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, organization_id, slug, verification_slug,
           custodia_verification_id, is_public, headline, summary,
           custom_about, contact_email,
           show_continuous_monitoring, show_connectors, show_sprs_link,
           show_set_asides, fields, published_at, updated_at
    FROM trust_pages
    WHERE organization_id = ${organizationId}
    LIMIT 1
  `) as TrustPageRow[];
  return rows[0] ?? null;
}

export async function publishTrustPage(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const sql = getSql();
  const updated = (await sql`
    UPDATE trust_pages
    SET is_public = TRUE,
        published_at = COALESCE(published_at, NOW()),
        updated_at = NOW()
    WHERE organization_id = ${input.organizationId}
    RETURNING id
  `) as Array<{ id: string }>;
  if (updated.length === 0) {
    throw new Error("Verified page not provisioned yet");
  }
  await recordAuditEvent({
    action: "trust_page.published",
    userId: input.userId,
    organizationId: input.organizationId,
    resourceType: "trust_page",
    resourceId: updated[0].id,
  });
}

export async function unpublishTrustPage(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const sql = getSql();
  const updated = (await sql`
    UPDATE trust_pages
    SET is_public = FALSE, updated_at = NOW()
    WHERE organization_id = ${input.organizationId}
    RETURNING id
  `) as Array<{ id: string }>;
  if (updated.length === 0) return;
  await recordAuditEvent({
    action: "trust_page.unpublished",
    userId: input.userId,
    organizationId: input.organizationId,
    resourceType: "trust_page",
    resourceId: updated[0].id,
  });
}

export async function updateTrustPageContentAction(input: {
  organizationId: string;
  userId: string;
  customAbout?: string | null;
  contactEmail?: string | null;
  showContinuousMonitoring?: boolean;
  showConnectors?: boolean;
  showSprsLink?: boolean;
  showSetAsides?: boolean;
}): Promise<void> {
  const sql = getSql();
  // 500 char ceiling on the about; null/empty is allowed.
  const about =
    input.customAbout != null
      ? input.customAbout.slice(0, 500).trim() || null
      : undefined;
  const contact =
    input.contactEmail != null
      ? input.contactEmail.trim().toLowerCase() || null
      : undefined;

  await sql`
    UPDATE trust_pages
    SET
      custom_about = COALESCE(${about ?? null}, custom_about),
      contact_email = COALESCE(${contact ?? null}, contact_email),
      show_continuous_monitoring = COALESCE(${input.showContinuousMonitoring ?? null}, show_continuous_monitoring),
      show_connectors = COALESCE(${input.showConnectors ?? null}, show_connectors),
      show_sprs_link = COALESCE(${input.showSprsLink ?? null}, show_sprs_link),
      show_set_asides = COALESCE(${input.showSetAsides ?? null}, show_set_asides),
      updated_at = NOW()
    WHERE organization_id = ${input.organizationId}
  `;
  await recordAuditEvent({
    action: "trust_page.updated",
    userId: input.userId,
    organizationId: input.organizationId,
    resourceType: "trust_page",
  });
}

/**
 * Rotate the slug + verification ID. Old badges / URLs 410 immediately.
 * Used when a customer suspects compromise or wants a fresh public ID.
 * Increments an internal version counter stored in `fields.slug_version`.
 */
export async function rotateTrustSlug(input: {
  organizationId: string;
  assessmentId: string;
  sprsFiledAtIso: string;
  userId: string;
}): Promise<TrustIdentifiers> {
  const sql = getSql();
  const row = await loadTrustPageForOrg(input.organizationId);
  const prev =
    typeof row?.fields === "object" && row?.fields !== null
      ? (row.fields as Record<string, unknown>)
      : {};
  const prevVersion =
    typeof prev.slug_version === "number" ? (prev.slug_version as number) : 1;
  const nextVersion = prevVersion + 1;
  const ids = computeTrustIdentifiers({
    organizationId: input.organizationId,
    assessmentId: input.assessmentId,
    sprsFiledAtIso: input.sprsFiledAtIso,
    slugVersion: nextVersion,
  });
  const nextFields = { ...prev, slug_version: nextVersion };
  await sql`
    UPDATE trust_pages
    SET verification_slug = ${ids.verificationSlug},
        slug = ${ids.verificationSlug},
        custodia_verification_id = ${ids.custodiaVerificationId},
        fields = ${JSON.stringify(nextFields)}::jsonb,
        updated_at = NOW()
    WHERE organization_id = ${input.organizationId}
  `;
  await recordAuditEvent({
    action: "trust_page.rotated",
    userId: input.userId,
    organizationId: input.organizationId,
    resourceType: "trust_page",
    metadata: {
      newCustodiaVerificationId: ids.custodiaVerificationId,
      slugVersion: nextVersion,
    },
  });
  return ids;
}
