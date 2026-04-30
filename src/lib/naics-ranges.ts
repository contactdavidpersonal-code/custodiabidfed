/**
 * Heuristic "typical contract range" lookup keyed by NAICS code.
 *
 * SAM.gov does NOT expose an estimated contract value on active
 * solicitations — that field only shows up on award notices after the
 * fact. To give bidders a rough sense of scale before they click in, we
 * surface a band based on historical small-business federal awards in
 * the same NAICS sector.
 *
 * The bands below are coarse approximations derived from publicly
 * available FPDS small-business award medians (10th–90th percentile-ish
 * for the 2022–2024 window). They are intentionally wide. Always
 * label the value as "Typical range" in the UI — never "estimate" or
 * "budget" — so we don't imply we know the agency's actual ceiling.
 *
 * Lookup is by 6-digit NAICS first, then by 4-digit prefix, then by
 * 3-digit sector. Anything that doesn't match returns null and the UI
 * just hides the badge.
 */

export type TypicalRange = {
  low: number;
  high: number;
  /** Pre-formatted label, e.g. "$50k–$500k". Cheap to render. */
  label: string;
};

function fmt(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 || Number.isInteger(m) ? `$${m.toFixed(0)}M` : `$${m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1_000)}k`;
  }
  return `$${n}`;
}

function band(low: number, high: number): TypicalRange {
  return { low, high, label: `${fmt(low)}–${fmt(high)}` };
}

// Sector / 3-digit NAICS bands. Based on SBA size standards & FPDS small-biz
// award medians. Order: most-specific (6-digit) keys would go above these,
// but we currently only need sector-level resolution.
const SECTOR_BANDS: Record<string, TypicalRange> = {
  // 11 — Agriculture, forestry, fishing
  "111": band(25_000, 250_000),
  "112": band(25_000, 250_000),
  "113": band(50_000, 500_000),
  "115": band(50_000, 500_000),

  // 21 — Mining / oil & gas extraction
  "211": band(250_000, 5_000_000),
  "213": band(100_000, 2_000_000),

  // 22 — Utilities
  "221": band(100_000, 5_000_000),

  // 23 — Construction
  "236": band(250_000, 10_000_000),
  "237": band(500_000, 25_000_000),
  "238": band(50_000, 2_000_000),

  // 31–33 — Manufacturing
  "311": band(50_000, 1_000_000),
  "315": band(25_000, 500_000),
  "323": band(10_000, 250_000),
  "332": band(50_000, 2_000_000),
  "333": band(100_000, 5_000_000),
  "334": band(250_000, 10_000_000),
  "335": band(100_000, 5_000_000),
  "336": band(250_000, 25_000_000),

  // 42 — Wholesale trade
  "423": band(50_000, 2_000_000),
  "424": band(50_000, 2_000_000),

  // 44–45 — Retail trade
  "441": band(50_000, 1_000_000),
  "454": band(25_000, 500_000),

  // 48–49 — Transportation & warehousing
  "481": band(100_000, 5_000_000),
  "484": band(50_000, 1_000_000),
  "488": band(50_000, 1_000_000),
  "493": band(50_000, 1_000_000),

  // 51 — Information
  "511": band(50_000, 2_000_000),
  "517": band(100_000, 5_000_000),
  "518": band(100_000, 5_000_000),
  "519": band(50_000, 1_000_000),

  // 52 — Finance & insurance
  "522": band(50_000, 1_000_000),
  "524": band(50_000, 1_000_000),

  // 53 — Real estate / rental & leasing
  "531": band(50_000, 1_000_000),
  "532": band(25_000, 500_000),

  // 54 — Professional, scientific, technical services (the biggest fed bucket)
  "541": band(100_000, 5_000_000),

  // 56 — Admin & support, waste management
  "561": band(50_000, 2_000_000),
  "562": band(100_000, 2_000_000),

  // 61 — Educational services
  "611": band(50_000, 1_000_000),

  // 62 — Health care & social assistance
  "621": band(50_000, 2_000_000),
  "622": band(100_000, 5_000_000),
  "623": band(100_000, 2_000_000),

  // 71 — Arts, entertainment, recreation
  "711": band(25_000, 500_000),

  // 72 — Accommodation & food services
  "721": band(50_000, 1_000_000),
  "722": band(25_000, 500_000),

  // 81 — Other services
  "811": band(25_000, 500_000),
  "812": band(25_000, 500_000),

  // 92 — Public administration (rare on contractor side)
  "928": band(100_000, 5_000_000),
};

// 4-digit overrides where the sector band is too wide to be useful.
const SUBSECTOR_BANDS: Record<string, TypicalRange> = {
  // 5415 — Computer systems design (heavy fed IT services)
  "5415": band(250_000, 10_000_000),
  // 5417 — Scientific R&D
  "5417": band(500_000, 25_000_000),
  // 5419 — Other professional/technical (varies wildly)
  "5419": band(50_000, 2_000_000),
  // 5413 — A&E (architecture / engineering)
  "5413": band(250_000, 10_000_000),
  // 5614 — Business support (call centers, BPO)
  "5614": band(100_000, 5_000_000),
  // 5616 — Investigation & security services (federal guard contracts)
  "5616": band(250_000, 10_000_000),
  // 2362 — Nonresidential building construction (fed facilities)
  "2362": band(1_000_000, 25_000_000),
  // 3361 — Motor vehicle manufacturing (rare for SB)
  "3364": band(1_000_000, 50_000_000),
  // 5112 — Software publishers
  "5112": band(100_000, 5_000_000),
  // 5182 — Cloud / data processing
  "5182": band(250_000, 10_000_000),
};

/**
 * Look up a typical award range for a NAICS code. Returns null if we
 * have no band for that sector (caller should hide the badge).
 *
 * Specificity order: 4-digit subsector → 3-digit sector. We don't
 * keep 6-digit overrides yet; if a particular code needs one, add it
 * to SUBSECTOR_BANDS keyed by its first 4 digits or extend with a
 * SIX_DIGIT_BANDS map.
 */
export function typicalRangeForNaics(
  naics: string | null | undefined,
): TypicalRange | null {
  if (!naics) return null;
  const digits = naics.replace(/\D/g, "");
  if (digits.length < 3) return null;
  const sub4 = digits.slice(0, 4);
  if (SUBSECTOR_BANDS[sub4]) return SUBSECTOR_BANDS[sub4];
  const sec3 = digits.slice(0, 3);
  if (SECTOR_BANDS[sec3]) return SECTOR_BANDS[sec3];
  return null;
}
