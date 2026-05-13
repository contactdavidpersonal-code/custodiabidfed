import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/blog";

/**
 * IndexNow webhook — pushes URL change notifications to Bing, Yandex, and
 * Naver in a single call. Free, instant. Run after a deploy that publishes
 * new or updated blog content.
 *
 * Setup:
 *   1. Generate a random hex key (any 32+ char hex string).
 *   2. Set INDEXNOW_KEY in the runtime environment.
 *   3. Publish the key at `/<INDEXNOW_KEY>.txt` containing just the key
 *      string. The IndexNow protocol requires this for ownership proof.
 *   4. Hit POST /api/indexnow after every deploy to broadcast.
 *
 * Auth: requires the `Authorization: Bearer <CRON_SECRET>` header so
 * arbitrary visitors can't churn the index queue.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_HOST = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const APP_URL = `https://${APP_HOST}`;

// The canonical static surface we want re-crawled on every deploy. Blog post
// URLs are appended dynamically from the post registry.
const STATIC_URLS = [
  "/",
  "/cmmc-level-1",
  "/blog",
  "/bid-digest",
  "/sprs-check",
  "/cmmc-check",
  "/upgrade",
  "/regulations",
  "/regulations/ScopingGuideL1v2.pdf",
  "/regulations/AssessmentGuideL1v2.pdf",
  "/regulations/ModelOverviewv2.pdf",
  "/sprs-guide",
  "/sam-guide",
  "/cmmc/templates",
  "/for-msps",
  "/audit-support",
  "/meet-charlie",
  "/privacy",
  "/terms",
];

function checkAuth(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization") ?? "";
  return got === `Bearer ${expected}`;
}

async function pingIndexNow(urls: string[]): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { ok: false, status: 0, body: "INDEXNOW_KEY not configured" };
  }
  const payload = {
    host: APP_HOST,
    key,
    keyLocation: `${APP_URL}/${key}.txt`,
    urlList: urls,
  };
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const postUrls = getAllPosts().map(
    (p) => `${APP_URL}/blog/${p.meta.slug}`,
  );
  const urls = [
    ...STATIC_URLS.map((p) => `${APP_URL}${p}`),
    ...postUrls,
  ];

  const result = await pingIndexNow(urls);
  return NextResponse.json(
    { submitted: urls.length, ...result },
    { status: result.ok ? 200 : 502 },
  );
}

// GET returns the URLs that would be submitted — handy for sanity-checking
// before wiring up a deploy hook.
export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const postUrls = getAllPosts().map(
    (p) => `${APP_URL}/blog/${p.meta.slug}`,
  );
  const urls = [
    ...STATIC_URLS.map((p) => `${APP_URL}${p}`),
    ...postUrls,
  ];
  return NextResponse.json({ count: urls.length, urls });
}
