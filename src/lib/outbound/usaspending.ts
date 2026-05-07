/**
 * USAspending.gov API client — federal contract awards data.
 *
 * Docs: https://api.usaspending.gov/
 * Key endpoint used here: POST /api/v2/search/spending_by_award/
 *
 * No authentication required. Public dataset. Rate limit ~60 rpm
 * (undocumented but observed); we keep calls modest.
 *
 * Why this lives in /lib/outbound: USAspending feeds the prospect
 * pipeline — DoD prime contracts in our target NAICS, recently awarded,
 * inside our ICP size band. The discovery cron calls
 * `searchAwards()` → ICP scorer → Hunter enrichment → DB.
 */

const USASPENDING_BASE = "https://api.usaspending.gov/api/v2";

/**
 * Default DoD-aligned NAICS targets for CMMC Level 1 ICP. These are the
 * codes where small primes most often handle FCI without yet having
 * compliance staff. Override per-call if needed.
 *
 * - 541330 — Engineering services
 * - 541512 — Computer systems design
 * - 541513 — Computer facilities management
 * - 541519 — Other computer related services
 * - 541714 — R&D in biotech (excluding nanobiotech)
 * - 541715 — R&D in physical/engineering/life sciences
 * - 334511 — Search/detection/navigation/guidance instruments
 * - 336411 — Aircraft manufacturing
 * - 336412 — Aircraft engine + parts manufacturing
 * - 336413 — Other aircraft parts + auxiliary equipment
 * - 336414 — Guided missile + space vehicle manufacturing
 * - 336415 — Guided missile/space propulsion
 */
export const DEFAULT_DOD_NAICS = [
  "541330",
  "541512",
  "541513",
  "541519",
  "541714",
  "541715",
  "334511",
  "336411",
  "336412",
  "336413",
  "336414",
  "336415",
] as const;

/** PSC = Product/Service Codes — agency-side categorization. Empty = no PSC filter. */
export const DEFAULT_DOD_AGENCIES = [
  "Department of Defense",
  "Department of the Army",
  "Department of the Navy",
  "Department of the Air Force",
  "Defense Logistics Agency",
] as const;

export type AwardSearchInput = {
  /** ISO date (YYYY-MM-DD). Inclusive. */
  startDate: string;
  /** ISO date (YYYY-MM-DD). Inclusive. */
  endDate: string;
  /** NAICS codes to include. Defaults to DEFAULT_DOD_NAICS. */
  naicsCodes?: readonly string[];
  /** Award amount band in dollars. */
  minAwardAmount?: number;
  maxAwardAmount?: number;
  /** Page size — USAspending caps at 100. */
  limit?: number;
  /** 1-indexed page. */
  page?: number;
};

/**
 * Single award row as projected by `spending_by_award`. We pick the
 * fields we actually need; USAspending returns many more we don't.
 */
export type AwardRow = {
  /** USAspending internal ID. */
  internalId: string;
  /** PIID — Procurement Instrument Identifier (the contract number). */
  piid: string;
  /** Recipient (the company that won the contract). */
  recipientName: string;
  recipientUei: string | null;
  /** UEI is the primary federal entity identifier; DUNS is legacy. */
  recipientDuns: string | null;
  recipientStateCode: string | null;
  recipientCity: string | null;
  /** Awarding agency / sub-agency strings. */
  awardingAgencyName: string | null;
  awardingSubAgencyName: string | null;
  /** Total obligated dollars on this award. */
  awardAmount: number;
  /** When the contract was signed / action date. ISO timestamp. */
  actionDate: string | null;
  /** NAICS code attached to this award. */
  naicsCode: string | null;
  naicsDescription: string | null;
};

type RawAwardRow = {
  internal_id?: number | string;
  "Award ID"?: string;
  "Recipient Name"?: string;
  recipient_id?: string | null;
  "Recipient UEI"?: string | null;
  "Recipient DUNS Number"?: string | null;
  "Place of Performance State Code"?: string | null;
  "Place of Performance City Code"?: string | null;
  "Awarding Agency"?: string | null;
  "Awarding Sub Agency"?: string | null;
  "Award Amount"?: number | string | null;
  "Action Date"?: string | null;
  "NAICS Code"?: string | null;
  NAICS?: string | null;
  naics_code?: string | null;
  naics_description?: string | null;
};

type RawSearchResponse = {
  results: RawAwardRow[];
  page_metadata?: {
    page: number;
    hasNext: boolean;
    last_record_unique_id?: number | null;
  };
};

/**
 * Search DoD prime contract awards in a date range, NAICS list, and
 * award size band.
 *
 * Returns a normalized `AwardRow[]` slice for one page. Caller paginates
 * by passing `page=2,3,...` until `hasMore` is false.
 */
export async function searchAwards(input: AwardSearchInput): Promise<{
  rows: AwardRow[];
  page: number;
  hasMore: boolean;
}> {
  const naics = input.naicsCodes ?? DEFAULT_DOD_NAICS;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const page = Math.max(input.page ?? 1, 1);

  const filters: Record<string, unknown> = {
    time_period: [{ start_date: input.startDate, end_date: input.endDate }],
    award_type_codes: ["A", "B", "C", "D"], // BPA Call, Purchase Order, Delivery Order, Definitive Contract
    naics_codes: [...naics],
    agencies: DEFAULT_DOD_AGENCIES.map((name) => ({
      type: "awarding",
      tier: "toptier",
      name,
    })),
  };
  if (input.minAwardAmount != null || input.maxAwardAmount != null) {
    filters.award_amounts = [
      {
        lower_bound: input.minAwardAmount ?? 0,
        upper_bound: input.maxAwardAmount ?? 999_999_999_999,
      },
    ];
  }

  // Field projection — USAspending only returns these. Casing matters; the
  // API returns columns keyed by these exact human-readable strings.
  const fields = [
    "Award ID",
    "Recipient Name",
    "Recipient UEI",
    "Recipient DUNS Number",
    "Award Amount",
    "Action Date",
    "Awarding Agency",
    "Awarding Sub Agency",
    "Place of Performance State Code",
    "Place of Performance City Code",
    "NAICS",
  ];

  const body = {
    filters,
    fields,
    page,
    limit,
    sort: "Action Date",
    order: "desc",
    subawards: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${USASPENDING_BASE}/search/spending_by_award/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`USAspending ${res.status}: ${detail.slice(0, 400)}`);
  }
  const data = (await res.json()) as RawSearchResponse;

  const rows: AwardRow[] = (data.results ?? []).map((r) => ({
    internalId: String(r.internal_id ?? r["Award ID"] ?? ""),
    piid: String(r["Award ID"] ?? ""),
    recipientName: String(r["Recipient Name"] ?? ""),
    recipientUei: r["Recipient UEI"] ?? null,
    recipientDuns: r["Recipient DUNS Number"] ?? null,
    recipientStateCode: r["Place of Performance State Code"] ?? null,
    recipientCity: r["Place of Performance City Code"] ?? null,
    awardingAgencyName: r["Awarding Agency"] ?? null,
    awardingSubAgencyName: r["Awarding Sub Agency"] ?? null,
    awardAmount: Number(r["Award Amount"] ?? 0),
    actionDate: r["Action Date"] ?? null,
    naicsCode: extractNaicsCode(r),
    naicsDescription: r.naics_description ?? null,
  }));

  return {
    rows,
    page,
    hasMore: Boolean(data.page_metadata?.hasNext),
  };
}

/**
 * USAspending sometimes returns NAICS as "541512: Computer Systems Design"
 * in the "NAICS" field, sometimes as a plain code in `naics_code`. Extract
 * just the numeric code.
 */
function extractNaicsCode(r: RawAwardRow): string | null {
  const candidates = [r["NAICS Code"], r.NAICS, r.naics_code].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  for (const c of candidates) {
    const m = c.match(/^\d{4,6}/);
    if (m) return m[0];
  }
  return null;
}

/**
 * Recipient profile — gives us company-level totals that single award rows
 * don't include. Used after award discovery to pull total federal $$ won
 * (a strong "real prime" signal) and home state.
 *
 * Endpoint: GET /api/v2/recipient/{recipient_id_with_levels}/
 *
 * The "recipient_id_with_levels" format is `<uuid>-<level>` where level is
 * "P" (parent), "C" (child), or "R" (recipient). When we only have a UEI
 * we have to call /recipient/duns/{uei}/ first to resolve.
 *
 * For Phase 2 we only need name + state + total amount, all of which are
 * in the award row. Recipient API integration is deferred to Phase 3.
 */
export async function tryDeriveDomainFromName(_companyName: string): Promise<string | null> {
  // Placeholder. USAspending doesn't return a domain field directly.
  // Phase 3: optional Clearbit / Apollo lookup, or Hunter's company search.
  // For now, the discovery pipeline relies on Hunter's domain-search by
  // company-name fallback when no domain is known.
  return null;
}
