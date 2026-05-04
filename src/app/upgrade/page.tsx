import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrialCheckoutButton } from "./TrialCheckoutButton";

const PLAN_SLUG = "cmmc_lv1_full_access";

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-7 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="font-serif text-xs font-bold text-[#10231d]">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[#456c5f] transition-colors hover:text-[#10231d]"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-5">
        <div className="mb-4 text-center">
          <div className="mb-2 inline-flex items-center gap-2 border border-[#bdf2cf] bg-[#eaf7ef] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1d6a4a]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#1d6a4a]" />
            14 days free &middot; No credit card required
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-4xl">
            Start your 14-day free trial. Get bid-ready without paying a cent.
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-snug text-[#4a7164]">
            Full Custodia workspace &mdash; CMMC Level&nbsp;1 build, freshness alerts, vCO on call. No card until day 14, only if you stay.
          </p>
        </div>

        {/* Stats: why now */}
        <div className="mb-4 grid gap-2 grid-cols-2 lg:grid-cols-4">
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
              label: "CMMC clauses flow down on new DoD solicitations",
            },
            {
              stat: "0 bids",
              label: "Without FAR 52.204-21 affirmation — no exceptions",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-[#cfe3d9] bg-white px-3 py-2"
            >
              <div className="font-serif text-lg font-bold leading-tight text-[#10231d]">{s.stat}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[#5a7f72]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing card — our design, Clerk button */}
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <div className="border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a06b1a]">
              Summer Federal Cash Incentive &middot; 100 seats
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-[#10231d]">$449</span>
              <span className="text-xs text-[#5a7f72]">/mo after trial</span>
              <span className="text-xs text-[#7a9c90] line-through">$749</span>
              <span className="ml-auto text-[11px] font-semibold text-[#1d6a4a]">14 days free, no card</span>
            </div>

            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-[#2c4940] sm:grid-cols-2">
              {[
                "All 17 FAR 52.204-21 practices walked by Charlie",
                "Bid-ready package: SSP, affirmation, evidence",
                "Year-round M365 / Google Workspace monitoring",
                "Evidence freshness alerts",
                "Annual SPRS re-affirmation handled",
                "Officer-reviewed before you submit",
                "BONUS: Daily Discover — 15 fresh SAM.gov bids/day matched to your NAICS",
                "BONUS: Monday Bid Digest emailed weekly",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&#10003;</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <TrialCheckoutButton
                planId={PLAN_SLUG}
                className="group flex w-full items-center justify-center gap-2 bg-[#0e2a23] px-5 py-3 text-sm font-bold text-[#bdf2cf] shadow-[0_10px_30px_-10px_rgba(14,42,35,0.6)] transition-colors hover:bg-[#10342a]"
              >
                Start my 14-day free trial
                <span aria-hidden className="text-base transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </TrialCheckoutButton>
              <p className="mt-1.5 text-center text-[11px] text-[#5a7f72]">
                No charge for 14 days &middot; Cancel anytime &middot; Money-back guarantee from first payment
              </p>
            </div>
          </div>

          {/* Why now / proof */}
          <div className="flex flex-col gap-3">
            <div className="border border-[#cfe3d9] bg-white p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                Why now is the moment
              </div>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-[#2c4940]">
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>CMMC clauses flow down on new DoD solicitations &mdash; primes filter subs without affirmations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>Small-business set-asides at a record share &mdash; pipeline is real but gated.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&middot;</span>
                  <span>Launch pricing ($449 vs $749) ends after the next 100 seats.</span>
                </li>
              </ul>
            </div>
            <div className="border border-[#cfe3d9] bg-[#0e2a23] p-4 text-[#cce5da]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
                vs. doing it yourself
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">DIY</div>
                  <div className="mt-0.5">3&ndash;6 mo &middot; $5k+ &middot; stale fast</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#7aab98]">Audit firm</div>
                  <div className="mt-0.5">$25k+ &middot; no monitoring</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-[0.12em] text-[#bdf2cf]">Custodia</div>
                  <div className="mt-0.5 font-semibold text-white">Days &middot; $449/mo &middot; watched</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#5a7f72]">
          Questions before you start?{" "}
          <a
            href="mailto:support@custodia.dev"
            className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
          >
            support@custodia.dev
          </a>
        </p>
      </main>
    </div>
  );
}
