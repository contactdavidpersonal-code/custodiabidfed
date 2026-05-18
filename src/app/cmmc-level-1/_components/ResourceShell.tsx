import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "./PrintButton";

/**
 * Shared chrome for every printable /cmmc-level-1/<resource> page.
 *
 * Provides:
 *  - Top nav (screen only) with Print button
 *  - @media print CSS that hides chrome and tightens margins
 *  - Bottom soft platform CTA (screen only)
 *  - Branded footer
 *
 * Server component. Child pages pass in their printable content.
 */
export function ResourceShell({
  title,
  printTitle = "Print / Save as PDF",
  children,
}: {
  title: string;
  printTitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#e9efea] text-[#10231d]">
      <style>{`
        @media print {
          @page { size: Letter; margin: 0.55in 0.5in; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { box-shadow: none !important; border: 0 !important; padding: 0 !important; background: white !important; }
          .print-page-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
          a { color: #10231d !important; text-decoration: none !important; }
        }
      `}</style>

      {/* Top bar — screen only */}
      <header className="no-print border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/custodia-logo.png"
              alt="Custodia"
              className="h-8 w-auto"
            />
            <span className="font-serif text-lg font-bold tracking-tight text-[#10231d]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/cmmc-level-1/diy"
              className="hidden text-sm font-medium text-[#44695c] hover:text-[#10231d] sm:inline"
            >
              &larr; The DIY handbook
            </Link>
            <PrintButton>{printTitle}</PrintButton>
          </div>
        </div>
      </header>

      <main className="px-4 py-10 md:px-6 md:py-16">{children}</main>

      {/* Off-print soft CTA */}
      <section className="no-print border-t border-[#cfe3d9] bg-[#08201a] px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
            Built by Custodia
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold leading-tight md:text-4xl">
            We give this away because we sell the
            <span className="italic text-[#8dd2b1]"> easy version</span>{" "}
            for $249/mo.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#a8cfc0]">
            This {title.toLowerCase()} is genuinely complete and yours to
            keep. If you&apos;d rather have the platform fill it in,
            collect the evidence, send the renewal reminders, and post
            your SPRS score for you &mdash; that&apos;s what we built.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-sm font-bold tracking-tight text-[#0c2219] transition-colors hover:bg-[#8dd2b1]"
            >
              Start the 14-day free trial &rarr;
            </Link>
            <Link
              href="/cmmc-level-1/diy"
              className="inline-flex items-center gap-2 border border-white/20 bg-transparent px-6 py-3 text-sm font-bold tracking-tight text-white transition-colors hover:border-[#8dd2b1] hover:text-[#bdf2cf]"
            >
              Keep going DIY &rarr;
            </Link>
          </div>
        </div>
      </section>

      <footer className="no-print border-t border-[#cfe3d9] bg-[#e9efea] px-6 py-12 text-sm text-[#5a7d70]">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="font-serif text-lg font-bold text-[#10231d]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </div>
            <div className="mt-1 text-xs">
              Guided CMMC Level 1 compliance. Pittsburgh, PA.
              Veteran-owned.
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/cmmc-level-1/diy" className="hover:text-[#10231d]">
              DIY handbook
            </Link>
            <Link href="/cmmc-level-1" className="hover:text-[#10231d]">
              CMMC L1 guide
            </Link>
            <Link href="/blog" className="hover:text-[#10231d]">
              Blog
            </Link>
            <Link href="/sprs-check" className="hover:text-[#10231d]">
              SPRS quiz
            </Link>
            <Link href="/upgrade" className="hover:text-[#10231d]">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
