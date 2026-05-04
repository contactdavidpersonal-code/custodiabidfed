import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <Link
            href="/"
            className="font-serif text-2xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
          >
            Custodia<span className="text-[#8dd2b1]">.</span>
          </Link>
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            14-day risk-free trial &middot; No credit card
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Get bid-ready for{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text pb-1 text-transparent">
              CMMC Level&nbsp;1
            </span>{" "}
            in days, not months.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#a8cfc0]">
            Try the full platform free for 14 days &mdash; no credit card, no
            commitment. If it doesn&apos;t earn its keep, you don&apos;t pay a cent.
            If it does, you stay bid-eligible year-round on autopilot.
          </p>

          <div className="mt-8 border-l-2 border-[#2f8f6d]/40 pl-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
              Why CMMC Level&nbsp;1 matters
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#cce5da]">
              FAR 52.204-21 is the floor for any federal contract touching FCI.
              No affirmation, no bid. Custodia delivers the SSP, evidence, and
              annual SPRS affirmation primes actually accept.
            </p>
          </div>

          <ul className="mt-8 space-y-2.5 text-sm text-[#cce5da]">
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">All 17 FAR 52.204-21 practices</span> walked in plain English by Charlie, your vCO</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Bid-ready package generated for you</span> &mdash; SSP, signed affirmation memo, evidence inventory</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Year-round monitoring</span> through your Microsoft 365 or Google Workspace tenant</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Evidence freshness alerts</span> &mdash; never get caught with stale artifacts at re-affirmation</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Annual SPRS re-affirmation handled</span> &mdash; we keep the cycle running on autopilot</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Officer-reviewed</span> when you&apos;re ready to bid &mdash; no DIY guesswork</span>
            </li>
          </ul>

          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-[#2f8f6d]/25 pt-6 text-xs">
            <div>
              <div className="font-bold uppercase tracking-[0.14em] text-[#7aab98]">DIY</div>
              <div className="mt-1 text-[#a8cfc0]">3&ndash;6 months, $5k+ in consulting, stale by year two</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.14em] text-[#7aab98]">Big-4 audit firm</div>
              <div className="mt-1 text-[#a8cfc0]">$25k+ engagement, no ongoing posture, no monitoring</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.14em] text-[#bdf2cf]">Custodia</div>
              <div className="mt-1 font-semibold text-white">Days to bid-ready, $449/mo, watched year-round</div>
            </div>
          </div>

          <p className="mt-10 text-sm text-[#7aab98]">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-[#bdf2cf] hover:text-white">
              Login &rarr;
            </Link>
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/assessments" />
        </div>
      </div>
    </main>
  );
}
