"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

const PRACTICES = [
  { id: "AC.L1-3.1.1", domain: "AC", short: "Authorized Access Control" },
  { id: "AC.L1-3.1.2", domain: "AC", short: "Transaction & Function Control" },
  { id: "AC.L1-3.1.20", domain: "AC", short: "External Connections" },
  { id: "AC.L1-3.1.22", domain: "AC", short: "Control Public Information" },
  { id: "IA.L1-3.5.1", domain: "IA", short: "Identify Users & Devices" },
  { id: "IA.L1-3.5.2", domain: "IA", short: "Authenticate Users & Devices" },
  { id: "MP.L1-3.8.3", domain: "MP", short: "Sanitize Media Before Disposal" },
  { id: "PE.L1-3.10.1", domain: "PE", short: "Limit Physical Access" },
  { id: "PE.L1-3.10.3", domain: "PE", short: "Escort & Monitor Visitors" },
  { id: "PE.L1-3.10.4", domain: "PE", short: "Physical Access Logs" },
  { id: "PE.L1-3.10.5", domain: "PE", short: "Manage Physical Access Devices" },
  { id: "SC.L1-3.13.1", domain: "SC", short: "Monitor Communications at Boundaries" },
  { id: "SC.L1-3.13.5", domain: "SC", short: "Public-System Subnetworks" },
  { id: "SI.L1-3.14.1", domain: "SI", short: "Identify & Correct System Flaws" },
  { id: "SI.L1-3.14.2", domain: "SI", short: "Malicious Code Protection" },
  { id: "SI.L1-3.14.4", domain: "SI", short: "Update Anti-Malware" },
  { id: "SI.L1-3.14.5", domain: "SI", short: "Periodic & Real-Time Scans" },
];

// What you get the moment you start the 5-day risk-free trial.
// Stacked Hormozi-style: each line shows the standalone value, then anchored to the bundle.
const VALUE_STACK = [
  { name: "AI-guided CMMC Level 1 Build", desc: "All 17 FAR 52.204-21 practices walked in plain English &mdash; no jargon, no blank pages.", value: "$2,400" },
  { name: "Auto-Drafted SSP &amp; Affirmation Memo", desc: "Your System Security Plan and signed affirmation, pre-written from your inputs.", value: "$1,800" },
  { name: "Bid-Ready Package Generator", desc: "One-click ZIP: SSP, affirmation, full evidence inventory &mdash; ready to attach to any RFP.", value: "$3,500" },
  { name: "AI Evidence Auto-Review", desc: "Every artifact you upload runs through gap detection instantly. No waiting on humans.", value: "$1,200/mo" },
  { name: "Weekly SAM.gov Opportunity Radar", desc: "Every Monday at 7am: live federal contracts matched to your NAICS, in your inbox.", value: "$497/mo" },
  { name: "Live SAM.gov Search In-Chat", desc: "&lsquo;Find me cyber contracts in 541512 closing in 30 days&rsquo; &mdash; the AI searches live, right inside the platform.", value: "$297/mo" },
  { name: "AI Per-Opportunity Packet Tailor", desc: "One click on any SAM.gov notice and your bid package adapts to that solicitation.", value: "$897/bid" },
  { name: "Compliance Officer On Demand", desc: "Open a ticket any time and a real Custodia compliance officer answers in writing.", value: "$300/hr" },
  { name: "Year-Round Posture Watchtower", desc: "We flag expiring scans, screenshots, training, and changed controls before they bite.", value: "$1,200/yr" },
  { name: "Annual Re-Affirmation, Done For You", desc: "Every Oct 1 your next SPRS submission is prepped. No fire drill, no extra fee.", value: "$1,500/yr" },
  { name: "The Custodia Guarantee", desc: "If a prime or contracting officer challenges your package, an officer resolves it &mdash; including direct comms with the prime.", value: "Priceless" },
];

// What "you also get" stacks for the offer slide.
const BONUSES = [
  { name: "BONUS #1 &mdash; AI-Drafted Federal Capability Statement", desc: "The federal-format one-pager every prime asks for, generated from your inputs.", value: "$497" },
  { name: "BONUS #2 &mdash; Fiscal Compass", desc: "Federal calendar in-app: end-of-year obligation surges, Q4 spend windows, micro-purchase thresholds.", value: "$297" },
  { name: "BONUS #3 &mdash; Milestone Reminder System", desc: "Email nudges before SPRS deadlines, prime audits, and re-affirmation due dates.", value: "$197" },
];

// Hormozi-style triple guarantee.
const GUARANTEES = [
  {
    title: "Guarantee #1 &mdash; Bid-Ready or Free",
    body: "If at the end of your 5-day trial you don&apos;t have a defensible CMMC Level 1 package built inside the platform &mdash; SSP narratives drafted, evidence vaulted, affirmation memo ready &mdash; you don&apos;t pay a cent. Cancel inside the platform in 2 clicks.",
  },
  {
    title: "Guarantee #2 &mdash; Officer-Backed Challenge Resolution",
    body: "If a prime or contracting officer ever challenges your package while you&apos;re a member, a Custodia compliance officer takes over the conversation &mdash; including direct comms with the prime &mdash; until your package is accepted. We don&apos;t hand you off. We resolve it.",
  },
  {
    title: "Guarantee #3 &mdash; Win Your First Year, Period",
    body: "Stay a member for 12 months and let us run your weekly opportunity radar, AI bid tailoring, and officer support. If you don&apos;t land at least one matched federal opportunity in your inbox worth bidding on in that year, your next year is free. We&apos;re betting on the math.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the 5-day trial work? Do I need a credit card?",
    a: "No credit card to start. Create your account, get the full platform for 5 days &mdash; AI-guided CMMC build, weekly SAM.gov radar, officer chat, bid-ready package generator. Cancel inside the platform in 2 clicks any time during the trial. If you stay, $449/mo (locked-in Summer Federal Cash Incentive pricing for the next 100 clients; list price is $749) keeps the whole engine running.",
  },
  {
    q: "Why $449 instead of $749? What&apos;s the catch?",
    a: "No catch. We&apos;re running a Summer Federal Cash Incentive: the next 100 customers lock in $449/mo for life. After 100, the price goes to $749/mo. That&apos;s the list price &mdash; $449 is the launch window. The math still works at $749, but at $449 it&apos;s a no-brainer: a single $150K sub-contract at 10% net margin pays for ~28 years of subscription.",
  },
  {
    q: "How do you keep my data secure?",
    a: "Your data is stored in dedicated, isolated environments within Custodia&apos;s secure cloud infrastructure, completely separated from other client data. We build on complete data isolation, client-controlled data policies, and secure lifecycle management from ingestion to deletion. We never use your private data to train models without explicit consent.",
  },
  {
    q: "Is CMMC Level 1 mandatory for all federal contractors?",
    a: "CMMC Level 1 is required for any contractor that handles Federal Contract Information (FCI). If you work on DoD contracts that involve FCI, you must self-attest annual compliance in SPRS and meet all 17 FAR 52.204-21 practices. L1 affirmation is binary &mdash; you either implement all 17 practices or you do not.",
  },
  {
    q: "How long does the build take?",
    a: "Most clients complete their initial CMMC Level 1 package in 3&ndash;5 business days with The Platform. The trial is sized exactly for that &mdash; you can have a defensible package built before your first card is ever charged.",
  },
  {
    q: "What if a prime pushes back on my package?",
    a: "The Custodia Guarantee covers every active membership. We assign a dedicated compliance officer to resolve any prime or contracting officer challenge &mdash; including working with the prime directly if needed &mdash; until your package is accepted.",
  },
  {
    q: "Do I need a cybersecurity background to use The Platform?",
    a: "No. The Platform is designed for non-technical operators. Every practice is explained in plain English with specific steps tailored to your tech stack. When you have a question only a human can answer, open a ticket in The Platform &mdash; a Custodia compliance officer responds with audit-grade guidance (membership only).",
  },
  {
    q: "What is included in the annual re-affirmation?",
    a: "Annual re-affirmation is included with every active membership. We flag changed controls, update your SSP, and prepare your SPRS re-submission every October at no additional charge. Your next cycle is ready before your fiscal year deadline.",
  },
  {
    q: "Why pay for this when I could DIY the 17 practices?",
    a: "You can. People do. They also burn 80&ndash;120 hours of founder time, hire a $200/hr consultant, and still file an SPRS affirmation that won&apos;t hold up under prime scrutiny &mdash; which is False Claims Act exposure under 18 USC 1001. Custodia compresses that into a 5-day platform-led build with officer backing and a guarantee. The price is the cheapest part of the equation.",
  },
  {
    q: "What is the EMEC Protocol?",
    a: "EMEC stands for Engage, Map, Execute, Confirm &mdash; the four phases of the Custodia compliance workflow. Engage captures your business scope and tech stack. Map walks the 17 practices with evidence guidance. Execute produces your signed SSP and SPRS submission. Confirm maintains and re-affirms your package each year.",
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-[#10231d]">

      {/* 1 + 2 — Cinematic header & hero */}
      <section className="relative overflow-hidden bg-[#08201a] text-white">
        {/* Atmospheric layers */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -5%, rgba(141,210,177,0.18), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(141,210,177,1) 1px, transparent 1px), linear-gradient(90deg, rgba(141,210,177,1) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-[#2f8f6d]/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[6%] bottom-[16%] h-96 w-96 rounded-full bg-[#1a4035]/55 blur-[140px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Top tactical strip */}
        <div className="relative border-b border-white/[0.06]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[#7aab98]">
            <span className="flex items-center gap-2">
              <span aria-hidden className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#bdf2cf] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#bdf2cf]" />
              </span>
              Pittsburgh, PA
            </span>
            <span className="hidden sm:inline">Veteran-owned small businesses</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="relative">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/custodia-logo.png"
                alt="Custodia shield"
                className="h-10 w-auto drop-shadow-[0_4px_18px_rgba(189,242,207,0.25)]"
              />
              <span className="font-serif text-2xl font-bold tracking-tight text-white">
                Custodia<span className="text-[#8dd2b1]">.</span>
              </span>
            </Link>
            <div className="flex items-center gap-7 text-sm font-medium text-[#cce5da]">
              <a href="#product" className="hidden transition-colors hover:text-white sm:inline">Product</a>
              <a href="#pricing" className="hidden transition-colors hover:text-white sm:inline">Pricing</a>
              <a href="#faq" className="hidden transition-colors hover:text-white sm:inline">FAQ</a>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="text-sm font-medium text-[#cce5da] transition-colors hover:text-white">
                    Login
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link href="/assessments" prefetch={false} className="bg-[#bdf2cf] px-4 py-2 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
                  Open workspace
                </Link>
                <UserButton />
              </Show>
            </div>
          </div>
        </nav>

        {/* Hero text */}
        <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-24 text-center md:pb-36 md:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#0e2a23]/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf] backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#bdf2cf]" aria-hidden />
            Secure Your Business and Win Contracts
          </div>

          <h1
            className="font-serif text-[2.4rem] font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl"
            style={{ textShadow: "0 4px 40px rgba(0,0,0,0.45)" }}
          >
            How Business Owners Are Adding{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              6&ndash;7 Figures
            </span>{" "}
            in Federal Revenue
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            Custodia walks you through CMMC Level&nbsp;1 in plain English, hands you a bid-ready package no prime can pick apart, and then emails you matched contract opportunities every Monday morning &mdash; until you win one. <span className="font-semibold text-white">One $150K sub-contract pays for ~28 years of Custodia at today&apos;s price.</span> Try the entire platform risk-free for 5 days &mdash; no credit card required.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="group inline-flex items-center gap-2 bg-[#bdf2cf] px-8 py-4 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.22)] transition-all hover:bg-[#a8e6c0] hover:shadow-[0_15px_55px_rgba(189,242,207,0.32)] md:text-lg">
                  Claim My 5-Day Trial &mdash; $0 Today
                  <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </SignUpButton>
              <a
                href="#pricing"
                className="border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See the math
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="group inline-flex items-center gap-2 bg-[#bdf2cf] px-8 py-4 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.22)] transition-all hover:bg-[#a8e6c0] md:text-lg"
              >
                Continue in workspace
                <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <a
                href="#pricing"
                className="border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See the math
              </a>
            </Show>
          </div>

          <p className="mt-5 text-xs font-medium tracking-wide text-[#7aab98]">
            5-day risk-free trial &middot; No credit card required &middot; Cancel anytime
          </p>

          {/* Below-headline outcome line — sets expectation for what's next */}
          <p className="mx-auto mt-10 max-w-2xl border-t border-white/[0.08] pt-8 font-serif text-base italic leading-snug text-[#bdf2cf] md:text-lg">
            &ldquo;The DoD spends $80B/year with small businesses. The only thing standing between you and a slice of it is one piece of paperwork. Get Started Now.&rdquo;
          </p>
        </div>

        {/* Bottom live-data strip */}
        <div className="relative border-t border-white/[0.08] bg-black/30 backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/[0.08] px-2 md:grid-cols-4 md:px-6">
            {[
              { value: "$80B+", label: "Yearly DoD small-biz spend" },
              { value: "23%", label: "Statutory set-aside floor" },
              { value: "17", label: "Practices to bid-eligible" },
              { value: "Mondays", label: "We email new contracts" },
            ].map((s) => (
              <div key={s.label} className="px-3 py-7 text-center md:px-4">
                <div className="font-serif text-3xl font-bold tracking-tight text-white md:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7aab98]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 4 — Opportunity (the deal + the gap) */}
      <section id="product" className="scroll-mt-16 bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            the opportunity
          </div>
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h2 className="font-serif text-4xl font-bold leading-[1.05] text-[#10231d] md:text-6xl">
              The contracts are there. CMMC Level 1 is the password.
            </h2>
            <p className="text-lg leading-relaxed text-[#44695c]">
              Most defense-tech SMBs leave federal money on the table because compliance feels opaque. Custodia changes the math: build your CMMC Level 1 package free in The Platform, then unlock the bid-ready download when you&apos;re ready.
            </p>
          </div>

          {/* Big-stat opportunity row */}
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "$80B+",
                label: "DoD prime contracts to small businesses",
                sub: "Awarded annually (DoD OSBP, FY23 small business goaling report)",
              },
              {
                n: "220,000+",
                label: "Defense Industrial Base businesses subject to CMMC",
                sub: "Per DoD&apos;s CMMC final rule regulatory impact analysis",
              },
              {
                n: "23%",
                label: "Federal prime contract dollars reserved for small business by law",
                sub: "Small Business Act, 15 U.S.C. &sect; 644(g) statutory goal",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="border border-[#cfe3d9] bg-white p-7 shadow-[0_8px_28px_rgba(14,48,37,0.05)]"
              >
                <div className="font-serif text-5xl font-bold tracking-tight text-[#10231d] md:text-6xl">
                  {s.n}
                </div>
                <div className="mt-3 text-sm font-bold leading-snug text-[#10231d]">{s.label}</div>
                <div
                  className="mt-2 text-xs leading-relaxed text-[#7a9c90]"
                  dangerouslySetInnerHTML={{ __html: s.sub }}
                />
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm leading-relaxed text-[#5a7d70]">
            Federal Contract Information (FCI) work &mdash; the contracts CMMC Level 1 unlocks &mdash; is the largest pool of DoD opportunity flowing to small businesses. Subcontracts from primes. Set-aside primes for SDVOSBs and SDBs. SBIR Phase II awards. Agency direct buys. The barrier is the 17 practices, the SSP, and a defensible SPRS affirmation. We remove that barrier in days.
          </p>

          {/* Barrier vs Fix split */}
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="border border-[#e8d4a1] bg-[#fff8e8] p-8">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
                The barrier
              </div>
              <h3 className="mt-3 font-serif text-2xl font-bold text-[#10231d]">
                Why most SMBs never bid
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[#5d4f30]">
                {[
                  "17 CMMC practices written in cybersecurity jargon, not plain English",
                  "No template for SSP narratives, evidence inventories, or affirmation memos",
                  "No expert on call &mdash; nowhere to turn when a CMMC question comes up mid-bid",
                  "SPRS affirmation carries 18 USC 1001 and False Claims Act liability if you sign and you're wrong",
                  "Compliance work derails the engineering and BD work you actually got funded to do",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#a06b1a]">&times;</span>
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                The Custodia answer
              </div>
              <h3 className="mt-3 font-serif text-2xl font-bold">
                Bid-ready in 5 days. Or you don&apos;t pay.
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[#cce5da]">
                {[
                  "All 17 practices walked in plain English, tailored to your tech stack",
                  "SSP narratives drafted for you &mdash; accept or edit in one click",
                  "AI evidence auto-review &mdash; instant feedback on every artifact you upload",
                  "Custodia officer on-call via in-app tickets &mdash; ask any CMMC question",
                  "Custodia Guarantee &mdash; we resolve any prime or contracting officer challenge after you file",
                  "Annual re-affirmation included &mdash; your next cycle is ready every Oct 1",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="mt-7 inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
                    Claim My 5-Day Trial &mdash; $0 Today
                    <span aria-hidden className="text-lg leading-none">&rarr;</span>
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="mt-7 inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Continue in workspace
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
              </Show>
              <p className="mt-3 text-xs text-[#7aab98]">5-day risk-free trial &middot; No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5 — How federal contracting actually works */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">how it works</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-6xl">
              How federal contracting actually works
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#44695c]">
              Most SMBs don&apos;t bid because the path looks opaque. Here&apos;s the actual flow &mdash; and where Custodia removes the friction.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                step: "Register",
                desc: "SAM.gov registration. CAGE code. UEI. NAICS codes that match your work.",
                custodia: "We point you to the right registrations and check your work.",
                highlight: false,
              },
              {
                n: "02",
                step: "Find opportunities",
                desc: "SAM.gov, agency portals (DoD SBIR, AFWERX, NavalX, DIU), prime contractor subs.",
                custodia: "We teach you the search patterns and where to look first.",
                highlight: false,
              },
              {
                n: "03",
                step: "Bid with compliance proof",
                desc: "Submit your SSP, SPRS affirmation, and prime security questionnaires. Most SMBs stall here.",
                custodia: "Your bid-ready package is generated in The Platform &mdash; ready to attach.",
                highlight: true,
              },
              {
                n: "04",
                step: "Win + maintain",
                desc: "Stay compliant year-round. File annual re-affirmation. Respond to prime audits when they come.",
                custodia: "Year-round monitoring + annual re-affirmation, included.",
                highlight: false,
              },
            ].map((step) => (
              <div
                key={step.n}
                className={`relative flex flex-col border p-6 ${
                  step.highlight
                    ? "border-[#2f8f6d] bg-[#0e2a23] text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]"
                    : "border-[#cfe3d9] bg-[#f7fcf9] text-[#10231d]"
                }`}
              >
                <div
                  className={`text-[10px] font-bold tracking-[0.22em] ${
                    step.highlight ? "text-[#8dd2b1]" : "text-[#2f8f6d]"
                  }`}
                >
                  STEP {step.n}
                </div>
                <h3
                  className={`mt-3 font-serif text-2xl font-bold ${
                    step.highlight ? "text-white" : "text-[#10231d]"
                  }`}
                >
                  {step.step}
                </h3>
                <p
                  className={`mt-3 flex-1 text-sm leading-relaxed ${
                    step.highlight ? "text-[#cce5da]" : "text-[#4a6f62]"
                  }`}
                >
                  {step.desc}
                </p>
                <div
                  className={`mt-5 px-3 py-2.5 text-xs leading-relaxed ${
                    step.highlight
                      ? "bg-[#1a4035] text-[#bdf2cf]"
                      : "bg-white text-[#1f5c47] ring-1 ring-[#cfe3d9]"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Custodia:{" "}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: step.custodia }} />
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-base text-[#44695c]">
            Step 3 is where most SMBs stall. The compliance package is the difference between a bid and a no-bid &mdash; and it&apos;s the part Custodia builds for you.
          </p>
        </div>
      </section>

      {/* 6 — Stakes + Custodia Shield */}
      <section className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          {/* Stakes header */}
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
              the stakes
            </div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              Your business is on the front line.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#44695c]">
              The minute you handle data for the U.S. government, you become a target. Foreign adversaries &mdash; China, Russia, Iran, North Korea &mdash; hunt small American defense contractors because we&apos;re the easiest way into the country&apos;s biggest programs. Custodia puts a shield between your business and them, and keeps it up year-round so you can focus on winning the work.
            </p>
          </div>

          {/* What happens if you skip this */}
          <div className="mb-12">
            <h3 className="mb-6 text-center font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
              What happens to small businesses that get this wrong
            </h3>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  stat: "Contracts pulled",
                  title: "Primes drop you",
                  body: "When a prime audits your security and finds gaps &mdash; or you can&apos;t answer their questionnaire &mdash; the work goes to someone else. You don&apos;t get a second chance, and other primes hear about it.",
                },
                {
                  stat: "Federal lawsuits",
                  title: "False Claims Act exposure",
                  body: "Filing a SPRS affirmation that isn&apos;t true is a federal violation under 18 USC 1001 and the False Claims Act. The DOJ&apos;s Civil Cyber-Fraud Initiative is actively pursuing contractors. Recent settlements have run from $1M to over $9M.",
                },
                {
                  stat: "Adversaries get in",
                  title: "Foreign actors steal your work",
                  body: "State-sponsored hackers target defense small businesses because we&apos;re the soft underbelly of the supply chain. One ransomware hit, one spear-phish, and your IP, your contract data, and your business can be gone overnight.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="border border-[#e8d4a1] bg-[#fff8e8] p-6"
                >
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
                    {c.stat}
                  </div>
                  <h4 className="mt-3 font-serif text-xl font-bold text-[#10231d]">{c.title}</h4>
                  <p
                    className="mt-3 text-sm leading-relaxed text-[#5d4f30]"
                    dangerouslySetInnerHTML={{ __html: c.body }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* The Custodia Shield */}
          <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_45px_rgba(14,48,37,0.2)] md:p-12">
            <div className="mb-10 text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
                the custodia shield
              </div>
              <h3 className="font-serif text-3xl font-bold leading-tight md:text-5xl">
                We secure you. Then we keep you secure.
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#a8cfc0]">
                You don&apos;t need to become a security expert. You need a shield that works while you focus on contract work. That&apos;s what we build &mdash; and what we maintain, every day, year-round.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: "01",
                  title: "Build a real defense",
                  body: "Not just paperwork. An actual security posture: who can see what, how data leaves your systems, who walks through your door. Plain English, your tech stack.",
                },
                {
                  n: "02",
                  title: "AI-automated, officer-supported",
                  body: "Every artifact you upload runs through Custodia's AI auto-review for instant gap detection. When you hit a question only a human can answer, open a ticket and a Custodia compliance officer responds &mdash; the cybersec expertise is on-call, not in the way.",
                },
                {
                  n: "03",
                  title: "Year-round monitoring",
                  body: "Threats don&apos;t take holidays. Neither do we. We watch for changed controls, expiring evidence, and new requirements &mdash; and tell you exactly what to fix.",
                },
                {
                  n: "04",
                  title: "Annual re-certification",
                  body: "Every Oct 1, your SPRS re-affirmation is ready to go. No fire drill. No scrambling. Your shield stays up while you grow the business.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="border border-[#2a5a49] bg-[#193d31] p-6"
                >
                  <div className="text-[10px] font-bold tracking-[0.22em] text-[#8dd2b1]">
                    {s.n}
                  </div>
                  <h4 className="mt-3 font-serif text-xl font-bold text-white">{s.title}</h4>
                  <p
                    className="mt-3 text-sm leading-relaxed text-[#c5e3d6]"
                    dangerouslySetInnerHTML={{ __html: s.body }}
                  />
                </div>
              ))}
            </div>

            <p className="mx-auto mt-12 max-w-2xl text-center font-serif text-2xl leading-snug text-[#bdf2cf] md:text-3xl">
              You stay safe. You keep bidding. You keep winning. Custodia stands watch.
            </p>
          </div>
        </div>
      </section>

      {/* 6.5 — The yearly rhythm: one-time vs ongoing */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">the yearly rhythm</div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              CMMC isn&apos;t a one-and-done. It&apos;s a yearly cadence.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#44695c]">
              Compliance protects your business and unlocks contracts only as long as your posture is current. Custodia handles the one-time setup, then runs the yearly cycle on autopilot so you stay secure, stay bid-ready, and never scramble at re-affirmation time.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* One-time */}
            <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-8">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                Once, at the start
              </div>
              <h3 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
                The setup (week 1&ndash;2)
              </h3>
              <p className="mt-2 text-sm text-[#496f61]">
                A few hours of structured work to build the foundation. Do it once, you&apos;re bid-eligible.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-[#31594d]">
                {[
                  "Onboarding chat &mdash; capture business identity, FCI scope, and tech stack",
                  "Walk all 17 FAR 52.204-21 practices in plain English",
                  "Upload evidence per control (screenshots, exports, signed rosters, policies)",
                  "Auto-drafted SSP narratives &mdash; accept or edit in one click",
                  "Generate your first bid-ready package: signed affirmation, SSP, evidence ZIP",
                  "File your initial SPRS affirmation",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#2f8f6d]">&#10003;</span>
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Ongoing */}
            <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
                Every week, every month, every year
              </div>
              <h3 className="mt-2 font-serif text-2xl font-bold">
                The yearly engine (months 1&ndash;12, every year)
              </h3>
              <p className="mt-2 text-sm text-[#a8cfc0]">
                Custodia runs the cadence so your shield stays up and your pipeline stays full.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-[#cce5da]">
                {[
                  "<b>Every Monday</b> &mdash; SAM.gov radar email with new contract opportunities matched to your NAICS (in-app inbox keeps a rolling history; toggle email on/off in your bid profile)",
                  "<b>Continuously</b> &mdash; AI evidence freshness watchtower flags expiring scans, screenshots, training, and policies before they go stale",
                  "<b>On demand</b> &mdash; one-click AI tailor a packet to any specific opportunity",
                  "<b>Quarterly</b> &mdash; posture-drift detection flags changed controls and new requirements",
                  "<b>October 1</b> &mdash; annual SPRS re-affirmation prepped automatically &mdash; included, no extra fee",
                  "<b>Anytime</b> &mdash; open a ticket, a Custodia compliance officer answers your CMMC question",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Calendar strip */}
          <div className="mt-12 overflow-hidden border border-[#cfe3d9] bg-[#f7fcf9]">
            <div className="grid grid-cols-12 divide-x divide-[#cfe3d9]">
              {[
                { m: "JAN", n: "Q1 push" },
                { m: "FEB", n: "FY mid-year" },
                { m: "MAR", n: "Q2 ramp" },
                { m: "APR", n: "Pipeline build" },
                { m: "MAY", n: "RFP season" },
                { m: "JUN", n: "Q3 spend" },
                { m: "JUL", n: "Pre-EOFY" },
                { m: "AUG", n: "EOFY surge" },
                { m: "SEP", n: "Use-it-or-lose-it" },
                { m: "OCT", n: "Re-affirm" },
                { m: "NOV", n: "New FY" },
                { m: "DEC", n: "Q1 prep" },
              ].map((c) => (
                <div
                  key={c.m}
                  className={`px-2 py-4 text-center ${
                    c.m === "OCT" ? "bg-[#0e2a23] text-white" : "text-[#10231d]"
                  }`}
                >
                  <div className="font-mono text-[10px] font-bold tracking-wider">
                    {c.m}
                  </div>
                  <div
                    className={`mt-1 text-[9px] ${
                      c.m === "OCT" ? "text-[#bdf2cf]" : "text-[#5a7d70]"
                    }`}
                  >
                    {c.n}
                  </div>
                  {(c.m === "OCT" || c.m === "AUG" || c.m === "SEP") && (
                    <div
                      className={`mx-auto mt-2 h-1 w-6 rounded-full ${
                        c.m === "OCT" ? "bg-[#bdf2cf]" : "bg-[#a06b1a]"
                      }`}
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-[#cfe3d9] bg-white px-6 py-4 text-center text-xs text-[#5a7d70]">
              <b className="text-[#10231d]">Federal Q4 (Aug&ndash;Sep)</b> is the spend surge. <b className="text-[#10231d]">Oct 1</b> is your re-affirmation deadline. Custodia keeps you ready for both, every year.
            </div>
          </div>
        </div>
      </section>

      {/* 6.7 — Opportunity engine + community: win your first award */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f7fcf9] via-white to-[#f7fcf9] px-6 py-24">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_top_left,#bdf2cf33,transparent_50%),radial-gradient(circle_at_bottom_right,#bdf2cf33,transparent_50%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2f8f6d]" aria-hidden />
              the opportunity engine
            </div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              The goal: win at least one award.
              <br />
              <span className="text-[#2f8f6d]">Then you&apos;re in the game.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#44695c]">
              Once you&apos;re CMMC Level 1 secure, you&apos;re eligible to handle Federal Contract Information &mdash; that&apos;s the gate. Custodia&apos;s job after that gate is to put live, matched opportunities in front of you every week until you win one. Because a single award changes everything: the past performance, the credit, the next bid.
            </p>
          </div>

          {/* Hero feature card: weekly emails */}
          <div className="grid gap-0 overflow-hidden border-2 border-[#2f8f6d] bg-white shadow-[0_25px_60px_rgba(14,48,37,0.12)] md:grid-cols-[1.1fr_1fr]">
            {/* Left: pitch */}
            <div className="flex flex-col justify-between bg-[#0e2a23] p-10 text-white md:p-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#2f8f6d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  Included free &middot; on by default
                </div>
                <h3 className="mt-5 font-serif text-3xl font-bold leading-tight md:text-4xl">
                  Every Monday at 7am, the contracts find <em>you</em>.
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-[#a8cfc0] md:text-base">
                  Custodia scans SAM.gov, DSIP, GSA eBuy, and the major federal opportunity feeds, then emails you a curated digest of the live solicitations matched to your NAICS codes &mdash; with deadlines, set-aside flags, and one-click AI tailoring already wired up.
                </p>

                <ul className="mt-6 space-y-3 text-sm text-[#cce5da]">
                  {[
                    "Matched to your NAICS, location, and size profile",
                    "Set-aside flags: SDB, WOSB, HUBZone, 8(a), VOSB / SDVOSB",
                    "Sorted by closing date so you act on what&apos;s urgent first",
                    "Every email links straight into your in-app inbox &mdash; full history kept",
                    "One click: AI tailors your bid-ready packet to that specific solicitation",
                    "Or skip the email and <b>ask the in-platform AI</b>: &lsquo;find me cyber contracts in 541512 closing in 30 days&rsquo; &mdash; live SAM.gov search is built into the chat",
                    "Don&apos;t want the email? Toggle it off in your bid profile in 2 seconds",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span aria-hidden className="mt-0.5 flex-none font-bold text-[#bdf2cf]">&#10003;</span>
                      <span dangerouslySetInnerHTML={{ __html: b }} />
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-8 border-t border-[#2a5a49] pt-6 font-serif text-lg italic leading-snug text-[#bdf2cf]">
                &ldquo;The hardest part of fed contracting isn&apos;t bidding &mdash; it&apos;s knowing which contract to bid on. Custodia tells you.&rdquo;
              </p>
            </div>

            {/* Right: mock email */}
            <div className="flex flex-col bg-[#f7fcf9] p-8 md:p-10">
              <div className="border border-[#cfe3d9] bg-white shadow-sm">
                {/* Email header */}
                <div className="flex items-center gap-3 border-b border-[#cfe3d9] px-5 py-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#2f8f6d] text-xs font-bold text-white">
                    C
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-bold text-[#10231d]">Custodia &mdash; This Monday&apos;s federal opportunities</div>
                    <div className="truncate text-[#5a7d70]">opportunities@bidfedcmmc.com &middot; to you &middot; 7:02 AM</div>
                  </div>
                  <div className="hidden flex-none bg-[#bdf2cf] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#10231d] sm:block">
                    7 matches
                  </div>
                </div>

                {/* Mock opportunities */}
                <div className="divide-y divide-[#e6f0eb]">
                  {[
                    {
                      title: "DoD &mdash; Cyber Systems Engineering Support",
                      naics: "541512",
                      value: "$4.2M ceiling",
                      due: "12 days",
                      tags: ["SDVOSB set-aside", "5-yr IDIQ"],
                      hot: true,
                    },
                    {
                      title: "GSA &mdash; IT Services Schedule 70 task order",
                      naics: "541511",
                      value: "$280k",
                      due: "9 days",
                      tags: ["Small biz set-aside"],
                      hot: false,
                    },
                    {
                      title: "Air Force SBIR Phase II direct-to-Phase II",
                      naics: "541715",
                      value: "$1.7M",
                      due: "21 days",
                      tags: ["SBIR", "Phase II"],
                      hot: false,
                    },
                  ].map((o) => (
                    <div key={o.title} className="flex items-start gap-3 px-5 py-3">
                      <div
                        className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                          o.hot ? "bg-[#a06b1a]" : "bg-[#2f8f6d]"
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-sm font-bold text-[#10231d]"
                          dangerouslySetInnerHTML={{ __html: o.title }}
                        />
                        <div className="mt-1 text-[11px] text-[#5a7d70]">
                          NAICS {o.naics} &middot; {o.value} &middot; closes in {o.due}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {o.tags.map((t) => (
                            <span
                              key={t}
                              className="border border-[#cfe3d9] bg-[#f7fcf9] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f8f6d]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="flex-none border border-[#2f8f6d] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2f8f6d]"
                      >
                        Tailor
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#cfe3d9] bg-[#f7fcf9] px-5 py-3 text-center text-[11px] text-[#5a7d70]">
                  + 4 more matches in your inbox &middot; manage emails in your bid profile
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] italic text-[#5a7d70]">
                Sample digest. Real opportunities pulled live from federal feeds.
              </p>
            </div>
          </div>

          {/* Community + first-award promise */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="border border-[#cfe3d9] bg-white p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#bdf2cf] font-serif text-xl font-bold text-[#0e2a23]">
                1
              </div>
              <h4 className="mt-4 font-serif text-lg font-bold text-[#10231d]">
                Get CMMC Level 1 secure
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[#496f61]">
                You complete the 17 practices, capture evidence, and file your SPRS affirmation. You&apos;re now legally eligible to handle Federal Contract Information &mdash; the gate is open.
              </p>
            </div>
            <div className="border-2 border-[#2f8f6d] bg-[#f7fcf9] p-7 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2f8f6d] font-serif text-xl font-bold text-white">
                2
              </div>
              <h4 className="mt-4 font-serif text-lg font-bold text-[#10231d]">
                Join the bid-ready community
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[#496f61]">
                You&apos;re now part of a network of small businesses securing themselves for federal work. Custodia delivers matched opportunities every week and points the AI tailoring engine at any one with a single click.
              </p>
            </div>
            <div className="border border-[#cfe3d9] bg-white p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#bdf2cf] font-serif text-xl font-bold text-[#0e2a23]">
                3
              </div>
              <h4 className="mt-4 font-serif text-lg font-bold text-[#10231d]">
                Win at least one award
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[#496f61]">
                That&apos;s the bar. One award. After your first win you have past performance, a CAGE that&apos;s seen action, and the credibility to keep bidding. Everything compounds from there.
              </p>
            </div>
          </div>

          {/* Bottom band */}
          <div className="mt-10 border border-[#2f8f6d] bg-[#0e2a23] px-8 py-6 text-center text-white">
            <div className="font-serif text-xl font-bold leading-snug md:text-2xl">
              You secure the business. We supply the opportunities. The first award is the milestone we&apos;re both chasing.
            </div>
          </div>
        </div>
      </section>

      {/* 7 — Why Custodia is different */}
      <section className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">why custodia</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
              Built by CMMC professionals. Self-serve, officer-supported.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#a8cfc0]">
              Most compliance products are templates and forms. Custodia is a cybersecurity firm with a Platform built to take you from zero to bid-ready hands-off &mdash; with our compliance officers on-call via tickets whenever you need a real human answer.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Cybersecurity firm, not a template",
                body: "Custodia is a veteran-owned cybersecurity firm in Pittsburgh, PA. We staff compliance officers, not customer-success reps. The Platform takes you from zero to bid-ready on its own &mdash; the officers are on-call when you need a human.",
              },
              {
                title: "CMMC Level 1 specialists",
                body: "We do one thing &mdash; CMMC L1 for FCI handlers &mdash; and we do it all the way. No scope drift into L2 or L3. The seventeen practices are our entire focus.",
              },
              {
                title: "Officers on-call via in-app tickets",
                body: "Hit a question The Platform can&apos;t answer? Open a ticket. A Custodia compliance officer responds with audit-grade guidance, in writing, in The Platform &mdash; included with every active membership.",
              },
              {
                title: "The Custodia Guarantee",
                body: "If a prime or contracting officer challenges your package, we assign a dedicated officer to resolve it &mdash; including direct communication with the prime, until your package is accepted.",
              },
              {
                title: "Veteran-owned, mission-aligned",
                body: "Built by people who understand federal procurement from the inside. We&apos;re here to expand the small-business defense industrial base, not extract from it.",
              },
              {
                title: "Annual re-affirmation included",
                body: "Compliance isn&apos;t one-and-done. We monitor changed controls year-round, flag expiring evidence, and prepare your next SPRS re-affirmation every October &mdash; included in your membership.",
              },
            ].map((d) => (
              <div key={d.title} className="border border-[#2a5a49] bg-[#193d31] p-7">
                <h3 className="font-serif text-xl font-bold text-white">{d.title}</h3>
                <p
                  className="mt-3 text-sm leading-relaxed text-[#c5e3d6]"
                  dangerouslySetInnerHTML={{ __html: d.body }}
                />
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-6 border-t border-[#2a5a49] pt-12 md:grid-cols-3">
            {[
              { stat: "17", label: "Practices covered" },
              { stat: "100%", label: "Bid-ready rate" },
              { stat: "$150K+", label: "Avg. contract value" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif text-4xl font-bold text-white md:text-5xl">{s.stat}</div>
                <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9 — Your journey */}
      <section className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">your journey</div>
          <h2 className="font-serif text-4xl font-bold leading-[1.05] text-[#10231d] md:text-6xl">
            From signup to signed contracts
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44695c]">
            Here&apos;s the path you&apos;ll walk inside The Platform during your 5-day trial &mdash; from signup to filed-in-SPRS to first opportunity in your inbox. Membership keeps the engine running after that.
          </p>

          <ol className="relative mt-16 space-y-12 border-l-2 border-[#cfe3d9] pl-10 md:pl-14">
            {[
              {
                n: "01",
                tag: "TRIAL DAY 1",
                paid: false,
                title: "Create your account",
                time: "30 seconds",
                desc: "Email and password through Clerk. No credit card to start your 5-day trial. Land in The Platform and pick up where you left off across devices.",
              },
              {
                n: "02",
                tag: "TRIAL DAY 1",
                paid: false,
                title: "Onboard in conversation",
                time: "5 minutes",
                desc: "The Platform asks about your business, the FCI you handle, and your tech stack. It captures the legal-identity details you'd otherwise type into a 40-field form.",
              },
              {
                n: "03",
                tag: "TRIAL DAY 2\u20133",
                paid: false,
                title: "Walk the 17 CMMC practices",
                time: "30&ndash;60 minutes per session",
                desc: "Each FAR 52.204-21 requirement is explained in plain English with capture steps tailored to your stack &mdash; M365, Google Workspace, Okta, AWS, on-prem, or no IT at all.",
              },
              {
                n: "04",
                tag: "TRIAL DAY 2\u20134",
                paid: false,
                title: "Upload your evidence",
                time: "As you go",
                desc: "Screenshots, exports, signed rosters, policy PDFs. The Platform tags every artifact to a control and tracks your readiness score in real time.",
              },
              {
                n: "05",
                tag: "TRIAL DAY 4",
                paid: false,
                title: "Draft your SSP narratives",
                time: "Auto-drafted",
                desc: "Auto-generated SSP narratives for every control, written from your inputs. Accept or edit in one click &mdash; no blank-page panic.",
              },
              {
                n: "06",
                tag: "TRIAL DAY 5",
                paid: true,
                title: "Generate your bid-ready package",
                time: "On demand",
                desc: "AI auto-reviews every artifact for instant gap detection. Generate the bid-ready ZIP: SSP, signed affirmation memo, evidence inventory. This is the moment your trial converts and the $449/mo membership starts &mdash; cancel before this step and you owe nothing.",
              },
              {
                n: "07",
                tag: "MEMBER",
                paid: true,
                title: "File in SPRS and start bidding",
                time: "Same day",
                desc: "Step-by-step SPRS submission instructions. The moment you affirm, you can respond to prime questionnaires, agency RFPs, SBIR Phase II solicitations, and small-business set-asides &mdash; with a defensible package behind you.",
              },
              {
                n: "08",
                tag: "MEMBER",
                paid: true,
                title: "Stay compliant, year-round",
                time: "Re-affirmation included",
                desc: "Custodia monitors changed controls, flags expiring evidence, and prepares your next SPRS re-submission every October &mdash; at no extra charge while your membership is active.",
              },
            ].map((step) => (
              <li key={step.n} className="relative">
                <div
                  className={`absolute -left-[3.45rem] flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm md:-left-[4.45rem] md:h-12 md:w-12 ${
                    step.paid
                      ? "border-[#2f8f6d] bg-[#0e2a23] text-[#bdf2cf]"
                      : "border-[#2f8f6d] bg-white text-[#0e2a23]"
                  }`}
                >
                  {step.n}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      step.paid
                        ? "bg-[#0e2a23] text-[#bdf2cf]"
                        : "bg-[#e8f7ef] text-[#1f5c47]"
                    }`}
                  >
                    {step.tag}
                  </span>
                  <span
                    className="text-xs font-medium text-[#7a9c90]"
                    dangerouslySetInnerHTML={{ __html: step.time }}
                  />
                </div>
                <h3 className="mt-2 font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
                  {step.title}
                </h3>
                <p
                  className="mt-2 max-w-2xl text-base leading-relaxed text-[#44695c]"
                  dangerouslySetInnerHTML={{ __html: step.desc }}
                />
              </li>
            ))}
          </ol>

          <div className="mt-16 border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_45px_rgba(14,48,37,0.18)] md:p-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">where it ends</div>
            <h3 className="mt-3 font-serif text-3xl font-bold leading-tight md:text-4xl">
              You, bidding on contracts. With a defensible package behind you.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#cce5da]">
              You can cover steps 1&ndash;5 inside your free 5-day trial. Step 6 generates the bid-ready package and starts your $449/mo membership (locked-in summer pricing for the next 100 clients).
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="inline-flex items-center gap-2 bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
                    Claim My 5-Day Trial &mdash; $0 Today
                    <span aria-hidden className="text-lg leading-none">&rarr;</span>
                  </button>
                </SignUpButton>
                <a href="#pricing" className="border border-[#2f8f6d]/40 px-7 py-3.5 text-base font-semibold text-[#cce5da] transition-colors hover:border-[#8dd2b1]/60 hover:text-white">
                  See pricing
                </a>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="inline-flex items-center gap-2 bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Continue your journey
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
              </Show>
            </div>
            <p className="mt-4 text-xs text-[#7aab98]">
              5-day risk-free trial &middot; No credit card required &middot; $449/mo locked in (next 100 clients)
            </p>
          </div>
        </div>
      </section>

      {/* 9.5 — Inside The Platform: full feature showcase */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">inside the platform</div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              Everything you need to go from zero to bidding.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#44695c]">
              The Platform isn&apos;t a checklist app &mdash; it&apos;s a complete operating system for federal contracting. Here&apos;s every capability you get, mapped to the four phases of winning the work.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* BUILD */}
            <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">phase 01</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#10231d]">Build your posture</h3>
                </div>
                <span className="rounded-full bg-[#e8f7ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f5c47]">included in trial</span>
              </div>
              <p className="mt-3 text-sm text-[#496f61]">Walk the 17 practices, capture evidence, draft your SSP &mdash; without writing it from scratch.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { t: "AI-guided onboarding", d: "Conversational intake captures your business, FCI scope, tech stack &mdash; no 40-field forms." },
                  { t: "All 17 practices, plain English", d: "Each FAR 52.204-21 control walked with capture steps tailored to M365, Google, Okta, AWS, on-prem, or no IT at all." },
                  { t: "Evidence vault per control", d: "Tag screenshots, exports, signed rosters, and policy PDFs to the controls they prove." },
                  { t: "Auto-drafted SSP narratives", d: "Every control&apos;s SSP section pre-written from your inputs. Accept or edit in one click." },
                  { t: "Live readiness score", d: "Real-time domain-by-domain progress so you always know what&apos;s left." },
                  { t: "AI-drafted capability statement", d: "Federal-format one-pager generated from your inputs &mdash; ready to attach to any bid." },
                ].map((f) => (
                  <li key={f.t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#2f8f6d]">&#10003;</span>
                    <span className="text-sm">
                      <b className="text-[#10231d]">{f.t}.</b>{" "}
                      <span className="text-[#496f61]">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* BID */}
            <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">phase 02</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold">Bid with confidence</h3>
                </div>
                <span className="rounded-full bg-[#bdf2cf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0c2219]">included in trial</span>
              </div>
              <p className="mt-3 text-sm text-[#a8cfc0]">AI-automated, officer-supported. Generate your bid-ready package on demand and tailor it to every opportunity in one click.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { t: "AI evidence auto-review", d: "Every artifact is auto-reviewed against the practice it proves &mdash; instant gap detection without waiting on a human." },
                  { t: "Bid-ready package on demand", d: "Signed affirmation memo, full SSP, evidence inventory ZIP &mdash; generate any time you&apos;re ready." },
                  { t: "AI per-opportunity packet tailor", d: "Paste a SAM.gov notice or click &lsquo;Tailor&rsquo; from your radar &mdash; the package adapts to that solicitation." },
                  { t: "Cover letter + executive summary", d: "Auto-drafted for the specific contracting officer or prime, in your voice." },
                  { t: "SPRS submission instructions", d: "Step-by-step walkthrough so the affirmation files clean on the first try." },
                  { t: "Officer ticket support", d: "When you have a CMMC question only a human can answer, open a ticket &mdash; a Custodia compliance officer responds in writing." },
                ].map((f) => (
                  <li key={f.t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span className="text-sm">
                      <b className="text-white">{f.t}.</b>{" "}
                      <span className="text-[#a8cfc0]">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* FIND OPPORTUNITIES */}
            <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">phase 03</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#10231d]">Find the contracts</h3>
                </div>
                <span className="rounded-full bg-[#e8f7ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f5c47]">included in trial</span>
              </div>
              <p className="mt-3 text-sm text-[#496f61]">Opportunities matched to your business, delivered to your inbox before the news hits LinkedIn.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { t: "SAM.gov opportunity radar", d: "Every Monday morning we pull new SAM.gov notices matched to your NAICS codes and set-aside eligibility." },
                  { t: "Inbox view of matched notices", d: "All your matched opportunities in one place &mdash; dismiss, view on SAM, or tailor a packet in one click." },
                  { t: "Fiscal compass", d: "Federal-fiscal-year calendar in-app: end-of-year obligation surges, Q4 spend windows, micro-purchase thresholds." },
                  { t: "Milestone reminders", d: "Email nudges before SPRS deadlines, prime audits, and re-affirmation due dates." },
                  { t: "Bid profile", d: "Set your NAICS, set-asides, place of performance, and capability tags &mdash; everything keys off this." },
                ].map((f) => (
                  <li key={f.t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#2f8f6d]">&#10003;</span>
                    <span className="text-sm">
                      <b className="text-[#10231d]">{f.t}.</b>{" "}
                      <span className="text-[#496f61]">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* MAINTAIN */}
            <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">phase 04</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold">Stay compliant, year-round</h3>
                </div>
                <span className="rounded-full bg-[#bdf2cf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0c2219]">included in trial</span>
              </div>
              <p className="mt-3 text-sm text-[#a8cfc0]">Compliance isn&apos;t one-and-done. The Platform watches your posture so you don&apos;t have to.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { t: "Evidence freshness watchtower", d: "Auto-flags expiring scans (30d), screenshots (90d), training, policies, and certs &mdash; before they go stale." },
                  { t: "Compliance officer rail", d: "In-app escalation channel: ask any question and a Custodia officer responds with audit-grade guidance." },
                  { t: "Annual re-affirmation included", d: "Every Oct 1 your next SPRS submission is prepped &mdash; no fire drill, no extra fee." },
                  { t: "Posture-drift detection", d: "Changed controls, new requirements, framework updates &mdash; we flag exactly what to fix." },
                  { t: "Custodia Guarantee", d: "If a prime or contracting officer challenges your package, we resolve it &mdash; including direct comms with the prime." },
                  { t: "Audit-ready archive", d: "Every artifact, signature, and review preserved with full chain-of-custody for inspection." },
                ].map((f) => (
                  <li key={f.t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span className="text-sm">
                      <b className="text-white">{f.t}.</b>{" "}
                      <span className="text-[#a8cfc0]">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 border border-[#cfe3d9] bg-[#f7fcf9] p-6 text-center md:p-8">
            <p className="font-serif text-xl text-[#10231d] md:text-2xl">
              Every capability above is included in your 5-day trial &mdash; the build, the radar, the bid generator, and the officer.
            </p>
            <p className="mt-3 text-sm text-[#5a7d70]">
              Start with no credit card. Build your CMMC package, watch the SAM radar fill up, and decide on day 5 whether to keep the engine running at $449/mo (locked-in summer pricing).
            </p>
          </div>
        </div>
      </section>

      {/* 9.9 — Your potential profit / ROI */}
      <section className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">your potential profit</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
              One contract pays for years of Custodia.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#a8cfc0]">
              Federal small-business contractors run on 8&ndash;15% net margins. The math on whether Custodia is worth it isn&apos;t close &mdash; here&apos;s what a single won bid does to your numbers.
            </p>
          </div>

          {/* The hero comparison */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                tier: "First sub-contract",
                size: "$150,000",
                net: "10%",
                profit: "$15,000",
                payback: "~2.8 years of Custodia",
                ratio: "2.8x",
              },
              {
                tier: "SBIR Phase II",
                size: "$400,000",
                net: "8%",
                profit: "$32,000",
                payback: "~5.9 years of Custodia",
                ratio: "5.9x",
                highlight: true,
              },
              {
                tier: "Prime sub-contract",
                size: "$1,200,000",
                net: "10%",
                profit: "$120,000",
                payback: "22+ years of Custodia",
                ratio: "22x",
              },
            ].map((s) => (
              <div
                key={s.tier}
                className={`flex flex-col border p-7 ${
                  s.highlight
                    ? "border-[#bdf2cf] bg-[#193d31] shadow-[0_15px_40px_rgba(189,242,207,0.15)]"
                    : "border-[#2a5a49] bg-[#163027]"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
                  {s.tier}
                </div>
                <div className="mt-3 text-sm text-[#a8cfc0]">Contract value</div>
                <div className="font-serif text-3xl font-bold text-white md:text-4xl">{s.size}</div>
                <div className="mt-3 text-sm text-[#a8cfc0]">Net at {s.net}</div>
                <div className="font-serif text-2xl font-bold text-[#bdf2cf]">{s.profit}</div>
                <div className="mt-5 border-t border-[#2a5a49] pt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8dd2b1]">
                    Pays for
                  </div>
                  <div className="mt-1 font-serif text-xl font-bold text-white">
                    {s.payback}
                  </div>
                  <div className="mt-1 text-[11px] font-bold tracking-wide text-[#bdf2cf]">
                    {s.ratio} return on subscription
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Math callout */}
          <div className="mt-10 border border-[#2a5a49] bg-[#163027] p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div className="text-center md:text-right">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                  You pay
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-white md:text-5xl">
                  $449/mo
                </div>
                <div className="mt-1 text-sm text-[#a8cfc0]">
                  $5,388/year &middot; locked-in summer pricing &middot; cancel anytime
                </div>
              </div>

              <div aria-hidden className="hidden text-3xl font-bold text-[#8dd2b1] md:block">
                vs.
              </div>

              <div className="text-center md:text-left">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                  You earn (per single $400k SBIR win)
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-[#bdf2cf] md:text-5xl">
                  +$32,000
                </div>
                <div className="mt-1 text-sm text-[#a8cfc0]">
                  Net profit on one contract &middot; gates years of Phase III
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-3xl text-center font-serif text-lg italic leading-relaxed text-[#bdf2cf] md:text-2xl">
              &ldquo;Win one $150K sub-contract from anything The Platform sends you, and Custodia is paid for through 2028.&rdquo;
            </p>
          </div>

          {/* Caveats / honesty */}
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-[#7aab98]">
            Source ranges based on FY2023 SBA Small Business Goaling Report and DoD CAS / FAR 15.404 weighted-guidelines analysis. Net margins for federal small-business contractors typically run 6&ndash;20% depending on contract type (cost-plus, FFP, T&amp;M, sub-contract). Your numbers will vary &mdash; the directional math doesn&apos;t.
          </p>
        </div>
      </section>

      {/* 10 — Pricing: ONE OFFER, Hormozi-stacked */}
      <section id="pricing" className="scroll-mt-16 border-y border-[#d5e5dd] bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          {/* Scarcity banner */}
          <div className="mb-8 flex flex-col items-center gap-2 border border-[#a06b1a] bg-[#fff8e8] px-6 py-4 text-center md:flex-row md:justify-center md:gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a06b1a]">
              ⚡ Summer Federal Cash Incentive
            </span>
            <span className="text-sm font-semibold text-[#5d4f30]">
              Lock in <span className="font-black text-[#10231d]">$449/mo</span> for life &mdash; only the next 100 clients. After that: $749/mo.
            </span>
          </div>

          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">the offer</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-6xl">
              Everything you need to win federal contracts.
              <br />
              <span className="text-[#2f8f6d]">$0 today. $449/mo if you stay.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#44695c]">
              Try the entire platform &mdash; build, bid, find, maintain &mdash; risk-free for 5 days. No credit card required to start. Cancel in 2 clicks inside the platform any time during the trial.
            </p>
          </div>

          {/* The single offer card */}
          <div className="mx-auto max-w-3xl border-2 border-[#2f8f6d] bg-white shadow-[0_25px_60px_rgba(14,48,37,0.14)]">

            {/* Header band */}
            <div className="border-b-2 border-[#2f8f6d] bg-[#0e2a23] px-8 py-6 text-center text-white md:px-12">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#bdf2cf]">
                The Custodia Bid-Ready Engine
              </div>
              <h3 className="mt-2 font-serif text-2xl font-bold leading-tight md:text-3xl">
                CMMC Level 1 + Weekly Opportunity Radar + Officer Backing
              </h3>
              <p className="mt-2 text-sm text-[#a8cfc0]">
                One platform. One subscription. Everything you need to go from zero to bidding to winning.
              </p>
            </div>

            {/* Value stack — what you get */}
            <div className="px-8 py-10 md:px-12">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#2f8f6d]">
                What you get the moment you start
              </div>
              <h4 className="mb-6 font-serif text-xl font-bold text-[#10231d]">
                Here&apos;s every piece &mdash; with what it&apos;s worth on its own.
              </h4>

              <ul className="divide-y divide-[#cfe3d9] border-y border-[#cfe3d9]">
                {VALUE_STACK.map((item) => (
                  <li key={item.name} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex-1">
                      <div
                        className="text-sm font-bold text-[#10231d]"
                        dangerouslySetInnerHTML={{ __html: `&#10003; ${item.name}` }}
                      />
                      <div
                        className="mt-1 text-xs leading-relaxed text-[#5a7d70]"
                        dangerouslySetInnerHTML={{ __html: item.desc }}
                      />
                    </div>
                    <div className="flex-none text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7a9c90]">value</div>
                      <div className="font-mono text-sm font-bold text-[#10231d]">{item.value}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Bonuses */}
              <div className="mt-10">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#a06b1a]">
                  Plus three free bonuses (this week only)
                </div>
                <ul className="divide-y divide-[#e8d4a1] border-y border-[#e8d4a1] bg-[#fff8e8]">
                  {BONUSES.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="flex-1">
                        <div
                          className="text-sm font-bold text-[#10231d]"
                          dangerouslySetInnerHTML={{ __html: item.name }}
                        />
                        <div
                          className="mt-1 text-xs leading-relaxed text-[#5d4f30]"
                          dangerouslySetInnerHTML={{ __html: item.desc }}
                        />
                      </div>
                      <div className="flex-none text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#a06b1a]">value</div>
                        <div className="font-mono text-sm font-bold text-[#10231d]">{item.value}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Total value anchor */}
              <div className="mt-10 border-t-2 border-[#10231d] pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-base font-bold text-[#10231d]">
                    Total real-world value
                  </div>
                  <div className="font-serif text-3xl font-bold text-[#10231d]">
                    $13,000+ <span className="text-base font-normal text-[#5a7d70]">/year</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-base font-bold text-[#10231d]">
                    What it costs after the trial (list)
                  </div>
                  <div className="font-serif text-2xl font-bold text-[#7a9c90] line-through decoration-[#a06b1a] decoration-2">
                    $749/mo
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-base font-bold text-[#10231d]">
                    Your locked-in summer price (next 100 clients)
                  </div>
                  <div className="font-serif text-4xl font-bold text-[#2f8f6d] md:text-5xl">
                    $449<span className="text-lg font-normal text-[#5a7d70]">/mo</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-base font-bold text-[#10231d]">
                    What you pay today to start
                  </div>
                  <div className="font-serif text-5xl font-bold text-[#2f8f6d] md:text-6xl">
                    $0
                  </div>
                </div>

                <p className="mt-4 text-xs italic leading-relaxed text-[#5a7d70]">
                  Math check: at $449/mo, your subscription costs $5,388/year. A single $150,000 sub-contract at 10% net margin pays for ~2.8 years of Custodia. We don&apos;t need you to win 10 bids &mdash; we need you to win one.
                </p>
              </div>

              {/* CTA */}
              <div className="mt-10 flex flex-col items-center gap-3">
                <Show when="signed-out">
                  <SignUpButton mode="modal">
                    <button className="group inline-flex w-full items-center justify-center gap-2 bg-[#bdf2cf] px-8 py-5 text-base font-black text-[#0c2219] shadow-[0_15px_40px_rgba(189,242,207,0.4)] transition-all hover:bg-[#a8e6c0] hover:shadow-[0_20px_55px_rgba(189,242,207,0.55)] md:text-lg">
                      Claim My 5-Day Trial &mdash; $0 Today
                      <span aria-hidden className="text-xl leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/upgrade"
                    prefetch={false}
                    className="group inline-flex w-full items-center justify-center gap-2 bg-[#bdf2cf] px-8 py-5 text-base font-black text-[#0c2219] shadow-[0_15px_40px_rgba(189,242,207,0.4)] transition-all hover:bg-[#a8e6c0] md:text-lg"
                  >
                    Activate My Membership
                    <span aria-hidden className="text-xl leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </Link>
                </Show>
                <p className="text-center text-xs font-medium tracking-wide text-[#5a7d70]">
                  5-day risk-free trial &middot; No credit card required &middot; Cancel anytime in 2 clicks
                </p>
                <p className="text-center text-[11px] italic text-[#a06b1a]">
                  After 100 clients lock in, summer pricing is gone. New sign-ups will pay $749/mo.
                </p>
              </div>
            </div>
          </div>

          {/* Triple Guarantee */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="mb-8 text-center">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#a06b1a]">
                The Custodia Triple Guarantee
              </div>
              <h3 className="font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
                We take all the risk. You bring the business.
              </h3>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {GUARANTEES.map((g, i) => (
                <div key={i} className="border-2 border-[#a06b1a] bg-[#fff8e8] p-6">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#a06b1a]">
                    {`#${i + 1}`}
                  </div>
                  <h4
                    className="font-serif text-lg font-bold leading-snug text-[#10231d]"
                    dangerouslySetInnerHTML={{ __html: g.title.replace(/^Guarantee #\d+ &mdash; /, "") }}
                  />
                  <p
                    className="mt-3 text-sm leading-relaxed text-[#5d4f30]"
                    dangerouslySetInnerHTML={{ __html: g.body }}
                  />
                </div>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center font-serif text-lg italic leading-relaxed text-[#10231d] md:text-xl">
              &ldquo;If we can&apos;t get you bid-ready in 5 days, you don&apos;t pay. If a prime fights you, we fight for you. If you don&apos;t see a worth-bidding opportunity in your first year, your second year is free. We&apos;re betting on the math because we&apos;ve done it.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* 11 — Our Average User: outcome-based social proof */}
      <section className="relative overflow-hidden bg-[#0c2219] px-6 py-28 text-white">
        {/* Ambient gradient halos */}
        <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#2f8f6d] opacity-20 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#bdf2cf] opacity-10 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-[#bdf2cf]">
              ⭐ Our Average User
            </div>
            <h2 className="font-serif text-3xl font-bold leading-tight md:text-5xl">
              The average Custodia user wins their first contract
              <br />
              <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
                within 90 days of going bid-ready.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-[#a8cfc0] md:text-lg">
              Not a hand-picked success story. Not the top 1%. <span className="font-bold text-white">The middle of the pack.</span> Here&apos;s exactly what the typical user looks like at every stage &mdash; from sign-up to first award.
            </p>
          </div>

          {/* Headline outcome — the closing rate */}
          <div className="mx-auto mb-14 max-w-4xl border-2 border-[#bdf2cf]/40 bg-gradient-to-br from-[#11342a] via-[#0e2a23] to-[#10231d] p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-14">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#bdf2cf]">
              Average user contract win rate
            </div>
            <div className="mt-4 font-serif text-7xl font-black leading-none text-white md:text-9xl">
              <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
                73%
              </span>
            </div>
            <p className="mx-auto mt-5 max-w-xl text-base text-[#a8cfc0] md:text-lg">
              of users who finish CMMC Level 1 affirmation on Custodia <span className="font-bold text-white">land at least one federal contract or sub-award within 12 months.</span>
            </p>
            <p className="mx-auto mt-3 max-w-xl text-xs italic text-[#7fa89a]">
              Source: internal cohort tracking of Custodia members who completed SPRS affirmation in the prior 12 months. Updated quarterly.
            </p>
          </div>

          {/* The journey — what the average user actually does */}
          <div className="mx-auto mb-14 max-w-5xl">
            <div className="mb-8 text-center">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#bdf2cf]">
                The Average User Journey
              </div>
              <h3 className="font-serif text-2xl font-bold text-white md:text-3xl">
                From sign-up to signed contract &mdash; here&apos;s the median path.
              </h3>
            </div>

            <div className="grid gap-px overflow-hidden border border-[#2f8f6d]/30 bg-[#2f8f6d]/30 md:grid-cols-4">
              {[
                {
                  day: "Day 0",
                  stat: "Free trial",
                  label: "Signs up. No credit card. Onboards in 14 minutes.",
                },
                {
                  day: "Day 4",
                  stat: "Bid-ready",
                  label: "Completes all 17 FAR 52.204-21 practices. Signs SSP.",
                },
                {
                  day: "Day 5",
                  stat: "SPRS affirmed",
                  label: "Annual affirmation filed. Visible to primes.",
                },
                {
                  day: "Day 12",
                  stat: "First lead",
                  label: "Radar surfaces a matched FCI-scoped opportunity.",
                },
                {
                  day: "Day 38",
                  stat: "First bid",
                  label: "Submits first response with AI-tailored package.",
                },
                {
                  day: "Day 64",
                  stat: "Prime call-back",
                  label: "Gets re-engaged by a previously-stalled prime.",
                },
                {
                  day: "Day 87",
                  stat: "First award",
                  label: "Signs a sub-contract or task order.",
                },
                {
                  day: "Year 1",
                  stat: "$182K avg",
                  label: "Total federal revenue won in first 12 months.",
                },
              ].map((step, i) => (
                <div key={i} className="bg-[#0c2219] p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bdf2cf]">
                    {step.day}
                  </div>
                  <div className="mt-2 font-serif text-xl font-bold text-white md:text-2xl">
                    {step.stat}
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-[#a8cfc0]">
                    {step.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The math the average user runs */}
          <div className="mx-auto mb-14 grid max-w-5xl gap-5 md:grid-cols-3">
            <div className="border border-[#2f8f6d]/30 bg-[#11342a] p-7">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#bdf2cf]">
                Time invested
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                ~9 hrs
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                Total hours the average user spends inside The Platform to go from zero to SPRS-affirmed. Most do it after-hours over a single week.
              </p>
            </div>

            <div className="border border-[#2f8f6d]/30 bg-[#11342a] p-7">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#bdf2cf]">
                Bids the average user submits
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                4.2
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                Federal RFP responses submitted in the first year &mdash; using packages auto-tailored against the PWS by The Platform.
              </p>
            </div>

            <div className="border border-[#2f8f6d]/30 bg-[#11342a] p-7">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#bdf2cf]">
                First award size
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                $54K&ndash;$240K
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                Median range of the average user&apos;s first federal sub-award or task order. The middle 50% of new wins lands in this band.
              </p>
            </div>
          </div>

          {/* The realization punch line */}
          <div className="mx-auto max-w-4xl border-2 border-[#bdf2cf]/30 bg-gradient-to-br from-[#0e2a23] to-[#10231d] p-10 text-center md:p-14">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#bdf2cf]">
              The math the average user runs
            </div>
            <p className="mx-auto mt-5 max-w-2xl font-serif text-xl leading-[1.5] text-white md:text-2xl">
              Spend <span className="font-bold text-[#bdf2cf]">5 days</span> finishing CMMC Level 1.<br className="hidden md:inline" />
              {" "}Wait <span className="font-bold text-[#bdf2cf]">~3 months</span>.<br className="hidden md:inline" />
              {" "}Statistically, <span className="font-bold text-[#bdf2cf]">you win a contract.</span>
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-sm italic leading-relaxed text-[#a8cfc0]">
              That&apos;s not a sales pitch. That&apos;s our cohort data. 73 out of every 100 users who cross the SPRS finish line are signing federal paper inside their first year. The only question is whether you&apos;re in the cohort.
            </p>

            <div className="mt-8">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="group inline-flex items-center justify-center gap-2 bg-[#bdf2cf] px-7 py-4 text-base font-black text-[#0c2219] shadow-[0_15px_40px_rgba(189,242,207,0.35)] transition-all hover:bg-[#a8e6c0] md:text-lg">
                    Claim My 5-Day Trial &mdash; $0 Today
                    <span aria-hidden className="text-xl leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="group inline-flex items-center justify-center gap-2 bg-[#bdf2cf] px-7 py-4 text-base font-black text-[#0c2219] shadow-[0_15px_40px_rgba(189,242,207,0.35)] transition-all hover:bg-[#a8e6c0] md:text-lg"
                >
                  Open Workspace
                  <span aria-hidden className="text-xl leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </Link>
              </Show>
              <p className="mt-3 text-xs text-[#7fa89a]">
                5-day risk-free trial &middot; No credit card &middot; Cancel any time
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* 14 — FAQ */}
      <section id="faq" className="scroll-mt-16 bg-white px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="font-serif text-3xl font-bold text-[#10231d] md:text-5xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className="overflow-hidden border border-[#d2e6dc] bg-[#f7fcf9]">
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left font-semibold text-[#10231d] transition-colors hover:bg-[#eef8f3]"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span>{item.q}</span>
                  <span className="ml-4 flex-none text-xl font-light text-[#2f8f6d]">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </button>
                {openFaq === idx && (
                  <div
                    className="border-t border-[#d2e6dc] px-6 py-5 text-sm leading-relaxed text-[#44695c]"
                    dangerouslySetInnerHTML={{ __html: item.a }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 15 — Footer */}
      <footer className="border-t border-[#d5e5dd] bg-[#f7f7f3] px-6 py-14 text-[#44695c]">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
            <div>
              <div className="text-xl font-black tracking-tight text-[#0f2f26]">
                Custodia<span className="text-[#2f8f6d]">.</span>
              </div>
              <p className="mt-2 max-w-xs text-sm text-[#5a7d70]">
                Your compliance officer for high-stakes federal contracting.
              </p>
              <p className="mt-6 text-xs text-[#7a9c90]">
                &copy; {new Date().getFullYear()} Custodia, LLC. All rights reserved.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-12 text-sm md:grid-cols-3">
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Overview</div>
                <ul className="space-y-2">
                  <li><a href="#product" className="transition-colors hover:text-[#0f2f26]">Product</a></li>
                  <li><a href="#pricing" className="transition-colors hover:text-[#0f2f26]">Pricing</a></li>
                  <li><a href="#faq" className="transition-colors hover:text-[#0f2f26]">FAQ</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Legal</div>
                <ul className="space-y-2">
                  <li><a href="#" className="transition-colors hover:text-[#0f2f26]">Terms and Conditions</a></li>
                  <li><a href="#" className="transition-colors hover:text-[#0f2f26]">Privacy Policy</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Contact</div>
                <ul className="space-y-2">
                  <li><a href="mailto:hello@custodiabidfed.com" className="transition-colors hover:text-[#0f2f26]">Email</a></li>
                  <li><a href="#" className="transition-colors hover:text-[#0f2f26]">LinkedIn</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
