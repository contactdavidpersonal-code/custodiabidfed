import type { ComponentType } from "react";

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
  /** Byline author. */
  author: { name: string; title: string };
};

export type BlogPost = {
  meta: BlogPostMeta;
  Body: ComponentType;
};

import cmmcSeventeen from "@/app/blog/posts/cmmc-level-1-17-practices";
import sprsScore from "@/app/blog/posts/sprs-score-explained";
import frameworksCompared from "@/app/blog/posts/far-vs-nist-vs-cmmc";
import cmmcCost from "@/app/blog/posts/cmmc-level-1-cost";

/**
 * Registered blog posts, ordered newest first. The order here is the order
 * they appear on /blog and in the sitemap.
 */
export const POSTS: BlogPost[] = [
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
