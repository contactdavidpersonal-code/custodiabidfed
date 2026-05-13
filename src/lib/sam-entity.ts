/**
 * SAM Entity Management API — registration freshness lookup.
 *
 * Why we need this: SPRS surfaces a CMMC self-assessment under whatever
 * SAM registration backs the CAGE/UEI on the affirmation. When a SAM
 * registration lapses, every downstream SPRS query for that vendor
 * silently flips to "Inactive" — primes searching for cleared
 * subcontractors get nothing back even though the CMMC record is still
 * MET. We want to catch this at sign time so the user knows their
 * affirmation will be unreachable until they re-register at sam.gov.
 *
 * Endpoint: GET https://api.sam.gov/entity-information/v3/entities
 *   Params: ueiSAM=<12-char UEI>, api_key=<SAM_GOV_API_KEY>
 *   Auth: api.data.gov key, shared with the rest of the SAM integration.
 *
 * This is a SOFT gate: if the API returns an error, is rate-limited, or
 * the key is missing, we degrade to "not checked" and let the sign go
 * through. We never want a sam.gov outage to block a CMMC affirmation.
 * If the API returns a definitive "Inactive" or "Expired" status, the
 * caller decides whether to warn or block. Today we WARN (and record in
 * the audit metadata) — the user can still file.
 *
 * Cache: results are cached in-process for 24h keyed on UEI. SAM
 * registration status changes daily at most, and a stale-by-a-day
 * answer is still useful for a sign-time gate.
 */

export type SamEntityStatus =
  | { kind: "active"; expirationDate: string | null; legalBusinessName: string | null }
  | { kind: "inactive"; reason: string; expirationDate: string | null }
  | { kind: "not_found" }
  | { kind: "unknown"; reason: string };

type CacheEntry = { status: SamEntityStatus; fetchedAt: number };
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const SAM_ENTITY_ENDPOINT =
  "https://api.sam.gov/entity-information/v3/entities";

export async function getSamEntityStatus(
  uei: string,
): Promise<SamEntityStatus> {
  const cleaned = uei.trim().toUpperCase();
  if (!/^[A-Z0-9]{12}$/.test(cleaned)) {
    return { kind: "unknown", reason: "UEI is not 12 alphanumeric characters" };
  }
  const cached = cache.get(cleaned);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.status;
  }

  const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  if (!apiKey) {
    // No SAM key configured — treat as unknown so callers degrade gracefully.
    return { kind: "unknown", reason: "SAM_GOV_API_KEY not configured" };
  }

  const url = new URL(SAM_ENTITY_ENDPOINT);
  url.searchParams.set("ueiSAM", cleaned);
  url.searchParams.set("samRegistered", "Yes");
  url.searchParams.set("api_key", apiKey);

  let status: SamEntityStatus;
  try {
    // Abort after 8s so an upstream stall can't hang the sign action.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      status = {
        kind: "unknown",
        reason: `SAM Entity API returned HTTP ${res.status}`,
      };
    } else {
      const body = (await res.json()) as {
        entityData?: Array<{
          entityRegistration?: {
            registrationStatus?: string;
            expirationDate?: string;
            legalBusinessName?: string;
          };
        }>;
        totalRecords?: number;
      };
      const record = body.entityData?.[0]?.entityRegistration;
      if (!record) {
        status = { kind: "not_found" };
      } else {
        const reg = (record.registrationStatus ?? "").toLowerCase();
        const expiration = record.expirationDate ?? null;
        const name = record.legalBusinessName ?? null;
        if (reg === "active") {
          status = { kind: "active", expirationDate: expiration, legalBusinessName: name };
        } else {
          status = {
            kind: "inactive",
            reason: record.registrationStatus
              ? `SAM registrationStatus is "${record.registrationStatus}"`
              : "SAM registrationStatus is not Active",
            expirationDate: expiration,
          };
        }
      }
    }
  } catch (err) {
    console.error("[sam-entity] lookup failed", { uei: cleaned }, err);
    status = {
      kind: "unknown",
      reason: err instanceof Error ? err.message : "fetch failed",
    };
  }

  cache.set(cleaned, { status, fetchedAt: Date.now() });
  return status;
}

/**
 * Convert a status into an optional warning string suitable for the
 * sign-time UI / audit metadata. Returns null when no warning is
 * warranted (active registration or unknown status — we don't warn on
 * unknown because we don't want noisy warnings every time the SAM API
 * blips).
 */
export function summarizeSamStatus(status: SamEntityStatus): string | null {
  switch (status.kind) {
    case "active":
      return null;
    case "inactive":
      return `Your SAM registration appears inactive (${status.reason}). Re-register at sam.gov before primes try to look you up — your CMMC affirmation will show as Inactive in SPRS searches until then.`;
    case "not_found":
      return "We couldn't find your UEI in the SAM Entity Management API. Re-register at sam.gov before primes try to look you up.";
    case "unknown":
      return null;
  }
}
