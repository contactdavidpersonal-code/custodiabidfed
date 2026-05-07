/**
 * Stage-1 rule filter for prospect discovery.
 *
 * Cheap, deterministic gate that drops only the *truly* impossible-fit
 * awards before we send the rest to Claude for ranking. The philosophy
 * is "let the LLM judge anything subjective; only hard-fail what's
 * obviously not an ICP."
 *
 * What's an ICP for Custodia?
 *   - Small US business (SBA-small or similar)
 *   - Just won a DoD prime contract
 *   - Almost certainly handles FCI (Federal Contract Information)
 *   - Probably doesn't have a CMMC compliance officer yet
 *
 * What's an obvious non-fit (and therefore a hard reject here)?
 *   - Megaprimes by name (Lockheed, Northrop, etc. — they have entire
 *     compliance departments)
 *   - Universities, FFRDCs, federal labs
 *   - Government entities themselves
 *   - Joint ventures (almost always megaprime + megaprime)
 *   - Foreign-domiciled recipients
 *   - Awards <$25k (below CMMC L1 threshold) or >$10M (likely big enough
 *     to already have it)
 *
 * Everything else passes through to Claude.
 */

import type { AwardRow } from "./usaspending";

export type IcpBand = "A" | "B" | "C" | "reject";

export type IcpScore = {
  score: number;
  band: IcpBand;
  reasons: string[];
};

/**
 * Confirmed-bad recipient names. Case-insensitive substring match.
 * Kept tight on purpose — broader filtering happens in the AI step.
 *
 * Rule for inclusion: company is publicly known to be too large to be
 * an ICP, and has a stable, unmistakable name token. ~25 entries total.
 */
const REJECT_NAME_PATTERNS = [
  // Government / public sector
  "DEPARTMENT OF",
  "STATE OF ",
  "CITY OF ",
  "COUNTY OF ",
  // Universities / FFRDCs / federal labs
  "UNIVERSITY",
  "COLLEGE OF",
  "RESEARCH FOUNDATION",
  "TRUSTEES OF",
  "BOARD OF REGENTS",
  "MITRE",
  "BATTELLE",
  "AEROSPACE CORPORATION",
  "RAND CORPORATION",
  "INSTITUTE FOR DEFENSE ANALYSES",
  "JOHNS HOPKINS APPLIED PHYSICS",
  "SOUTHWEST RESEARCH INSTITUTE",
  // Mega-defense-primes
  "LOCKHEED MARTIN",
  "RAYTHEON",
  "BOEING",
  "NORTHROP GRUMMAN",
  "GENERAL DYNAMICS",
  "L3HARRIS",
  "BAE SYSTEMS",
  "LEIDOS",
  "BOOZ ALLEN",
  "HUNTINGTON INGALLS",
  // Big consulting + big tech federal arms
  "SAIC",
  "CACI INTERNATIONAL",
  "MANTECH",
  "ACCENTURE FEDERAL",
  "DELOITTE",
  "KPMG ",
  "IBM CORPORATION",
  "MICROSOFT CORPORATION",
  "ORACLE AMERICA",
  "AMAZON WEB SERVICES",
  // Public engineering megafirms ($1B+ revenue)
  "TETRA TECH",
  "AECOM",
  "JACOBS ENGINEERING",
  "JACOBS SOLUTIONS",
  "PARSONS CORPORATION",
  "PARSONS GOVERNMENT",
  "ICF INTERNATIONAL",
  "FLUOR FEDERAL",
  "KBR INC",
  "CDM SMITH",
  "CDM FEDERAL",
  "HDR ENGINEERING",
  "HDR-",
  "STANTEC",
  "ARCADIS",
  "BLACK & VEATCH",
  "BURNS & MCDONNELL",
  "MICHAEL BAKER",
  // Joint ventures
  "JOINT VENTURE",
  " JV ",
  " JV,",
  " JV.",
  " JV)",
];

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
]);

/**
 * Award size band for CMMC L1 ICP.
 *
 *   < $25k  → below the federal micro-purchase floor for FCI handling;
 *             also too small a contract to fund a vendor like us
 *   $25k–$5M → SMB sweet spot for L1 (above ~$2M, CUI handling becomes
 *             likely → L2 territory → not our ICP)
 *   > $5M  → company is probably already big enough to have compliance
 *             figured out and likely on L2 anyway
 */
const MIN_AWARD = 25_000;
const MAX_AWARD = 5_000_000;

export type ScoreInput = {
  award: AwardRow;
  /** Now timestamp (ms). Pass for deterministic scoring in tests. */
  now?: number;
};

/**
 * Hard-filter only. Awards that pass come back with band="C" and a
 * generic score so the AI step can rerank. The rule layer no longer
 * tries to do nuanced 0-100 scoring; that's Claude's job.
 *
 * This is a big departure from v1. v1 tried to assign a 0-100 fit
 * score with NAICS tiers, recency curves, agency bonuses, etc. — and
 * the result was that obvious megaprimes (Tetra Tech, CDM, HDR) leaked
 * through with band="C" because they hit the right NAICS + recency.
 *
 * v2 (this) is a binary gate: either you pass to Claude or you don't.
 */
export function scoreAward(input: ScoreInput): IcpScore {
  const { award } = input;
  const reasons: string[] = [];

  // Hard rejects ─────────────────────────────────────────────────────
  if (!award.recipientName || award.recipientName.length < 3) {
    return { score: 0, band: "reject", reasons: ["Missing recipient name"] };
  }

  const upperName = award.recipientName.toUpperCase();
  for (const pattern of REJECT_NAME_PATTERNS) {
    if (upperName.includes(pattern)) {
      return {
        score: 0,
        band: "reject",
        reasons: [`Name matches reject pattern: "${pattern.trim()}"`],
      };
    }
  }

  if (award.awardAmount < MIN_AWARD) {
    return {
      score: 0,
      band: "reject",
      reasons: [`Award too small: $${award.awardAmount.toLocaleString()}`],
    };
  }
  if (award.awardAmount > MAX_AWARD) {
    return {
      score: 0,
      band: "reject",
      reasons: [
        `Award too large: $${award.awardAmount.toLocaleString()} (>$10M = likely already compliant)`,
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

  // Pass — generic 50 score so it sorts above hard-rejects but the AI
  // band is what actually matters downstream.
  reasons.push(`Passed rule filter (amt=$${award.awardAmount.toLocaleString()}, naics=${award.naicsCode ?? "?"}, state=${award.recipientStateCode ?? "?"})`);
  if (award.recipientUei) reasons.push(`SAM-registered: ${award.recipientUei}`);
  return { score: 50, band: "C", reasons };
}

/**
 * Best-effort domain inference from a recipient company name.
 *
 * USAspending doesn't return websites. We strip entity suffixes,
 * collapse to alnum, and try ".com". Hunter's domainSearch will
 * accept either a domain or just the company name, so this is just a
 * starting hint — Hunter resolves the real one.
 */
export function inferDomain(companyName: string): string | null {
  const slug = companyName
    .toLowerCase()
    .replace(/\b(llc|inc|incorporated|corp|corporation|ltd|limited|co|company|llp|lp|pllc|plc|gmbh|ag|sa|nv|bv|sas)\.?\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (slug.length < 3 || slug.length > 30) return null;
  return `${slug}.com`;
}
