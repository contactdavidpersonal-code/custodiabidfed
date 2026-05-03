import type { MetadataRoute } from "next";
import { ensureDbReady, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/sprs-check`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/onboard`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/upgrade`, changeFrequency: "monthly", priority: 0.5 },
  ];

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

  return [...staticEntries, ...publishedEntries];
}
