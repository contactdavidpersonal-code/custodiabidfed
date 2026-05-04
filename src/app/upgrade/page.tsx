import { CheckoutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UpgradePage() {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");

  // If the user already has active access (paid OR active trial), Clerk's `has`
  // returns true. We send them straight back into the workspace — no payment
  // collection until the trial ends and the plan flips to inactive.
  if (has({ plan: "user:cmmc_lv1_full_access" })) redirect("/assessments");

  // Falls through here when:
  //   - the 14-day trial has expired (Clerk revokes the plan), OR
  //   - the user never started the trial / it lapsed without payment.
  // We render our own pricing UI and use Clerk's CheckoutButton to trigger
  // the hosted checkout flow.
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#456c5f] transition-colors hover:text-[#10231d]"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 border border-[#bdf2cf] bg-[#eaf7ef] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#1d6a4a]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#1d6a4a]" />
            14 days free &middot; No credit card required
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-5xl">
            Start your 14-day free trial.
            <br className="hidden md:block" /> Get bid-ready without paying a cent.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#4a7164] md:text-lg">
            Spin up the full Custodia workspace today &mdash; CMMC Level&nbsp;1 build,
            evidence freshness alerts, and your virtual compliance officer on call.
            We don&apos;t ask for a card until day 14, and only if you stay.
          </p>
        </div>

        {/* Stats: why now */}
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              stat: "$830B+",
              label: "FY26 federal contract obligations open to small business",
            },
            {
              stat: "23%",
              label: "Statutory federal small-business contracting goal",
            },
            {
              stat: "Nov 10, 2025",
              label: "CMMC clauses now flow down on new DoD solicitations",
            },
            {
              stat: "0 bids",
              label: "If you can't affirm FAR 52.204-21 — no exceptions",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-[#cfe3d9] bg-white p-5"
            >
              <div className="font-serif text-2xl font-bold text-[#10231d]">{s.stat}</div>
              <div className="mt-1 text-xs leading-relaxed text-[#5a7f72]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing card — our design, Clerk button */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="border border-[#cfe3d9] bg-white p-7 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a06b1a]">
              Summer Federal Cash Incentive &middot; 100 seats
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif text-5xl font-bold text-[#10231d]">$449</span>
              <span className="text-base text-[#5a7f72]">/mo after trial</span>
              <span className="text-base text-[#7a9c90] line-through">$749</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-[#1d6a4a]">
              14 days free first &mdash; no card required to start.
            </div>

            <ul className="mt-6 space-y-2.5 text-sm text-[#2c4940]">
              {[
                "All 17 FAR 52.204-21 practices walked by Charlie, your vCO",
                "Bid-ready package: SSP, signed affirmation memo, evidence inventory",
                "Year-round monitoring via Microsoft 365 or Google Workspace",
                "Evidence freshness alerts so you never bid with stale artifacts",
                "Annual SPRS re-affirmation handled every October",
                "Officer-reviewed before you submit &mdash; no DIY guesswork",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&#10003;</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <CheckoutButton planId="cmmc_lv1_full_access" planPeriod="month">
                <button className="group flex w-full items-center justify-center gap-2 bg-[#0e2a23] px-6 py-4 text-base font-bold text-[#bdf2cf] shadow-[0_10px_30px_-10px_rgba(14,42,35,0.6)] transition-colors hover:bg-[#10342a]">
                  Start my 14-day free trial
                  <span aria-hidden className="text-lg transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </CheckoutButton>
              <p className="mt-3 text-center text-xs text-[#5a7f72]">
                No charge for 14 days &middot; Cancel anytime &middot; 14-day money-back guarantee from your first payment
              </p>
            </div>
          </div>

          {/* Why now / proof */}
          <div className="flex flex-col gap-4">
            <div className="border border-[#cfe3d9] bg-white p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                Why now is the moment
              </div>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#2c4940]">
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>CMMC clauses are flowing down on new DoD solicitations &mdash; primes are filtering subs without affirmations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>Set-asides for small business hit a record share of obligations &mdash; the pipeline is real but gated.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>Locked-in launch pricing ($449 vs $749 list) goes away after the next 100 seats.</span>
                </li>
              </ul>
            </div>
            <div className="border border-[#cfe3d9] bg-[#0e2a23] p-6 text-[#cce5da]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
                vs. doing it yourself
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">DIY</div>
                  <div className="mt-1">3&ndash;6 mo &middot; $5k+ &middot; stale fast</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">Audit firm</div>
                  <div className="mt-1">$25k+ &middot; no monitoring</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#bdf2cf]">Custodia</div>
                  <div className="mt-1 font-semibold text-white">Days &middot; $449/mo &middot; watched</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-[#5a7f72]">
          Questions before you start?{" "}
          <a
            href="mailto:support@custodia.dev"
            className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
          >
            support@custodia.dev
          </a>
          .
        </p>
      </main>
    </div>
  );
}
