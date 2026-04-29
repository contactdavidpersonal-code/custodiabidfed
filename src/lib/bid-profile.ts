import {
  ensureBusinessProfile,
  getBusinessProfile,
  updateBusinessProfile,
  type BusinessProfileRow,
} from "@/lib/assessment";

/**
 * Master Bid Profile. The editable surface a small business curates once and
 * then snapshots into a per-opportunity Bid-Ready Packet. We store this inside
 * `business_profile.data.bid_ready` so onboarding's free-form profile blob and
 * the bid-ready namespace coexist without a schema migration.
 *
 * Locked-elsewhere fields (UEI, CAGE, NAICS, legal name, SSP responses,
 * affirmation) are intentionally NOT stored here — those have a system of
 * record (`organizations`, `assessments`) and editing them on the bid profile
 * would let a user falsify their compliance posture.
 */
export type SetAside =
  | "8a"
  | "wosb"
  | "edwosb"
  | "hubzone"
  | "sdvosb"
  | "vosb"
  | "sb";

export const setAsideLabels: Record<SetAside, string> = {
  "8a": "8(a) Business Development",
  wosb: "Woman-Owned Small Business (WOSB)",
  edwosb: "Economically Disadvantaged WOSB (EDWOSB)",
  hubzone: "HUBZone",
  sdvosb: "Service-Disabled Veteran-Owned Small Business (SDVOSB)",
  vosb: "Veteran-Owned Small Business (VOSB)",
  sb: "Small Business (SBA size standard)",
};

export type PastPerformanceEntry = {
  id: string;
  agency: string;
  contract_no: string;
  naics: string;
  period_start: string;
  period_end: string;
  value_usd: string;
  scope: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
};

export type Insurance = {
  carrier: string;
  policy_number: string;
  general_liability_limit: string;
  professional_liability_limit: string;
  expiration_date: string;
};

export type Bonding = {
  bonding_company: string;
  bonding_capacity_usd: string;
};

export type BidProfile = {
  capability_statement: string;
  differentiators: string;
  core_competencies: string;
  poc_name: string;
  poc_title: string;
  poc_email: string;
  poc_phone: string;
  website: string;
  set_asides: SetAside[];
  insurance: Insurance;
  bonding: Bonding;
  past_performance: PastPerformanceEntry[];
  updated_at?: string;
};

export const emptyBidProfile = (): BidProfile => ({
  capability_statement: "",
  differentiators: "",
  core_competencies: "",
  poc_name: "",
  poc_title: "",
  poc_email: "",
  poc_phone: "",
  website: "",
  set_asides: [],
  insurance: {
    carrier: "",
    policy_number: "",
    general_liability_limit: "",
    professional_liability_limit: "",
    expiration_date: "",
  },
  bonding: {
    bonding_company: "",
    bonding_capacity_usd: "",
  },
  past_performance: [],
});

const VALID_SET_ASIDES = new Set<string>(Object.keys(setAsideLabels));

/**
 * Coerce arbitrary stored JSON into a well-formed BidProfile. Defensive — the
 * data column is JSONB and may have been written by an older version of this
 * code, or hand-edited.
 */
export function normalizeBidProfile(input: unknown): BidProfile {
  const base = emptyBidProfile();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;

  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const setAsidesRaw = Array.isArray(raw.set_asides) ? raw.set_asides : [];
  const set_asides = setAsidesRaw
    .filter((s): s is string => typeof s === "string" && VALID_SET_ASIDES.has(s))
    .map((s) => s as SetAside);

  const insRaw =
    raw.insurance && typeof raw.insurance === "object"
      ? (raw.insurance as Record<string, unknown>)
      : {};
  const bondRaw =
    raw.bonding && typeof raw.bonding === "object"
      ? (raw.bonding as Record<string, unknown>)
      : {};

  const ppRaw = Array.isArray(raw.past_performance) ? raw.past_performance : [];
  const past_performance = ppRaw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      id: str(p.id) || cryptoRandomId(),
      agency: str(p.agency),
      contract_no: str(p.contract_no),
      naics: str(p.naics),
      period_start: str(p.period_start),
      period_end: str(p.period_end),
      value_usd: str(p.value_usd),
      scope: str(p.scope),
      customer_name: str(p.customer_name),
      customer_email: str(p.customer_email),
      customer_phone: str(p.customer_phone),
    }));

  return {
    capability_statement: str(raw.capability_statement),
    differentiators: str(raw.differentiators),
    core_competencies: str(raw.core_competencies),
    poc_name: str(raw.poc_name),
    poc_title: str(raw.poc_title),
    poc_email: str(raw.poc_email),
    poc_phone: str(raw.poc_phone),
    website: str(raw.website),
    set_asides,
    insurance: {
      carrier: str(insRaw.carrier),
      policy_number: str(insRaw.policy_number),
      general_liability_limit: str(insRaw.general_liability_limit),
      professional_liability_limit: str(insRaw.professional_liability_limit),
      expiration_date: str(insRaw.expiration_date),
    },
    bonding: {
      bonding_company: str(bondRaw.bonding_company),
      bonding_capacity_usd: str(bondRaw.bonding_capacity_usd),
    },
    past_performance,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export async function loadBidProfile(
  organizationId: string,
): Promise<BidProfile> {
  await ensureBusinessProfile(organizationId);
  const row = await getBusinessProfile(organizationId);
  const data = (row?.data ?? {}) as Record<string, unknown>;
  return normalizeBidProfile(data.bid_ready);
}

/**
 * Save the bid_ready namespace WITHOUT clobbering other onboarding fields the
 * AI tooling has captured (what_we_do, primary_customers, team_size, etc.).
 * Re-uses the existing updateBusinessProfile helper for write-through.
 */
export async function saveBidProfile(
  organizationId: string,
  next: BidProfile,
): Promise<void> {
  await ensureBusinessProfile(organizationId);
  const row: BusinessProfileRow | null = await getBusinessProfile(organizationId);
  const existing = (row?.data ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    bid_ready: { ...next, updated_at: new Date().toISOString() },
  };
  await updateBusinessProfile(
    organizationId,
    merged,
    row?.completeness_score ?? 0,
    "user",
  );
}

/**
 * Completeness score for the bid profile — drives the readiness indicator
 * shown next to the "Generate packet" button. Heuristic, not a contract.
 */
export function bidProfileCompleteness(p: BidProfile): {
  score: number;
  missing: string[];
} {
  const missing: string[] = [];
  let earned = 0;
  const max = 100;

  // Capability statement (25)
  if (p.capability_statement.trim().length >= 200) earned += 25;
  else missing.push("Capability statement (200+ chars)");

  // Core competencies (10)
  if (p.core_competencies.trim().length > 0) earned += 10;
  else missing.push("Core competencies");

  // Differentiators (10)
  if (p.differentiators.trim().length > 0) earned += 10;
  else missing.push("Differentiators");

  // POC (15)
  if (
    p.poc_name.trim() &&
    p.poc_email.trim() &&
    p.poc_phone.trim()
  )
    earned += 15;
  else missing.push("Point of contact (name, email, phone)");

  // Insurance (15)
  if (p.insurance.carrier.trim() && p.insurance.expiration_date.trim())
    earned += 15;
  else missing.push("Insurance carrier + expiration");

  // Past performance (15) — at least one entry, doesn't need to be filled out
  if (p.past_performance.length >= 1) earned += 15;
  else missing.push("At least one past-performance entry");

  // Set-asides (5) — optional but encouraged
  if (p.set_asides.length > 0) earned += 5;
  else missing.push("Set-aside certifications (if applicable)");

  // Website (5)
  if (p.website.trim()) earned += 5;
  else missing.push("Website URL");

  return { score: Math.min(earned, max), missing };
}

function cryptoRandomId(): string {
  // Edge + Node 18+ both expose globalThis.crypto.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function newPastPerformanceEntry(): PastPerformanceEntry {
  return {
    id: cryptoRandomId(),
    agency: "",
    contract_no: "",
    naics: "",
    period_start: "",
    period_end: "",
    value_usd: "",
    scope: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
  };
}
