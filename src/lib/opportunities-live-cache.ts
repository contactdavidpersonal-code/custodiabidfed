/**
 * Cached SAM.gov live preview for the /opportunities page.
 *
 * Why it exists:
 *   - Every page render used to hit SAM.gov v2 search + N×Anthropic Haiku
 *     summary calls. Cost adds up, latency was 3–6s, and SAM.gov outages
 *     wiped out the live cards entirely.
 *   - This module fronts the live fetch with a per-org Postgres cache
 *     (table `sam_live_cache`) keyed by NAICS list. Reads return cached
 *     cards instantly. Writes happen at most once per TTL_MS, and only
 *     when the upstream result actually changed (payload-hash check).
 *
 * Failure mode:
 *   - If SAM.gov errors and we have a cached row, we return the cached
 *     payload with `staleSamFetch=true` so the page can show a tiny
 *     "from cache" hint without losing the cards.
 *   - If we have no cache and SAM.gov errors, we return an empty list +
 *     `liveFetchFailed=true` and the page falls back to its sample bank.
 */

import crypto from "node:crypto";
import { ensureDbReady, getSql } from "@/lib/db";
import { searchSamOpportunities, type SamOpportunity } from "@/lib/sam-radar";
import { getAnthropic } from "@/lib/anthropic";

/** Cards live in cache for 6h. Plenty of time given SAM.gov posts on a
 *  daily cadence, but short enough that a fresh listing is visible same-day. */
const TTL_MS = 6 * 60 * 60 * 1000;

/** How many cards we want surfaced on the page. Mirrors PREVIEW_TARGET in
 *  the page so the cache fetches the exact slice we'll render. */
const TARGET = 4;

export type CachedOpportunityCard = {
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
  awardAmount: string | null;
  samUrl: string | null;
  /** AI summary (preferred) or plain-text excerpt; null if both failed. */
  summary: string | null;
};

export type LivePreviewResult = {
  cards: CachedOpportunityCard[];
  /** True iff we tried to refresh and SAM.gov rejected us; cards may be
   *  served from a stale cache row. */
  staleSamFetch: boolean;
  /** True iff there is no cache and SAM.gov refused. Page should backfill
   *  from samples. */
  liveFetchFailed: boolean;
};

type CacheRow = {
  naics_key: string;
  payload_hash: string;
  payload: CachedOpportunityCard[];
  fetched_at: Date;
};

function naicsKey(naicsCodes: string[]): string {
  return [...naicsCodes].sort().join(",");
}

function hashPayload(cards: CachedOpportunityCard[]): string {
  const ids = cards
    .map((c) => c.noticeId)
    .sort()
    .join("|");
  return crypto.createHash("sha1").update(ids).digest("hex");
}

async function readCache(organizationId: string): Promise<CacheRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT naics_key, payload_hash, payload, fetched_at
    FROM sam_live_cache
    WHERE organization_id = ${organizationId}
  `) as Array<{
    naics_key: string;
    payload_hash: string;
    payload: CachedOpportunityCard[];
    fetched_at: string;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    naics_key: r.naics_key,
    payload_hash: r.payload_hash,
    payload: r.payload,
    fetched_at: new Date(r.fetched_at),
  };
}

async function writeCache(
  organizationId: string,
  key: string,
  hash: string,
  payload: CachedOpportunityCard[],
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO sam_live_cache (organization_id, naics_key, payload_hash, payload, fetched_at)
    VALUES (${organizationId}, ${key}, ${hash}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (organization_id) DO UPDATE
      SET naics_key    = EXCLUDED.naics_key,
          payload_hash = EXCLUDED.payload_hash,
          payload      = EXCLUDED.payload,
          fetched_at   = NOW()
  `;
}

async function bumpFetchedAt(organizationId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE sam_live_cache SET fetched_at = NOW()
    WHERE organization_id = ${organizationId}
  `;
}

/**
 * Fetch the SAM.gov noticedesc resource for one card. Best-effort: any
 * failure (auth, 404, timeout) yields null and the caller proceeds without
 * a summary on that card.
 */
async function fetchNoticeDescription(
  url: string | null,
  apiKey: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    let target = url;
    if (target.includes("{api_key}")) {
      target = target.replace("{api_key}", encodeURIComponent(apiKey));
    } else if (!/[?&]api_key=/.test(target)) {
      target += (target.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(apiKey)}`;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { description?: string };
    return json.description ?? null;
  } catch {
    return null;
  }
}

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

function plainExcerpt(raw: string | null, max = 260): string | null {
  if (!raw) return null;
  const text = stripHtml(raw);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max - 40 ? lastSpace : max).trim()}\u2026`;
}

async function aiSummarize(
  title: string,
  rawDescription: string,
): Promise<string | null> {
  const cleaned = stripHtml(rawDescription).slice(0, 4000);
  if (!cleaned || cleaned.length < 40) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const client = getAnthropic();
    const resp = await client.messages.create(
      {
        model: "claude-haiku-4-5",
        max_tokens: 120,
        system:
          "You summarize U.S. federal contracting opportunity notices for a small business owner deciding whether to bid. Output ONE sentence (max 220 characters) describing what the agency is actually asking a contractor to do or supply. Start with an action verb (Provide, Supply, Maintain, Operate, Furnish, etc.). No preamble, no quotes, no markdown, no agency name, no contract numbers, no dates. Plain prose only.",
        messages: [
          {
            role: "user",
            content: `Title: ${title}\n\nNotice description:\n${cleaned}`,
          },
        ],
      },
      { signal: ctl.signal },
    );
    clearTimeout(timer);
    const block = resp.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const text = block.text.trim().replace(/^["']|["']$/g, "");
    return text.length > 0 ? text : null;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[opportunities] aiSummarize failed: ${msg}`);
    return null;
  }
}

async function fetchAndSummarize(
  apiKey: string,
  naicsCodes: string[],
): Promise<CachedOpportunityCard[]> {
  const live = await searchSamOpportunities({
    apiKey,
    naicsCodes,
    postedFromDays: 30,
    limit: Math.max(TARGET * 2, 8),
  });
  // Dedupe + slice to TARGET before doing N expensive AI calls.
  const seen = new Set<string>();
  const slice: SamOpportunity[] = [];
  for (const o of live) {
    if (!o || !o.noticeId) continue;
    if (seen.has(o.noticeId)) continue;
    seen.add(o.noticeId);
    slice.push(o);
    if (slice.length >= TARGET) break;
  }
  // AI-summarize all of them concurrently. Each call is bounded internally.
  const cards = await Promise.all(
    slice.map(async (o): Promise<CachedOpportunityCard> => {
      let summary: string | null = null;
      if (o.description) {
        const raw = await fetchNoticeDescription(o.description, apiKey);
        if (raw) summary = (await aiSummarize(o.title ?? "", raw)) ?? plainExcerpt(raw);
      }
      return {
        noticeId: o.noticeId,
        title: o.title ?? "(untitled)",
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
        summary,
      };
    }),
  );
  return cards;
}

/**
 * Main entrypoint. Returns up-to-TARGET cached cards for the org. Refreshes
 * from SAM.gov when the cache is missing, expired, or keyed off a different
 * NAICS list. Refresh writes the cache only when the result set changed
 * (payload hash) so we don't churn the row on every refresh tick.
 */
export async function getCachedLivePreview(input: {
  organizationId: string;
  naicsCodes: string[];
}): Promise<LivePreviewResult> {
  const { organizationId, naicsCodes } = input;
  const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  const liveDisabled = process.env.OPPORTUNITIES_LIVE_PREVIEW === "off";

  if (liveDisabled || !apiKey || naicsCodes.length === 0) {
    return { cards: [], staleSamFetch: false, liveFetchFailed: false };
  }

  await ensureDbReady();

  const key = naicsKey(naicsCodes);
  const cached = await readCache(organizationId);
  const fresh =
    cached &&
    cached.naics_key === key &&
    Date.now() - cached.fetched_at.getTime() < TTL_MS;

  if (fresh) {
    return { cards: cached.payload, staleSamFetch: false, liveFetchFailed: false };
  }

  // Need a refresh: cache is missing, expired, or org's NAICS changed.
  try {
    const cards = await fetchAndSummarize(apiKey, naicsCodes);
    const hash = hashPayload(cards);
    if (cached && cached.payload_hash === hash && cached.naics_key === key) {
      // Result set didn't actually change — bump fetched_at so we don't keep
      // re-firing the upstream call this hour, but skip the JSONB write.
      await bumpFetchedAt(organizationId);
      return { cards: cached.payload, staleSamFetch: false, liveFetchFailed: false };
    }
    await writeCache(organizationId, key, hash, cards);
    return { cards, staleSamFetch: false, liveFetchFailed: false };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(
      `[opportunities] cached live preview refresh failed (org=${organizationId}, naics=${key}): ${msg}`,
    );
    if (cached && cached.payload.length > 0) {
      return { cards: cached.payload, staleSamFetch: true, liveFetchFailed: false };
    }
    return { cards: [], staleSamFetch: false, liveFetchFailed: true };
  }
}
