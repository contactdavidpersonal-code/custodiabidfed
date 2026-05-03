import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogShell } from "../_components/BlogShell";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

/**
 * Statically generate every published post at build time so the blog is
 * fully crawlable, fast, and CDN-cacheable. New posts added to the
 * registry will be statically generated on the next deploy.
 */
export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.meta.slug }));
}

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `${APP_URL}/blog/${post.meta.slug}`;
  return {
    title: `${post.meta.title} | Custodia`,
    description: post.meta.description,
    keywords: post.meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: "article",
      url,
      siteName: "Custodia",
      publishedTime: post.meta.datePublished,
      modifiedTime: post.meta.dateModified ?? post.meta.datePublished,
      authors: [post.meta.author.name],
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.description,
    },
    robots: { index: true, follow: true },
  };
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage(
  props: PageProps<"/blog/[slug]">,
) {
  const { slug } = await props.params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const related = getRelatedPosts(slug, 3);
  const url = `${APP_URL}/blog/${post.meta.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.meta.title,
    description: post.meta.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.meta.datePublished,
    dateModified: post.meta.dateModified ?? post.meta.datePublished,
    keywords: post.meta.keywords.join(", "),
    author: {
      "@type": "Organization",
      name: post.meta.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
    },
    isAccessibleForFree: true,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Custodia",
        item: APP_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${APP_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.meta.title,
        item: url,
      },
    ],
  };

  const Body = post.Body;

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Article header */}
      <header className="relative overflow-hidden bg-[#08201a] px-6 py-16 text-white md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -10%, rgba(141,210,177,0.16), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#7aab98]"
          >
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2 opacity-50">/</span>
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[#bdf2cf]">{post.meta.category}</span>
          </nav>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            {post.meta.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            {post.meta.description}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-5 text-xs text-[#7aab98]">
            <span>
              By <strong className="text-white">{post.meta.author.name}</strong>
              <span className="ml-1 text-[#7aab98]">&middot; {post.meta.author.title}</span>
            </span>
            <span aria-hidden className="opacity-40">/</span>
            <span>{formatDate(post.meta.datePublished)}</span>
            <span aria-hidden className="opacity-40">/</span>
            <span>{post.meta.readingMinutes} min read</span>
          </div>
        </div>
      </header>

      <article>
        <Body />
      </article>

      {/* Related posts */}
      {related.length > 0 ? (
        <section className="border-t border-[#cfe3d9] bg-[#f7fcf9] px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-xs font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Keep reading
            </div>
            <ol className="grid gap-5 md:grid-cols-3">
              {related.map((p) => (
                <li
                  key={p.meta.slug}
                  className="flex flex-col border border-[#cfe3d9] bg-white p-6 transition-colors hover:border-[#2f8f6d]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                    {p.meta.category}
                  </div>
                  <Link
                    href={`/blog/${p.meta.slug}`}
                    className="mt-2 font-serif text-lg font-bold leading-snug text-[#10231d] hover:text-[#0e2a23]"
                  >
                    {p.meta.title}
                  </Link>
                  <p className="mt-2 flex-1 text-sm text-[#44695c]">
                    {p.meta.excerpt}
                  </p>
                  <Link
                    href={`/blog/${p.meta.slug}`}
                    className="mt-4 text-sm font-bold text-[#2f8f6d] hover:text-[#0e2a23]"
                  >
                    Read &rarr;
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </BlogShell>
  );
}
