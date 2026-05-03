"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * App-level error boundary. Catches unexpected throws from any route that
 * doesn't have its own error.tsx. Mobile-first layout: comfortable padding,
 * stacked CTAs, no horizontal overflow.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error boundary:", error);
  }, [error]);

  return (
    <main
      className="flex min-h-[100dvh] items-center bg-[#f7f7f3] px-4 py-12 text-[#10231d] md:px-6"
      style={{
        paddingTop: "calc(2rem + var(--safe-top))",
        paddingBottom: "calc(2rem + var(--safe-bottom))",
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
          Something broke
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold leading-tight md:text-3xl">
          We hit an unexpected error.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#3f5a51] md:text-base">
          Your data is safe. This was a transient issue on our side. Try the
          page again, or head back to your workspace.
        </p>
        {error?.digest ? (
          <p className="mt-4 font-mono text-[11px] text-[#7a5410]">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="bg-[#0e2a23] px-5 py-3 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Try again
          </button>
          <Link
            href="/assessments"
            className="border border-[#cfe3d9] bg-white px-5 py-3 text-center text-sm font-bold text-[#10231d] hover:bg-[#f1f6f3]"
          >
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
