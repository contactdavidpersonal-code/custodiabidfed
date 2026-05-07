import type { Metadata } from "next";
import Link from "next/link";
import CmmcCheckClient from "./CmmcCheckClient";

export const metadata: Metadata = {
  title: "CMMC Level 1 Check | Custodia",
  description:
    "Free 5-minute conversation with Charlie. Find out if your company needs CMMC Level 1, where the gaps are, and get a one-page printable report you can save or share. No signup. No credit card.",
  robots: { index: true, follow: true },
};

export default function CmmcCheckPage() {
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#fafaf7]">
      <header className="shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="font-serif text-lg font-bold tracking-tight text-[#10231d]"
          >
            Custodia
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/pricing" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/meet-charlie" className="hidden hover:text-slate-900 sm:block">
              Meet Charlie
            </Link>
            <Link
              href="/sign-up"
              className="hidden rounded-full bg-[#10231d] px-4 py-1.5 text-xs font-semibold tracking-wide text-white hover:bg-[#0a1813] sm:inline-block"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Free for federal awardees — no signup
          </div>
          <h1 className="font-serif text-2xl font-bold leading-[1.1] tracking-tight text-[#10231d] sm:text-3xl md:text-4xl">
            Do you actually need <span className="italic">CMMC Level 1?</span>
          </h1>
          <p className="mx-auto mt-2 hidden max-w-2xl text-sm leading-snug text-slate-700 sm:block sm:text-base">
            A 5-minute conversation with Charlie — Custodia&apos;s virtual
            Compliance Officer. Walk away with a one-page report you can save,
            print, or send to anyone.
          </p>
          <div className="mt-3 hidden items-center justify-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 sm:flex">
            <span>FAR 52.204-21</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>32 CFR § 170</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>CMMC v2.13</span>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-4 pb-3 sm:px-6 sm:pb-4">
        <CmmcCheckClient />
      </section>

      <footer className="shrink-0 border-t border-slate-200 bg-[#fafaf7]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 text-[11px] text-slate-500 sm:px-6">
          <span>© Custodia · bidfedcmmc.com</span>
          <span className="hidden sm:inline">
            $449/mo locked through end of fiscal year for CMMC Check arrivals.
          </span>
        </div>
      </footer>
    </main>
  );
}
