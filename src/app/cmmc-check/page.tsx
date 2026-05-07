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
    <main className="min-h-screen bg-[#fafaf7]">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Free for federal awardees — no signup
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] sm:text-5xl md:text-6xl">
            Do you actually need <span className="italic">CMMC Level 1?</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-700 sm:text-xl">
            A 5-minute conversation with Charlie — Custodia&apos;s virtual
            Compliance Officer — that tells you whether your contract triggers
            CMMC, where the gaps are, and what to do next. You walk away with a
            one-page report you can save, print, or send to anyone.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs uppercase tracking-widest text-slate-500">
            <span>FAR 52.204-21</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>32 CFR § 170</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>CMMC v2.13</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <CmmcCheckClient />
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6">
          <Pillar
            title="Isolated by design"
            body="This conversation runs on its own surface, with no access to any customer data or product code. Charlie only knows what you tell him here."
          />
          <Pillar
            title="Plain English, sourced"
            body="Every claim Charlie makes traces back to FAR 52.204-21, 32 CFR § 170, or the CMMC Assessment Guide v2.13. No vendor jargon."
          />
          <Pillar
            title="Yours to keep"
            body="The one-page report is generated server-side from your answers. Bookmark it, print it, attach it to a contracting officer email — it&apos;s yours."
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#fafaf7]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© Custodia · bidfedcmmc.com</span>
          <span>
            Current rate ($449/mo) locked through end of fiscal year for CMMC
            Check arrivals.
          </span>
        </div>
      </footer>
    </main>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800">
        {title}
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}
