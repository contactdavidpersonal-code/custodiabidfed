/**
 * Daily Discover — bonus opportunities feed.
 *
 * Replaces the heavier /opportunities inbox flow with a lightweight
 * "here are the top 15 open SAM.gov notices for your NAICS today" surface.
 * Refreshes once per UTC day per NAICS code (NOT per org) so the upstream
 * api.data.gov call budget scales with NAICS diversity instead of user
 * count. Worst case for a 1k-user platform on the public 1,000/day key
 * is ~1 SAM call per distinct NAICS code per day — well within budget.
 *
 * Filtering is deliberately permissive:
 *   - Active notices only (active=true on the SAM call)
 *   - We softly exclude notices that explicitly call out CMMC L2/L3 or
 *     handling of CUI / DFARS 252.204-7012, since this platform serves
 *     CMMC L1 accounts and we don't want to dangle out-of-scope work.
 *   - Award notices ('a') are excluded (no longer biddable).
 *   - Everything else passes through. We err on the side of showing more.
 */

import { ensureDbReady, getSql } from "@/lib/db";
import {
  searchSamOpportunities,
  type SamOpportunity,
  SamApiKeyError,
} from "@/lib/sam-radar";

/** Target cards to surface on the Discover page. */
export const DISCOVER_TARGET = 15;

/** How many results to pull per NAICS so the post-filter still has 15 left. */
const PER_NAICS_FETCH = 30;

/** Posted-within window to bias toward recent activity. */
const POSTED_WITHIN_DAYS = 30;

export type DiscoverCard = {
  noticeId: string;
  title: string;
  department: string | null;
  type: string | null;
  naicsCode: string | null;
  setAside: string | null;
  postedDate: string | null;
  responseDeadline: string | null;
  solicitationNumber: string | null;
  placeOfPerformance: string | null;
  /** Award amount when SAM exposes one (rare on active solicitations). */
  awardAmount: string | null;
  samUrl: string | null;
  /** Plain-text excerpt of the description; null if not available. */
  excerpt: string | null;
};

export type DiscoverResult = {
  cards: DiscoverCard[];
  /** Date (YYYY-MM-DD UTC) that the underlying NAICS rows were fetched. */
  fetchedFor: string;
  /** True if no SAM key is configured or no NAICS were supplied. */
  configMissing: boolean;
  /** True if SAM.gov refused us and no cached row was available. */
  liveFetchFailed: boolean;
};

/* ---------------------------------------------------------------------- */
/* CMMC L1 fitness filter                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Substring patterns (case-insensitive) that strongly imply the work
 * requires CMMC L2/L3 or CUI handling — out of scope for L1 contractors
 * using this platform. Keep the list short and unambiguous: a false
 * positive here means we hide a legitimate L1 opportunity from the user.
 */
const L1_EXCLUDE_PATTERNS: RegExp[] = [
  /\bCMMC\s*(?:Level\s*)?(?:2|3|II|III)\b/i,
  /\bDFARS\s*252\.204[-\s]*7012\b/i,
  /\bcontrolled\s+unclassified\s+information\b/i,
  /\bCUI\s+handling\b/i,
  /\bsafeguard(?:ing)?\s+CUI\b/i,
];

function isCmmcL1Friendly(o: SamOpportunity): boolean {
  // Award notices are not biddable — exclude them from a "discover open
  // opportunities" feed regardless of CMMC fit.
  if (o.type && /award/i.test(o.type)) return false;
  const haystack = [o.title, o.description].filter(Boolean).join(" ");
  if (!haystack) return true;
  return !L1_EXCLUDE_PATTERNS.some((p) => p.test(haystack));
}

/* ---------------------------------------------------------------------- */
/* Description excerpt (plain text only, no AI calls)                      */
/* ---------------------------------------------------------------------- */

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(raw: string | null, max = 240): string | null {
  if (!raw) return null;
  const text = stripHtml(raw);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max - 40 ? lastSpace : max).trim()}\u2026`;
}

function toCard(o: SamOpportunity): DiscoverCard {
  return {
    noticeId: o.noticeId,
    title: o.title,
    department: o.department,
    type: o.type,
    naicsCode: o.naicsCode,
    setAside: o.setAside,
    postedDate: o.postedDate,
    responseDeadline: o.responseDeadline,
    solicitationNumber: o.solicitationNumber,
    placeOfPerformance: o.placeOfPerformance,
    awardAmount: o.awardAmount,
    samUrl: o.samUrl,
    excerpt: excerpt(o.description),
  };
}

/* ---------------------------------------------------------------------- */
/* Cache table I/O                                                         */
/* ---------------------------------------------------------------------- */

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readCachedForNaics(
  naics: string,
  date: string,
): Promise<DiscoverCard[] | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT payload
    FROM sam_naics_daily
    WHERE naics_code = ${naics} AND fetched_for_date = ${date}
  `) as Array<{ payload: DiscoverCard[] }>;
  return rows[0]?.payload ?? null;
}

async function writeCachedForNaics(
  naics: string,
  date: string,
  cards: DiscoverCard[],
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO sam_naics_daily (naics_code, fetched_for_date, payload, fetched_at)
    VALUES (${naics}, ${date}, ${JSON.stringify(cards)}::jsonb, NOW())
    ON CONFLICT (naics_code, fetched_for_date) DO UPDATE
      SET payload = EXCLUDED.payload, fetched_at = NOW()
  `;
}

/**
 * Fetch one NAICS from SAM.gov, run the L1 filter, persist the daily row.
 * Returns the filtered cards. Throws SamApiKeyError on auth failure (caller
 * decides whether to swallow).
 */
async function refreshOneNaics(
  apiKey: string,
  naics: string,
  date: string,
): Promise<DiscoverCard[]> {
  const live = await searchSamOpportunities({
    apiKey,
    naicsCodes: [naics],
    postedFromDays: POSTED_WITHIN_DAYS,
    limit: PER_NAICS_FETCH,
  });
  const filtered = live.filter(isCmmcL1Friendly).map(toCard);
  await writeCachedForNaics(naics, date, filtered);
  return filtered;
}

/* ---------------------------------------------------------------------- */
/* Public entrypoint                                                       */
/* ---------------------------------------------------------------------- */

/**
 * Get today's discover cards for the org's NAICS list. Reads cache first;
 * for any NAICS missing today's row, fires a single SAM.gov call to
 * populate it. The result is the merged top-N across all the user's codes,
 * deduped by noticeId and sorted by postedDate desc.
 */
export async function getDailyDiscoverForOrg(input: {
  naicsCodes: string[];
}): Promise<DiscoverResult> {
  const naics = (input.naicsCodes ?? [])
    .map((c) => c.trim())
    .filter((c) => /^\d{2,6}$/.test(c))
    .slice(0, 5); // sanity cap
  const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  const date = todayUtc();

  if (naics.length === 0 || !apiKey) {
    return { cards: [], fetchedFor: date, configMissing: true, liveFetchFailed: false };
  }

  await ensureDbReady();

  const merged: DiscoverCard[] = [];
  const seen = new Set<string>();
  let liveFetchFailed = false;

  for (const code of naics) {
    let cards = await readCachedForNaics(code, date);
    if (cards == null) {
      try {
        cards = await refreshOneNaics(apiKey, code, date);
      } catch (err) {
        if (err instanceof SamApiKeyError) {
          // Whole platform is dark — log and stop trying.
          console.error(
            `[discover] SAM api_key rejected on naics=${code}:`,
            err.message,
          );
          liveFetchFailed = true;
          break;
        }
        console.error(`[discover] fetch failed for naics=${code}:`, err);
        // Try yesterday's row as a graceful fallback so the page isn't blank.
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        cards =
          (await readCachedForNaics(code, yesterday.toISOString().slice(0, 10))) ??
          [];
      }
    }

    for (const c of cards ?? []) {
      if (seen.has(c.noticeId)) continue;
      seen.add(c.noticeId);
      merged.push(c);
    }
  }

  // Sort: newest postedDate first, then those with a response deadline
  // (more actionable) ahead of those without.
  merged.sort((a, b) => {
    const da = a.postedDate ? Date.parse(a.postedDate) : 0;
    const db = b.postedDate ? Date.parse(b.postedDate) : 0;
    if (db !== da) return db - da;
    if (!!b.responseDeadline !== !!a.responseDeadline) {
      return b.responseDeadline ? 1 : -1;
    }
    return 0;
  });

  return {
    cards: merged.slice(0, DISCOVER_TARGET),
    fetchedFor: date,
    configMissing: false,
    liveFetchFailed: liveFetchFailed && merged.length === 0,
  };
}
