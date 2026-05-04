import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Custodia",
  description:
    "$449/month. Flat. Everything included — Charlie, evidence collection, signed artifact pack, audit support, continuous monitoring, Bid Radar. 14-day free trial. No credit card required.",
};

const INCLUDED = [
  "Charlie — your virtual Compliance Officer, 24/7",
  "Guided CMMC Level 1 interview (the 17 FAR practices)",
  "Evidence collection — Microsoft 365, Google Workspace, manual upload",
  "Signed, hash-anchored annual artifact pack (SPRS-ready)",
  "Continuous monitoring with green/yellow/red alerts",
  "Audit Support — officer prep + same-day evidence pack",
  "Weekly Compliance Pulse email (the dashboard, in your inbox)",
  "Public Trust Page (opt-in) primes can use to verify you",
  "Daily Discover — 15 CMMC Level 1-fit SAM.gov opportunities matched to your NAICS, refreshed every day",
  "Monday Bid Digest — the week's newest contracts emailed to you (toggle on/off in-app)",
  "Carnegie Mellon-trained human officer escalation when you need it",
];

const EXCLUDED = [
  "CMMC Level 2 / DFARS 7012 / FedRAMP (officer-led engagements)",
  "ITAR / Export Control program build-out",
  "Onsite assessor travel (virtual is included; onsite at cost)",
  "Legal representation (we prep the record; you pick counsel)",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back to Custodia
          </Link>
          <Link
            href="/sprs-check"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Take the free SPRS quiz first &rarr;
          </Link>
        </div>

        <h1 className="mb-2 font-serif text-4xl text-slate-900">
          One price. Everything in.
        </h1>
        <p className="mb-10 text-lg text-slate-700">
          We don&apos;t want you choosing between &ldquo;the cheap plan
          that doesn&apos;t actually get you bid-ready&rdquo; and &ldquo;the
          one that does.&rdquo; There is one plan. It does both.
        </p>

        <div className="mb-12 grid gap-6 md:grid-cols-[1fr_360px] md:items-start">
          <div className=" border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-serif text-2xl text-slate-900">
              What you get
            </h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className=" border-2 border-slate-900 bg-slate-900 p-6 text-white shadow-lg">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
              Custodia
            </div>
            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-5xl font-bold">$449</span>
              <span className="text-lg text-slate-300">/month</span>
            </div>
            <div className="mb-6 text-xs text-slate-400">
              Annual billing available. Cancel any time.
            </div>
            <Link
              href="/sign-up"
              className="mb-3 block w-full  bg-amber-400 px-4 py-3 text-center text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              Start 14-day free trial
            </Link>
            <Link
              href="/sprs-check"
              className="mb-6 block w-full  border border-slate-700 bg-transparent px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              Take the free SPRS quiz
            </Link>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>&middot; No credit card required to start</li>
              <li>&middot; Federal bid-ready in 7 days, typical</li>
              <li>&middot; 14-day money-back guarantee</li>
              <li>&middot; One price for the life of your subscription</li>
            </ul>
          </aside>
        </div>

        <div className="mb-12  border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-xl text-slate-900">
            What&apos;s NOT included
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            We are deliberately scoped to CMMC Level 1 and the FAR
            52.204-21 practices. The following are separate engagements:
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {EXCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className=" border border-slate-200 bg-emerald-50 p-6 text-slate-800 shadow-sm">
          <h3 className="mb-2 font-serif text-lg text-slate-900">
            The 14-day money-back guarantee
          </h3>
          <p className="text-sm">
            If, within the first 14 days of a paid subscription, you decide
            Custodia isn&apos;t the right fit — for any reason — write us at
            support@custodia.security and we&apos;ll refund the full month.
            No interrogation, no &ldquo;cancellation specialist&rdquo; on the
            phone.
          </p>
        </div>
      </div>
    </main>
  );
}
