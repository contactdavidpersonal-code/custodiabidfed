import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "./_components/BlogShell";
import { getAllPosts } from "@/lib/blog";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title:
    "Custodia Blog — CMMC Level 1, in plain English | Custodia",
  description:
    "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors. Written by Carnegie Mellon-trained information security engineers.",
  alternates: { canonical: `${APP_URL}/blog` },
  openGraph: {
    title: "Custodia Blog — CMMC Level 1, in plain English",
    description:
      "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors.",
    type: "website",
    url: `${APP_URL}/blog`,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Custodia Blog — CMMC Level 1, in plain English",
    description:
      "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors.",
  },
  robots: { index: true, follow: true },
};

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Custodia Blog",
    url: `${APP_URL}/blog`,
    description:
      "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors.",
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.meta.title,
      description: p.meta.description,
      url: `${APP_URL}/blog/${p.meta.slug}`,
      datePublished: p.meta.datePublished,
      dateModified: p.meta.dateModified ?? p.meta.datePublished,
      author: { "@type": "Organization", name: p.meta.author.name },
    })),
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#08201a] px-6 py-20 text-white md:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -5%, rgba(141,210,177,0.18), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(141,210,177,1) 1px, transparent 1px), linear-gradient(90deg, rgba(141,210,177,1) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#0e2a23]/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#bdf2cf]" />
            The Custodia Library
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            CMMC Level 1, in{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              plain English
            </span>
            .
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            The federal compliance internet is mostly written by 3PAOs
            who hate plain English. We&apos;re fixing that &mdash; one
            cornerstone post at a time. Written by Carnegie Mellon-trained
            information security engineers, for the small defense
            contractors actually doing the work.
          </p>
        </div>
      </section>

      {/* Post grid */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <ol className="grid gap-6 md:grid-cols-2">
            {posts.map((p, i) => (
              <li
                key={p.meta.slug}
                className={`flex flex-col border border-[#cfe3d9] bg-white p-7 shadow-[0_8px_28px_rgba(14,48,37,0.05)] transition-colors hover:border-[#2f8f6d] ${
                  i === 0 ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                  <span>{p.meta.category}</span>
                  <span aria-hidden className="opacity-40">/</span>
                  <span className="text-[#7a9c90]">
                    {p.meta.readingMinutes} min read
                  </span>
                </div>
                <Link
                  href={`/blog/${p.meta.slug}`}
                  className="mt-3 font-serif text-2xl font-bold leading-snug text-[#10231d] hover:text-[#0e2a23] md:text-3xl"
                >
                  {p.meta.title}
                </Link>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#44695c]">
                  {p.meta.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-[#e6efe9] pt-4">
                  <span className="text-xs text-[#7a9c90]">
                    {formatDate(p.meta.datePublished)}
                  </span>
                  <Link
                    href={`/blog/${p.meta.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#2f8f6d] hover:text-[#0e2a23]"
                  >
                    Read &rarr;
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </BlogShell>
  );
}
