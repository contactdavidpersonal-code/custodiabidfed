import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-xl">
          <Link
            href="/"
            className="font-serif text-xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
          >
            Custodia<span className="text-[#8dd2b1]">.</span>
          </Link>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            14-day risk-free trial &middot; No credit card
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            Get bid-ready for{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text pb-0.5 text-transparent">
              CMMC Level&nbsp;1
            </span>{" "}
            in days, not months.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
            Try the full platform free for 14 days &mdash; no credit card, no
            commitment. If it doesn&apos;t earn its keep, you don&apos;t pay a cent.
            Stay bid-eligible year-round on autopilot.
          </p>

          <div className="mt-4 border-l-2 border-[#2f8f6d]/40 pl-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
              Why CMMC Level&nbsp;1 matters
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#cce5da]">
              FAR 52.204-21 is the floor for any federal contract touching FCI.
              No affirmation, no bid.
            </p>
          </div>

          <ul className="mt-4 space-y-1.5 text-xs text-[#cce5da]">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">All 17 FAR 52.204-21 practices</span> walked by Charlie, your vCO</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Bid-ready package generated</span> &mdash; SSP, affirmation memo, evidence</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Year-round monitoring</span> via M365 or Google Workspace</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Annual SPRS re-affirmation</span> handled on autopilot</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              <span><span className="font-semibold text-white">Officer-reviewed</span> &mdash; no DIY guesswork</span>
            </li>
          </ul>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#2f8f6d]/25 pt-3 text-[10px]">
            <div>
              <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">DIY</div>
              <div className="mt-0.5 text-[#a8cfc0]">3&ndash;6 mo, $5k+, stale fast</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">Audit firm</div>
              <div className="mt-0.5 text-[#a8cfc0]">$25k+, no monitoring</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.12em] text-[#bdf2cf]">Custodia</div>
              <div className="mt-0.5 font-semibold text-white">Days, $449/mo, watched</div>
            </div>
          </div>

          <p className="mt-5 text-xs text-[#7aab98]">
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
