import type { Metadata } from "next";
import Link from "next/link";
import { CHARLIE_BIO } from "@/lib/ai/charlie";

export const metadata: Metadata = {
  title: "Custodia | TurboTax for CMMC Level 1",
  description:
    "Federal compliance for small contractors, in plain English. Charlie — your AI compliance officer — walks you through CMMC Level 1 in 7 days. $249/month, flat. 14-day free trial.",
};

const FEATURES = [
  {
    title: "Charlie, your virtual Compliance Officer",
    body: "Plain-English interview through all 17 FAR 52.204-21 practices. No acronym soup. Charlie asks about your business — then tells you exactly what evidence you need.",
  },
  {
    title: "Evidence, automatically",
    body: "Connect Microsoft 365 or Google Workspace and Charlie pulls MFA, password, and access-control evidence on its own. Or upload our CSV templates the old-fashioned way.",
  },
  {
    title: "Signed, hash-anchored artifact pack",
    body: "One click and you have a SPRS-ready ZIP with the annual self-assessment, your policies, and per-control evidence — every artifact HMAC-signed and verifiable.",
  },
  {
    title: "Continuous monitoring, 24/7",
    body: "When MFA gets disabled at 2am or a laptop retires without a wipe log, Charlie raises a flag before an assessor or a prime ever does.",
  },
  {
    title: "Audit Support, included",
    body: "A prime asks for backup. A DoD assessor knocks. Your Custodia officer prepares the evidence pack and walks the conversation with you. No extra invoice.",
  },
  {
    title: "Bid Radar, on the side",
    body: "Three curated SAM.gov opportunities a week, scored against your business. Charlie tells you GO / MAYBE / SKIP — so you stop drowning in dead-end bids.",
  },
];

const FAQS = [
  {
    q: "Who is Custodia for?",
    a: "Small U.S. defense-tech, professional-services, or product companies (1–50 people) that hold (or want to hold) a federal contract. If FAR 52.204-21 applies to you, Custodia applies to you.",
  },
  {
    q: "What's CMMC Level 1?",
    a: "It's the basic cybersecurity hygiene standard the U.S. Department of Defense requires of any company handling Federal Contract Information (FCI). Seventeen practices in plain English. You self-assess and submit a score to SPRS once a year.",
  },
  {
    q: "How is this different from a $200/hour consultant?",
    a: "A consultant gives you a Word doc and a bill. Custodia gives you a software platform that does the work, a signed artifact pack you can hand to a prime tomorrow, and continuous monitoring all year — for a flat $249/month. When you actually need a human, our Carnegie Mellon-trained officers are included.",
  },
  {
    q: "Does Custodia handle CMMC Level 2 or DFARS 7012?",
    a: "Not in the $249 plan — those are separate, officer-led engagements we sell to companies actually handling Controlled Unclassified Information (CUI). Most of our customers do not need L2; if you do, Charlie will tell you and we can scope it.",
  },
  {
    q: "What's the trial?",
    a: "14 days, full platform access, no credit card surprises. If you take the free SPRS quiz first, you'll know before signing up whether Custodia can help you.",
  },
  {
    q: "What's the money-back guarantee?",
    a: "If, within the first 30 days of a paid subscription, Custodia isn't the right fit — for any reason — write us and we refund the full month. No phone interrogation.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="font-serif text-xl font-bold text-slate-900">
            Custodia
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 sm:flex">
            <Link href="/meet-charlie" className="hover:text-slate-900">Meet Charlie</Link>
            <Link href="/audit-support" className="hover:text-slate-900">Audit support</Link>
            <Link href="/cmmc/templates" className="hover:text-slate-900">Templates</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link
              href="/sign-in"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            TurboTax for CMMC Level 1
          </div>
          <h1 className="mx-auto mb-4 max-w-3xl font-serif text-4xl leading-tight text-slate-900 sm:text-5xl">
            Federal compliance, in plain English.
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-700">
            Charlie — your virtual Compliance Officer — walks you through
            CMMC Level 1 in <strong className="text-slate-900">7 days</strong>.
            One flat price. No tier upsells. No 80-page consultant deck.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sprs-check"
              className="rounded-xl border-2 border-slate-900 bg-white px-6 py-3 text-base font-bold text-slate-900 hover:bg-slate-100"
            >
              Take the free SPRS quiz
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-slate-900 px-6 py-3 text-base font-bold text-white hover:bg-slate-800"
            >
              Start 14-day free trial
            </Link>
          </div>
          <div className="mt-6 text-sm text-slate-500">
            $249/mo &middot; Cancel any time &middot; 30-day money back
          </div>
        </div>
      </section>

      {/* Charlie intro */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-[260px_1fr] md:items-center">
          <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            <div className="text-center">
              <div className="text-6xl font-bold text-slate-900">C</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Charlie
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {CHARLIE_BIO.title}
            </div>
            <h2 className="mb-4 font-serif text-3xl text-slate-900">
              Hi, I&apos;m Charlie.
            </h2>
            <p className="mb-6 text-slate-700">&ldquo;{CHARLIE_BIO.intro}&rdquo;</p>
            <Link
              href="/meet-charlie"
              className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Meet Charlie &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-2 text-center font-serif text-3xl text-slate-900">
            Everything you need. One flat price.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-600">
            We don&apos;t want you choosing between &ldquo;the cheap plan&rdquo;
            and &ldquo;the one that actually gets you bid-ready.&rdquo; There
            is one plan. It does both.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-700">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPRS quiz CTA */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Free, no login required
          </div>
          <h2 className="mb-4 font-serif text-3xl text-slate-900">
            Where do you stand right now?
          </h2>
          <p className="mb-8 text-lg text-slate-700">
            Twelve plain-English questions. Two minutes. We&apos;ll give you a
            SPRS-style score primes recognize, plus a free PDF gap report
            you can save.
          </p>
          <Link
            href="/sprs-check"
            className="inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold text-white hover:bg-emerald-500"
          >
            Take the free SPRS quiz &rarr;
          </Link>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="border-b border-slate-200 bg-slate-900 py-16 text-white">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-4 font-serif text-3xl">
            $249/month. Everything in.
          </h2>
          <div className="mb-8 grid gap-2 text-slate-300">
            <div>Charlie + officer escalation included</div>
            <div>Microsoft 365 + Google Workspace connectors</div>
            <div>Manual evidence path for everything else</div>
            <div>Continuous monitoring + weekly Compliance Pulse email</div>
            <div>Public Trust Page (opt-in) primes can verify</div>
            <div>Bid Radar &mdash; 3 curated opportunities/week</div>
            <div>Audit support included</div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex rounded-xl bg-amber-400 px-6 py-3 text-base font-bold text-slate-900 hover:bg-amber-300"
          >
            See full pricing
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="mb-8 text-center font-serif text-3xl text-slate-900">
            Frequently asked
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-slate-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="mb-4 font-serif text-3xl text-slate-900">
            Federal bid-ready in seven days.
          </h2>
          <p className="mb-8 text-lg text-slate-700">
            Start your 14-day free trial. Charlie takes it from there.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sprs-check"
              className="rounded-xl border-2 border-slate-900 bg-white px-6 py-3 text-base font-bold text-slate-900 hover:bg-slate-100"
            >
              Take the free SPRS quiz
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-slate-900 px-6 py-3 text-base font-bold text-white hover:bg-slate-800"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-600">
          <div className="mb-4 flex flex-wrap gap-6">
            <Link href="/meet-charlie" className="hover:text-slate-900">Meet Charlie</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/audit-support" className="hover:text-slate-900">Audit support</Link>
            <Link href="/cmmc/templates" className="hover:text-slate-900">Templates</Link>
            <Link href="/sprs-check" className="hover:text-slate-900">Free SPRS quiz</Link>
            <a
              href="mailto:officers@custodia.us"
              className="hover:text-slate-900"
            >
              Contact
            </a>
          </div>
          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Custodia. CMMC Level 1
            self-assessment software for U.S. federal contractors. Built by
            Carnegie Mellon-trained information security engineers.
          </div>
        </div>
      </footer>
    </main>
  );
}
