import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Subscription confirmed — Custodia",
};

type Props = {
  searchParams: Promise<{ s?: string }>;
};

export default async function ConfirmedPage({ searchParams }: Props) {
  const { s } = await searchParams;
  const ok = s === "ok";

  return (
    <div className="min-h-[70vh] bg-white text-[#10231d]">
      <main className="mx-auto max-w-2xl px-6 py-20">
        {ok ? (
          <>
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              You&apos;re in
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
              Welcome to the Monday Bid Digest.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#1d3a30]">
              The first digest will land in your inbox the next Monday at
              7am ET. While you wait, here&apos;s the highest-leverage
              thing you can do in the next 5 minutes:
            </p>
            <div className="mt-6 border border-[#cfe3d9] bg-[#f7fcf9] p-6">
              <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                Recommended next step
              </div>
              <h2 className="mt-2 font-serif text-xl font-bold text-[#10231d]">
                Take the free CMMC check
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1d3a30]">
                Five questions. No signup. Tells you which CMMC level
                actually applies to your contracts, and what your next
                step is.
              </p>
              <Link
                href="/cmmc-check"
                className="mt-4 inline-flex items-center bg-[#08201a] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23]"
              >
                Start the CMMC check &rarr;
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a07c2e]">
              Hmm
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
              That link looks expired or already used.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#1d3a30]">
              No problem &mdash; resubscribe in 30 seconds and we&apos;ll
              send a fresh confirmation link.
            </p>
            <Link
              href="/bid-digest"
              className="mt-6 inline-flex items-center bg-[#08201a] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23]"
            >
              Back to subscribe page &rarr;
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
