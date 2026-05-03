import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for /blog and /blog/[slug] — matches the dark-hero theme of
 * the marketing site (deep green #08201a, mint accents, Lora serif headings).
 *
 * Server component. No auth required; blog must be crawlable + cacheable.
 */
export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#10231d]">
      <header className="border-b border-white/[0.06] bg-[#08201a] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[#7aab98]">
          <Link href="/" className="transition-colors hover:text-white">
            &larr; Custodia
          </Link>
          <span className="hidden sm:inline">CMMC Level 1, in plain English</span>
        </div>
        <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/blog" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <span className="font-serif text-2xl font-bold tracking-tight text-white">
              Custodia<span className="text-[#8dd2b1]">.</span>
              <span className="ml-2 text-sm font-medium text-[#8dd2b1]">Blog</span>
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium text-[#cce5da]">
            <Link
              href="/sprs-check"
              className="hidden transition-colors hover:text-white sm:inline"
            >
              Free SPRS quiz
            </Link>
            <Link
              href="/pricing"
              className="hidden transition-colors hover:text-white sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/sign-up"
              className="bg-[#bdf2cf] px-4 py-2 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
            >
              Start 14-day trial
            </Link>
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <BlogTrialCTA />

      <footer className="border-t border-[#cfe3d9] bg-[#f7f7f3] px-6 py-12 text-sm text-[#5a7d70]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="font-serif text-lg font-bold text-[#10231d]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </div>
            <div className="mt-1 text-xs">
              TurboTax for CMMC Level 1. Pittsburgh, PA. Veteran-owned.
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/" className="hover:text-[#10231d]">Home</Link>
            <Link href="/blog" className="hover:text-[#10231d]">Blog</Link>
            <Link href="/pricing" className="hover:text-[#10231d]">Pricing</Link>
            <Link href="/sprs-check" className="hover:text-[#10231d]">SPRS quiz</Link>
            <Link href="/privacy" className="hover:text-[#10231d]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#10231d]">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Conversion block rendered at the bottom of every blog page — single, strong
 * CTA pointing at the free SPRS quiz (lead magnet) + trial signup.
 */
export function BlogTrialCTA() {
  return (
    <section className="bg-[#08201a] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          Stop reading. Start filing.
        </div>
        <h2 className="font-serif text-3xl font-bold leading-tight md:text-5xl">
          Find your SPRS score in 4 minutes. Then file it in 7 days.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#a8cfc0] md:text-lg">
          Take the free SPRS quiz to see exactly where you stand on the 17 FAR
          52.204-21 practices &mdash; no signup, no card. If you like what you
          see, the 14-day Custodia trial picks up where the quiz leaves off
          and walks you to a signed, bid-ready package.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sprs-check"
            className="inline-flex items-center gap-2 bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
          >
            Take the free SPRS quiz
            <span aria-hidden>&rarr;</span>
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 border border-[#2f8f6d]/60 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] transition-colors hover:border-[#8dd2b1]/80 hover:text-white"
          >
            Start 14-day free trial
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#7aab98]">
          14-day free trial &middot; No credit card required &middot; $449/mo flat
        </p>
      </div>
    </section>
  );
}

/**
 * Visual primitives reused across post bodies. Keeping them here so all four
 * pillar posts render with consistent typography and spacing.
 */

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="prose-custodia mx-auto max-w-3xl px-6 py-12 text-[17px] leading-[1.75] text-[#1d3a30] md:py-16">
      {children}
    </div>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-24 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-10 scroll-mt-24 font-serif text-xl font-bold text-[#10231d] md:text-2xl"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-5">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-5 space-y-2 pl-5 [&>li]:relative [&>li]:list-disc [&>li]:marker:text-[#2f8f6d]">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-5 space-y-2 pl-5 [&>li]:list-decimal [&>li]:marker:font-bold [&>li]:marker:text-[#2f8f6d]">
      {children}
    </ol>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "ok";
  title?: string;
  children: ReactNode;
}) {
  const palette =
    tone === "warn"
      ? "border-[#e8d4a1] bg-[#fff8e8] text-[#5d4f30]"
      : tone === "ok"
        ? "border-[#2f8f6d] bg-[#f7fcf9] text-[#1f5c47]"
        : "border-[#cfe3d9] bg-[#f7fcf9] text-[#1d3a30]";
  return (
    <aside className={`mt-8 border-l-4 px-5 py-4 ${palette}`}>
      {title ? (
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em]">
          {title}
        </div>
      ) : null}
      <div className="text-[15px] leading-relaxed">{children}</div>
    </aside>
  );
}

export function Quote({
  children,
  cite,
}: {
  children: ReactNode;
  cite?: string;
}) {
  return (
    <blockquote className="mt-8 border-l-4 border-[#2f8f6d] bg-[#f7fcf9] px-6 py-5 font-serif text-xl italic leading-snug text-[#10231d]">
      &ldquo;{children}&rdquo;
      {cite ? (
        <cite className="mt-2 block text-xs not-italic font-bold uppercase tracking-wider text-[#5a7d70]">
          &mdash; {cite}
        </cite>
      ) : null}
    </blockquote>
  );
}

export function TableSimple({
  head,
  rows,
}: {
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#0e2a23] text-[10px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
          <tr>
            {head.map((h) => (
              <th key={h} className="border border-[#0e2a23] px-3 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-[#f7fcf9]"}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-[#cfe3d9] px-3 py-2.5 align-top text-[#1d3a30]"
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TOC({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Table of contents"
      className="mt-8 border border-[#cfe3d9] bg-[#f7fcf9] px-6 py-5"
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
        On this page
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.id} className="flex gap-2">
            <span className="font-mono text-xs text-[#7a9c90]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${it.id}`}
              className="text-[#1f5c47] underline-offset-2 hover:underline"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
