"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary for /opportunities. Keeps the surrounding chrome
 * (header, nav) intact and renders an actionable empty state instead of the
 * default Next.js 500 page when the server component render throws.
 */
export default function OpportunitiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[opportunities] route error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Step 7 of 7 &middot; Find &amp; submit bids
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold">
              We hit a snag loading your pipeline.
            </h1>
          </div>
          <Link
            href="/assessments"
            className=" border border-[#cfe3d9] bg-white px-3 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Workspace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className=" border border-[#a06b1a] bg-[#fff7e8] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
            Temporary error
          </p>
          <h2 className="mt-1 font-serif text-lg font-bold text-[#5a3d0a]">
            We couldn&apos;t load opportunities right now.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5a3d0a]">
            This is usually a transient SAM.gov or database hiccup. Your data
            is safe. Try refreshing in a moment, or head back to your workspace
            to keep working on your assessment.
          </p>
          {error?.digest ? (
            <p className="mt-3 font-mono text-[11px] text-[#7a5410]">
              Reference: {error.digest}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className=" bg-[#0e2a23] px-4 py-2 text-sm font-bold text-[#bdf2cf] hover:bg-[#10342a]"
            >
              Try again
            </button>
            <Link
              href="/assessments"
              className=" border border-[#cfe3d9] bg-white px-4 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
            >
              ← Back to workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
