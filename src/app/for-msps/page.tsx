"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { motion } from "motion/react";
import { AdminLink } from "@/components/AdminLink";

// Cinematic Apple-style easing
const SECTION_EASE = [0.16, 1, 0.3, 1] as const;

// Viewport-revealed <section>. Drop-in replacement: same props, fades + lifts in
// once when 15% of the section enters the viewport.
function RevealSection({
  children,
  ...rest
}: ComponentProps<typeof motion.section>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.85, ease: SECTION_EASE }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

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

// What an MSP gets the moment they start the 14-day free trial. No credit card required.
// Stacked Hormozi-style: each line shows the standalone value across a 5-client book.
const VALUE_STACK = [
  { name: "Charlie-Guided CMMC L1 Build &mdash; per client", desc: "Your virtual Compliance Officer walks every client through all 15 FAR 52.204-21 safeguarding requirements in plain English. They answer; Charlie types. You bill.", value: "$2,400/client" },
  { name: "Auto-Drafted SSP &amp; Affirmation &mdash; per client", desc: "System Security Plan and signed affirmation generated from each client&apos;s answers. White-label-ready PDFs you can hand straight to the prime.", value: "$1,800/client" },
  { name: "Bid-Ready Package Generator &mdash; per client", desc: "One-click ZIP per client: SSP, affirmation, full evidence inventory. Hand off to your client or attach to the RFP yourself.", value: "$3,500/client" },
  { name: "M365 / Google Workspace Connectors", desc: "Auto-pull authorized-users, MFA status, audit logs from each client&apos;s tenant. Stop manually screenshotting evidence one client at a time.", value: "$1,200/mo" },
  { name: "AI Evidence Auto-Review", desc: "Every artifact your client uploads is gap-checked instantly. You see what&apos;s missing before the prime does &mdash; no human bottleneck.", value: "$1,200/mo" },
  { name: "Org Switcher &mdash; one login, all clients", desc: "Switch between client businesses from your header in one click. Same workspace, same Charlie, isolated data per tenant.", value: "Priceless" },
  { name: "SAM.gov Opportunity Feeds &mdash; per client", desc: "Each client gets their own NAICS-matched Monday digest. Drives client retention &mdash; they see Custodia (and you) delivering revenue, not just compliance paperwork.", value: "$497/client/mo" },
  { name: "Compliance Officer Backstop", desc: "Open a ticket any time on behalf of any client. A credentialed Custodia officer answers in writing. You stay the face; we&apos;re the muscle.", value: "$300/hr" },
  { name: "Year-Round Posture Watchtower &mdash; every client", desc: "Stale evidence, expiring scans, drifted controls flagged automatically across your entire book. One alert feed.", value: "$1,200/client/yr" },
  { name: "Annual SPRS Re-Affirmation &mdash; every client", desc: "Every Oct 1, every client&apos;s next SPRS submission is prepped automatically. No fire drill, no spreadsheet of due dates.", value: "$1,500/client/yr" },
  { name: "The Custodia Guarantee", desc: "If a prime or contracting officer ever challenges your client&apos;s package, a credentialed Custodia officer steps in &mdash; behind your MSP brand &mdash; and resolves it.", value: "Priceless" },
];

// What "you also get" stacks for the offer slide.
const BONUSES = [
  { name: "BONUS #1 &mdash; Capability Statement Generator (per client)", desc: "Federal-format one-pager generated for each client. Hand it to them as a deliverable; they hand it to primes.", value: "$497/client" },
  { name: "BONUS #2 &mdash; MSP Fiscal Compass", desc: "Federal calendar across all your clients: end-of-year obligation surges, Q4 spend windows, re-affirmation deadlines &mdash; one view.", value: "$297/yr" },
  { name: "BONUS #3 &mdash; MSP Milestone Reminders", desc: "Automated email nudges before each client&apos;s SPRS deadline, prime audit, or re-affirmation date. Never lose a client to a missed cycle.", value: "$197/yr" },
  { name: "BONUS #4 &mdash; Onboarding Playbook", desc: "The exact 5-step playbook to onboard a new CMMC L1 client in week 1 &mdash; intake form, kickoff script, evidence-collection checklist, hand-off email templates.", value: "$997" },
];

// Hormozi-style triple guarantee &mdash; reframed for MSPs.
const GUARANTEES = [
  {
    title: "Guarantee #1 &mdash; First Client Bid-Ready in Week 1, or We Stay With You",
    body: "Onboard your first client during the 14-day free trial &mdash; no credit card required to start. Most MSPs ship their first client&apos;s bid-ready package within the trial window. If your package isn&apos;t defensible to FAR 52.204-21 standard, our credentialed compliance officer rebuilds it with you, on our time, until it is. The platform is the leverage. The officer is the muscle behind your brand.",
  },
  {
    title: "Guarantee #2 &mdash; Officer-Backed Challenge Resolution &mdash; Behind Your Brand",
    body: "If a prime or contracting officer ever challenges one of your clients&apos; packages while you&apos;re a member, a Custodia compliance officer steps in to resolve it &mdash; behind your MSP brand. Your client sees you handling it; we do the heavy lifting. We don&apos;t hand you off. We don&apos;t go around you to your client. We resolve it.",
  },
  {
    title: "Guarantee #3 &mdash; Year-Round Posture Watchtower &mdash; Every Client",
    body: "As long as you&apos;re a member, every client business in your portfolio is watched. M365 and Google Workspace connectors continuously monitor evidence freshness, flag expiring scans/screenshots/training, and prep every client&apos;s annual SPRS re-affirmation every October. One alert feed across your whole book. No fire drills. No per-client surcharge.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the 14-day free trial work?",
    a: "Sign up with just an email &mdash; no credit card required. You get the full MSP platform free for 14 days: invite a real client business, run them through CMMC Level 1 with Charlie, generate their bid-ready package, file SPRS. Most MSPs ship their first client&apos;s package inside the trial. If you stay past day 14, add a card and pick Squad ($499/mo, up to 5 client businesses) or Platoon ($1,499/mo, up to 20). The Custodia Guarantee continues for the life of your membership.",
  },
  {
    q: "Can I rebrand the deliverables for my MSP?",
    a: "Yes. The signed SSP, affirmation memo, and bid-ready ZIP are clean PDFs without Custodia chrome by default &mdash; hand them to your client or attach them to the prime as your deliverable. Light white-label (your MSP logo on the cover) is on the roadmap; full white-label (custom domain, custom theme) is available on request for Platoon members.",
  },
  {
    q: "What happens if I leave the platform &mdash; does my client lose access?",
    a: "Your clients keep their data. The bid-ready packages, SSPs, evidence ZIPs, and SPRS affirmation history are exportable at any time. If you cancel, you can either (1) hand exports to your client and walk away, or (2) we&apos;ll work with you to migrate the client to a direct Custodia subscription so their compliance posture stays watched. We&apos;re a software platform, not a hostage situation.",
  },
  {
    q: "Do you sell direct to my clients?",
    a: "Not the ones you&apos;ve onboarded under your MSP account. Once a client is in your Squad or Platoon book, they belong to your MSP relationship &mdash; we don&apos;t market them, contact them, or invite them to switch to direct billing. We make money from MSPs serving DoD primes; cannibalizing your book would tank our biggest channel.",
  },
  {
    q: "Can I bring my existing clients in?",
    a: "Yes &mdash; that&apos;s the point. Click &lsquo;Create Organization&rsquo; in the workspace, name it after the client business, invite the client&apos;s owner or IT lead as a member, and start the CMMC L1 walkthrough. Each client gets their own isolated workspace under your one login. Onboarding a known client typically takes &lt;30 minutes; Charlie does the heavy lifting from there.",
  },
  {
    q: "How do you keep my client&apos;s FCI secure?",
    a: "Per-tenant envelope encryption with AWS KMS. Each client business has its own Data Encryption Key; the master KEK lives inside AWS KMS and never leaves. Custodia engineers can&apos;t read encrypted FCI without going through KMS, which is logged in CloudTrail. Tenant data is logically isolated &mdash; even if our database leaked, every client&apos;s ciphertext would still be unreadable on its own. U.S.-region hosting only. Aligned with FAR 52.204-21 safeguarding for Federal Contract Information.",
  },
  {
    q: "Does Charlie or any AI train on my client&apos;s FCI?",
    a: "No. Custodia only uses enterprise AI providers under a zero-retention, no-training contract &mdash; prompts and uploaded evidence are never used to train any model. Charlie reads in-context to answer the question, then the context is discarded. We do not sell, share, or feed any client&apos;s FCI to third-party AI, analytics, or marketing. No training. No retention. No exceptions.",
  },
  {
    q: "What&apos;s the pricing?",
    a: "Two MSP plans, monthly or annual: <b>Squad</b> &mdash; $499/mo (or $420/mo billed annually, 2 months free), manage up to 5 client businesses. <b>Platoon</b> &mdash; $1,499/mo (or $1,250/mo billed annually, 2 months free), manage up to 20 client businesses. Every client gets the full Custodia stack &mdash; Charlie, connectors, signed artifact pack, officer escalation. Unlimited team members per client. 14-day free trial on both. No credit card to start.",
  },
  {
    q: "Why a per-business cap instead of unlimited?",
    a: "Two reasons. (1) Every client business gets dedicated AI analysis, evidence storage, and credentialed officer escalation &mdash; that&apos;s real cost we want to scale honestly. (2) We&apos;re early; serving 30 businesses excellently beats 100 poorly. If you legitimately manage more than 20 DoD primes, email founders@custodia.com &mdash; we&apos;ll talk enterprise.",
  },
  {
    q: "How long does it take to onboard a client?",
    a: "Most MSPs onboard a new client in 30 minutes (intake + connector setup) and ship their bid-ready package within 3&ndash;5 business days. Charlie runs the interview; the client answers the questions only they can answer. You stay the relationship; we do the typing.",
  },
  {
    q: "What if a prime pushes back on my client&apos;s package?",
    a: "The Custodia Guarantee covers every active membership. A credentialed compliance officer steps in &mdash; behind your MSP brand &mdash; to resolve any prime or contracting officer challenge, including direct communication with the prime if needed, until your client&apos;s package is accepted.",
  },
  {
    q: "Does CMMC Level 1 cover what my clients actually need?",
    a: "CMMC Level 1 covers the ~80,000 DoD contractors who handle Federal Contract Information (FCI) and self-attest annually in SPRS &mdash; the largest tier of the Defense Industrial Base. If a client handles Controlled Unclassified Information (CUI), they need Level 2 (we don&apos;t do L2; we&apos;ll refer you to a C3PAO). For everyone else &mdash; the small DoD primes most MSPs actually serve &mdash; L1 is the gate, and Custodia handles it end-to-end.",
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-[#10231d]">

      {/* 1 + 2 — Cinematic header & hero */}
      <RevealSection className="relative overflow-hidden bg-[#08201a] text-white">
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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#7aab98] sm:px-6 sm:py-3 sm:text-[10px] sm:tracking-[0.24em]">
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
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <img
                src="/custodia-logo.png"
                alt="Custodia shield"
                className="h-8 w-auto [filter:drop-shadow(0_0_14px_rgba(0,0,0,0.85))_drop-shadow(0_2px_6px_rgba(0,0,0,0.7))] sm:h-10"
              />
              <span className="font-serif text-xl font-bold tracking-tight text-white [text-shadow:0_0_18px_rgba(0,0,0,0.9),0_2px_6px_rgba(0,0,0,0.75)] sm:text-2xl">
                Custodia<span className="text-[#8dd2b1]">.</span>
              </span>
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium text-[#cce5da] sm:gap-7">
              <a href="#product" className="hidden transition-colors hover:text-white sm:inline">Product</a>
              <a href="#pricing" className="hidden transition-colors hover:text-white sm:inline">Pricing</a>
              <Link href="/blog" className="hidden transition-colors hover:text-white sm:inline">Blog</Link>
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
                <AdminLink className="bg-[#08201a] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#bdf2cf] ring-1 ring-[#bdf2cf]/40 transition-colors hover:bg-[#0c2a22]" />
                <UserButton />
              </Show>
            </div>
          </div>
        </nav>

        {/* Hero text */}
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 text-center sm:px-6 sm:pb-28 sm:pt-20 md:pb-36 md:pt-28">
          <div className="mx-auto mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#0e2a23]/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#bdf2cf] backdrop-blur sm:px-4 sm:text-[10px] sm:tracking-[0.22em]">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#bdf2cf]" aria-hidden />
            <span className="truncate">Run a CMMC Level 1 Practice. Without Hiring For One.</span>
          </div>

          <h1
            className="font-serif text-[2rem] font-bold leading-[1.05] tracking-tight sm:text-[2.4rem] md:text-6xl lg:text-7xl"
            style={{ textShadow: "0 4px 40px rgba(0,0,0,0.45)" }}
          >
            <span className="block">
              Run a CMMC&nbsp;L1 Practice<span className="text-[#8dd2b1]">.</span>
            </span>
            <span className="block bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text pb-2 text-transparent leading-[1.15]">
              Without hiring for one<span className="text-[#8dd2b1] [-webkit-text-fill-color:#8dd2b1]">.</span>
            </span>
          </h1>

          {/* Platform demo screenshot in browser chrome */}
          <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-lg border border-white/[0.12] bg-[#1a1a1a] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-[#2f8f6d]/20 sm:mt-12 sm:rounded-xl">
            {/* Browser top bar */}
            <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#262626] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
              </div>
              <div className="mx-auto flex max-w-md flex-1 items-center gap-1.5 rounded-md bg-[#3a3a3a] px-3 py-1 text-[11px] text-[#a8cfc0]">
                <svg
                  className="h-3 w-3 text-[#8dd2b1]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="truncate">bidfedcmmc.com</span>
              </div>
              <div className="w-[54px]" aria-hidden />
            </div>
            <Image
              src="/demo%20image2.png"
              alt="Custodia platform — Charlie walking a user through CMMC Level 1"
              width={1600}
              height={1000}
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 960px, (min-width: 640px) 90vw, 100vw"
              className="h-auto w-full"
            />
          </div>

          <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-relaxed text-[#a8cfc0] sm:mt-6 sm:text-base md:text-lg">
            Custodia is the operating system for MSPs running a CMMC Level&nbsp;1 line of business. Onboard each DoD client in 30 minutes, ship their bid-ready package in week 1, and keep their posture watched <span className="font-semibold text-white">year-round</span> &mdash; one login, every client, credentialed officer behind your brand. <span className="font-semibold text-white">14-day free trial. No credit card required.</span>
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                prefetch={false}
                className="group inline-flex items-center justify-center gap-2 bg-[#bdf2cf] px-6 py-3.5 text-base font-bold text-[#0c2219] shadow-[0_10px_40px_rgba(189,242,207,0.22)] transition-all hover:bg-[#a8e6c0] hover:shadow-[0_15px_55px_rgba(189,242,207,0.32)] sm:px-8 sm:py-4 md:text-lg"
              >
                Start My 14-Day Free Trial
                <span aria-hidden className="text-lg leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center border border-[#2f8f6d]/50 bg-white/[0.02] px-6 py-3 text-base font-semibold text-[#cce5da] backdrop-blur transition-colors hover:border-[#8dd2b1]/70 hover:bg-white/[0.05] hover:text-white sm:px-7 sm:py-3.5"
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
            14-day free trial &middot; No credit card required &middot; <span className="font-semibold text-white">Squad $499/mo</span> (up to 5 clients) or <span className="font-semibold text-white">Platoon $1,499/mo</span> (up to 20) &middot; Cancel anytime
          </p>

          {/* Powered by AWS — credibility under CTA */}
          <a
            href="https://aws.amazon.com/what-is-cloud-computing"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block opacity-80 transition-opacity hover:opacity-100"
            aria-label="Powered by AWS Cloud Computing"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://d0.awsstatic.com/logos/powered-by-aws-white.png"
              alt="Powered by AWS Cloud Computing"
              className="h-auto w-[160px]"
            />
          </a>

          {/* Below-headline outcome line — sets expectation for what's next */}
          <p className="mx-auto mt-10 max-w-2xl border-t border-white/[0.08] pt-8 font-serif text-base italic leading-snug text-[#bdf2cf] md:text-lg">
            &ldquo;~80,000 DoD contractors need CMMC Level 1. Most don&apos;t have one yet. Their MSP is the natural buyer of the practice that gets them there. That&apos;s you.&rdquo;
          </p>
        </div>

        {/* Bottom live-data strip */}
        <div className="relative border-t border-white/[0.08] bg-black/30 backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/[0.08] px-2 md:grid-cols-4 md:px-6">
            {[
              { value: "~80k", label: "DoD contractors needing L1" },
              { value: "3,607", label: "CyberAB-listed providers (gap)" },
              { value: "3-8", label: "DoD clients per typical MSP" },
              { value: "Week 1", label: "First client bid-ready" },
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
      </RevealSection>


      {/* 4 — Opportunity (the deal + the gap) */}
      <RevealSection id="product" className="scroll-mt-16 bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            the opportunity
          </div>
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h2 className="font-serif text-4xl font-bold leading-[1.05] text-[#10231d] md:text-6xl">
              Your DoD clients need CMMC L1. You&apos;re already their IT.
            </h2>
            <p className="text-lg leading-relaxed text-[#44695c]">
              Every MSP serving DoD primes is sitting on a compliance line of business waiting to be turned on. Custodia gives you the platform, the playbook, and the officer &mdash; so you can stop turning down CMMC requests and start charging $1,200&ndash;$3,500/month per client for it.
            </p>
          </div>

          {/* Big-stat opportunity row */}
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "~80,000",
                label: "DoD contractors that need CMMC Level 1 self-attestation",
                sub: "Per DoD&apos;s CMMC final rule regulatory impact analysis &mdash; the largest tier of the Defense Industrial Base",
              },
              {
                n: "3,607",
                label: "CyberAB-listed providers serving them today",
                sub: "22:1 ratio of contractors needing help to providers offering it &mdash; this market is wildly under-supplied",
              },
              {
                n: "3-8",
                label: "DoD primes the typical MSP already serves",
                sub: "Survey of 200+ MSPs &mdash; most have a hidden book of compliance work they&apos;re currently turning down",
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
            Federal Contract Information (FCI) work is the largest pool of DoD opportunity flowing to small businesses. Your DoD clients are sitting in that pool right now. Their primes are already asking for SPRS affirmations. Today, they call you and you say not my lane. With Custodia, you say we will have your package next week &mdash; and bill recurring revenue to do it.
          </p>

          {/* Barrier vs Fix split */}
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="border border-[#e8d4a1] bg-[#fff8e8] p-8">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
                Why most MSPs don&apos;t run a CMMC practice
              </div>
              <h3 className="mt-3 font-serif text-2xl font-bold text-[#10231d]">
                The math doesn&apos;t pencil &mdash; until now
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[#5d4f30]">
                {[
                  "Hiring a credentialed compliance officer ($120k+ fully loaded) just to handle questions you can't answer",
                  "Each new client = 80+ hours of manual evidence collection, SSP drafting, and screenshots &mdash; non-billable bench time",
                  "C3PAO and template providers price out at $5k-$15k per client one-time, leaving you on the hook for re-affirmation",
                  "False Claims Act liability on every SPRS submission you advise on &mdash; one wrong MET and your E&amp;O premium triples",
                  "Compliance work derails the IT and security work your MSP actually got hired to do",
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
                A turnkey CMMC&nbsp;L1 practice. Behind your brand.
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-[#cce5da]">
                {[
                  "All 15 requirements walked in plain English &mdash; tailored per client's tech stack",
                  "SSP narratives auto-drafted per client &mdash; accept or edit, hand off as your deliverable",
                  "AI evidence auto-review across your whole book &mdash; instant gap detection per client",
                  "Credentialed Custodia officer answers any CMMC question &mdash; behind your MSP brand",
                  "M365 / Google connectors per client &mdash; year-round monitoring + freshness alerts",
                  "Custodia Guarantee &mdash; we resolve any prime challenge for any client in your book",
                  "Annual re-affirmation included for every client &mdash; one Oct 1 cycle, every client prepped",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  prefetch={false}
                  className="mt-7 inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Start My 14-Day Free Trial
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
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
              <p className="mt-3 text-xs text-[#7aab98]">14-day free trial &middot; No credit card required &middot; Cancel anytime</p>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* 5 — How an MSP onboards a CMMC L1 client */}
      <RevealSection className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">how it works</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-6xl">
              How an MSP onboards a CMMC&nbsp;L1 client
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#44695c]">
              Four steps. ~30 minutes of your time per client. Bid-ready package shipped to your client inside week 1.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                step: "Invite the client",
                desc: "Click Create Organization in your workspace. Name it after the client business. Invite their owner or IT lead by email. Their workspace is isolated under your one MSP login.",
                custodia: "Per-tenant encryption keys + isolated workspace per client.",
                highlight: false,
              },
              {
                n: "02",
                step: "Charlie interviews",
                desc: "Your virtual Compliance Officer captures the client's business scope, FCI handling, tech stack, and team. Plain English. The questions only the client can answer.",
                custodia: "You stay the relationship. We do the typing.",
                highlight: false,
              },
              {
                n: "03",
                step: "Connect M365 / Google",
                desc: "Read-only OAuth into the client's tenant pulls the authorized-users roster, MFA status, and audit logs &mdash; the evidence that takes 80 hours to collect manually, automated.",
                custodia: "Year-round monitoring switches on the moment connectors hand-shake.",
                highlight: true,
              },
              {
                n: "04",
                step: "Ship the package + file SPRS",
                desc: "Generate the bid-ready ZIP &mdash; signed SSP, affirmation memo, evidence inventory. Hand it to your client as your deliverable. Walk them through SPRS submission. Bill recurring.",
                custodia: "Officer backstop on every submission, behind your MSP brand.",
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
            Step 3 is the unlock. Most MSPs would have to run a 6-week services engagement per client just to collect that evidence by hand. Custodia automates it &mdash; so your billable hours go to the parts only your team can do.
          </p>
        </div>
      </RevealSection>

      {/* 6 — Stakes + Custodia Shield */}
      <RevealSection className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          {/* Stakes header */}
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
              the stakes
            </div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              Your clients are on the front line. Their MSP is their first line.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#44695c]">
              The minute your client handles data for the U.S. government, they become a target. Foreign adversaries hunt small American defense contractors because they&apos;re the easiest way into the country&apos;s biggest programs &mdash; and you&apos;re the one they call when something breaks. Custodia puts a real shield between your clients and the threat &mdash; and a credentialed officer behind your MSP brand to back you up.
            </p>
          </div>

          {/* What happens if you skip this */}
          <div className="mb-12">
            <h3 className="mb-6 text-center font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
              What happens to MSPs who tell DoD clients &ldquo;not my lane&rdquo;
            </h3>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  stat: "Client churn",
                  title: "Your client fires you",
                  body: "When a prime asks for SPRS proof and you can&apos;t deliver, your client finds an MSP that can. They take the rest of the IT contract with them. The CMMC question is now the table-stakes question for every DoD-adjacent SMB.",
                },
                {
                  stat: "E&amp;O exposure",
                  title: "Liability flows uphill",
                  body: "If you advise a client on SPRS without a credentialed officer behind you, your E&amp;O carrier becomes the deep pocket on every False Claims Act action. Recent DOJ Civil Cyber-Fraud settlements: $1M-$9M+. With Custodia, the officer signs off &mdash; not you.",
                },
                {
                  stat: "Revenue left behind",
                  title: "$50k-$200k ARR per client, gone",
                  body: "Every MSP turning down CMMC work is leaving $1,200-$3,500/month per DoD client on the table. With 5-20 clients in your book, that&apos;s a real recurring revenue line &mdash; one that lifts the value of your MSP at exit.",
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

          {/* The Custodia Shield — security flex */}
          <div className="border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_15px_45px_rgba(14,48,37,0.2)] md:p-12">
            <div className="mb-10 text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
                the custodia shield &middot; zero-trust security
              </div>
              <h3 className="font-serif text-3xl font-bold leading-tight md:text-5xl">
                Built so even <span className="italic">we</span>&nbsp;can&rsquo;t read your client&apos;s FCI.
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#a8cfc0]">
                Custodia is engineered on AWS with envelope encryption, per-tenant keys per client business, and a zero-AI-training pledge. If our database leaked tomorrow, every one of your clients&apos; FCI would still be ciphertext &mdash; useless to attackers, useless to us, useless to any AI. That&rsquo;s the bar. That&rsquo;s the shield.
              </p>
            </div>

            {/* Trust pillars */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  tag: "AWS KMS",
                  title: "Keys live inside AWS. Always.",
                  body: "Your data is protected by AWS KMS-backed envelope encryption. The master key never leaves AWS &mdash; not into our servers, not into our env vars, not into a backup. Every key use is logged in AWS CloudTrail. To decrypt, an attacker would need to compromise AWS itself.",
                },
                {
                  tag: "Per-Tenant Keys",
                  title: "Each client. Their own key.",
                  body: "Every client business in your MSP book gets its own Data Encryption Key. One client&apos;s ciphertext is mathematically useless to any other &mdash; and useless to anyone outside that tenant. No shared keys, no cross-client blast radius if anything ever leaks.",
                },
                {
                  tag: "Zero AI Training",
                  title: "Charlie reads. Charlie forgets.",
                  body: "Charlie only runs on enterprise AI providers under a no-training, zero-retention contract. Your clients&apos; FCI is never used to train any model &mdash; ours or anyone else&rsquo;s. He answers in-context, then the context is gone.",
                },
                {
                  tag: "U.S. Only",
                  title: "Client FCI never leaves the U.S.",
                  body: "Application, database, and AWS KMS keys are all hosted in U.S. regions. No foreign hops, no foreign sub-processors touching any client&apos;s evidence. Aligned with FAR 52.204-21 safeguarding.",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="border border-[#2a5a49] bg-[#193d31] p-6"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
                    {s.tag}
                  </div>
                  <h4 className="mt-3 font-serif text-xl font-bold text-white">{s.title}</h4>
                  <p
                    className="mt-3 text-sm leading-relaxed text-[#c5e3d6]"
                    dangerouslySetInnerHTML={{ __html: s.body }}
                  />
                </div>
              ))}
            </div>

            {/* The pledge — what we will never do */}
            <div className="mt-10 border border-[#2a5a49] bg-[#10322a] p-8 md:p-10">
              <div className="grid gap-8 md:grid-cols-[1fr_1.4fr_0.9fr] md:items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
                    the custodia pledge
                  </div>
                  <h4 className="mt-2 font-serif text-2xl font-bold leading-tight text-white md:text-3xl">
                    What we will <span className="italic">never</span> do with your client&apos;s data.
                  </h4>
                </div>
                <ul className="space-y-3 text-sm leading-relaxed text-[#cce5da] md:text-base">
                  {[
                    "<b>Never</b> use your FCI to train AI &mdash; ours or anyone else&rsquo;s.",
                    "<b>Never</b> sell, share, or syndicate your data to brokers or marketers.",
                    "<b>Never</b> store encryption keys in plaintext or outside AWS KMS.",
                    "<b>Never</b> let Charlie act on your data without your in-app request.",
                    "<b>Never</b> host your FCI outside the United States.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3">
                      <span aria-hidden className="mt-1 flex-none text-[#8dd2b1]">&#10005;</span>
                      <span dangerouslySetInnerHTML={{ __html: line }} />
                    </li>
                  ))}
                </ul>

                {/* Official "Powered by AWS" badge — hotlinked per AWS
                    co-marketing guidelines. Dark-background variant.
                    https://aws.amazon.com/co-marketing/ */}
                <div className="flex flex-col items-center justify-center border border-[#2a5a49] bg-[#0e2a23] p-6 text-center shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                  <a
                    href="https://aws.amazon.com/what-is-cloud-computing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://d0.awsstatic.com/logos/powered-by-aws-white.png"
                      alt="Powered by AWS Cloud Computing"
                      className="mx-auto h-auto w-full max-w-[180px]"
                    />
                  </a>
                  <div className="mt-4 border-t border-[#2a5a49] pt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
                    KMS &middot; CloudTrail &middot; U.S. Region
                  </div>
                </div>
              </div>
            </div>

            {/* Stack badges */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-[#2a5a49] pt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
              <span>Built on AWS</span>
              <span aria-hidden className="text-[#2a5a49]">|</span>
              <span>AWS KMS Envelope Encryption</span>
              <span aria-hidden className="text-[#2a5a49]">|</span>
              <span>Zero-Retention AI</span>
              <span aria-hidden className="text-[#2a5a49]">|</span>
              <span>FAR 52.204-21 Aligned</span>
              <span aria-hidden className="text-[#2a5a49]">|</span>
              <span>U.S. Region Only</span>
            </div>

            <p className="mx-auto mt-10 max-w-3xl text-center font-serif text-2xl leading-snug text-[#bdf2cf] md:text-3xl">
              Your clients stay safe. You keep billing. You both keep winning. Custodia stands watch.
            </p>

            {/* Honesty footnote */}
            <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] leading-relaxed text-[#7aab98]">
              Custodia BidFed handles CMMC Level 1 / FCI only. We are not FedRAMP Authorized and do not store Controlled Unclassified Information (CUI). The architecture above is aligned with FAR 52.204-21 safeguarding and the FCI scoping principles in NIST SP 800-171 r2.
            </p>
          </div>
        </div>
      </RevealSection>

      {/* 6.5 — The yearly rhythm: one-time vs ongoing */}
      <RevealSection className="bg-white px-6 py-24">
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
                  "Walk all 15 FAR 52.204-21 safeguarding requirements in plain English",
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
                  "<b>On demand</b> &mdash; one-click Charlie-tailored packet for any specific opportunity",
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
      </RevealSection>

      {/* 6.7 — Opportunity engine + community: bid-ready and watched */}
      <RevealSection className="relative overflow-hidden bg-gradient-to-b from-[#f7fcf9] via-white to-[#f7fcf9] px-6 py-24">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_top_left,#bdf2cf33,transparent_50%),radial-gradient(circle_at_bottom_right,#bdf2cf33,transparent_50%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2f8f6d]" aria-hidden />
              the opportunity engine
            </div>
            <h2 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-6xl">
              The goal: stay bid-eligible all year.
              <br />
              <span className="text-[#2f8f6d]">Then bid with confidence.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#44695c]">
              Once you&apos;re CMMC Level 1 secure, you&apos;re eligible to handle Federal Contract Information &mdash; that&apos;s the gate. Custodia&apos;s job after that gate is to keep your posture watched and put live, matched opportunities in front of you every week, so when you choose to bid, you bid with a defensible package and current evidence behind you.
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
                  Custodia scans SAM.gov, DSIP, GSA eBuy, and the major federal opportunity feeds, then emails you a curated digest of the live solicitations matched to your NAICS codes &mdash; with deadlines, set-aside flags, and one-click Charlie tailoring already wired up.
                </p>

                <ul className="mt-6 space-y-3 text-sm text-[#cce5da]">
                  {[
                    "Matched to your NAICS, location, and size profile",
                    "Set-aside flags: SDB, WOSB, HUBZone, 8(a), VOSB / SDVOSB",
                    "Sorted by closing date so you act on what&apos;s urgent first",
                    "Every email links straight into your in-app inbox &mdash; full history kept",
                    "One click: Charlie tailors your bid-ready packet to that specific solicitation",
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
                You complete the 15 safeguarding requirements, capture evidence, and file your SPRS affirmation. You&apos;re now legally eligible to handle Federal Contract Information &mdash; the gate is open.
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
                You&apos;re now part of a network of small businesses securing themselves for federal work. Custodia delivers matched opportunities every week and points Charlie&apos;s tailoring engine at any one with a single click.
              </p>
            </div>
            <div className="border border-[#cfe3d9] bg-white p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#bdf2cf] font-serif text-xl font-bold text-[#0e2a23]">
                3
              </div>
              <h4 className="mt-4 font-serif text-lg font-bold text-[#10231d]">
                Stay watched all year
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[#496f61]">
                Connect Microsoft 365 or Google Workspace and Custodia continuously monitors your evidence, flags expiring scans and stale rosters, and preps your annual SPRS re-affirmation every October &mdash; so your bid eligibility never quietly drifts.
              </p>
            </div>
          </div>

          {/* Bottom band */}
          <div className="mt-10 border border-[#2f8f6d] bg-[#0e2a23] px-8 py-6 text-center text-white">
            <div className="font-serif text-xl font-bold leading-snug md:text-2xl">
              You secure the business. We surface the opportunities, watch your posture, and keep your evidence fresh year-round.
            </div>
          </div>
        </div>
      </RevealSection>

      {/* 7 — Why Custodia is different */}
      <RevealSection className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">why custodia</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
              Built for MSPs who want a CMMC&nbsp;L1 line of business.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#a8cfc0]">
              Most CMMC products are templates and forms aimed at end-contractors. Custodia is a cybersecurity firm with a multi-tenant Platform built for the MSPs who actually serve the DoD primes &mdash; with credentialed compliance officers on-call, behind your brand, whenever you need a real human answer.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Cybersecurity firm, not a template",
                body: "Custodia is a veteran-owned cybersecurity firm in Pittsburgh, PA. We staff compliance officers, not customer-success reps. The Platform takes each of your clients from zero to bid-ready &mdash; the officers are on-call, behind your MSP brand, when you or your client need a human.",
              },
              {
                title: "CMMC Level 1 specialists",
                body: "We do one thing &mdash; CMMC L1 for FCI handlers &mdash; and we do it all the way. No scope drift into L2 or L3. The 15 safeguarding requirements are our entire focus, so your MSP can offer a clean, focused product line.",
              },
              {
                title: "Officers on-call &mdash; behind your brand",
                body: "Hit a question The Platform can&apos;t answer? Open a ticket on behalf of any client. A Custodia compliance officer responds with audit-grade guidance, in writing &mdash; behind your MSP brand. Included with every active membership.",
              },
              {
                title: "The Custodia Guarantee",
                body: "If a prime or contracting officer challenges any of your clients&apos; packages, we assign a dedicated officer to resolve it &mdash; including direct communication with the prime &mdash; until the package is accepted. You stay the face. We do the muscle.",
              },
              {
                title: "Veteran-owned, mission-aligned",
                body: "Built by people who understand federal procurement from the inside. We&apos;re here to expand the small-business defense industrial base by powering MSPs &mdash; not extracting from them.",
              },
              {
                title: "Annual re-affirmation included &mdash; every client",
                body: "Compliance isn&apos;t one-and-done. We monitor changed controls year-round, flag expiring evidence per client, and prep every client&apos;s next SPRS re-affirmation every October &mdash; included in your MSP membership.",
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
              { stat: "30 min", label: "Per-client onboarding" },
              { stat: "Week 1", label: "First client bid-ready" },
              { stat: "$1.2k+", label: "MRR per managed client" },
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
      </RevealSection>

      {/* 9 — Your journey */}
      <RevealSection className="bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">your journey</div>
          <h2 className="font-serif text-4xl font-bold leading-[1.05] text-[#10231d] md:text-6xl">
            From signup to a defensible bid-ready package — for every client in your book
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44695c]">
            Here&apos;s the path you&apos;ll walk inside The Platform during your 14-day free trial &mdash; first client bid-ready by week 1, no credit card required to start. Membership keeps every client&apos;s posture watched, evidence fresh, and a credentialed officer on-call all year.
          </p>

          <ol className="relative mt-16 space-y-12 border-l-2 border-[#cfe3d9] pl-10 md:pl-14">
            {[
              {
                n: "01",
                tag: "DAY 1",
                paid: false,
                title: "Create your account",
                time: "30 seconds",
                desc: "Sign up with email through Clerk &mdash; no credit card required. Land in The Platform and pick up where you left off across devices. You won&apos;t add a payment method until day 14, if you choose to stay.",
              },
              {
                n: "02",
                tag: "DAY 1",
                paid: false,
                title: "Onboard in conversation",
                time: "5 minutes",
                desc: "The Platform asks about your business, the FCI you handle, and your tech stack. It captures the legal-identity details you'd otherwise type into a 40-field form.",
              },
              {
                n: "03",
                tag: "DAY 2\u20133",
                paid: false,
                title: "Walk the 15 CMMC requirements",
                time: "30&ndash;60 minutes per session",
                desc: "Each FAR 52.204-21 requirement is explained in plain English with capture steps tailored to your stack &mdash; M365, Google Workspace, Okta, AWS, on-prem, or no IT at all.",
              },
              {
                n: "04",
                tag: "DAY 2\u20134",
                paid: false,
                title: "Upload your evidence",
                time: "As you go",
                desc: "Screenshots, exports, signed rosters, policy PDFs. The Platform tags every artifact to a control and tracks your readiness score in real time.",
              },
              {
                n: "05",
                tag: "DAY 4",
                paid: false,
                title: "Draft your SSP narratives",
                time: "Auto-drafted",
                desc: "Auto-generated SSP narratives for every control, written from your inputs. Accept or edit in one click &mdash; no blank-page panic.",
              },
              {
                n: "06",
                tag: "DAY 5",
                paid: true,
                title: "Generate your bid-ready package",
                time: "On demand",
                desc: "Charlie auto-reviews every artifact for instant gap detection. Generate the bid-ready ZIP: SSP, signed affirmation memo, evidence inventory. With days to spare in your 14-day trial, you can ask Charlie to surface matched opportunities, draft prime questionnaire responses, and brief you for outreach &mdash; before you ever add a card.",
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
              Your client, bidding with a defensible package &mdash; you, billing recurring.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#cce5da]">
              All 8 steps happen inside your 14-day free trial &mdash; with a real client. Steps 1&ndash;6 (build to bid-ready) typically wrap up in week 1. Steps 7&ndash;8 are where membership earns its keep: continuous monitoring through every client&apos;s M365 or Google tenant, freshness alerts across your whole book, year-round officer access, and annual SPRS re-affirmation. Squad ($499/mo, up to 5 clients) or Platoon ($1,499/mo, up to 20) only kicks in if you stay past day 14.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  prefetch={false}
                  className="inline-flex items-center gap-2 bg-[#bdf2cf] px-7 py-3.5 text-base font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Start My 14-Day Free Trial
                  <span aria-hidden className="text-lg leading-none">&rarr;</span>
                </Link>
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
              14-day free trial &middot; No credit card required &middot; Squad $499/mo or Platoon $1,499/mo after
            </p>
          </div>
        </div>
      </RevealSection>

      {/* 9.5 — Inside The Platform: full feature showcase */}
      <RevealSection className="bg-white px-6 py-24">
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
              <p className="mt-3 text-sm text-[#496f61]">Walk the 15 safeguarding requirements, capture evidence, draft your SSP &mdash; without writing it from scratch.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { t: "Charlie-guided onboarding", d: "Your vCO captures your business, FCI scope, and tech stack in conversation &mdash; no 40-field forms." },
                  { t: "All 15 requirements, plain English", d: "Each FAR 52.204-21 safeguarding requirement walked with capture steps tailored to M365, Google, Okta, AWS, on-prem, or no IT at all." },
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
              Every capability above is included in your 14-day free trial &mdash; the build, Charlie&apos;s opportunity sourcing, the bid generator, year-round monitoring, and the officer.
            </p>
            <p className="mt-3 text-sm text-[#5a7d70]">
              Sign up with email &mdash; no credit card required. Onboard your first real client and ship their bid-ready package in week 1. Connect their M365 or Google tenant for continuous monitoring. Squad ($499/mo, up to 5 clients) or Platoon ($1,499/mo, up to 20) only kicks in if you stay past day 14.
            </p>
          </div>
        </div>
      </RevealSection>

      {/* 9.9 — Your potential MRR / ROI as an MSP */}
      <RevealSection className="bg-[#0e2a23] px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">your potential ARR</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
              A handful of clients pays for the platform many times over.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-[#a8cfc0]">
              MSPs typically charge $1,200&ndash;$3,500/mo per DoD client for managed CMMC. Custodia&apos;s Squad and Platoon plans are flat &mdash; every additional client is pure margin until you hit the cap.
            </p>
          </div>

          {/* The hero comparison */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                tier: "Squad &middot; 3 clients",
                size: "$1,500/mo each",
                net: "minus $499 Custodia",
                profit: "$54,000 ARR",
                payback: "~9x return on subscription",
                ratio: "9x",
              },
              {
                tier: "Platoon &middot; 10 clients",
                size: "$1,500/mo each",
                net: "minus $1,499 Custodia",
                profit: "$162,000 ARR",
                payback: "~9x return on subscription",
                ratio: "9x",
                highlight: true,
              },
              {
                tier: "Platoon &middot; 20 clients",
                size: "$2,000/mo each",
                net: "minus $1,499 Custodia",
                profit: "$462,000 ARR",
                payback: "~26x return on subscription",
                ratio: "26x",
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
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]"
                  dangerouslySetInnerHTML={{ __html: s.tier }}
                />
                <div className="mt-3 text-sm text-[#a8cfc0]">MSP service price</div>
                <div className="font-serif text-3xl font-bold text-white md:text-4xl">{s.size}</div>
                <div className="mt-3 text-sm text-[#a8cfc0]">{s.net}</div>
                <div className="font-serif text-2xl font-bold text-[#bdf2cf]">{s.profit}</div>
                <div className="mt-5 border-t border-[#2a5a49] pt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8dd2b1]">
                    Net of platform
                  </div>
                  <div className="mt-1 font-serif text-xl font-bold text-white">
                    {s.payback}
                  </div>
                  <div className="mt-1 text-[11px] font-bold tracking-wide text-[#bdf2cf]">
                    {s.ratio} on subscription cost
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
                  You pay (Platoon)
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-white md:text-5xl">
                  $1,499/mo
                </div>
                <div className="mt-1 text-sm text-[#a8cfc0]">
                  $17,988/year &middot; flat &middot; up to 20 clients
                </div>
              </div>

              <div aria-hidden className="hidden text-3xl font-bold text-[#8dd2b1] md:block">
                vs.
              </div>

              <div className="text-center md:text-left">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
                  You bill (10 clients @ $1,500/mo)
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-[#bdf2cf] md:text-5xl">
                  +$180,000/yr
                </div>
                <div className="mt-1 text-sm text-[#a8cfc0]">
                  Recurring &middot; sticky &middot; ~$75/client to Custodia
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-3xl text-center font-serif text-lg italic leading-relaxed text-[#bdf2cf] md:text-2xl">
              &ldquo;Close one managed-CMMC client and Custodia is paid through 2026. Close ten and you have a real practice line.&rdquo;
            </p>
          </div>

          {/* Caveats / honesty */}
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-[#7aab98]">
            MSP service pricing ranges based on public managed-compliance and managed-security MSP pricing for SMB DoD-adjacent contractors. Each MSP sets its own retail price; Custodia&apos;s subscription is flat per cohort tier. Your numbers will vary &mdash; the directional math doesn&apos;t.
          </p>
        </div>
      </RevealSection>

      {/* 10 — Pricing: Squad + Platoon, two-tier */}
      <RevealSection id="pricing" className="scroll-mt-16 border-y border-[#d5e5dd] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          {/* Scarcity banner */}
          <div className="mb-8 flex flex-col items-center gap-2 border border-[#a06b1a] bg-[#fff8e8] px-6 py-4 text-center md:flex-row md:justify-center md:gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a06b1a]">
              Founding MSP Cohort
            </span>
            <span className="text-sm font-semibold text-[#5d4f30]">
              First <span className="font-black text-[#10231d]">25 MSP partners</span> lock in monthly pricing for life. After cohort closes, prices step up.
            </span>
          </div>

          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">the offer</div>
            <h2 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-6xl">
              Two plans. One platform. Every client included.
              <br />
              <span className="text-[#2f8f6d]">$0 today. Pick a tier on day 14 if you stay.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#44695c]">
              Try the entire MSP platform free for 14 days. Onboard a real client, ship a real bid-ready package, file a real SPRS affirmation. No credit card to start. Cancel any time inside the platform. The Custodia Guarantee runs for the life of your membership.
            </p>
          </div>

          {/* Two-tier pricing grid: Squad + Platoon */}
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            {/* Squad */}
            <div className="flex flex-col border-2 border-[#cfe3d9] bg-white p-8 shadow-[0_15px_40px_rgba(14,48,37,0.08)] md:p-10">
              <div className="border-b border-[#cfe3d9] pb-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#2f8f6d]">Squad</div>
                <h3 className="mt-2 font-serif text-3xl font-bold text-[#10231d]">Up to 5 client businesses</h3>
                <p className="mt-2 text-sm text-[#5a7d70]">For MSPs starting a CMMC line of business or managing a tight DoD-adjacent book.</p>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-5xl font-bold text-[#10231d]">$499</span>
                  <span className="text-base text-[#5a7d70]">/mo</span>
                </div>
                <p className="mt-2 text-xs text-[#5a7d70]">
                  Or <span className="font-bold text-[#10231d]">$420/mo billed annually</span> &middot; $5,040/yr &middot; 2 months free
                </p>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm text-[#31594d]">
                {[
                  "Up to 5 isolated client workspaces",
                  "Charlie-guided CMMC L1 build per client",
                  "M365 / Google connectors per client",
                  "Auto-drafted SSP + bid-ready ZIP per client",
                  "Officer escalation behind your MSP brand",
                  "Annual SPRS re-affirmation for every client",
                  "Unlimited team members per client workspace",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#2f8f6d]">&#10003;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <Show when="signed-out">
                  <Link
                    href="/sign-up?plan=msp_squad_5"
                    prefetch={false}
                    className="block w-full bg-[#0e2a23] px-6 py-4 text-center text-base font-bold text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
                  >
                    Start Squad &mdash; 14 days free
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/upgrade?plan=msp_squad_5"
                    prefetch={false}
                    className="block w-full bg-[#0e2a23] px-6 py-4 text-center text-base font-bold text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
                  >
                    Activate Squad
                  </Link>
                </Show>
                <p className="mt-3 text-center text-xs text-[#5a7d70]">No credit card required to start the trial</p>
              </div>
            </div>

            {/* Platoon */}
            <div className="relative flex flex-col border-2 border-[#2f8f6d] bg-[#0e2a23] p-8 text-white shadow-[0_25px_60px_rgba(14,48,37,0.18)] md:p-10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#bdf2cf] px-4 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#0c2219]">
                Most popular for established MSPs
              </div>

              <div className="border-b border-[#2a5a49] pb-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#bdf2cf]">Platoon</div>
                <h3 className="mt-2 font-serif text-3xl font-bold">Up to 20 client businesses</h3>
                <p className="mt-2 text-sm text-[#a8cfc0]">For MSPs running a real CMMC line of business across a meaningful DoD book.</p>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-5xl font-bold text-white">$1,499</span>
                  <span className="text-base text-[#a8cfc0]">/mo</span>
                </div>
                <p className="mt-2 text-xs text-[#a8cfc0]">
                  Or <span className="font-bold text-white">$1,250/mo billed annually</span> &middot; $15,000/yr &middot; 2 months free
                </p>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm text-[#cce5da]">
                {[
                  "Up to 20 isolated client workspaces",
                  "Everything in Squad &mdash; 4x the capacity",
                  "Priority officer ticket queue",
                  "MSP onboarding playbook + intake templates",
                  "Custom domain / light white-label on request",
                  "Quarterly portfolio review with a Custodia officer",
                  "Annual SPRS re-affirmation for every client",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 flex-none font-bold text-[#8dd2b1]">&#10003;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <Show when="signed-out">
                  <Link
                    href="/sign-up?plan=msp_platoon_20"
                    prefetch={false}
                    className="block w-full bg-[#bdf2cf] px-6 py-4 text-center text-base font-black text-[#0c2219] shadow-[0_10px_30px_rgba(189,242,207,0.35)] transition-colors hover:bg-[#a8e6c0]"
                  >
                    Start Platoon &mdash; 14 days free
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/upgrade?plan=msp_platoon_20"
                    prefetch={false}
                    className="block w-full bg-[#bdf2cf] px-6 py-4 text-center text-base font-black text-[#0c2219] shadow-[0_10px_30px_rgba(189,242,207,0.35)] transition-colors hover:bg-[#a8e6c0]"
                  >
                    Activate Platoon
                  </Link>
                </Show>
                <p className="mt-3 text-center text-xs text-[#7aab98]">No credit card required to start the trial</p>
              </div>
            </div>
          </div>

          {/* Hormozi value stack */}
          <div className="mx-auto mt-16 max-w-3xl border-2 border-[#cfe3d9] bg-white p-8 md:p-10">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#2f8f6d]">
              What you get the moment you start
            </div>
            <h4 className="mb-6 font-serif text-xl font-bold text-[#10231d]">
              Every Custodia capability &mdash; included in both plans.
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
                Plus four free bonuses (founding cohort)
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

            <p className="mt-8 text-xs italic leading-relaxed text-[#5a7d70]">
              Math check: at $1,499/mo Platoon, your subscription is $17,988/yr &mdash; about $75/client/month for a fully-managed compliance platform. Bill your client $1,200&ndash;$3,500/mo for the managed service and the math works on the first invoice. Squad ($499/mo) prices out around $100/client/mo at 5 clients with the same economics.
            </p>
          </div>

          {/* Triple Guarantee */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="mb-8 text-center">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#a06b1a]">
                The Custodia Triple Guarantee
              </div>
              <h3 className="font-serif text-3xl font-bold text-[#10231d] md:text-4xl">
                We take all the risk. You bring the clients.
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
              &ldquo;Try the platform free for 14 days &mdash; no card. Onboard a real client. Ship their bid-ready package in week 1. Connect their M365 or Google tenant. Officer behind your brand. If a prime fights any client&apos;s package, we fight for you. If you don&apos;t close your first managed-CMMC client in your first quarter as a member, your second quarter is free.&rdquo;
            </p>
          </div>
        </div>
      </RevealSection>

      {/* 11 — Our Average User: outcome-based social proof */}
      <RevealSection className="relative overflow-hidden bg-[#0c2219] px-6 py-28 text-white">
        {/* Ambient gradient halos */}
        <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#2f8f6d] opacity-20 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#bdf2cf] opacity-10 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-[#bdf2cf]">
              ⭐ Our Average User
            </div>
            <h2 className="font-serif text-3xl font-bold leading-tight md:text-5xl">
              The average Custodia MSP closes their first 3 client packages
              <br />
              <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
                inside their first quarter.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-[#a8cfc0] md:text-lg">
              Not a hand-picked success story. Not the top 1%. <span className="font-bold text-white">The middle of the pack.</span> Here&apos;s exactly what the typical MSP partner builds &mdash; from sign-up through their first 3 paying CMMC clients.
            </p>
          </div>

          {/* Headline outcome — bid-eligibility milestone */}
          <div className="mx-auto mb-14 max-w-4xl border-2 border-[#bdf2cf]/40 bg-gradient-to-br from-[#11342a] via-[#0e2a23] to-[#10231d] p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-14">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#bdf2cf]">
              First-client bid-ready rate
            </div>
            <div className="mt-4 font-serif text-7xl font-black leading-none text-white md:text-9xl">
              <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
                100%
              </span>
            </div>
            <p className="mx-auto mt-5 max-w-xl text-base text-[#a8cfc0] md:text-lg">
              of MSP partners who complete onboarding for their first client business <span className="font-bold text-white">ship a defensible SPRS Level 1 affirmation</span> for that client &mdash; the legal prerequisite for the client to handle FCI and bid on FCI-scoped contracts.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-xs italic text-[#7fa89a]">
              Custodia handles CMMC Level 1 only. Award outcomes depend on each client&apos;s bid quality, agency selection, and competition &mdash; not the platform. We secure the eligibility; you and your client secure the business.
            </p>
          </div>

          {/* The journey — what the average user actually builds */}
          <div className="mx-auto mb-14 max-w-5xl">
            <div className="mb-8 text-center">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#bdf2cf]">
                The Average MSP Journey
              </div>
              <h3 className="font-serif text-2xl font-bold text-white md:text-3xl">
                From sign-up to first 3 paying clients &mdash; the median MSP path
              </h3>
            </div>

            <div className="grid gap-px overflow-hidden border border-[#2f8f6d]/30 bg-[#2f8f6d]/30 md:grid-cols-4">
              {[
                {
                  day: "Day 0",
                  stat: "Free trial",
                  label: "MSP signs up. No credit card. Reads the onboarding playbook in 15 minutes.",
                },
                {
                  day: "Day 1",
                  stat: "First client invited",
                  label: "Picks one DoD client from existing book. Creates org, invites client owner, kicks off Charlie interview.",
                },
                {
                  day: "Day 5",
                  stat: "First package shipped",
                  label: "Client&apos;s bid-ready package generated. SSP, affirmation, evidence ZIP handed off as deliverable.",
                },
                {
                  day: "Day 7",
                  stat: "Client SPRS-affirmed",
                  label: "MSP walks client through SPRS submission. Client visible to primes. MSP starts billing recurring.",
                },
                {
                  day: "Day 14",
                  stat: "Decision",
                  label: "Trial ends. MSP picks Squad ($499/mo, up to 5) or Platoon ($1,499/mo, up to 20). Already breaking even.",
                },
                {
                  day: "Month 2",
                  stat: "Clients 2 &amp; 3",
                  label: "Pitch CMMC managed-service to two more existing DoD clients. Both onboarded the same week. Three packages live.",
                },
                {
                  day: "Quarter 1",
                  stat: "$3.6k+ MRR",
                  label: "3 paying clients at $1,200/mo MSP service tier = $3,600 MRR. Custodia subscription paid 2.4x over by clients alone.",
                },
                {
                  day: "Year 1",
                  stat: "Re-affirmed across book",
                  label: "Every client&apos;s annual SPRS re-submission prepped automatically every October. Posture watched. Renewals predictable.",
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
                Time per client
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                ~30 min
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                MSP time to onboard a new client business inside The Platform. Most of the work is Charlie interviewing the client &mdash; you stay the relationship, we do the typing.
              </p>
            </div>

            <div className="border border-[#2f8f6d]/30 bg-[#11342a] p-7">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#bdf2cf]">
                Recurring per client
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                $1.2k-$3.5k/mo
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                Typical managed-CMMC service price MSPs charge per DoD client &mdash; on top of base IT contracts. Lifts annual revenue per DoD client by $14k-$42k.
              </p>
            </div>

            <div className="border border-[#2f8f6d]/30 bg-[#11342a] p-7">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#bdf2cf]">
                Posture watched
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-white">
                365 days
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
                Continuous monitoring across every client&apos;s M365 or Google tenant. One alert feed for your whole book. No fire drills, no per-client surcharge.
              </p>
            </div>
          </div>

          {/* The realization punch line */}
          <div className="mx-auto max-w-4xl border-2 border-[#bdf2cf]/30 bg-gradient-to-br from-[#0e2a23] to-[#10231d] p-10 text-center md:p-14">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#bdf2cf]">
              The math the average MSP runs
            </div>
            <p className="mx-auto mt-5 max-w-2xl font-serif text-xl leading-[1.5] text-white md:text-2xl">
              Onboard your first DoD client in <span className="font-bold text-[#bdf2cf]">week 1</span>.<br className="hidden md:inline" />
              {" "}Bill <span className="font-bold text-[#bdf2cf]">$1,200&ndash;$3,500/mo</span> per client.<br className="hidden md:inline" />
              {" "}Pay $499/mo for Squad (or $1,499 for Platoon). <span className="font-bold text-[#bdf2cf]">Math closes on client #1.</span>
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-sm italic leading-relaxed text-[#a8cfc0]">
              We don&apos;t promise contract wins for your clients &mdash; nobody legitimate can. We promise the only thing the platform actually controls: a defensible CMMC Level 1 package per client, year-round monitoring, and a credentialed officer behind your MSP brand.
            </p>

            <div className="mt-8">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  prefetch={false}
                  className="group inline-flex items-center justify-center gap-2 bg-[#bdf2cf] px-7 py-4 text-base font-black text-[#0c2219] shadow-[0_15px_40px_rgba(189,242,207,0.35)] transition-all hover:bg-[#a8e6c0] md:text-lg"
                >
                  Start My 14-Day Free Trial
                  <span aria-hidden className="text-xl leading-none transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </Link>
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
                14-day free trial &middot; No credit card required &middot; Cancel any time &middot; CMMC L1 Success Guarantee
              </p>
            </div>
          </div>
        </div>
      </RevealSection>


      {/* 13.5 — The Custodia Guarantee: your assigned Compliance Officer */}
      <RevealSection className="relative overflow-hidden bg-[#f5efe3] px-4 py-20 sm:px-6 sm:py-28">
        {/* subtle parchment texture via layered gradients */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(16,35,29,0.08), transparent 55%), radial-gradient(circle at 85% 75%, rgba(47,143,109,0.10), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-14">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#2f8f6d]">
              The Custodia Guarantee
            </div>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-3xl font-bold leading-[1.1] text-[#10231d] sm:text-4xl md:text-5xl">
              A credentialed Compliance Officer behind your MSP brand. Year&#8209;round.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#3d5a4f] sm:text-lg">
              We&apos;re a cybersecurity firm first &mdash; not just a SaaS. The platform automates the paperwork; a credentialed Custodia Compliance Officer guarantees every client&apos;s package gets done to standard. If anything comes up &mdash; for you or any of your clients &mdash; we step in. Behind your brand. On our time.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-5">
            {/* Officer card */}
            <div className="md:col-span-2 border-2 border-[#10231d]/15 bg-white p-7 shadow-[0_25px_60px_-30px_rgba(16,35,29,0.45)] sm:p-8">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2f8f6d]">
                Assigned at enrollment
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div
                  aria-hidden
                  className="flex h-16 w-16 flex-none items-center justify-center bg-gradient-to-br from-[#10231d] to-[#1d4a3d] font-serif text-2xl font-bold text-[#bdf2cf]"
                >
                  vCO
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-xl font-bold text-[#10231d]">
                    Your Compliance Officer
                  </div>
                  <div className="mt-1 text-sm text-[#3d5a4f]">
                    Master&apos;s educated &middot; Highly credentialed
                  </div>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[#10231d]">
                {[
                  "MS in cybersecurity, information assurance, or related field",
                  "CMMC&#8209;aligned credentials (CISSP, CCP, CCA, or equivalent)",
                  "Years of federal compliance experience &mdash; not a chatbot, not a ticket queue",
                  "Knows your package, your tenant, and your bid posture by name",
                ].map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none bg-[#2f8f6d]" />
                    <span dangerouslySetInnerHTML={{ __html: line }} />
                  </li>
                ))}
              </ul>
            </div>

            {/* What they do */}
            <div className="md:col-span-3 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Anytime, year&#8209;round",
                  body: "Stuck on a control for one of your clients? Prime asking for evidence you don&apos;t recognize? Sub&#8209;contract clause that&apos;s new to you? Your officer is a message away &mdash; not a tier&#8209;1 agent reading a script.",
                },
                {
                  title: "Behind your brand &mdash; not in front of you",
                  body: "You stay the relationship with the client. The officer answers your questions and backstops your package, but never goes around you to your client. Your MSP, your brand, your client.",
                },
                {
                  title: "CMMC success guarantee",
                  body: "If any client&apos;s Level 1 package isn&apos;t defensible to standard, that&apos;s on us. We rebuild it with you, on our time, until it is. The posture is ours; the relationship stays yours.",
                },
                {
                  title: "Cybersecurity firm first",
                  body: "Custodia is staffed by security professionals, not SaaS support. The web app is the leverage. The officer is the muscle that makes your MSP look like a Fortune 100 compliance practice.",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="border border-[#10231d]/15 bg-white p-6 transition-shadow hover:shadow-[0_18px_40px_-20px_rgba(16,35,29,0.35)]"
                >
                  <div
                    className="font-serif text-lg font-bold text-[#10231d]"
                    dangerouslySetInnerHTML={{ __html: card.title }}
                  />
                  <p
                    className="mt-3 text-sm leading-relaxed text-[#3d5a4f]"
                    dangerouslySetInnerHTML={{ __html: card.body }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pull quote */}
          <div className="mx-auto mt-12 max-w-3xl border-l-4 border-[#2f8f6d] bg-white/60 px-7 py-6 sm:mt-16">
            <p className="font-serif text-lg italic leading-[1.55] text-[#10231d] sm:text-xl">
              &ldquo;The relationship is yours. The posture is ours. And if anything ever goes sideways for one of your clients &mdash; a prime challenge, a missing artifact, a control they don&apos;t understand &mdash; you get a credentialed human at your back, not a help center.&rdquo;
            </p>
            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-[#2f8f6d]">
              &mdash; The Custodia Guarantee
            </div>
          </div>
        </div>
      </RevealSection>


      {/* 14 — FAQ */}
      <RevealSection id="faq" className="scroll-mt-16 bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center sm:mb-12">
            <h2 className="font-serif text-2xl font-bold text-[#10231d] sm:text-3xl md:text-5xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <details
                key={idx}
                className="group overflow-hidden border border-[#d2e6dc] bg-[#f7fcf9] [&[open]]:bg-white"
                open={openFaq === idx}
              >
                <summary
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenFaq(openFaq === idx ? null : idx);
                  }}
                  className="flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-[#10231d] transition-colors hover:bg-[#eef8f3] sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden"
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <span className="flex-none text-xl font-light text-[#2f8f6d] transition-transform group-[&[open]]:rotate-45">
                    +
                  </span>
                </summary>
                {openFaq === idx && (
                  <div
                    className="border-t border-[#d2e6dc] px-5 py-4 text-sm leading-relaxed text-[#44695c] sm:px-6 sm:py-5"
                    dangerouslySetInnerHTML={{ __html: item.a }}
                  />
                )}
              </details>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* 15 — Footer */}
      <footer className="border-t border-[#d5e5dd] bg-[#f7f7f3] px-6 py-14 text-[#44695c]">
        <div className="mx-auto max-w-6xl">
          {/* Top CTA strip */}
          <div className="mb-12 flex flex-col items-start justify-between gap-4  border border-[#cfe3d9] bg-white p-6 md:flex-row md:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
                Founding MSP Cohort &middot; 25 partners
              </div>
              <div className="mt-1 font-serif text-lg font-bold text-[#0f2f26]">
                14 days free, no credit card &mdash; Squad $499/mo or Platoon $1,499/mo
              </div>
            </div>
            <Link
              href="/sign-up"
              className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
            >
              Start my MSP trial &rarr;
            </Link>
          </div>

          <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <img
                  src="/custodia-logo.png"
                  alt="Custodia shield"
                  className="h-8 w-auto"
                />
                <div className="text-xl font-black tracking-tight text-[#0f2f26]">
                  Custodia<span className="text-[#2f8f6d]">.</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-[#7a9c90]">
                Custodia, LLC &middot; Pittsburgh, PA &middot; Veteran-owned
              </p>
              <p className="mt-2 text-xs text-[#7a9c90]">
                &copy; {new Date().getFullYear()} Custodia, LLC. All rights reserved.
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#9bb3a8]">
                Not a law firm &middot; Not affiliated with the U.S. Government
              </p>
            </div>
            <div className="grid grid-cols-2 gap-12 text-sm md:grid-cols-4">
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Platform</div>
                <ul className="space-y-2">
                  <li><a href="#product" className="transition-colors hover:text-[#0f2f26]">How it works</a></li>
                  <li><a href="#pricing" className="transition-colors hover:text-[#0f2f26]">Pricing</a></li>
                  <li><a href="#guarantees" className="transition-colors hover:text-[#0f2f26]">Guarantees</a></li>
                  <li><a href="#faq" className="transition-colors hover:text-[#0f2f26]">FAQ</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">For MSPs</div>
                <ul className="space-y-2">
                  <li><Link href="/sign-up" className="transition-colors hover:text-[#0f2f26]">Start free trial</Link></li>
                  <li><Link href="/sign-in" className="transition-colors hover:text-[#0f2f26]">Sign in</Link></li>
                  <li><Link href="/dashboard" className="transition-colors hover:text-[#0f2f26]">Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Legal</div>
                <ul className="space-y-2">
                  <li><a href="/terms" className="transition-colors hover:text-[#0f2f26]">Terms</a></li>
                  <li><a href="/privacy" className="transition-colors hover:text-[#0f2f26]">Privacy</a></li>
                  <li><a href="/dpa" className="transition-colors hover:text-[#0f2f26]">DPA</a></li>
                  <li><a href="/security" className="transition-colors hover:text-[#0f2f26]">Security</a></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2f8f6d]">Contact</div>
                <ul className="space-y-2">
                  <li><a href="mailto:support@custodia.dev" className="transition-colors hover:text-[#0f2f26]">support@custodia.dev</a></li>
                  <li><a href="mailto:support@custodia.dev?subject=Support" className="transition-colors hover:text-[#0f2f26]">Support</a></li>
                  <li><a href="https://www.linkedin.com/company/custodia-bidfed" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#0f2f26]">LinkedIn</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile-only sticky bottom CTA — signed-out only */}
      <Show when="signed-out">
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#cfe3d9] bg-white/95 px-4 py-3 backdrop-blur sm:hidden"
          style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}
        >
          <Link
            href="/sign-up"
            prefetch={false}
            className="flex w-full items-center justify-center gap-2 bg-[#0e2a23] px-6 py-3.5 text-sm font-bold text-[#bdf2cf] shadow-[0_8px_24px_-8px_rgba(14,42,35,0.5)] transition-colors hover:bg-[#10342a]"
          >
            Start 14-day free trial
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </Show>

    </div>
  );
}
