import type { ComponentType } from "react";

export type BlogPostFaqEntry = {
  /** Plain-text question. Used as-is in FAQPage JSON-LD. */
  question: string;
  /** Plain-text answer. Used as-is in FAQPage JSON-LD. Strip HTML. */
  answer: string;
};

export type BlogPostMeta = {
  slug: string;
  title: string;
  /** Used for <meta description> and OG/Twitter cards. */
  description: string;
  /** Short blurb shown on the index page. ~140 characters. */
  excerpt: string;
  /** ISO date — used in JSON-LD and the byline. */
  datePublished: string;
  /** Optional ISO date — defaults to datePublished. */
  dateModified?: string;
  /** Eyebrow above H1, also used as category badge on the index. */
  category: string;
  /** Keywords for the <meta keywords> tag and search relevance. */
  keywords: string[];
  /** Estimated reading time, minutes. */
  readingMinutes: number;
  /** Byline author. Rendered as schema.org Person for E-E-A-T. */
  author: {
    name: string;
    title: string;
    /** Optional public profile URLs (e.g. LinkedIn). Strengthens E-E-A-T. */
    sameAs?: string[];
  };
  /**
   * Optional FAQ entries. When present, the blog post page emits a FAQPage
   * JSON-LD block in addition to the Article schema. AI search engines
   * (Google AI Overviews, Perplexity, etc.) extract these verbatim, so each
   * answer should be a clean, self-contained sentence or two.
   */
  faq?: BlogPostFaqEntry[];
};

export type BlogPost = {
  meta: BlogPostMeta;
  Body: ComponentType;
};

import cmmcSeventeen from "@/app/blog/posts/cmmc-level-1-17-practices";
import sprsScore from "@/app/blog/posts/sprs-score-explained";
import frameworksCompared from "@/app/blog/posts/far-vs-nist-vs-cmmc";
import cmmcCost from "@/app/blog/posts/cmmc-level-1-cost";
import l1vsL2 from "@/app/blog/posts/cmmc-level-1-vs-level-2";

/**
 * Registered blog posts, ordered newest first. The order here is the order
 * they appear on /blog and in the sitemap.
 */
export const POSTS: BlogPost[] = [
  l1vsL2,
  cmmcSeventeen,
  sprsScore,
  frameworksCompared,
  cmmcCost,
];

export function getAllPosts(): BlogPost[] {
  return POSTS;
}

export function getPostBySlug(slug: string): BlogPost | null {
  return POSTS.find((p) => p.meta.slug === slug) ?? null;
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  return POSTS.filter((p) => p.meta.slug !== slug).slice(0, limit);
}
