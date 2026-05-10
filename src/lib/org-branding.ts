import type { OrganizationRow } from "@/lib/assessment";

/**
 * Customer-facing brand resolved off the business_profile JSONB. Used to brand
 * the deliverables (SSP, affirmation memo, zipped HTML) to the customer's
 * company — it's their attestation, so their letterhead. Custodia attribution
 * stays in a small footer note + the Verified URL on the badge.
 */
export type OrgBranding = {
  companyName: string;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Single composed location line — best-effort formatted from parts. */
  locationLine: string | null;
};

const PROFILE_KEYS = {
  logo: "logo_url",
  website: "website",
  phone: "phone",
  email: "customer_facing_email",
  address1: "street_address",
  address2: "street_address_2",
  city: "city",
  state: "state",
  zip: "zip",
} as const;

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

export function resolveOrgBranding(
  org: Pick<OrganizationRow, "name">,
  profileData: Record<string, unknown> | null | undefined,
): OrgBranding {
  const d = profileData ?? {};
  const city = str(d[PROFILE_KEYS.city]);
  const state = str(d[PROFILE_KEYS.state]);
  const zip = str(d[PROFILE_KEYS.zip]);
  const locationLine = [
    [city, state].filter(Boolean).join(", "),
    zip ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    companyName: org.name,
    logoUrl: str(d[PROFILE_KEYS.logo]),
    website: str(d[PROFILE_KEYS.website]),
    phone: str(d[PROFILE_KEYS.phone]),
    email: str(d[PROFILE_KEYS.email]),
    addressLine1: str(d[PROFILE_KEYS.address1]),
    addressLine2: str(d[PROFILE_KEYS.address2]),
    city,
    state,
    zip,
    locationLine: locationLine.length > 0 ? locationLine : null,
  };
}

/**
 * Normalize a user-supplied URL — strip protocol for display while keeping
 * the original href intact via a separate helper.
 */
export function displayUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function hrefUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
