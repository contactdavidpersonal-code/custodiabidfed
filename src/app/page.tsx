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

      {/* 1 — Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#e0ebe5] bg-[#f7f7f3]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-black tracking-tight text-[#0f2f26]">
            Custodia<span className="text-[#2f8f6d]">.</span>
          </span>
          <div className="hidden items-center gap-8 text-sm font-semibold text-[#3b5f53] md:flex">
            <a href="#product" className="transition-colors hover:text-[#10231d]">Product</a>
            <a href="#pricing" className="transition-colors hover:text-[#10231d]">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-[#10231d]">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="text-sm font-semibold text-[#3b5f53] transition-colors hover:text-[#10231d]">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-xl bg-[#104d3a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d3e2f]">
                  Create free account
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/assessments" prefetch={false} className="rounded-xl bg-[#104d3a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d3e2f]">
                Open workspace
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* 2 — Hero */}
      <section className="relative overflow-hidden bg-[#0e2a23] px-6 pb-24 pt-32 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(47,143,109,0.3),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#1a4035]/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
            CMMC Level 1 &middot; FAR 52.204-21 &middot; Veteran-owned
          </div>
          <h1 className="font-serif text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Win federal contracts like you&apos;re worth it
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#a8cfc0] md:text-xl">
            Custodia helps defense-tech contractors become CMMC Level 1 compliant and bid with confidence. Build your entire package in The Platform &mdash; free forever. Pay only when you&apos;re ready to download the bid-ready package.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="rounded-xl bg-[#8dd2b1] px-8 py-4 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#78c5a0]">
                  Create free account
                </button>
              </SignUpButton>
              <a href="#pricing" className="rounded-xl border border-[#2f8f6d]/60 px-8 py-4 text-base font-semibold text-[#8dd2b1] transition-colors hover:bg-[#1a4035]">
                See pricing
              </a>
            </Show>
            <Show when="signed-in">
              <Link href="/assessments" prefetch={false} className="rounded-xl bg-[#8dd2b1] px-8 py-4 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#78c5a0]">
                Continue in workspace
              </Link>
              <a href="#product" className="rounded-xl border border-[#2f8f6d]/60 px-8 py-4 text-base font-semibold text-[#8dd2b1] transition-colors hover:bg-[#1a4035]">
                See how it works
              </a>
            </Show>
          </div>
          <p className="mt-4 text-xs font-semibold tracking-wide text-[#7aab98]">
            Free forever &middot; No credit card required &middot; Veteran-owned cybersecurity firm
          </p>
          <div className="mt-14 flex flex-wrap items-start justify-center gap-4">
            {[
              { label: "Compliance", value: "Achieved", sub: "All 17 practices" },
              { label: "SPRS Score", value: "Filed", sub: "Binary affirmation" },
              { label: "Bid-ready", value: "100%", sub: "Of active clients" },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-[#2f8f6d]/40 bg-[#193d31] px-6 py-4 text-left">
                <div className="text-xs font-bold uppercase tracking-widest text-[#6bbf9a]">{m.label}</div>
                <div className="mt-1 text-3xl font-black text-white">{m.value}</div>
                <div className="text-xs text-[#7aab98]">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — Trust bar */}
      <section className="border-b border-[#e0ebe5] bg-[#f7f7f3] px-6 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6b9484]">
            Trusted by defense-tech startups, SBIR awardees, and DoD subcontractors across the U.S.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-[#9ab5ac]">
            <span>Pittsburgh, PA</span>
            <span>&middot;</span>
            <span>Veteran-owned</span>
            <span>&middot;</span>
            <span>Cybersecurity firm</span>
            <span>&middot;</span>
            <span>Government contractors</span>
            <span>&middot;</span>
            <span>DoD subcontractors</span>
          </div>
        </div>
      </section>

      {/* 4 — Value proposition */}
      <section id="product" className="scroll-mt-16 bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            value proposition
          </div>
          <div className="grid gap-16 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-serif text-4xl font-bold leading-tight text-[#10231d] md:text-5xl">
                Achieve compliance with clarity, confidence, and control
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[#44695c]">
                In a market driven by trust, your compliance posture defines how primes, contracting officers, and agencies view your business.
              </p>
              <div className="mt-8 rounded-2xl border border-[#cde5d8] bg-white p-6 shadow-sm">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                  CMMC Level 1 &mdash; Live progress
                </div>
                <div className="space-y-3">
                  {[
                    { domain: "Access Control (AC)", pct: 100 },
                    { domain: "Identification & Auth (IA)", pct: 100 },
                    { domain: "Media Protection (MP)", pct: 85 },
                    { domain: "Physical Protection (PE)", pct: 72 },
                  ].map((d) => (
                    <div key={d.domain}>
                      <div className="flex justify-between text-xs font-semibold text-[#355d50]">
                        <span>{d.domain}</span>
                        <span>{d.pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-[#e1efe8]">
                        <div
                          className="h-full rounded-full bg-[#2f8f6d] transition-all"
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-[#608679]">
                  Platform review catches gaps before a prime or auditor would.
                </p>
              </div>
            </div>
            <div className="space-y-8">
              {[
                {
                  title: "Master the 17 CMMC practices",
                  body: "The Platform walks every FAR 52.204-21 requirement in plain English, with evidence capture steps tailored to your exact tech stack &mdash; M365, Google Workspace, AWS, or on-prem.",
                },
                {
                  title: "Elevate your evidence posture",
                  body: "Get officer feedback on every artifact you upload. Screenshots, exports, signed rosters &mdash; gaps are caught before a prime or contracting officer finds them.",
                },
                {
                  title: "Build, measure, and maintain",
                  body: "Develop a defensible compliance program through Platform-guided analysis, a signed attestation package, and year-round monitoring that keeps you bid-ready.",
                },
              ].map((f) => (
                <div key={f.title} className="border-l-4 border-[#2f8f6d] pl-5">
                  <h3 className="font-serif text-xl font-bold text-[#10231d]">{f.title}</h3>
                  <p
                    className="mt-2 text-base leading-relaxed text-[#4a6f62]"
                    dangerouslySetInnerHTML={{ __html: f.body }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5 — Three features */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">Guided workflow</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              Close the gap, every time
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[#44695c]">
              Sharpen the compliance habits that make your contract packages precise and defensible.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Platform-guided practices",
                body: "The Platform walks your team through all 17 CMMC Level 1 requirements with plain-English instructions and capture steps tailored to your stack. No cybersecurity background required.",
              },
              {
                title: "Evidence reviewed by officers",
                body: "Get continuous guidance on body-of-evidence gaps. A Custodia officer reviews every upload and flags insufficient evidence before a prime would find it.",
              },
              {
                title: "SPRS-ready in days",
                body: "Build a defensible program through measurable Platform analysis and scenario-based evidence capture. From conversation to signed SPRS affirmation in days, not months.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-3xl border border-[#d2e6dc] bg-[#f7fcf9] p-7">
                <h3 className="font-serif text-2xl font-bold text-[#123328]">{f.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#4b7164]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — EMEC Protocol (equiv. to CLAPPS / Big 6) */}
      <section className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            EMEC Protocol analysis
          </div>
          <div className="grid gap-14 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-serif text-4xl font-bold leading-tight text-[#10231d] md:text-5xl">
                Move beyond scattered compliance
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#44695c]">
                The EMEC Protocol was developed by Custodia compliance officers for defense-tech operators who need to meet DoD requirements without becoming cybersecurity experts.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  {
                    letter: "E",
                    phase: "Engage",
                    desc: "Capture your legal identity, scope, and tech stack through conversation &mdash; no forms.",
                  },
                  {
                    letter: "M",
                    phase: "Map",
                    desc: "Walk all 17 CMMC Level 1 practices with tailored evidence capture steps.",
                  },
                  {
                    letter: "E",
                    phase: "Execute",
                    desc: "Sign the binary affirmation. Download your SSP, memo, and evidence inventory. File in SPRS.",
                  },
                  {
                    letter: "C",
                    phase: "Confirm",
                    desc: "Monitor your package year-round and re-affirm every October &mdash; included at no extra charge.",
                  },
                ].map((p) => (
                  <div key={p.phase} className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#104d3a] text-sm font-black text-[#8dd2b1]">
                      {p.letter}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#10231d]">{p.phase}</div>
                      <div
                        className="text-sm text-[#4a6f62]"
                        dangerouslySetInnerHTML={{ __html: p.desc }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Practice tracker mockup */}
            <div className="rounded-3xl border border-[#badacc] bg-white p-7 shadow-[0_15px_45px_rgba(14,48,37,0.08)]">
              <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                EMEC Protocol &middot; Phase 2 of 4
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#10231d]">Mapping your 17 practices</h3>
              <div className="mt-5 space-y-2">
                {[
                  { id: "AC.L1-3.1.1", label: "Authorized Access Control", done: true },
                  { id: "AC.L1-3.1.2", label: "Transaction & Function Control", done: true },
                  { id: "IA.L1-3.5.1", label: "Identify Users & Devices", done: true },
                  { id: "PE.L1-3.10.1", label: "Limit Physical Access", done: false },
                  { id: "SI.L1-3.14.1", label: "Identify & Correct System Flaws", done: false },
                ].map((ctrl) => (
                  <div
                    key={ctrl.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                      ctrl.done ? "bg-[#e8f7ef] text-[#1f5c47]" : "bg-[#f3f6f5] text-[#5e7f73]"
                    }`}
                  >
                    <span className={`flex-none font-bold ${ctrl.done ? "text-[#2f8f6d]" : "text-[#9bb5ac]"}`}>
                      {ctrl.done ? "✓" : "○"}
                    </span>
                    <span className="font-mono text-[10px] text-[#7a9c90]">{ctrl.id}</span>
                    <span className="font-semibold">{ctrl.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[#ffcf8a] bg-[#fff4de] px-4 py-3 text-xs text-[#83570d]">
                <strong>Officer note:</strong> Upload a screenshot of your MFA configuration to satisfy PE.L1-3.10.1.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 — SSP Document Assistant */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-14 md:grid-cols-2 md:items-center">
            {/* Mockup */}
            <div className="rounded-3xl border border-[#badacc] bg-[#f7fcf9] p-7 shadow-[0_15px_45px_rgba(14,48,37,0.08)]">
              <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                SSP Document Assistant &middot; The Platform
              </div>
              <div className="mt-1 text-sm text-[#4a6f62]">Drafting SSP narrative&hellip;</div>
              <div className="mt-4 rounded-xl border border-[#cde5d8] bg-white p-4 text-xs leading-relaxed text-[#31594d]">
                <strong>AC.L1-3.1.1 &mdash; Authorized Access Control</strong>
                <br /><br />
                [Company Name] restricts information system access to authorized users and the processes acting on behalf of those users. Access is granted on a need-to-know basis and reviewed quarterly by the designated system owner.
                <br /><br />
                <span className="font-semibold text-[#2f8f6d]">
                  Evidence attached: access-control-policy.pdf, user-access-review-Q1.xlsx
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded-lg bg-[#104d3a] px-4 py-2 text-xs font-bold text-white">
                  Accept narrative &rarr;
                </button>
                <button className="rounded-lg border border-[#cde5d8] px-4 py-2 text-xs font-semibold text-[#4a6f62]">
                  Edit
                </button>
              </div>
            </div>
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                Document assistant &middot; Custodia
              </div>
              <h2 className="font-serif text-4xl font-bold leading-tight text-[#10231d] md:text-5xl">
                Turn scattered evidence into a bid-ready package
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#44695c]">
                The Platform structures your SSP and refines language that resonates with primes and contracting officers.
              </p>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[#d2e6dc] p-5">
                  <h4 className="font-semibold text-[#14392f]">Auto-draft SSP narratives for all 17 controls</h4>
                  <p className="mt-1 text-sm text-[#4a6f62]">
                    Upload your policy docs and The Platform drafts SSP narratives for every practice &mdash; accept or edit in one click. No writing from scratch.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d2e6dc] p-5">
                  <h4 className="font-semibold text-[#14392f]">Translate technical controls into clarity</h4>
                  <p className="mt-1 text-sm text-[#4a6f62]">
                    Receive continuous guidance on how to explain your controls in plain language that primes and contracting officers can verify quickly and with confidence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8 — Impact / "For contractors, by veterans" */}
      <section className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">impact</div>
          <div className="grid gap-14 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">
                For contractors, by veterans
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#a8cfc0]">
                Custodia was founded by a veteran and cybersecurity professional in Pittsburgh, PA. We&apos;ve collaborated with compliance officers and former DoD program managers to develop the EMEC Protocol and our officer-backed Platform.
              </p>
              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-[#2a5a49] pt-8">
                {[
                  { stat: "17", label: "Practices covered" },
                  { stat: "100%", label: "Bid-ready rate" },
                  { stat: "$150K+", label: "Avg. contract value" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-3xl font-black text-white">{s.stat}</div>
                    <div className="mt-1 text-xs text-[#7aab98]">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Featured quote */}
            <div className="rounded-3xl border border-[#2a5a49] bg-[#193d31] p-8">
              <p className="text-base leading-relaxed text-[#c5e3d6]">
                &ldquo;Working with the federal market felt overwhelming &mdash; compliance language, SPRS, primes asking for evidence packages we didn&apos;t have. Custodia walked us through every step. We went from zero to bid-ready in a week. The Guarantee gave us real confidence our package would hold up under scrutiny.&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f8f6d] text-sm font-bold text-white">
                  D
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Defense-tech founder</div>
                  <div className="text-xs text-[#7aab98]">SBIR Phase II awardee &middot; Pittsburgh, PA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9 — Use cases */}
      <section className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">use cases</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              Professional-grade compliance for defense-tech excellence
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[#44695c]">
              Level up your compliance posture across every stage of federal contracting &mdash; build a culture of security and confidence.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "First-time federal bidder",
                desc: "Navigate SAM.gov, CAGE/UEI, and CMMC requirements from scratch with Platform guidance and officer support.",
              },
              {
                title: "SBIR awardee",
                desc: "Protect your FCI and meet DoD requirements without derailing your core R&D work or research timelines.",
              },
              {
                title: "Prime contractor pushback",
                desc: "Respond to prime security questionnaires and evidence requests with a defensible, officer-backed package.",
              },
              {
                title: "Annual re-affirmation",
                desc: "Renew your SPRS affirmation every October with zero friction &mdash; your package is maintained year-round.",
              },
              {
                title: "Internal team compliance",
                desc: "Elevate firm-wide security posture with Platform-guided reviews and officer oversight across your team.",
              },
            ].map((uc) => (
              <div
                key={uc.title}
                className="rounded-3xl border border-[#cfe3d9] bg-white p-7 shadow-[0_4px_16px_rgba(14,48,37,0.05)]"
              >
                <h3 className="font-serif text-xl font-bold text-[#14392f]">{uc.title}</h3>
                <p
                  className="mt-3 text-sm leading-relaxed text-[#4a6f62]"
                  dangerouslySetInnerHTML={{ __html: uc.desc }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10 — Pricing */}
      <section id="pricing" className="scroll-mt-16 border-y border-[#d5e5dd] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">pricing</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              Build for free. Pay when it&apos;s time to bid.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#44695c]">
              Use The Platform end-to-end at no cost. Upgrade only when you&apos;re ready to generate the bid-ready package.
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
                    Create free account
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
                    Start free, upgrade when ready
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

      {/* 12 — Blog / Resources */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">blog</div>
            <h2 className="font-serif text-3xl font-bold text-[#10231d]">The latest from Custodia</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                tag: "guide",
                title: "What CMMC Level 1 actually requires &mdash; and what it doesn&apos;t",
                cta: "Read more",
              },
              {
                tag: "news",
                title: "SPRS filing deadlines for FY2026: what every subcontractor needs to know",
                cta: "Read more",
              },
              {
                tag: "podcast",
                title: "Building a compliance culture at a 5-person defense-tech startup",
                cta: "Read more",
              },
            ].map((post) => (
              <div key={post.title} className="rounded-3xl border border-[#d2e6dc] bg-[#f7fcf9] p-7">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[#2f8f6d]">{post.tag}</div>
                <h3
                  className="font-serif text-xl font-bold leading-snug text-[#10231d]"
                  dangerouslySetInnerHTML={{ __html: post.title }}
                />
                <button className="mt-5 text-sm font-semibold text-[#2f8f6d] transition-colors hover:text-[#10231d]">
                  {post.cta} &rarr;
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 13 — CTA Banner */}
      <section className="border-y border-[#9ccfb9] bg-[#dcf4e6] px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-4xl font-bold leading-tight text-[#10231d] md:text-5xl">
            Make compliance your firm&apos;s most powerful advantage
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#3f6658]">
            Defense contracts worth $150K+ are waiting. Build your CMMC Level 1 package free in The Platform &mdash; pay only when you&apos;re ready to bid.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="rounded-xl bg-[#104d3a] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                  Create free account
                </button>
              </SignUpButton>
              <a href="#pricing" className="rounded-xl border-2 border-[#104d3a] px-8 py-4 text-base font-semibold text-[#104d3a] transition-colors hover:bg-white">
                See pricing
              </a>
            </Show>
            <Show when="signed-in">
              <Link href="/assessments" prefetch={false} className="rounded-xl bg-[#104d3a] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                Open workspace
              </Link>
            </Show>
          </div>
          <p className="mt-4 text-xs font-semibold text-[#3f6658]">
            Free forever &middot; No credit card &middot; Upgrade when you&apos;re ready to download the package
          </p>
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
