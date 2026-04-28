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
  "Platform-guided onboarding in 5 minutes",
  "Plain-English walkthrough of all 17 FAR 52.204-21 practices",
  "Draft and edit SSP narratives for every control",
  "Per-control evidence upload",
  "View your readiness score, broken down by domain",
  "Read-only previews of your SSP and affirmation memo",
];

const MEMBERSHIP_INCLUDES = [
  "Everything in Free, plus:",
  "Generate the bid-ready package &mdash; signed affirmation memo, SSP, full evidence inventory ZIP",
  "Officer review on every artifact before package generation",
  "SPRS submission instructions, step by step",
  "Year-round compliance monitoring &mdash; flags changed controls automatically",
  "1:1 Custodia Ticket Support &mdash; officer answers any question",
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
    a: "No. The Platform is designed for non-technical operators. Every practice is explained in plain English with specific steps tailored to your tech stack. A Custodia officer is available for any question once you upgrade to membership.",
  },
  {
    q: "What is included in the annual re-affirmation?",
    a: "Annual re-affirmation is included with every active membership. We flag changed controls, update your SSP, and prepare your SPRS re-submission every October at no additional charge. Your next cycle is ready before your fiscal year deadline.",
  },
  {
    q: "Why does the package cost money if the build is free?",
    a: "SPRS affirmations carry legal weight under 18 USC 1001 and the False Claims Act. We charge for the package because that&apos;s when a Custodia officer reviews every artifact, signs off on the evidence, and stands behind the package with our Guarantee. The officer review is the guarantee.",
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
        <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-24 text-center md:pb-36 md:pt-32">
          <h1
            className="font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
            style={{ textShadow: "0 4px 40px rgba(0,0,0,0.45)" }}
          >
            Access{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              $80B+
            </span>{" "}
            in gov contracts,
            <br className="hidden sm:block" />
            step by step on this platform.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-[#a8cfc0] md:text-xl">
            Custodia walks defense-tech contractors through CMMC Level 1 in plain English. Build your full package free in The Platform. Pay only when you&apos;re ready to bid.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="group inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.18)] transition-all hover:bg-[#a8e6c0] hover:shadow-[0_15px_55px_rgba(189,242,207,0.3)]">
                  Start For Free
                  <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </SignUpButton>
              <a
                href="#pricing"
                className="rounded-xl border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See pricing
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.18)] transition-all hover:bg-[#a8e6c0]"
              >
                Continue in workspace
                <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <a
                href="#pricing"
                className="rounded-xl border border-[#2f8f6d]/50 bg-white/[0.02] px-7 py-3.5 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white"
              >
                See pricing
              </a>
            </Show>
          </div>
          <p className="mt-6 text-xs font-medium tracking-wide text-[#7aab98]">
            Free forever &middot; No credit card required &middot; Cancel anytime
          </p>
        </div>

        {/* Bottom live-data strip */}
        <div className="relative border-t border-white/[0.08] bg-black/30 backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/[0.08] px-2 md:grid-cols-4 md:px-6">
            {[
              { value: "$80B+", label: "DoD small-business contracts" },
              { value: "220K+", label: "DIB companies subject to CMMC" },
              { value: "23%", label: "Federal set-aside (statute)" },
              { value: "17", label: "CMMC Level 1 practices" },
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
                  "No officer in the loop &mdash; easy to file something defensible-looking that isn't",
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
                  "Officer review on every artifact before you sign anything",
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
                  title: "Officer-reviewed, not self-assessed",
                  body: "Every artifact you upload is reviewed by a Custodia compliance officer. We catch the gaps an adversary or auditor would find &mdash; before they find them.",
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

      {/* 7 — Why Custodia is different */}
      <section className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">why custodia</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
              Built by CMMC professionals. Officer-backed.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#a8cfc0]">
              Most compliance products are templates and forms. Custodia is a cybersecurity firm with a Platform built to scale our officers &mdash; not replace them.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Cybersecurity firm, not a template",
                body: "Custodia is a veteran-owned cybersecurity firm in Pittsburgh, PA. We staff compliance officers, not customer-success reps. Officers review your evidence and sign off on your package.",
              },
              {
                title: "CMMC Level 1 specialists",
                body: "We do one thing &mdash; CMMC L1 for FCI handlers &mdash; and we do it all the way. No scope drift into L2 or L3. The seventeen practices are our entire focus.",
              },
              {
                title: "Officer in the loop on every package",
                body: "The Platform handles the structured 80% of the work. Officer judgment handles the remaining 20% &mdash; the part that decides whether your affirmation holds up under prime or contracting officer scrutiny.",
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
                title: "Officer review + bid-ready package",
                time: "Days, not months",
                desc: "A Custodia compliance officer reviews every artifact and your full package. Once cleared, you generate the bid-ready ZIP: SSP, signed affirmation memo, evidence inventory.",
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
              The first five steps are free, forever. You only pay when you&apos;re ready for officer review and your bid-ready package &mdash; at step six.
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
                Generate the bid-ready package and keep it current year-round. Officer review on every artifact. Re-affirmation included.
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
