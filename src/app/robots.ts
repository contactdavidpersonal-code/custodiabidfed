import type { MetadataRoute } from "next";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/verified/", "/sprs-check"],
        // Keep customer workspaces and API surfaces out of search results.
        disallow: [
          "/assessments",
          "/dashboard",
          "/profile",
          "/onboard",
          "/sign-in",
          "/sign-up",
          "/api/",
          "/upgrade",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
