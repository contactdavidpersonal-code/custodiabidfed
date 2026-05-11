import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Unsubscribed — Custodia",
};

type Props = {
  searchParams: Promise<{ s?: string }>;
};

export default async function UnsubscribedPage({ searchParams }: Props) {
  const { s } = await searchParams;
  const ok = s === "ok";
  return (
    <div className="min-h-[70vh] bg-white text-[#10231d]">
      <main className="mx-auto max-w-2xl px-6 py-20">
        {ok ? (
          <>
            <h1 className="font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
              You&apos;re unsubscribed.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#1d3a30]">
              We won&apos;t send you any more Monday Bid Digest emails.
              If you ever change your mind, the door&apos;s open.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center bg-[#08201a] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23]"
            >
              Back to home
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
              That unsubscribe link didn&apos;t match anything.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#1d3a30]">
              You may already be unsubscribed. If you keep getting
              emails, reply to any of them and we&apos;ll remove you by
              hand.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
