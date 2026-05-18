import type { Metadata } from "next";
import Link from "next/link";
import CmmcCheckClient from "./CmmcCheckClient";

export const metadata: Metadata = {
  title: "Do you need CMMC (Cybersecurity Maturity Model Certification) Level 1? | Custodia",
  description:
    "Five-minute conversation with Charlie. Find out whether your federal contract requires Cybersecurity Maturity Model Certification (CMMC) Level 1 — the basic federal cyber standard — and exactly where you stand.",
  robots: { index: true, follow: true },
};

export default function CmmcCheckPage() {
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#0d2e25] text-white">
      <header className="shrink-0 border-b border-white/10 bg-[#0a2620]/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="font-serif text-lg font-bold tracking-tight text-white"
          >
            Custodia
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/upgrade" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/meet-charlie" className="hidden hover:text-white sm:block">
              Meet Charlie
            </Link>
            <Link
              href="/sign-up"
              className="hidden bg-[#c4f0b8] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0a2620] transition-colors hover:bg-white sm:inline-block"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto w-full max-w-6xl shrink-0 px-4 pt-5 pb-3 sm:px-6 sm:pt-7 sm:pb-4">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_rgba(196,240,184,0.10),_transparent_70%)]"
        />
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 border border-[#c4f0b8]/40 bg-[#0a2620] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c4f0b8]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c4f0b8]" />
            Free · Five minutes · No signup
          </div>
          <h1 className="font-serif text-2xl leading-[1.05] tracking-tight text-white sm:text-3xl md:text-4xl">
            Do you need{" "}
            <span className="text-[#c4f0b8]">
              Cybersecurity Maturity Model Certification (CMMC) Level&nbsp;1
            </span>{" "}
            for your federal contract?
          </h1>
          <p className="mx-auto mt-3 hidden max-w-2xl text-sm leading-snug text-white/70 sm:block sm:text-base">
            Five-minute conversation with Charlie. He&apos;ll confirm whether
            CMMC Level&nbsp;1 (the basic federal cyber standard) applies to
            you, where the gaps are, and what to fix before your next bid or
            annual affirmation.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-4 pb-3 sm:px-6 sm:pb-4">
        <CmmcCheckClient />
      </section>

      <footer className="shrink-0 border-t border-white/10 bg-[#0a2620]/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 text-[11px] text-white/40 sm:px-6">
          <span>© Custodia · bidfedcmmc.com</span>
          <span className="hidden sm:inline">
            $249/mo Self Service (or $2,496/yr on annual — two months free).
          </span>
        </div>
      </footer>
    </main>
  );
}
