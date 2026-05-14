import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "@/app/blog/_components/BlogShell";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/diy`;

export const metadata: Metadata = {
  title:
    "Do CMMC Level 1 Yourself — The Free DIY Handbook (2026) | Custodia",
  description:
    "The complete, honest, end-to-end guide to doing CMMC Level 1 yourself — for free. Seven steps, eight printable templates, plain English, no consultants required. Built by the engineers at Custodia.",
  keywords: [
    "diy cmmc level 1",
    "do cmmc level 1 yourself",
    "cmmc level 1 free",
    "how to do cmmc level 1",
    "cmmc level 1 guide free",
    "cmmc level 1 templates free",
    "cmmc self assessment guide",
    "cmmc free resources",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Do CMMC Level 1 Yourself — The Free DIY Handbook (2026)",
    description:
      "Seven steps, eight printable templates, plain English. The complete free DIY path to CMMC Level 1.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Do CMMC Level 1 Yourself — The Free DIY Handbook",
    description:
      "The complete free DIY path. Seven steps. Eight templates. No consultants.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

type Step = {
  n: string;
  title: string;
  italic?: string;
  blurb: string;
  time: string;
  deliverable: string;
  resource: { label: string; href: string };
  reading?: { label: string; href: string };
  detail: string[];
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Decide if you actually need it",
    italic: "(don't skip)",
    blurb:
      "If your contracts only have FCI (no CUI), you need CMMC Level 1. If they have CUI, you need Level 2 — different rules, different costs.",
    time: "5 minutes",
    deliverable: "A definitive yes / no, written down",
    resource: { label: "CUI vs FCI breakdown", href: "/blog/cui-vs-fci" },
    reading: { label: "Decision tree", href: "/blog/do-i-need-cmmc-decision-tree" },
    detail: [
      "Pull your last 3 federal contracts. Search for the strings 'FAR 52.204-21' and 'CUI'.",
      "If FAR 52.204-21 appears anywhere → Level 1 applies.",
      "If 'CUI' or 'DFARS 252.204-7012' appears → you're at Level 2, not Level 1. Stop and reassess.",
      "If neither appears in any contract → CMMC may not apply to you yet. Save this guide for when it does.",
    ],
  },
  {
    n: "02",
    title: "Scope your boundary",
    italic: "(the 90% lever)",
    blurb:
      "Decide which laptops, people, cloud apps, and rooms touch federal contract info. Anything inside the boundary has to meet the 15 controls. Anything outside doesn't.",
    time: "20 minutes",
    deliverable: "A signed scoping worksheet + boundary diagram",
    resource: {
      label: "Scoping worksheet template",
      href: "/cmmc-level-1/scoping-worksheet",
    },
    detail: [
      "Don't treat the whole company as in-scope by default. A 6-person shop usually has 3 laptops, 2 cloud apps, and a firewall in scope — not everything.",
      "List the people who touch FCI. The receptionist who only stamps envelopes is probably out of scope.",
      "List the devices, then the cloud apps, then the network and physical work area.",
      "Draw the boundary. A pencil sketch is acceptable evidence at Level 1.",
      "Sign and date the worksheet. This becomes the foundation of your SSP.",
    ],
  },
  {
    n: "03",
    title: "Inventory your assets",
    blurb:
      "Write down every in-scope device, every in-scope cloud account, every authorized user, every key/badge. This is the asset list your SSP and self-assessment reference.",
    time: "30 minutes",
    deliverable: "A current asset inventory (people, devices, apps)",
    resource: {
      label: "Use the scoping worksheet tables",
      href: "/cmmc-level-1/scoping-worksheet",
    },
    detail: [
      "The scoping worksheet (Step 2) doubles as your asset inventory. If you completed it, you're done with this step.",
      "If you want a standalone asset register, the templates folder in our repo has CSV starters (access-device-register, role-matrix, network-boundary-inventory).",
      "Update the inventory whenever someone joins or leaves, or you add a new app.",
    ],
  },
  {
    n: "04",
    title: "Write your policies",
    italic: "(eight of them)",
    blurb:
      "Eight one-page policies that cover all 15 controls. Adapt the templates, fill in your company name, sign, date, file.",
    time: "45 minutes",
    deliverable: "Eight signed, dated policies on file",
    resource: {
      label: "8 free policy templates",
      href: "/cmmc-level-1/policy-templates",
    },
    detail: [
      "Access Control · Identification & Authentication · Media Protection · Physical Protection · Network/Boundary · System Integrity · Incident Response · Acceptable Use.",
      "These are not novels. Each is one page. A 6-person company doesn't need a 40-page Information Security Manual.",
      "Have the affirming official (owner, CEO, or formally delegated CIO) sign and date each one.",
      "Re-sign annually as part of the affirmation cycle (Step 7).",
    ],
  },
  {
    n: "05",
    title: "Implement the 15 controls",
    blurb:
      "The actual technical work. Most of it is configuration of tools you already have (MFA on email, antivirus on, firewall configured, visitor log started).",
    time: "1–3 days, sometimes longer",
    deliverable: "Each of the 15 controls is genuinely operational",
    resource: {
      label: "The 15 requirements explained",
      href: "/blog/cmmc-level-1-17-practices",
    },
    detail: [
      "If you already have Microsoft 365 Business + Windows Defender + a router with a firewall, most controls are configuration, not procurement.",
      "Highest-leverage moves: turn on MFA across every cloud app, verify Defender is on every laptop, document who has admin, start a visitor log, set up a guest Wi-Fi separate from work Wi-Fi.",
      "Things people buy unnecessarily: enterprise EDR, a SIEM, a $20k MSP retainer. None of these are required for Level 1.",
      "Document what you implemented and where in your SSP (Step 6).",
    ],
  },
  {
    n: "06",
    title: "Write your System Security Plan (SSP)",
    blurb:
      "One document that describes how you implement each of the 15 controls. The single artifact that proves you took this seriously when a prime asks.",
    time: "60 minutes",
    deliverable: "A signed SSP referencing your scope, assets, and policies",
    resource: {
      label: "Free fill-in-the-blank SSP template",
      href: "/cmmc-level-1/ssp-template",
    },
    detail: [
      "For each of the 15 controls, write 2–4 sentences: what you do, who is responsible, where the evidence lives.",
      "Reference your policies (Step 4) and inventory (Steps 2–3). Don't repeat them — link.",
      "Have the affirming official sign and date. Schedule annual review.",
      "Save the PDF where you can find it on demand. This is the document primes will ask for.",
    ],
  },
  {
    n: "07",
    title: "Self-assess + post to SPRS",
    italic: "(the action that makes it real)",
    blurb:
      "Run the 15-question checklist. Sign the attestation. Post the affirmation in SPRS. You are now bid-ready.",
    time: "60 minutes (longer if PIEE isn't set up yet)",
    deliverable: "A live SPRS posting with your affirmation date",
    resource: {
      label: "Self-assessment checklist",
      href: "/cmmc-level-1/checklist",
    },
    reading: {
      label: "SPRS walkthrough",
      href: "/cmmc-level-1/sprs-walkthrough",
    },
    detail: [
      "Run the checklist. Honestly. If you can't mark MET on all 15, fix the gap before submitting.",
      "Have the affirming official sign the attestation.",
      "Post the affirmation in SPRS using our step-by-step walkthrough.",
      "Take a screenshot of the SPRS confirmation. Save it with your SSP.",
      "Set a calendar reminder for 11 months from now: time for the annual affirmation.",
    ],
  },
];

export default function DiyHubPage() {
  const totalTimeMin = 5 + 20 + 30 + 45 + 60 + 60; // baseline, ignoring Step 5 install time

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Do CMMC Level 1 Yourself — The Free DIY Handbook",
    description:
      "The complete free, end-to-end guide to doing CMMC Level 1 yourself.",
    url: PAGE_URL,
    totalTime: "PT4H",
    estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
    step: STEPS.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: s.blurb,
      url: `${PAGE_URL}#step-${s.n}`,
    })),
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[#08201a] px-6 pb-24 pt-20 text-white md:pb-28 md:pt-28">
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
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2f8f6d]/40 bg-[#0e2a23]/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#bdf2cf]" />
            The Custodia DIY handbook
          </div>
          <h1 className="font-serif text-[2.4rem] font-bold leading-[1.04] tracking-tight md:text-[4.2rem]">
            Do CMMC Level 1
            <br className="hidden md:block" />{" "}
            <span className="italic text-[#a8cfc0]">yourself</span>
            <span className="text-[#8dd2b1]">.</span>{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text italic text-transparent">
              For free.
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-[#a8cfc0] md:text-xl">
            Every consultant in the defense industrial base will tell
            you CMMC requires their help. For Level 1, they&apos;re
            wrong. Here is the complete, honest path &mdash; seven
            steps, eight printable templates, plain English. Built by
            the engineers at Custodia.
          </p>

          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-3 divide-x divide-white/[0.08] border border-white/[0.08] bg-[#0a261e]/40">
            {[
              { n: "7", l: "Steps end-to-end" },
              { n: "8", l: "Printable templates" },
              { n: "$0", l: "Cost to follow" },
            ].map((s) => (
              <div key={s.l} className="px-4 py-6 text-center md:px-6 md:py-7">
                <dt className="font-serif text-3xl font-bold text-white md:text-4xl">
                  {s.n}
                </dt>
                <dd className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7aab98]">
                  {s.l}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#step-01"
              className="inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-sm font-bold tracking-tight text-[#0c2219] transition-colors hover:bg-[#8dd2b1]"
            >
              Start with Step 1 &rarr;
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 border border-white/20 bg-transparent px-6 py-3 text-sm font-bold tracking-tight text-white transition-colors hover:border-[#8dd2b1] hover:text-[#bdf2cf]"
            >
              Or have us do it &mdash; $149/mo &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Honesty section ---------- */}
      <section className="border-b border-[#cfe3d9] bg-[#f7f7f3] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 grid gap-10 md:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                The honest pitch
              </div>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-5xl">
                We sell a platform. We&apos;re still going to tell you
                how to do this <span className="italic text-[#2f8f6d]">without us</span>.
              </h2>
            </div>
            <div className="text-[15px] leading-relaxed text-[#44695c]">
              <p>
                Here&apos;s why: CMMC Level 1 is genuinely doable
                without a consultant. We&apos;ve seen 6-person shops
                finish in a week. The consultants charging $15&ndash;40k
                for a Level 1 engagement are quietly extracting rent on
                the fact that nobody published the full path in plain
                English.
              </p>
              <p className="mt-3">
                We did. If you finish this handbook and never pay us a
                dollar, you got what you came for. If somewhere around
                the annual affirmation, evidence collection, or the next
                contract&apos;s renewal you decide you&apos;d rather not
                think about this every year &mdash; that&apos;s when
                you&apos;ll come back. The platform is $149/mo and we
                run the whole thing for you.
              </p>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden border border-[#cfe3d9] bg-[#cfe3d9] md:grid-cols-3">
            {[
              {
                t: "DIY works if",
                items: [
                  "You have ~4 focused hours over a week",
                  "You're comfortable with M365 / Google Workspace settings",
                  "You're willing to maintain the annual cycle yourself",
                ],
              },
              {
                t: "DIY breaks if",
                items: [
                  "You haven't run a self-assessment in 18+ months",
                  "Your SSP and policies are 'somewhere in a drawer'",
                  "You're targeting Level 2 (different ball game)",
                ],
              },
              {
                t: "When to pay someone",
                items: [
                  "Your prime requires evidence quarterly",
                  "You handle CUI (that's Level 2, not 1)",
                  "You'd rather sleep through the renewal",
                ],
              },
            ].map((col) => (
              <div key={col.t} className="bg-white p-6">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                  {col.t}
                </div>
                <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-[#10231d]">
                  {col.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 inline-block h-1 w-2 bg-[#2f8f6d]" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- The 7 steps ---------- */}
      <section className="border-b border-[#cfe3d9] bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                The whole path
              </div>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-5xl">
                Seven steps. Roughly{" "}
                <span className="italic text-[#2f8f6d]">{Math.round(totalTimeMin / 60)} hours</span> of work.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-relaxed text-[#5a7d70] md:block">
              Each step gives you a specific deliverable and a template.
              Do them in order. Don&apos;t skip Step 2.
            </p>
          </div>

          <ol className="space-y-px overflow-hidden border border-[#cfe3d9] bg-[#cfe3d9]">
            {STEPS.map((s) => (
              <li
                key={s.n}
                id={`step-${s.n}`}
                className="block bg-white p-8 md:p-10"
              >
                <div className="grid gap-6 md:grid-cols-[110px_1fr]">
                  <div>
                    <div className="font-serif text-5xl font-bold text-[#2f8f6d] md:text-6xl">
                      {s.n}
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                      {s.time}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif text-2xl font-bold leading-tight text-[#10231d] md:text-[28px]">
                      {s.title}
                      {s.italic ? (
                        <>
                          {" "}
                          <span className="italic text-[#2f8f6d]">{s.italic}</span>
                        </>
                      ) : null}
                    </h3>
                    <p className="mt-3 text-[16px] leading-relaxed text-[#44695c]">
                      {s.blurb}
                    </p>

                    <div className="mt-5 grid gap-3 border-y border-[#cfe3d9] py-4 text-[13px] md:grid-cols-2">
                      <div>
                        <div className="font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                          Deliverable
                        </div>
                        <div className="mt-1 text-[#10231d]">{s.deliverable}</div>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        <div>
                          <div className="font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                            Template
                          </div>
                          <Link
                            href={s.resource.href}
                            className="mt-1 inline-block font-bold text-[#10231d] underline decoration-[#8dd2b1] decoration-2 underline-offset-[4px] hover:decoration-[#2f8f6d]"
                          >
                            {s.resource.label} &rarr;
                          </Link>
                        </div>
                        {s.reading ? (
                          <div>
                            <div className="font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                              Reading
                            </div>
                            <Link
                              href={s.reading.href}
                              className="mt-1 inline-block font-bold text-[#10231d] underline decoration-[#8dd2b1] decoration-2 underline-offset-[4px] hover:decoration-[#2f8f6d]"
                            >
                              {s.reading.label} &rarr;
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <ul className="mt-5 space-y-2 text-[14px] leading-relaxed text-[#10231d]">
                      {s.detail.map((d) => (
                        <li key={d} className="flex gap-3">
                          <span
                            aria-hidden
                            className="mt-2 inline-block h-1 w-2 flex-shrink-0 bg-[#2f8f6d]"
                          />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Template library ---------- */}
      <section className="border-b border-[#cfe3d9] bg-[#f7f7f3] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
              The library
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-5xl">
              Every template, in one place.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#44695c]">
              All free. All printable. All built from primary sources
              (FAR 52.204-21, 32 CFR Part 170). No email gate, no PDF
              wall, no upsells in the middle.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Scoping worksheet",
                d: "Define your FCI boundary, list assets, draw the diagram.",
                href: "/cmmc-level-1/scoping-worksheet",
                k: "20 min",
              },
              {
                t: "SSP template",
                d: "Fill-in-the-blank System Security Plan covering all 15 controls.",
                href: "/cmmc-level-1/ssp-template",
                k: "60 min",
              },
              {
                t: "8 policy templates",
                d: "One page each. Covers every L1 control family.",
                href: "/cmmc-level-1/policy-templates",
                k: "45 min",
              },
              {
                t: "Self-assessment checklist",
                d: "All 15 requirements in plain English. Score yourself.",
                href: "/cmmc-level-1/checklist",
                k: "30 min",
              },
              {
                t: "SPRS posting walkthrough",
                d: "Step-by-step for submitting your affirmation in SPRS.",
                href: "/cmmc-level-1/sprs-walkthrough",
                k: "30 min",
              },
              {
                t: "Annual affirmation guide",
                d: "Calendar template + 10-point review for the annual renewal.",
                href: "/cmmc-level-1/annual-affirmation",
                k: "15 min/yr",
              },
            ].map((card) => (
              <Link
                key={card.t}
                href={card.href}
                className="group block border border-[#cfe3d9] bg-white p-6 transition-colors hover:border-[#2f8f6d]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-xl font-bold text-[#10231d] group-hover:text-[#2f8f6d]">
                    {card.t}
                  </h3>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                    {card.k}
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#44695c]">
                  {card.d}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#0e2a23] underline decoration-[#8dd2b1] decoration-2 underline-offset-[6px] group-hover:decoration-[#2f8f6d]">
                  Open template <span aria-hidden>&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-b border-[#cfe3d9] bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Common questions
          </div>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10231d] md:text-5xl">
            Honest answers.
          </h2>

          <div className="mt-10 divide-y divide-[#cfe3d9] border-y border-[#cfe3d9]">
            {[
              {
                q: "Is doing CMMC Level 1 yourself actually allowed?",
                a: "Yes. Level 1 is explicitly self-assessed. No third-party assessor, no government auditor — just you, the 15 requirements, and an annual affirmation in SPRS. (Level 2 is different: it requires a C3PAO assessment.)",
              },
              {
                q: "What does the consultant charge for that I'm not paying?",
                a: "For Level 1, consultants typically charge for: a scoping conversation, drafting your SSP, drafting your policies, a gap assessment, and 'remediation guidance.' Everything in that list is something we hand you a template for — free. The legitimate work a consultant adds is project management and accountability, not unique knowledge.",
              },
              {
                q: "What if I do something wrong?",
                a: "Honest mistakes during self-assessment are not the False Claims Act risk. Knowingly false attestations are. The protective move is: implement what you can, document what you've done, sign your attestation only when it's truly accurate. If you have a gap, fix it before you submit.",
              },
              {
                q: "How long does this actually take?",
                a: "About 4 hours of focused work spread over a week, if you start from a reasonably modern setup (M365 Business or Google Workspace + a recent firewall). Add 1–3 days if you need to install MFA, configure antivirus, or set up a separate guest Wi-Fi.",
              },
              {
                q: "What does your platform actually do that this handbook doesn't?",
                a: "The platform fills the templates in for you using a guided interview, collects evidence on a schedule, sends the annual renewal reminders, generates your SPRS-ready score and submission packet, and gives you a single dashboard a prime can be shown. (SPRS posting itself still requires your CAGE-linked PIEE login — we walk you through it.) The handbook gives you the same artifacts at the cost of doing the work manually each year.",
              },
              {
                q: "When should I just pay someone?",
                a: "(a) When you handle CUI — that's Level 2, not Level 1, and is a different process. (b) When your prime requires evidence collection on a recurring basis and the manual cycle would eat more than $149/mo of your time. (c) When the annual renewal is what keeps slipping — that's exactly the failure mode the platform is built to prevent.",
              },
            ].map((f, i) => (
              <details
                key={i}
                className="group cursor-pointer py-5"
              >
                <summary className="flex cursor-pointer items-baseline justify-between gap-4 text-left">
                  <span className="font-serif text-lg font-bold text-[#10231d]">
                    {f.q}
                  </span>
                  <span
                    aria-hidden
                    className="font-serif text-2xl text-[#2f8f6d] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#44695c]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Bottom CTA ---------- */}
      <section className="bg-[#08201a] px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
            Ready to start
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold leading-tight md:text-5xl">
            Two paths.{" "}
            <span className="italic text-[#a8cfc0]">Pick one.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#a8cfc0]">
            The free DIY path will get you to bid-ready in about a
            week. The platform will get you there in seven days and
            keep you there every year after.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden bg-white/[0.08] md:grid-cols-2">
            <div className="bg-[#0a261e] p-8 text-left">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#7aab98]">
                Free DIY path
              </div>
              <div className="mt-3 font-serif text-3xl font-bold">
                $0<span className="text-base font-medium text-[#7aab98]"> &middot; ~4 hours of work</span>
              </div>
              <Link
                href="#step-01"
                className="mt-6 inline-flex items-center gap-2 border border-white/20 bg-transparent px-5 py-2.5 text-sm font-bold transition-colors hover:border-[#8dd2b1] hover:text-[#bdf2cf]"
              >
                Start with Step 1 &rarr;
              </Link>
            </div>
            <div className="bg-[#0a261e] p-8 text-left">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
                Custodia platform
              </div>
              <div className="mt-3 font-serif text-3xl font-bold">
                $149<span className="text-base font-medium text-[#a8cfc0]">/mo &middot; 14-day free trial</span>
              </div>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex items-center gap-2 bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#8dd2b1]"
              >
                Start the free trial &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </BlogShell>
  );
}
