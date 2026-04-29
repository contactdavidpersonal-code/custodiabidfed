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

const FREE_INCLUDES = [
  "Full Platform access &mdash; no time limit, no credit card",
  "AI-guided onboarding in 5 minutes &mdash; no 40-field forms",
  "Plain-English walkthrough of all 17 FAR 52.204-21 practices",
  "Auto-drafted SSP narratives for every control &mdash; accept or edit",
  "Per-control evidence vault with smart classification",
  "Live readiness score, broken down by domain",
  "Read-only previews of your SSP and affirmation memo",
  "AI-drafted federal capability statement",
  "Weekly SAM.gov opportunity radar &mdash; matched to your NAICS",
  "Ask the in-platform AI to search SAM.gov live &mdash; &lsquo;find me cyber contracts in 541512 closing in 30 days&rsquo;",
  "Fiscal compass: federal calendar &amp; milestone reminders",
];

const MEMBERSHIP_INCLUDES = [
  "Everything in Free, plus:",
  "Generate the bid-ready package &mdash; signed affirmation memo, SSP, full evidence inventory ZIP",
  "AI evidence auto-review on every artifact &mdash; instant gap detection",
  "AI per-opportunity packet tailoring &mdash; one click from any SAM.gov notice",
  "SPRS submission instructions, step by step",
  "Evidence freshness watchtower &mdash; auto-flags expiring scans, screenshots, training",
  "Compliance officer tickets &mdash; ask a Custodia officer any CMMC question, anytime",
  "Year-round monitoring &mdash; flags changed controls automatically",
  "Annual re-affirmation included &mdash; ready every Oct 1, no extra charge",
  "Prime questionnaire support via ticket",
  "Custodia Guarantee &mdash; officer-backed challenge resolution with primes",
];

const FAQ_ITEMS = [
  {
    q: "How does free work? When do I need to pay?",
    a: "Create a free account and use The Platform without limits &mdash; walk all 17 practices, draft SSP narratives, upload evidence, and watch your readiness score build. You only pay when you&apos;re ready to generate the bid-ready package: signed affirmation memo, full evidence inventory, and SPRS submission instructions. Build first. Pay when it&apos;s time to bid.",
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
    a: "Most clients complete their initial compliance package in 3&ndash;5 business days with The Platform. You can move at your own pace &mdash; the free tier never expires, so there&apos;s no pressure to finish on someone else&apos;s timeline.",
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
    q: "Why does the package cost money if the build is free?",
    a: "SPRS affirmations carry legal weight under 18 USC 1001 and the False Claims Act. The free tier walks you through the build; membership is what generates the signed bid-ready package, keeps your posture fresh year-round, and gives you direct access to a Custodia compliance officer via ticket whenever a CMMC question comes up. The Custodia Guarantee covers you if a prime or contracting officer pushes back.",
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
                <Link href="/assessments" prefetch={false} className="rounded-xl bg-[#bdf2cf] px-4 py-2 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
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
            How Established Business Owners Are Adding{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              6&ndash;7 Figures
            </span>{" "}
            in Federal Revenue
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            Custodia walks you through CMMC Level&nbsp;1 in plain English, hands you a bid-ready package no prime can pick apart, and then emails you matched contract opportunities every Monday morning &mdash; until you win one. <span className="font-semibold text-white">One award covers years of subscription.</span> Build the entire package free; pay only when you&apos;re ready to bid.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="group inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-8 py-4 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.22)] transition-all hover:bg-[#a8e6c0] hover:shadow-[0_15px_55px_rgba(189,242,207,0.32)] md:text-lg">
                  Show Me My Contracts &mdash; Free
                  <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </SignUpButton>
              <a
                href="#pricing"
                className="rounded-xl border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See the math
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-8 py-4 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.22)] transition-all hover:bg-[#a8e6c0] md:text-lg"
              >
                Continue in workspace
                <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <a
                href="#pricing"
                className="rounded-xl border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See the math
              </a>
            </Show>
          </div>

          <p className="mt-5 text-xs font-medium tracking-wide text-[#7aab98]">
            No credit card required &middot; 5-day free trial &middot; Cancel anytime
          </p>

          {/* Below-headline outcome line — sets expectation for what's next */}
          <p className="mx-auto mt-10 max-w-2xl border-t border-white/[0.08] pt-8 font-serif text-base italic leading-snug text-[#bdf2cf] md:text-lg">
            &ldquo;The DoD spends $80B/year with small businesses. The only thing standing between you and a slice of it is one piece of paperwork. We file it for you.&rdquo;
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
                className="rounded-3xl border border-[#cfe3d9] bg-white p-7 shadow-[0_8px_28px_rgba(14,48,37,0.05)]"
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
            <div className="rounded-3xl border border-[#e8d4a1] bg-[#fff8e8] p-8">
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

            <div className="rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                The Custodia answer
              </div>
              <h3 className="mt-3 font-serif text-2xl font-bold">
                Bid-ready in days. Free until you are.
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
                  <button className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-6 py-3 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
                    Start For Free
                    <span aria-hidden className="text-lg leading-none">&rarr;</span>
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-6 py-3 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Continue in workspace
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
              </Show>
              <p className="mt-3 text-xs text-[#7aab98]">No credit card required &middot; Pay only for the bid-ready package</p>
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
                className={`relative flex flex-col rounded-3xl border p-6 ${
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
                  className={`mt-5 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
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
                  className="rounded-3xl border border-[#e8d4a1] bg-[#fff8e8] p-6"
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
          <div className="rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_45px_rgba(14,48,37,0.2)] md:p-12">
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
                  className="rounded-2xl border border-[#2a5a49] bg-[#193d31] p-6"
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
            <div className="rounded-3xl border border-[#cfe3d9] bg-[#f7fcf9] p-8">
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
            <div className="rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
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
          <div className="mt-12 overflow-hidden rounded-3xl border border-[#cfe3d9] bg-[#f7fcf9]">
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
          <div className="grid gap-0 overflow-hidden rounded-3xl border-2 border-[#2f8f6d] bg-white shadow-[0_25px_60px_rgba(14,48,37,0.12)] md:grid-cols-[1.1fr_1fr]">
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
              <div className="rounded-2xl border border-[#cfe3d9] bg-white shadow-sm">
                {/* Email header */}
                <div className="flex items-center gap-3 border-b border-[#cfe3d9] px-5 py-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#2f8f6d] text-xs font-bold text-white">
                    C
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-bold text-[#10231d]">Custodia &mdash; This Monday&apos;s federal opportunities</div>
                    <div className="truncate text-[#5a7d70]">opportunities@bidfedcmmc.com &middot; to you &middot; 7:02 AM</div>
                  </div>
                  <div className="hidden flex-none rounded-sm bg-[#bdf2cf] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#10231d] sm:block">
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
                              className="rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f8f6d]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="flex-none rounded-sm border border-[#2f8f6d] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2f8f6d]"
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
            <div className="rounded-2xl border border-[#cfe3d9] bg-white p-7">
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
            <div className="rounded-2xl border-2 border-[#2f8f6d] bg-[#f7fcf9] p-7 shadow-sm">
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
            <div className="rounded-2xl border border-[#cfe3d9] bg-white p-7">
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
          <div className="mt-10 rounded-2xl border border-[#2f8f6d] bg-[#0e2a23] px-8 py-6 text-center text-white">
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
              <div key={d.title} className="rounded-3xl border border-[#2a5a49] bg-[#193d31] p-7">
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
            Here&apos;s the path you&apos;ll walk inside The Platform. Free for the first five steps. Membership unlocks at step six, when your package is ready to ship.
          </p>

          <ol className="relative mt-16 space-y-12 border-l-2 border-[#cfe3d9] pl-10 md:pl-14">
            {[
              {
                n: "01",
                tag: "FREE",
                paid: false,
                title: "Create your free account",
                time: "30 seconds",
                desc: "Email and password through Clerk. No credit card. Land in The Platform and pick up where you left off across devices.",
              },
              {
                n: "02",
                tag: "FREE",
                paid: false,
                title: "Onboard in conversation",
                time: "5 minutes",
                desc: "The Platform asks about your business, the FCI you handle, and your tech stack. It captures the legal-identity details you'd otherwise type into a 40-field form.",
              },
              {
                n: "03",
                tag: "FREE",
                paid: false,
                title: "Walk the 17 CMMC practices",
                time: "30&ndash;60 minutes per session",
                desc: "Each FAR 52.204-21 requirement is explained in plain English with capture steps tailored to your stack &mdash; M365, Google Workspace, Okta, AWS, on-prem, or no IT at all.",
              },
              {
                n: "04",
                tag: "FREE",
                paid: false,
                title: "Upload your evidence",
                time: "As you go",
                desc: "Screenshots, exports, signed rosters, policy PDFs. The Platform tags every artifact to a control and tracks your readiness score in real time.",
              },
              {
                n: "05",
                tag: "FREE",
                paid: false,
                title: "Draft your SSP narratives",
                time: "Auto-drafted",
                desc: "Auto-generated SSP narratives for every control, written from your inputs. Accept or edit in one click &mdash; no blank-page panic.",
              },
              {
                n: "06",
                tag: "MEMBERSHIP",
                paid: true,
                title: "Generate your bid-ready package",
                time: "On demand",
                desc: "AI auto-reviews every artifact for instant gap detection. When you&apos;re ready, generate the bid-ready ZIP: SSP, signed affirmation memo, evidence inventory. Officers are on-call via tickets if you hit a question along the way.",
              },
              {
                n: "07",
                tag: "MEMBERSHIP",
                paid: true,
                title: "File in SPRS and start bidding",
                time: "Same day",
                desc: "Step-by-step SPRS submission instructions. The moment you affirm, you can respond to prime questionnaires, agency RFPs, SBIR Phase II solicitations, and small-business set-asides &mdash; with a defensible package behind you.",
              },
              {
                n: "08",
                tag: "MEMBERSHIP",
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

          <div className="mt-16 rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_45px_rgba(14,48,37,0.18)] md:p-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">where it ends</div>
            <h3 className="mt-3 font-serif text-3xl font-bold leading-tight md:text-4xl">
              You, bidding on contracts. With a defensible package behind you.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#cce5da]">
              The first five steps are free, forever. You only pay when you&apos;re ready to generate your bid-ready package &mdash; at step six.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]">
                    Start For Free
                    <span aria-hidden className="text-lg leading-none">&rarr;</span>
                  </button>
                </SignUpButton>
                <a href="#pricing" className="rounded-xl border border-[#2f8f6d]/40 px-7 py-3.5 text-base font-semibold text-[#cce5da] transition-colors hover:border-[#8dd2b1]/60 hover:text-white">
                  See pricing
                </a>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Continue your journey
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
              </Show>
            </div>
            <p className="mt-4 text-xs text-[#7aab98]">
              No credit card required to start &middot; Membership unlocks at step six
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
            <div className="rounded-3xl border border-[#cfe3d9] bg-[#f7fcf9] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">phase 01</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#10231d]">Build your posture</h3>
                </div>
                <span className="rounded-full bg-[#e8f7ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f5c47]">free</span>
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
            <div className="rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">phase 02</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold">Bid with confidence</h3>
                </div>
                <span className="rounded-full bg-[#bdf2cf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0c2219]">membership</span>
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
            <div className="rounded-3xl border border-[#cfe3d9] bg-[#f7fcf9] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">phase 03</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#10231d]">Find the contracts</h3>
                </div>
                <span className="rounded-full bg-[#e8f7ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f5c47]">free</span>
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
            <div className="rounded-3xl border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_40px_rgba(14,48,37,0.18)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">phase 04</div>
                  <h3 className="mt-1 font-serif text-2xl font-bold">Stay compliant, year-round</h3>
                </div>
                <span className="rounded-full bg-[#bdf2cf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0c2219]">membership</span>
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

          <div className="mt-12 rounded-2xl border border-[#cfe3d9] bg-[#f7fcf9] p-6 text-center md:p-8">
            <p className="font-serif text-xl text-[#10231d] md:text-2xl">
              Free covers the build and the radar. Membership covers the bid, the win, and the maintenance.
            </p>
            <p className="mt-3 text-sm text-[#5a7d70]">
              Sign up free, build your posture, watch the SAM radar fill up, and upgrade the moment you&apos;re ready to download a bid-ready package.
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
                payback: "5 years of Custodia",
                ratio: "5.0x",
              },
              {
                tier: "SBIR Phase II",
                size: "$400,000",
                net: "8%",
                profit: "$32,000",
                payback: "10.7 years of Custodia",
                ratio: "10.7x",
                highlight: true,
              },
              {
                tier: "Prime sub-contract",
                size: "$1,200,000",
                net: "10%",
                profit: "$120,000",
                payback: "40+ years of Custodia",
                ratio: "40x",
              },
            ].map((s) => (
              <div
                key={s.tier}
                className={`flex flex-col rounded-3xl border p-7 ${
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
          <div className="mt-10 rounded-3xl border border-[#2a5a49] bg-[#163027] p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div className="text-center md:text-right">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                  You pay
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-white md:text-5xl">
                  $249/mo
                </div>
                <div className="mt-1 text-sm text-[#a8cfc0]">
                  $2,988/year &middot; cancel anytime
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
              &ldquo;Win one contract from anything The Platform sends you, and Custodia is paid for through 2030.&rdquo;
            </p>
          </div>

          {/* Caveats / honesty */}
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-[#7aab98]">
            Source ranges based on FY2023 SBA Small Business Goaling Report and DoD CAS / FAR 15.404 weighted-guidelines analysis. Net margins for federal small-business contractors typically run 6&ndash;20% depending on contract type (cost-plus, FFP, T&amp;M, sub-contract). Your numbers will vary &mdash; the directional math doesn&apos;t.
          </p>
        </div>
      </section>

      {/* 10 — Pricing */}
      <section id="pricing" className="scroll-mt-16 border-y border-[#d5e5dd] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">start today</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-6xl">
              Start free now. Bid when you&apos;re ready.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#44695c]">
              Every week you wait is a contract someone else is bidding on. Sign up free, build your package today, and pay only when it&apos;s time to download the bid-ready ZIP and start winning the work.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">

            {/* Free Forever */}
            <div className="flex flex-col rounded-3xl border border-[#cfe3d9] bg-[#f7fcf9] p-7">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#2f8f6d]">Free forever</div>
              <div className="font-serif text-3xl font-bold text-[#10231d]">$0</div>
              <p className="mt-2 text-sm text-[#496f61]">
                Build your CMMC Level 1 package in The Platform. No time limit. No credit card.
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {FREE_INCLUDES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#31594d]">
                    <span className="mt-0.5 flex-none text-[#2f8f6d]">✓</span>
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="mt-8 w-full rounded-xl border-2 border-[#104d3a] px-6 py-3 font-bold text-[#104d3a] transition-colors hover:bg-[#f0f9f5]">
                    Start For Free
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/assessments" prefetch={false} className="mt-8 block w-full rounded-xl border-2 border-[#104d3a] px-6 py-3 text-center font-bold text-[#104d3a] transition-colors hover:bg-[#f0f9f5]">
                  Open workspace
                </Link>
              </Show>
              <p className="mt-3 text-center text-xs text-[#5d8376]">No credit card required</p>
            </div>

            {/* Membership */}
            <div className="flex flex-col rounded-3xl border-2 border-[#2f8f6d] bg-white p-7 shadow-[0_12px_36px_rgba(14,48,37,0.12)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2f8f6d]">CMMC 1 membership</span>
                <span className="rounded-full bg-[#2f8f6d] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  for the package
                </span>
              </div>
              <div className="font-serif text-3xl font-bold text-[#10231d]">
                $249<span className="text-lg font-normal text-[#6a9080]">/mo</span>
              </div>
              <p className="mt-2 text-sm text-[#496f61]">
                Generate the bid-ready package on demand and keep it current year-round. AI auto-review on every artifact. Officer help via ticket when you need it. Re-affirmation included.
              </p>
              <p className="mt-1 text-xs text-[#5d8376]">
                Billed monthly &middot; Cancel any time &middot; 7-day free trial, no credit card required
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {MEMBERSHIP_INCLUDES.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-sm ${
                      i === 0 ? "font-semibold text-[#10231d]" : "text-[#31594d]"
                    }`}
                  >
                    {i !== 0 && <span className="mt-0.5 flex-none text-[#2f8f6d]">✓</span>}
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="mt-8 w-full rounded-xl bg-[#104d3a] px-6 py-3 font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                    Start For Free
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/upgrade" prefetch={false} className="mt-8 block w-full rounded-xl bg-[#104d3a] px-6 py-3 text-center font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                  Upgrade to Membership
                </Link>
              </Show>
              <p className="mt-3 text-center text-xs text-[#5d8376]">7-day free trial &middot; No credit card</p>
            </div>
          </div>
        </div>
      </section>

      {/* 11 — Testimonials */}
      <section className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">testimonials</div>
            <h2 className="font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
              Real results from real contractors
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                quote: "Custodia took something that felt impossible &mdash; CMMC compliance for a 4-person team &mdash; and made it completely approachable. The Platform is clear, the officer support is real, and our package held up with our prime.",
                name: "J.M.",
                company: "Defense-tech startup &middot; SBIR awardee",
              },
              {
                quote: "A prime asked for our CMMC evidence with 3 weeks&apos; notice. Custodia got us compliant and filed in SPRS with time to spare. The Guarantee gave us confidence to submit without second-guessing every line.",
                name: "R.T.",
                company: "Engineering firm &middot; DoD subcontractor",
              },
              {
                quote: "The Platform walkthrough is genuinely impressive. It knew our stack, suggested the right evidence, and the SSP narratives saved us hours of writing. Highly recommend for any SMB in the federal space.",
                name: "S.P.",
                company: "Software startup &middot; First-time federal bidder",
              },
              {
                quote: "The officer support inside The Platform is what sets Custodia apart. Every question got a real answer, and when our prime pushed back, Custodia resolved it directly. We didn&apos;t have to fight that battle alone.",
                name: "M.H.",
                company: "Veteran-owned firm &middot; Pittsburgh, PA",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-3xl border border-[#cfe3d9] bg-white p-8">
                <p
                  className="text-base leading-relaxed text-[#3b5f53]"
                  dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }}
                />
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f7ef] text-sm font-bold text-[#1f5c47]">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#10231d]">{t.name}</div>
                    <div
                      className="text-xs text-[#6a9080]"
                      dangerouslySetInnerHTML={{ __html: t.company }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
              <div key={idx} className="overflow-hidden rounded-2xl border border-[#d2e6dc] bg-[#f7fcf9]">
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
