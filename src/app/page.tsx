"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { FormEvent, useState } from "react";

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

const SELF_SERVE_INCLUDES = [
  "Conversational onboarding — your AI compliance officer learns your business in 5 minutes",
  "Plain-English walkthrough of every one of the 17 practices",
  "Per-control evidence upload with AI vision review on every artifact",
  "Auto-drafted narratives for your System Security Plan",
  "Bid-ready ZIP package: SSP, signed affirmation memo, evidence inventory",
  "SPRS submission instructions and annual re-affirmation reminders",
];

const BOOTCAMP_INCLUDES = [
  "Everything in self-serve, plus:",
  "1-week intensive with a Custodia compliance officer",
  "We do the SAM.gov registration and CAGE/UEI work for you",
  "Live policy + SSP review with your senior signer on the call",
  "Direct help with your first bid response",
  "30 days of post-bootcamp officer access",
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Tell us about your business",
    desc: "5-minute conversation. Your AI officer captures legal identity, scope, and tech stack — no forms.",
  },
  {
    n: "02",
    title: "Walk the 17 practices",
    desc: "Each practice is explained in plain English with capture steps tailored to your stack (M365, Google Workspace, Okta, AWS, on-prem, or none of the above).",
  },
  {
    n: "03",
    title: "Upload evidence",
    desc: "Screenshots, exports, signed rosters. AI vision review catches insufficient evidence before a prime would.",
  },
  {
    n: "04",
    title: "Sign and download",
    desc: "Senior official signs the binary L1 affirmation. Download a single ZIP with your SSP, signed memo, and every artifact — file in SPRS and start bidding.",
  },
];

function WaitlistForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("We will reach out within 1 business day.");
        setForm({ name: "", email: "", company: "" });
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-4">
      <input
        type="text"
        placeholder="Your name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
      />
      <input
        type="email"
        required
        placeholder="Work email *"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
      />
      <input
        type="text"
        placeholder="Company name"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
      />
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="w-full rounded-lg bg-amber-400 px-8 py-3 text-lg font-bold text-slate-900 transition-colors hover:bg-amber-300 disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Talk to a Custodia officer →"}
      </button>
      {message && (
        <p
          className={`text-center text-sm font-medium ${
            status === "success" ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight">
            Custodia<span className="text-amber-400">.</span>
          </span>
          <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#how" className="transition-colors hover:text-slate-900">
              How it works
            </a>
            <a href="#paths" className="transition-colors hover:text-slate-900">
              Self-serve or bootcamp
            </a>
            <a href="#about" className="transition-colors hover:text-slate-900">
              About
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-300">
                  Start free
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-300"
              >
                Open workspace
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-slate-900 px-6 pb-24 pt-32 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            CMMC Level 1 · FAR 52.204-21
          </div>
          <h1 className="mb-6 text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
            From zero to bidding on{" "}
            <span className="text-amber-400">federal contracts</span>.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-slate-300 md:text-2xl">
            We get your business to the cybersecurity standard required to handle Federal Contract Information — so you can win the work, keep the work, and renew every year.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="rounded-xl bg-amber-400 px-8 py-4 text-lg font-bold text-slate-900 transition-colors hover:bg-amber-300"
              >
                Open your workspace →
              </Link>
              <a
                href="#how"
                className="px-8 py-4 text-lg font-medium text-slate-300 transition-colors hover:text-white"
              >
                See how it works ↓
              </a>
            </Show>
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="rounded-xl bg-amber-400 px-8 py-4 text-lg font-bold text-slate-900 transition-colors hover:bg-amber-300">
                  Start free — self-serve
                </button>
              </SignUpButton>
              <a
                href="#bootcamp"
                className="rounded-xl border border-slate-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:border-amber-400 hover:text-amber-400"
              >
                Or have us run it for you →
              </a>
            </Show>
          </div>
          <p className="mt-10 text-sm text-slate-400">
            Pittsburgh, PA · Veteran-owned · Built by Carnegie Mellon graduates
          </p>
        </div>
      </section>

      {/* Who this is for */}
      <section className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              Who we built this for
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              You don&apos;t have to learn cybersecurity to win federal work.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              CMMC Level 1 became a contract requirement in 2025. The acronyms are intimidating, but the path through them is mechanical — and that&apos;s what we automate.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "You just won an FCI contract",
                desc: "A prime asked for proof of CMMC Level 1 in your last response. You need to be compliant before kickoff — not in six months.",
              },
              {
                title: "You want to start bidding",
                desc: "You see opportunities on SAM.gov but every solicitation references CMMC. You need a clean affirmation on file before the bid even gets read.",
              },
              {
                title: "You want it done right",
                desc: "You don’t have time for a 12-month consulting engagement. You want a professional, defensible path — self-serve or done-for-you.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              How it works
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              One workspace. Four steps. One bid-ready package.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <div className="text-xs font-mono font-bold tracking-widest text-amber-600">
                  {step.n}
                </div>
                <h3 className="mt-1 text-lg font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two paths */}
      <section id="paths" className="scroll-mt-16 bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              Two ways in
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              Drive it yourself, or have us run it for you.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Same destination — a clean SPRS affirmation and a bid-ready package. Pick the path that matches your time and team.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border-2 border-amber-300 bg-white p-8 shadow-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                Most popular
              </div>
              <div className="text-2xl font-black tracking-tight">Self-Serve Platform</div>
              <p className="mt-2 text-sm text-slate-600">
                You drive. The AI compliance officer guides every step. Designed for founders who want a defensible path without a consultant&apos;s timeline.
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {SELF_SERVE_INCLUDES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 flex-none text-amber-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-900 transition-colors hover:bg-amber-300">
                    Start free — no credit card
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="mt-8 block w-full rounded-xl bg-amber-400 px-6 py-3 text-center font-bold text-slate-900 transition-colors hover:bg-amber-300"
                >
                  Open your workspace →
                </Link>
              </Show>
            </div>
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white shadow-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
                Done-for-you
              </div>
              <div className="text-2xl font-black tracking-tight">Bootcamp with a Custodia Officer</div>
              <p className="mt-2 text-sm text-slate-300">
                A senior compliance officer runs the workspace alongside you for one week. For founders with a deadline who&apos;d rather pay than learn.
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {BOOTCAMP_INCLUDES.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-sm ${
                      i === 0
                        ? "font-semibold text-white"
                        : "text-slate-300"
                    }`}
                  >
                    {i !== 0 && <span className="mt-0.5 flex-none text-amber-400">✓</span>}
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#bootcamp"
                className="mt-8 block w-full rounded-xl border border-amber-400 px-6 py-3 text-center font-bold text-amber-400 transition-colors hover:bg-amber-400 hover:text-slate-900"
              >
                Talk to a Custodia officer →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* The 17 practices */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              The work, made concrete
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              The 17 CMMC Level 1 practices.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
              Defined by FAR 52.204-21(b)(1). Inside the workspace, every one of these has plain-English copy, evidence-capture steps for your stack, and an AI-drafted SSP narrative.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {PRACTICES.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
              >
                <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400">
                  {p.domain}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] text-slate-500">{p.id}</div>
                  <div className="text-sm font-semibold text-slate-900">{p.short}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-amber-900">
              <strong>L1 affirmation is binary.</strong> Either you implement all 17 or you don&apos;t — there is no partial credit. The 110-point NIST scoring you&apos;ve seen elsewhere applies to <em>Level 2</em>, not Level 1. We tell you the difference, and we don&apos;t let you sign until you&apos;re actually ready.
            </p>
          </div>
        </div>
      </section>

      {/* About / Mission */}
      <section id="about" className="scroll-mt-16 bg-slate-900 px-6 py-24 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
            Why we built this
          </div>
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">
            Securing the businesses that secure America.
          </h2>
          <div className="mx-auto mt-8 space-y-5 text-left text-base leading-relaxed text-slate-300 md:text-lg">
            <p>
              Custodia is a Pittsburgh, PA cybersecurity firm. <strong className="text-white">Veteran-owned and operated</strong>, founded by <strong className="text-white">Carnegie Mellon graduates</strong>.
            </p>
            <p>
              We started this project because we kept watching small American businesses lose contract opportunities — not because their products weren&apos;t good, but because the compliance paperwork in front of those contracts was written for Fortune 500 contractors with full GRC teams.
            </p>
            <p>
              CMMC Level 1 isn&apos;t complicated. It&apos;s 17 practices that any well-run small business can implement. What&apos;s missing is a tool that translates the regulations into plain English, captures the right evidence, and produces the artifacts a Contracting Officer expects — without charging $50,000 for the privilege.
            </p>
            <p>
              That&apos;s what Custodia does. And we built it specifically to support local Pittsburgh and surrounding-region businesses making the transition into federal work, then opened it up to anyone who needs it.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-slate-700 pt-10 text-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Pittsburgh, PA
              </div>
              <div className="mt-1 text-sm text-slate-400">Headquartered locally</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Veteran-owned
              </div>
              <div className="mt-1 text-sm text-slate-400">Service informs the mission</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                CMU built
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Cybersecurity from the source
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bootcamp inquiry */}
      <section
        id="bootcamp"
        className="scroll-mt-16 bg-slate-900 border-t border-slate-800 px-6 py-24 text-white"
      >
        <div className="mx-auto max-w-xl text-center">
          <div className="mb-6 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold text-amber-300">
            Done-for-you · Limited cohorts
          </div>
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Want it handled?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Tell us about your business and a Custodia officer will reach out within one business day to scope a one-week bootcamp.
          </p>
          <div className="mt-10">
            <WaitlistForm />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            No credit card. No commitment. We&apos;ll talk first to confirm fit.
          </p>
        </div>
      </section>

      <footer className="bg-slate-950 px-6 py-10 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-lg font-bold text-white">
            Custodia<span className="text-amber-400">.</span>
          </div>
          <p className="text-center text-xs">
            CMMC Level 1 self-serve platform and officer-led bootcamp · Pittsburgh, PA · Veteran-owned · CMU built
          </p>
          <p className="text-xs">© {new Date().getFullYear()} Custodia, LLC.</p>
        </div>
      </footer>
    </div>
  );
}
