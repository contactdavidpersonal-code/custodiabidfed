import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Custodia",
  description:
    "Self Service $149/mo (was $197) — Charlie + evidence + signed artifact pack + monitoring + Bid Radar. Add Custodia Officer for $297/mo for a credentialed human on call. 14-day free trial. No credit card.",
};

const SELF_SERVICE_INCLUDED = [
  "Charlie — your virtual Compliance Officer, 24/7",
  "Guided CMMC Level 1 interview (the 15 FAR safeguarding requirements)",
  "Evidence collection — Microsoft 365, Google Workspace, manual upload",
  "Signed, hash-anchored annual artifact pack (SPRS-ready)",
  "Continuous monitoring with green/yellow/red alerts",
  "Weekly Compliance Pulse email",
  "Public Trust Page (opt-in) primes can use to verify you",
  "Daily Discover — 15 CMMC L1-fit SAM.gov opportunities matched to your NAICS",
  "Monday Bid Digest — newest contracts emailed to you",
];

const OFFICER_INCLUDED = [
  "Everything in Self Service",
  "Unlimited tickets to a credentialed Custodia Compliance Officer",
  "Written replies threaded back into the platform — no inbox-hopping",
  "Officer-led audit support — same-day prep + evidence pack",
  "Officer review before you submit or affirm",
  "Priority escalation when Charlie flags something complex",
  "Office hours with your assigned officer",
];

const EXCLUDED = [
  "CMMC Level 2 / DFARS 7012 / FedRAMP (scoped consulting engagement)",
  "ITAR / Export Control program build-out",
  "Onsite assessor travel (virtual is included; onsite at cost)",
  "Legal representation (we prep the record; you pick counsel)",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
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

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-900">
          Federal Compliance Grant &middot; Locked through Sept 30
        </div>

        <h1 className="mb-2 font-serif text-4xl text-slate-900">
          Pick the version that fits how you work.
        </h1>
        <p className="mb-10 max-w-3xl text-lg text-slate-700">
          One platform, two ways to run it. Self Service is the whole CMMC
          Level 1 stack with Charlie doing the heavy lifting. Add Custodia
          Officer when you want a credentialed human on call &mdash; for the
          awkward 5% Charlie flags, audit prep, and continued federal work.
        </p>

        <div className="mb-12 grid gap-6 md:grid-cols-2">
          {/* Self Service */}
          <section className=" border-2 border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
              Self Service
            </div>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold text-slate-900">$149</span>
              <span className="text-lg text-slate-500">/mo</span>
              <span className="ml-1 text-sm text-rose-700 line-through decoration-rose-400">
                was $197
              </span>
            </div>
            <div className="mb-1 text-xs text-slate-500">
              Or $139/mo billed annually ($1,668/yr).
            </div>
            <div className="mb-4 text-xs font-semibold text-amber-900">
              Federal Compliance Grant &mdash; locked through FY end (Sept 30).
            </div>
            <Link
              href="/sign-up?plan=bidfedcmmc_self_service_"
              className="mb-3 block w-full  bg-amber-400 px-4 py-3 text-center text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              Start 14-day free trial
            </Link>
            <p className="mb-5 text-xs text-slate-500">
              No credit card required. Less than one micro-purchase
              contract&rsquo;s profit pays for a whole year of compliance.
            </p>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-700">
              What you get
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {SELF_SERVICE_INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Self Service + Officer */}
          <section className=" border-2 border-slate-900 bg-slate-900 p-6 text-white shadow-lg">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
              <span>Self Service + Custodia Officer</span>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                Most popular
              </span>
            </div>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold">$297</span>
              <span className="text-lg text-slate-300">/mo</span>
            </div>
            <div className="mb-1 text-xs text-slate-400">
              Or $289/mo billed annually ($3,468/yr).
            </div>
            <div className="mb-4 text-xs font-semibold text-amber-200">
              A credentialed human on call for the awkward 5%.
            </div>
            <Link
              href="/sign-up?plan=bidfedcmmc_self_service_custodia_officer_"
              className="mb-3 block w-full  bg-amber-400 px-4 py-3 text-center text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              Start 14-day free trial
            </Link>
            <p className="mb-5 text-xs text-slate-300">
              No credit card required. Cancel anytime. Annual billing
              available.
            </p>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-200">
              What you get
            </h3>
            <ul className="space-y-2 text-sm text-slate-100">
              {OFFICER_INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mb-12  border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-xl text-slate-900">
            What&apos;s NOT included on either plan
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Both plans are scoped to CMMC Level 1 and the FAR 52.204-21
            practices. The following are separate, scoped engagements with a
            credentialed Custodia officer &mdash; email{" "}
            <a
              href="mailto:officers@custodia.us?subject=Security%20consulting%20beyond%20CMMC%20L1"
              className="font-semibold text-emerald-700 hover:underline"
            >
              officers@custodia.us
            </a>
            :
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
            The Custodia CMMC Level 1 Success Guarantee
          </h3>
          <p className="text-sm">
            We are a cybersecurity firm first &mdash; not just a web app. If
            your CMMC Level 1 package isn&apos;t defensible to FAR 52.204-21
            standard, we rebuild it with you, on our time, until it is. On
            the Officer plan a credentialed Custodia Compliance Officer owns
            the rebuild. The bidding is yours. The posture is ours.
          </p>
        </div>
      </div>
    </main>
  );
}
