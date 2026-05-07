/**
 * ICP scorer for cold-outbound prospect discovery.
 *
 * Translates a USAspending `AwardRow` into a 0–100 score with a band
 * (A / B / C / reject) and a list of human-readable reasons. Stored on
 * the prospect row so the /admin queue can sort and filter.
 *
 * Scoring philosophy: a *real* CMMC L1 ICP looks like
 *   - small DoD prime (1–250 employees, but USAspending doesn't give us
 *     headcount, so we use award size as a strong proxy)
 *   - just won their first or second federal contract (recency = urgency)
 *   - in a NAICS where FCI handling is the norm
 *   - U.S. domestic (no foreign primes)
 *   - not a research university or federal lab
 *
 * The strongest single signal is "won a $250k–$2M DoD contract in the
 * last 30 days" — that's a founder who just took on a real obligation
 * to safeguard FCI and almost certainly has no compliance staff.
 */

import type { AwardRow } from "./usaspending";

export type IcpBand = "A" | "B" | "C" | "reject";

export type IcpScore = {
  score: number;
  band: IcpBand;
  reasons: string[];
};

/**
 * Recipient name patterns that auto-reject. Universities, federal labs,
 * and primes-of-primes don't fit our ICP. Case-insensitive substring match.
 */
const REJECT_NAME_PATTERNS = [
  // Universities + research orgs
  "UNIVERSITY",
  "COLLEGE",
  "INSTITUTE OF TECHNOLOGY",
  "RESEARCH FOUNDATION",
  // Federal / state government
  "DEPARTMENT OF",
  "U.S.",
  "UNITED STATES",
  "STATE OF",
  // Mega-primes (already have full compliance staff)
  "LOCKHEED MARTIN",
  "RAYTHEON",
  "RTX",
  "BOEING",
  "NORTHROP GRUMMAN",
  "GENERAL DYNAMICS",
  "L3HARRIS",
  "BAE SYSTEMS",
  "LEIDOS",
  "BOOZ ALLEN",
  "SAIC",
  "CACI",
  "MANTECH",
  "PEROT SYSTEMS",
  "ACCENTURE FEDERAL",
  "DELOITTE",
  "KPMG",
  "PWC",
  "IBM",
  "MICROSOFT",
  "ORACLE",
  "AMAZON WEB SERVICES",
  "GOOGLE LLC",
  "PALANTIR",
  // Research labs that contract directly
  "BATTELLE",
  "MITRE",
  "AEROSPACE CORPORATION",
  "JOHNS HOPKINS APPLIED PHYSICS",
];

/** US state codes — anything else triggers a "non-US?" reason. */
const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
]);

/** ICP-friendly NAICS where the SMB-DoD-prime overlap is highest. */
const TIER_A_NAICS = new Set([
  "541330", // Engineering services
  "541512", // Computer systems design
  "541513", // Computer facilities management
  "541519", // Other computer related
  "336411", // Aircraft mfg
  "336412", // Aircraft engine + parts
  "336413", // Other aircraft parts
  "336414", // Guided missile + space vehicle
  "336415", // Guided missile/space propulsion
  "334511", // Search/detection/navigation instruments
]);

const TIER_B_NAICS = new Set([
  "541714", // R&D biotech
  "541715", // R&D physical/eng/life sci
]);

export type ScoreInput = {
  award: AwardRow;
  /** Now timestamp (ms). Pass for deterministic scoring in tests. */
  now?: number;
};

/**
 * Score a single USAspending award row 0–100 with a band + reasons.
 *
 * Bands:
 *   A: 75–100  — top priority, push to outreach immediately
 *   B: 50–74   — second wave, queue behind As
 *   C: 25–49   — keep but don't push to outreach
 *   reject: 0–24 — auto-suppress
 */
export function scoreAward(input: ScoreInput): IcpScore {
  const { award } = input;
  const now = input.now ?? Date.now();
  const reasons: string[] = [];

  // 1. Hard rejects ─────────────────────────────────────────────────
  const upperName = award.recipientName.toUpperCase();
  for (const pattern of REJECT_NAME_PATTERNS) {
    if (upperName.includes(pattern)) {
      return {
        score: 0,
        band: "reject",
        reasons: [`Recipient name matches reject pattern: "${pattern}"`],
      };
    }
  }
  if (!award.recipientName || award.recipientName.length < 3) {
    return { score: 0, band: "reject", reasons: ["Missing recipient name"] };
  }
  // Award size sanity. Below $50k usually means a one-off purchase;
  // above $25M means we're not the right vendor.
  if (award.awardAmount < 50_000) {
    return {
      score: 0,
      band: "reject",
      reasons: [`Award too small: $${award.awardAmount.toLocaleString()}`],
    };
  }
  if (award.awardAmount > 25_000_000) {
    return {
      score: 0,
      band: "reject",
      reasons: [
        `Award too large: $${award.awardAmount.toLocaleString()} (likely has compliance team)`,
      ],
    };
  }
  if (award.recipientStateCode && !US_STATE_CODES.has(award.recipientStateCode)) {
    return {
      score: 0,
      band: "reject",
      reasons: [`Non-US recipient state: ${award.recipientStateCode}`],
    };
  }

  // 2. Positive scoring ─────────────────────────────────────────────
  let score = 0;

  // NAICS tier (max 30)
  if (award.naicsCode && TIER_A_NAICS.has(award.naicsCode)) {
    score += 30;
    reasons.push(`Tier-A NAICS: ${award.naicsCode}`);
  } else if (award.naicsCode && TIER_B_NAICS.has(award.naicsCode)) {
    score += 18;
    reasons.push(`Tier-B NAICS: ${award.naicsCode}`);
  } else if (award.naicsCode) {
    score += 5;
    reasons.push(`Other NAICS: ${award.naicsCode}`);
  }

  // Award size sweet spot: $250k–$2M is the prime SMB band (max 30)
  const amt = award.awardAmount;
  if (amt >= 250_000 && amt <= 2_000_000) {
    score += 30;
    reasons.push(`Sweet-spot award size: $${amt.toLocaleString()}`);
  } else if (amt >= 100_000 && amt < 250_000) {
    score += 22;
    reasons.push(`Small-but-real award: $${amt.toLocaleString()}`);
  } else if (amt > 2_000_000 && amt <= 10_000_000) {
    score += 18;
    reasons.push(`Large award: $${amt.toLocaleString()}`);
  } else if (amt > 10_000_000) {
    score += 8;
    reasons.push(`Very large award: $${amt.toLocaleString()}`);
  } else {
    score += 5;
    reasons.push(`Below sweet spot: $${amt.toLocaleString()}`);
  }

  // Recency: fresher = more urgency for them to comply (max 25)
  if (award.actionDate) {
    const ageDays = Math.floor(
      (now - new Date(award.actionDate).getTime()) / 86_400_000,
    );
    if (ageDays <= 14) {
      score += 25;
      reasons.push(`Awarded ${ageDays}d ago (very fresh)`);
    } else if (ageDays <= 30) {
      score += 20;
      reasons.push(`Awarded ${ageDays}d ago (fresh)`);
    } else if (ageDays <= 60) {
      score += 12;
      reasons.push(`Awarded ${ageDays}d ago`);
    } else if (ageDays <= 90) {
      score += 6;
      reasons.push(`Awarded ${ageDays}d ago (older)`);
    } else {
      score += 0;
      reasons.push(`Awarded ${ageDays}d ago (stale)`);
    }
  }

  // Has UEI = registered in SAM, can legally take federal $$ (max 10)
  if (award.recipientUei) {
    score += 10;
    reasons.push(`SAM-registered (UEI: ${award.recipientUei})`);
  } else {
    reasons.push("No UEI on award (unusual)");
  }

  // DoD specifically (max 5) — already filtered to DoD primes upstream
  // but double-credit when the awarding sub-agency is a primary mission
  // area like Army/Navy/AF.
  const subagency = (award.awardingSubAgencyName ?? "").toLowerCase();
  if (
    subagency.includes("army") ||
    subagency.includes("navy") ||
    subagency.includes("air force") ||
    subagency.includes("space force") ||
    subagency.includes("marine")
  ) {
    score += 5;
    reasons.push(`Direct service branch: ${award.awardingSubAgencyName}`);
  }

  // Cap and band
  score = Math.max(0, Math.min(100, Math.round(score)));
  let band: IcpBand;
  if (score >= 75) band = "A";
  else if (score >= 50) band = "B";
  else if (score >= 25) band = "C";
  else band = "reject";

  return { score, band, reasons };
}

/**
 * Best-effort domain inference from a recipient company name.
 *
 * USAspending doesn't return websites. We try a tiny heuristic:
 * lowercased, alphanumerics only, ".com" suffix. Catches plain names
 * like "ACME ROBOTICS LLC" → "acmerobotics.com" which Hunter then
 * verifies (or returns nothing for, in which case the prospect goes
 * into the "needs manual research" bucket).
 *
 * This is intentionally simple. Phase 3 can add a real lookup
 * (Clearbit / Apollo / Google) if the manual bucket grows too big.
 */
export function inferDomain(companyName: string): string | null {
  const slug = companyName
    .toLowerCase()
    // strip business-entity suffixes
    .replace(/\b(llc|inc|incorporated|corp|corporation|ltd|limited|co|company|llp|lp|pllc|plc|gmbh|ag|sa|nv|bv|sas)\.?\b/g, "")
    // strip non-alnum
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (slug.length < 3 || slug.length > 30) return null;
  return `${slug}.com`;
}
