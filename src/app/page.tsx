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

const AVERAGE_FCI_AWARD = "$150K+";

const SELF_SERVE_INCLUDES: { label: string }[] = [
  { label: "AI compliance officer onboards your business in 5 minutes — no forms, no templates to fill in" },
  { label: "Plain-English walkthrough of all 17 FAR 52.204-21 practices, tailored to your exact tech stack" },
  { label: "Auto-drafted SSP narratives for every control — edit or accept in one click" },
  { label: "Per-control evidence upload with AI vision review — catches gaps before a prime or auditor would" },
  { label: "SPRS self-attestation entry + step-by-step submission instructions" },
  { label: "Bid-ready attestation package: SSP, signed affirmation memo, full evidence inventory" },
  { label: "Monthly AI compliance monitoring — flags changed controls and expiring evidence automatically" },
  { label: "1:1 Custodia Ticket Support — compliance officer answers any question, year-round" },
  { label: "Annual re-affirmation included — your next cycle is ready every Oct 1, no extra charge" },
  { label: "Prime questionnaire support — submit a ticket when a prime sends security questions and we help you answer" },
  { label: "Custodia Guarantee — if any prime or contracting officer pushes back on your package, we assign a compliance officer to resolve it, including working with the prime directly" },
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

const READINESS_STEPS = [
  {
    title: "Current state",
    status: "You are here",
    detail: "No package yet, or package is fragmented across docs and screenshots.",
  },
  {
    title: "Guided build",
    status: "In platform",
    detail: "Custodia AI officer walks all 17 controls, evidence, and narratives step-by-step.",
  },
  {
    title: "Bid-ready",
    status: "Compliant",
    detail: "Signed affirmation, SSP, and evidence inventory ready for primes and contracting officers.",
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
        className="w-full rounded-lg border border-[#2a5a49] bg-[#103327] px-4 py-3 text-white placeholder-[#88b7a2] outline-none focus:border-[#8dd2b1] focus:ring-1 focus:ring-[#8dd2b1]"
      />
      <input
        type="email"
        required
        placeholder="Work email *"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full rounded-lg border border-[#2a5a49] bg-[#103327] px-4 py-3 text-white placeholder-[#88b7a2] outline-none focus:border-[#8dd2b1] focus:ring-1 focus:ring-[#8dd2b1]"
      />
      <input
        type="text"
        placeholder="Company name"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        className="w-full rounded-lg border border-[#2a5a49] bg-[#103327] px-4 py-3 text-white placeholder-[#88b7a2] outline-none focus:border-[#8dd2b1] focus:ring-1 focus:ring-[#8dd2b1]"
      />
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="w-full rounded-lg bg-[#8dd2b1] px-8 py-3 text-lg font-bold text-[#113428] transition-colors hover:bg-[#78c5a0] disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Talk to a Custodia officer →"}
      </button>
      {message && (
        <p
          className={`text-center text-sm font-medium ${
            status === "success" ? "text-[#9fe4c2]" : "text-[#ffb6b6]"
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
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#d5e5dd] bg-[#f7f7f3]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-black tracking-tight text-[#0f2f26]">
            Custodia<span className="text-[#2f8f6d]">.</span>
          </span>
          <div className="hidden items-center gap-6 text-sm font-semibold text-[#3b5f53] md:flex">
            <a href="#how" className="transition-colors hover:text-[#10231d]">
              How it works
            </a>
            <a href="#paths" className="transition-colors hover:text-[#10231d]">
              Membership
            </a>
            <a href="#about" className="transition-colors hover:text-[#10231d]">
              About
            </a>
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
                  Start free trial
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/assessments"
                prefetch={false}
                className="rounded-xl bg-[#104d3a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d3e2f]"
              >
                Open workspace
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#d5e5dd] bg-[radial-gradient(circle_at_18%_12%,#d6f4df,transparent_48%),radial-gradient(circle_at_86%_14%,#e5f2eb,transparent_44%),#f7f7f3] px-6 pb-20 pt-28 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.35fr_1fr] md:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b8d8cb] bg-[#e8f7ef] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#1f5c47]">
              CMMC Level 1 only · FAR 52.204-21
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-[#10231d] md:text-6xl">
              Clear guidance for non-technical teams to become CMMC 1 compliant and bid with confidence.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#355d50] md:text-xl">
              Custodia is your cybersecurity partner in the loop: AI handles speed, a real compliance officer handles edge cases. Build a defensible package to compete for contracts worth <strong className="text-[#0f2f26]">{AVERAGE_FCI_AWARD}</strong> or more, securely.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Show when="signed-in">
                <Link
                  href="/assessments"
                  prefetch={false}
                  className="rounded-xl bg-[#104d3a] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#0d3e2f]"
                >
                  Continue in workspace
                </Link>
                <a
                  href="#how"
                  className="rounded-xl border border-[#b8d8cb] bg-white px-8 py-4 text-base font-semibold text-[#1f5c47] transition-colors hover:border-[#86bca7] hover:text-[#0f2f26]"
                >
                  See your path to compliance
                </a>
              </Show>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-[#104d3a] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                    Start free trial
                  </button>
                </SignUpButton>
                <a
                  href="#bootcamp"
                  className="rounded-xl border border-[#b8d8cb] bg-white px-8 py-4 text-base font-semibold text-[#1f5c47] transition-colors hover:border-[#86bca7] hover:text-[#0f2f26]"
                >
                  Talk to an officer
                </a>
              </Show>
            </div>
            <p className="mt-8 text-sm text-[#4f7668]">
              Pittsburgh, PA · Veteran-owned cybersecurity firm · Carnegie Mellon graduates
            </p>
          </div>

          <div className="rounded-3xl border border-[#badacc] bg-white p-6 shadow-[0_15px_45px_rgba(14,48,37,0.08)] md:p-7">
            <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Readiness snapshot
            </div>
            <h2 className="font-serif text-3xl font-bold text-[#10231d]">Where you are now</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#44695c]">
              Most SMB teams start with scattered policies and no evidence trail. This platform turns that into one clean, bid-ready package.
            </p>
            <div className="mt-5 space-y-3">
              {READINESS_STEPS.map((step, idx) => (
                <div key={step.title} className="rounded-2xl border border-[#d7e9e0] bg-[#f7fcf9] p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-[#15392e]">{step.title}</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f8f6d]">
                      {step.status}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-[#4d7366]">{step.detail}</p>
                  {idx < READINESS_STEPS.length - 1 && (
                    <div className="mt-3 h-1.5 rounded-full bg-[#e1efe8]">
                      <div
                        className="h-full rounded-full bg-[#2f8f6d]"
                        style={{ width: idx === 0 ? "34%" : "68%" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[#ffcf8a] bg-[#fff4de] px-4 py-3 text-sm text-[#83570d]">
              Outcome: secure handling of FCI, a defensible CMMC 1 package, and higher-confidence bidding.
            </div>
          </div>
        </div>
      </section>

      {/* Who this is for */}
      <section className="bg-[#f7f7f3] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Built for real SMB operators
            </div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              You do not need to become a cybersecurity expert.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-[#44695c]">
              You need a practical path, simple language, and clear proof that your contract information is protected.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "You got pushed by a prime",
                desc: "A prime asked for CMMC Level 1 evidence and your team does not have a clean package yet.",
              },
              {
                title: "You are preparing your first bids",
                desc: "You are seeing opportunities, but compliance language keeps slowing your responses down.",
              },
              {
                title: "You want confidence, not confusion",
                desc: "You want to know exactly what is done, what is missing, and what to do next each week.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-3xl border border-[#cfe3d9] bg-white p-7 shadow-[0_8px_28px_rgba(14,48,37,0.06)]"
              >
                <h3 className="font-serif text-2xl font-bold text-[#14392f]">{card.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#4a6f62]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-y border-[#d5e5dd] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Guided workflow
            </div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              One workspace. Four guided steps. No guesswork.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.n}
                className="rounded-3xl border border-[#d2e6dc] bg-[#f7fcf9] p-7"
              >
                <div className="text-xs font-bold tracking-[0.2em] text-[#2f8f6d]">STEP {step.n}</div>
                <h3 className="mt-2 font-serif text-2xl font-bold text-[#123328]">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#4b7164]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two paths */}
      <section id="paths" className="scroll-mt-16 bg-[#f7f7f3] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Membership
            </div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              Casual to use. Serious on security.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-[#44695c]">
              Your team gets plain-English guidance and weekly direction. Custodia officers stay in the loop to keep your package defensible when contract pressure shows up.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col rounded-3xl border border-[#8ec2ab] bg-white p-8 shadow-[0_10px_30px_rgba(14,48,37,0.07)]">
              <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e6f7ef] px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-[#1f5c47] ring-1 ring-[#b8d8cb]">
                CMMC 1 membership
              </div>
              <div className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d]">$249/mo</div>
              <p className="mt-2 text-base text-[#496f61]">
                AI speed plus human oversight. Build, monitor, and re-affirm your CMMC Level 1 package in one secure system.
              </p>
              <p className="mt-1 text-xs text-[#5d8376]">
                Billed monthly · Cancel any time · 7-day free trial, no credit card required
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {SELF_SERVE_INCLUDES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm text-[#31594d]">
                    <span className="mt-0.5 flex-none text-[#2f8f6d]">✓</span>
                    {f.label}
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="mt-8 w-full rounded-xl bg-[#104d3a] px-6 py-3 font-bold text-white transition-colors hover:bg-[#0d3e2f]">
                    Start free trial
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/upgrade"
                  prefetch={false}
                  className="mt-8 block w-full rounded-xl bg-[#104d3a] px-6 py-3 text-center font-bold text-white transition-colors hover:bg-[#0d3e2f]"
                >
                  Start your membership
                </Link>
              </Show>
            </div>
            <div className="flex flex-col rounded-3xl border border-[#214c3e] bg-[#12382c] p-8 text-[#e3f5ed] shadow-[0_10px_30px_rgba(14,48,37,0.15)]">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9cdbbe]">
                Done-for-you
              </div>
              <div className="font-serif text-3xl font-bold tracking-tight text-white">Bootcamp with a Custodia Officer</div>
              <p className="mt-2 text-base text-[#bfdfd0]">
                A senior compliance officer drives the process with your team for one week when speed matters.
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {BOOTCAMP_INCLUDES.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-sm ${
                      i === 0 ? "font-semibold text-white" : "text-[#c2e4d4]"
                    }`}
                  >
                    {i !== 0 && <span className="mt-0.5 flex-none text-[#89d2af]">✓</span>}
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#bootcamp"
                className="mt-8 block w-full rounded-xl border border-[#89d2af] px-6 py-3 text-center font-bold text-[#d8f2e6] transition-colors hover:bg-[#89d2af] hover:text-[#12382c]"
              >
                Talk to a Custodia officer
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Custodia Guarantee */}
      <section className="border-y border-[#9ccfb9] bg-[#dcf4e6] px-6 py-24">
        <div className="mx-auto max-w-5xl rounded-3xl border border-[#8bc6ab] bg-[#f4fbf7] p-8 shadow-[0_12px_36px_rgba(14,48,37,0.08)] md:p-10">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            Included with every membership
          </div>
          <h2 className="font-serif text-4xl font-bold leading-tight text-[#10231d]">The Custodia Guarantee</h2>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-[#3f6658]">
            If a prime contractor or contracting officer pushes back on any part of your CMMC Level 1 package from Custodia, we assign a dedicated compliance officer and resolve it. If needed, we work with the prime directly until your package is accepted.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              "Dedicated officer assigned immediately",
              "Challenge reviewed line-by-line with you",
              "Package and evidence remediated in-platform",
              "Direct communication with prime or officer when needed",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-[#cae6d8] bg-white px-4 py-3 text-sm font-medium text-[#31594c]">
                ✓ {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-[#608679]">
            Applies to active memberships and packages generated within Custodia. Limited to CMMC Level 1 scope.
          </p>
        </div>
      </section>

      {/* The 17 practices */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              The standards you must meet
            </div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-5xl">
              All 17 CMMC Level 1 practices, guided in one place.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base text-[#496f61]">
              No partial credit. Your workspace tracks each practice with plain-English instructions, evidence checks, and SSP narrative support.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {PRACTICES.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-[#d2e6dc] bg-[#f7fcf9] px-4 py-3"
              >
                <span className="rounded-md bg-[#104d3a] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#bef4be]">
                  {p.domain}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] text-[#5e8376]">{p.id}</div>
                  <div className="text-sm font-semibold text-[#123328]">{p.short}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-[#ffcf8a] bg-[#fff4de] p-6 text-center">
            <p className="text-[#83570d]">
              <strong>L1 affirmation is binary.</strong> You either implement all 17 practices or you do not. Level 2 point scoring does not apply here.
            </p>
          </div>
        </div>
      </section>

      {/* About / Mission */}
      <section id="about" className="scroll-mt-16 bg-[#14382d] px-6 py-24 text-[#dbf1e7]">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
            Why we built this
          </div>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-white md:text-5xl">
            Security is a growth lever when it is explained clearly.
          </h2>
          <div className="mx-auto mt-8 space-y-5 text-left text-base leading-relaxed text-[#c5e3d6] md:text-lg">
            <p>
              Custodia is a Pittsburgh cybersecurity firm. <strong className="text-white">Veteran-owned and operated</strong>, founded by <strong className="text-white">Carnegie Mellon graduates</strong>.
            </p>
            <p>
              We built this because small businesses kept missing contract opportunities, not due to capability gaps, but because compliance work felt opaque and overloaded.
            </p>
            <p>
              Our model is simple: make compliance understandable for non-technical operators, automate the heavy lifting, and keep a real officer in the loop when judgment is required.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-[#2a5a49] pt-10 text-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#8dd2b1]">Pittsburgh, PA</div>
              <div className="mt-1 text-sm text-[#8eb6a6]">Headquartered locally</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#8dd2b1]">Veteran-owned</div>
              <div className="mt-1 text-sm text-[#8eb6a6]">Mission-driven service</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#8dd2b1]">CMU built</div>
              <div className="mt-1 text-sm text-[#8eb6a6]">Cybersecurity depth</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bootcamp inquiry */}
      <section
        id="bootcamp"
        className="scroll-mt-16 border-t border-[#2a5a49] bg-[#14382d] px-6 py-24 text-white"
      >
        <div className="mx-auto max-w-xl text-center">
          <div className="mb-6 inline-block rounded-full border border-[#88cead]/40 bg-[#1d4a3b] px-4 py-1.5 text-sm font-semibold text-[#b8e7d3]">
            Done-for-you · Limited cohorts
          </div>
          <h2 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">Want it handled?</h2>
          <p className="mt-4 text-lg leading-relaxed text-[#c0dfd1]">
            Share your timeline and a Custodia compliance officer will reach out within one business day.
          </p>
          <div className="mt-10">
            <WaitlistForm />
          </div>
          <p className="mt-4 text-xs text-[#8db2a2]">No credit card. No commitment. We confirm fit first.</p>
        </div>
      </section>

      <footer className="bg-[#0d271f] px-6 py-10 text-[#9ac3b1]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-lg font-bold text-white">
            Custodia<span className="text-[#8dd2b1]">.</span>
          </div>
          <p className="text-center text-xs">
            CMMC Level 1 self-serve platform and officer-guided bootcamp · Pittsburgh, PA · Veteran-owned · CMU built
          </p>
          <p className="text-xs">© {new Date().getFullYear()} Custodia, LLC.</p>
        </div>
      </footer>
    </div>
  );
}
