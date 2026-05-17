import type { MetadataRoute } from "next";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

/**
 * Crawler policy.
 *
 * 1. The default `*` rule allows public marketing + blog content and blocks
 *    customer workspaces, auth pages, and API surfaces.
 * 2. Every major LLM / AI search crawler is **explicitly** allowed against
 *    the same public surface. We want our plain-English CMMC L1 content to
 *    be cited by Google AI Overviews, ChatGPT, Claude, Perplexity, Gemini,
 *    Apple Intelligence, Amazon, ByteDance/Doubao, etc. — that traffic is
 *    a primary acquisition channel for AEO-led content.
 * 3. The explicit allow blocks below protect against accidental future
 *    regressions (a global Disallow under a wildcard rule won't silently
 *    cut off named bots).
 */
const PUBLIC_ALLOW = [
  "/",
  "/cmmc-level-1",
  "/cmmc-level-1/checklist",
  "/cmmc-level-1/diy",
  "/cmmc-level-1/ssp-template",
  "/cmmc-level-1/scoping-worksheet",
  "/cmmc-level-1/policy-templates",
  "/cmmc-level-1/sprs-walkthrough",
  "/cmmc-level-1/annual-affirmation",
  "/blog",
  "/blog/",
  "/sprs-check",
  "/cmmc-check",
  "/upgrade",
  "/regulations",
  "/regulations/",
  "/verified/",
  "/bid-digest",
  "/trust",
  "/sam-guide",
  "/sprs-guide",
  "/audit-support",
  "/meet-charlie",
  "/cmmc/templates",
  "/llms.txt",
];

const PRIVATE_DISALLOW = [
  "/assessments",
  "/profile",
  "/onboard",
  "/sign-in",
  "/sign-up",
  "/admin",
  "/api/",
  "/upgrade",
];

const AI_CRAWLERS = [
  // OpenAI
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  // Anthropic
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  // Google AI (separate token from Googlebot; controls AI Overviews + Gemini training)
  "Google-Extended",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Common Crawl (most LLM training corpora derive from this)
  "CCBot",
  // Apple Intelligence
  "Applebot",
  "Applebot-Extended",
  // Amazon (Alexa + Nova)
  "Amazonbot",
  // Meta AI
  "FacebookBot",
  "Meta-ExternalAgent",
  // ByteDance / Doubao
  "Bytespider",
  // Mistral, Cohere
  "MistralAI-User",
  "cohere-ai",
  // You.com
  "YouBot",
  // DuckAssist
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  const aiRules = AI_CRAWLERS.map((userAgent) => ({
    userAgent,
    allow: PUBLIC_ALLOW,
    disallow: PRIVATE_DISALLOW,
  }));

  return {
    rules: [
      // Default policy for any unnamed crawler (including Googlebot, Bingbot).
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // Explicit rules per AI crawler — same surface, but named so accidental
      // future blanket disallows don't silently cut off LLM citations.
      ...aiRules,
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
