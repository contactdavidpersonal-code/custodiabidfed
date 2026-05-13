import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "./_components/BlogShell";
import { getAllPosts, type BlogPost } from "@/lib/blog";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title:
    "The Custodia Library — CMMC Level 1, in plain English | Custodia",
  description:
    "An editorial library of plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS — for the small defense contractors actually doing the work.",
  alternates: { canonical: `${APP_URL}/blog` },
  openGraph: {
    title: "The Custodia Library — CMMC Level 1, in plain English",
    description:
      "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors.",
    type: "website",
    url: `${APP_URL}/blog`,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Custodia Library — CMMC Level 1, in plain English",
    description:
      "Plain-English guides to CMMC Level 1, FAR 52.204-21, NIST 800-171, and SPRS for small defense contractors.",
  },
  robots: { index: true, follow: true },
};

/**
 * Editorial groupings — every post maps into one of three funnel stages.
 * The order here is also the on-page reading order within each section.
 */
const STAGE_DEFS: Array<{
  id: "need" | "understand" | "file";
  eyebrow: string;
  title: string;
  blurb: string;
  slugs: string[];
}> = [
  {
    id: "need",
    eyebrow: "Stage 01",
    title: "Do you actually need CMMC?",
    blurb:
      "Before you spend a dollar: a flowchart of who is covered, who is exempt, and what FCI really means in your contracts.",
    slugs: [
      "do-i-need-cmmc-decision-tree",
      "cui-vs-fci",
      "what-is-fci-federal-contract-information",
      "cmmc-level-1-vs-level-2",
      "dfars-7012-vs-cmmc",
      "cmmc-for-sbir-phase-1-winners",
    ],
  },
  {
    id: "understand",
    eyebrow: "Stage 02",
    title: "What CMMC Level 1 actually is",
    blurb:
      "The 15 safeguarding requirements, the binary pass/fail model, and how FAR, NIST, and CMMC actually fit together.",
    slugs: [
      "cmmc-level-1-17-practices",
      "cmmc-level-1-binary-no-score",
      "far-vs-nist-vs-cmmc",
    ],
  },
  {
    id: "file",
    eyebrow: "Stage 03",
    title: "How to file it and stay bid-ready",
    blurb:
      "Run the self-assessment, post your SPRS score, and respond to a prime asking for proof — without paying a 3PAO.",
    slugs: [
      "cmmc-level-1-checklist",
      "sprs-score-explained",
      "cmmc-level-1-cost",
      "prime-asking-for-sprs-score-level-1-response",
    ],
  },
];

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
  const postBySlug = new Map(posts.map((p) => [p.meta.slug, p]));
  const featured = postBySlug.get("do-i-need-cmmc-decision-tree") ?? posts[0];

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "The Custodia Library",
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

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[#08201a] px-6 pb-24 pt-20 text-white md:pb-28 md:pt-28">
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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#0e2a23]/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#bdf2cf]" />
            The Custodia Library
          </div>
          <h1 className="font-serif text-[2.6rem] font-bold leading-[1.04] tracking-tight md:text-[4.5rem]">
            CMMC Level 1,
            <br className="hidden md:block" />{" "}
            <span className="italic text-[#a8cfc0]">in </span>
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text italic text-transparent">
              plain English
            </span>
            <span className="text-[#8dd2b1]">.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-[#a8cfc0] md:text-xl">
            The federal compliance internet was written by consultants who get
            paid by the page. This library is written by the engineers actually
            shipping the work &mdash; for the small defense contractors who
            just want to bid, win, and stay compliant.
          </p>

          {/* Stat strip — Rhetorich-style proof bar */}
          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-3 divide-x divide-white/[0.08] border border-white/[0.08] bg-[#0a261e]/40">
            {[
              { n: "15", l: "Safeguarding requirements" },
              { n: "1", l: "Annual SPRS affirmation" },
              { n: "7 days", l: "To a bid-ready package" },
            ].map((s) => (
              <div
                key={s.l}
                className="px-4 py-6 text-center md:px-6 md:py-7"
              >
                <dt className="font-serif text-3xl font-bold text-white md:text-4xl">
                  {s.n}
                </dt>
                <dd className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7aab98]">
                  {s.l}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- 3-step path explainer ---------- */}
      <section className="border-b border-[#cfe3d9] bg-[#f7f7f3] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                The whole path
              </div>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-5xl">
                Three questions. Three answers.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-relaxed text-[#5a7d70] md:block">
              You don&apos;t need a $20k 3PAO to start. You need to know
              whether CMMC L1 applies to you, what it asks for, and how to
              file the answer. Start anywhere.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden border border-[#cfe3d9] bg-[#cfe3d9] md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Do I need it?",
                d: "If your contract mentions FAR 52.204-21 or FCI, the answer is probably yes. The decision tree gets you to a definitive answer in two minutes.",
                cta: "Take the decision tree",
                href: "/blog/do-i-need-cmmc-decision-tree",
              },
              {
                n: "02",
                t: "What does it require?",
                d: "Fifteen basic safeguarding requirements. No score, no maturity model — pass or fail. Here is what each one actually asks of your business.",
                cta: "Read the 15 requirements",
                href: "/blog/cmmc-level-1-17-practices",
              },
              {
                n: "03",
                t: "How do I file?",
                d: "Self-assess, post your SPRS affirmation, hand a one-page summary to any prime asking. We&apos;ll show you the exact path — seven days, no consultants.",
                cta: "See the 7-day path",
                href: "/cmmc-level-1",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="flex flex-col bg-white p-7 md:p-8"
              >
                <div className="font-mono text-xs font-bold tracking-[0.2em] text-[#2f8f6d]">
                  {step.n}
                </div>
                <h3 className="mt-4 font-serif text-2xl font-bold text-[#10231d]">
                  {step.t}
                </h3>
                <p
                  className="mt-3 flex-1 text-[15px] leading-relaxed text-[#44695c]"
                  dangerouslySetInnerHTML={{ __html: step.d }}
                />
                <Link
                  href={step.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0e2a23] underline decoration-[#8dd2b1] decoration-2 underline-offset-[6px] hover:decoration-[#2f8f6d]"
                >
                  {step.cta}
                  <span aria-hidden>&rarr;</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Free DIY Handbook banner ---------- */}
      <section className="border-b border-[#cfe3d9] bg-white px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/cmmc-level-1/diy"
            className="group block overflow-hidden border border-[#cfe3d9] bg-[#08201a] text-white transition-colors hover:border-[#2f8f6d]"
          >
            <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
              <div className="p-10 md:p-14">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
                  New &middot; The free DIY handbook
                </div>
                <h2 className="mt-4 font-serif text-3xl font-bold leading-tight md:text-[44px]">
                  Do CMMC Level 1
                  {" "}
                  <span className="italic text-[#a8cfc0]">yourself</span>
                  <span className="text-[#8dd2b1]">.</span>{" "}
                  <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text italic text-transparent">
                    For free.
                  </span>
                </h2>
                <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#a8cfc0]">
                  Seven steps. Eight printable templates. The complete
                  end-to-end path &mdash; SSP, scoping worksheet, 8
                  policies, SPRS walkthrough. No email gate. No upsell.
                </p>
                <div className="mt-7 inline-flex items-center gap-2 border border-white/20 px-5 py-2.5 text-sm font-bold transition-colors group-hover:border-[#8dd2b1] group-hover:text-[#bdf2cf]">
                  Open the handbook <span aria-hidden>&rarr;</span>
                </div>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-white/[0.08] border-t border-white/[0.08] bg-[#0a261e] md:border-l md:border-t-0">
                {[
                  { n: "7", l: "Steps" },
                  { n: "8", l: "Templates" },
                  { n: "$0", l: "Cost" },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col items-center justify-center px-4 py-10">
                    <dt className="font-serif text-4xl font-bold text-white md:text-5xl">
                      {s.n}
                    </dt>
                    <dd className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7aab98]">
                      {s.l}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Link>
        </div>
      </section>

      {/* ---------- Featured post ---------- */}
      {featured ? (
        <section className="border-b border-[#e6efe9] bg-white px-6 py-16 md:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
              <span className="inline-block h-px w-8 bg-[#2f8f6d]" />
              Editor&apos;s pick
            </div>
            <Link
              href={`/blog/${featured.meta.slug}`}
              className="group block border border-[#cfe3d9] bg-[#f7f7f3] transition-colors hover:border-[#2f8f6d]"
            >
              <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
                <div className="relative overflow-hidden border-b border-[#cfe3d9] bg-[#08201a] p-10 text-white md:border-b-0 md:border-r md:p-14">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.05]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(141,210,177,1) 1px, transparent 1px), linear-gradient(90deg, rgba(141,210,177,1) 1px, transparent 1px)",
                      backgroundSize: "44px 44px",
                    }}
                  />
                  <div className="relative">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdf2cf]">
                      {featured.meta.category}
                    </div>
                    <h3 className="mt-5 font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-[2.6rem]">
                      {featured.meta.title}
                    </h3>
                    <p className="mt-5 text-[15px] leading-relaxed text-[#a8cfc0]">
                      {featured.meta.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col justify-between p-10 md:p-14">
                  <div>
                    <div className="font-serif text-sm italic text-[#5a7d70]">
                      The most-asked question we get. We turned it into a
                      flowchart so you can stop guessing and get a yes/no in
                      two minutes — including the edge cases (subcontractors,
                      SBIR Phase I, COTS resellers).
                    </div>
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-[#cfe3d9] pt-5 text-xs text-[#7a9c90]">
                    <span>
                      By{" "}
                      <strong className="text-[#10231d]">
                        {featured.meta.author.name}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-2 font-bold text-[#0e2a23] group-hover:text-[#2f8f6d]">
                      Read the decision tree
                      <span aria-hidden>&rarr;</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      ) : null}

      {/* ---------- Library grid + sidebar ad ---------- */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1fr_300px] md:gap-16">
          {/* Main column — grouped by funnel stage */}
          <div>
            {STAGE_DEFS.map((stage) => {
              const stagePosts = stage.slugs
                .map((s) => postBySlug.get(s))
                .filter((p): p is BlogPost => Boolean(p));
              if (stagePosts.length === 0) return null;
              return (
                <section
                  key={stage.id}
                  className="mb-16 last:mb-0"
                  aria-labelledby={`stage-${stage.id}`}
                >
                  <div className="mb-8 border-b border-[#cfe3d9] pb-5">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                      {stage.eyebrow}
                    </div>
                    <h2
                      id={`stage-${stage.id}`}
                      className="mt-2 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-4xl"
                    >
                      {stage.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
                      {stage.blurb}
                    </p>
                  </div>

                  <ol className="space-y-6">
                    {stagePosts.map((p, i) => (
                      <li
                        key={p.meta.slug}
                        className="group relative flex flex-col gap-4 border-b border-[#e6efe9] pb-6 last:border-b-0 sm:flex-row sm:items-start sm:gap-8"
                      >
                        <div className="font-serif text-2xl font-bold text-[#2f8f6d]/40 sm:w-12 sm:flex-shrink-0 sm:text-3xl">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                            <span>{p.meta.category}</span>
                            <span aria-hidden className="opacity-30">
                              &middot;
                            </span>
                            <span className="text-[#7a9c90]">
                              {p.meta.readingMinutes} min read
                            </span>
                          </div>
                          <Link
                            href={`/blog/${p.meta.slug}`}
                            className="mt-2 block font-serif text-xl font-bold leading-snug text-[#10231d] decoration-[#8dd2b1] decoration-2 underline-offset-[5px] hover:underline md:text-2xl"
                          >
                            {p.meta.title}
                          </Link>
                          <p className="mt-2 text-[15px] leading-relaxed text-[#44695c]">
                            {p.meta.excerpt}
                          </p>
                          <div className="mt-3 text-xs text-[#7a9c90]">
                            {formatDate(p.meta.datePublished)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>

          {/* Right sidebar — platform ad + SPRS quiz */}
          <aside className="md:sticky md:top-6 md:self-start">
            <div className="space-y-6">
              {/* Primary platform ad */}
              <div className="relative overflow-hidden border border-[#0e2a23] bg-[#08201a] p-6 text-white">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(141,210,177,1) 1px, transparent 1px), linear-gradient(90deg, rgba(141,210,177,1) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />
                <div className="relative">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdf2cf]">
                    The Custodia Platform
                  </div>
                  <h3 className="mt-3 font-serif text-2xl font-bold leading-tight">
                    Guided CMMC Level 1, end-to-end.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                    Software that turns the 15 requirements into a checklist,
                    drafts your policies, and files your SPRS affirmation.
                  </p>
                  <ul className="mt-4 space-y-2 text-[13px] text-[#cce5da]">
                    {[
                      "All 15 controls, in plain English",
                      "Auto-generated SSP + policies",
                      "Annual SPRS affirmation built in",
                      "Free for the first 14 days",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-[5px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#8dd2b1]"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/sign-up"
                    className="mt-5 inline-flex w-full items-center justify-center gap-1.5 bg-[#bdf2cf] px-4 py-3 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                  >
                    Start 14-day free trial
                    <span aria-hidden>&rarr;</span>
                  </Link>
                  <p className="mt-3 text-center text-[11px] text-[#7aab98]">
                    No credit card &middot; $149/mo after trial
                  </p>
                </div>
              </div>

              {/* Secondary lead magnet */}
              <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-6">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#2f8f6d]">
                  Free tool
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold leading-snug text-[#10231d]">
                  Find your SPRS score in 4 minutes.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#44695c]">
                  No signup. No card. A real estimate against all 15 controls.
                </p>
                <Link
                  href="/sprs-check"
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 border border-[#0e2a23] px-4 py-2.5 text-sm font-bold text-[#0e2a23] transition-colors hover:bg-[#0e2a23] hover:text-white"
                >
                  Take the SPRS quiz
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>

              {/* Library nav */}
              <div className="border-t border-[#cfe3d9] pt-6">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#2f8f6d]">
                  Jump to
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {STAGE_DEFS.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#stage-${s.id}`}
                        className="flex items-baseline gap-3 text-[#1d3a30] hover:text-[#2f8f6d]"
                      >
                        <span className="font-mono text-[10px] text-[#7a9c90]">
                          0{i + 1}
                        </span>
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </BlogShell>
  );
}
