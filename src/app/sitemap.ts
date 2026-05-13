import type { MetadataRoute } from "next";
import { ensureDbReady, getSql } from "@/lib/db";
import { getAllPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/cmmc-level-1`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${APP_URL}/blog`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${APP_URL}/bid-digest`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${APP_URL}/sprs-check`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/cmmc-check`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/upgrade`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/regulations`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${APP_URL}/regulations/scoping-guide-level-1`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${APP_URL}/regulations/assessment-guide-level-1`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${APP_URL}/regulations/model-overview`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${APP_URL}/sprs-guide`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/sam-guide`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/cmmc/templates`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/for-msps`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/audit-support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/meet-charlie`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Blog posts — static at build/request time from the in-memory registry.
  const blogEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${APP_URL}/blog/${post.meta.slug}`,
    lastModified: new Date(
      `${post.meta.dateModified ?? post.meta.datePublished}T12:00:00Z`,
    ),
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  let publishedEntries: MetadataRoute.Sitemap = [];
  try {
    await ensureDbReady();
    const sql = getSql();
    const rows = (await sql`
      SELECT verification_slug, slug, updated_at
      FROM trust_pages
      WHERE is_public = TRUE
      ORDER BY updated_at DESC
      LIMIT 5000
    `) as Array<{
      verification_slug: string | null;
      slug: string;
      updated_at: string;
    }>;
    publishedEntries = rows.map((r) => ({
      url: `${APP_URL}/verified/${r.verification_slug ?? r.slug}`,
      lastModified: new Date(r.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.warn("[sitemap] failed to load trust pages:", err);
  }

  return [...staticEntries, ...blogEntries, ...publishedEntries];
}
