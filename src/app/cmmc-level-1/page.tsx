import type { Metadata } from "next";
import Link from "next/link";
import { BlogShell } from "@/app/blog/_components/BlogShell";
import { getAllPosts } from "@/lib/blog";
import PublicCmmcL1Agent from "./_components/PublicCmmcL1Agent";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1`;
const LAST_UPDATED = "2026-05-13";

export const metadata: Metadata = {
  title:
    "CMMC Level 1: The Complete Plain-English Guide (2026) | Custodia",
  description:
    "Everything a small DoD contractor needs to know about CMMC Level 1: the 15 FAR 52.204-21 safeguarding requirements, the annual SPRS affirmation, real costs, and how to get bid-ready in a week. Plain English. Primary sources cited.",
  keywords: [
    "cmmc level 1",
    "cmmc level 1 requirements",
    "cmmc level 1 self assessment",
    "cmmc level 1 cost",
    "cmmc level 1 vs level 2",
    "cmmc level 1 sprs",
    "cmmc level 1 affirmation",
    "cmmc level 1 plain english",
    "cmmc level 1 small business",
    "cmmc level 1 checklist",
    "far 52.204-21",
    "fci compliance",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "CMMC Level 1: The Complete Plain-English Guide (2026)",
    description:
      "The 15 FAR 52.204-21 safeguarding requirements, the SPRS affirmation, real 2026 costs, and a 7-day path to bid-ready. Written for small DoD contractors.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "CMMC Level 1: The Complete Plain-English Guide (2026)",
    description:
      "The 15 FAR 52.204-21 safeguards, the SPRS affirmation, the real cost, and how to get bid-ready in a week.",
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

const PRACTICE_FAMILIES = [
  {
    family: "Access Control (AC)",
    short: "AC",
    practices: [
      { id: "AC.L1-3.1.1", title: "Limit system access to authorized users" },
      { id: "AC.L1-3.1.2", title: "Limit transactions to authorized functions" },
      { id: "AC.L1-3.1.20", title: "Control connections to external systems" },
      { id: "AC.L1-3.1.22", title: "Control information posted publicly" },
    ],
  },
  {
    family: "Identification & Authentication (IA)",
    short: "IA",
    practices: [
      { id: "IA.L1-3.5.1", title: "Identify users, processes, and devices" },
      { id: "IA.L1-3.5.2", title: "Authenticate users, processes, and devices" },
    ],
  },
  {
    family: "Media Protection (MP)",
    short: "MP",
    practices: [
      { id: "MP.L1-3.8.3", title: "Sanitize or destroy media before disposal or reuse" },
    ],
  },
  {
    family: "Physical Protection (PE)",
    short: "PE",
    practices: [
      { id: "PE.L1-3.10.1", title: "Limit physical access to authorized individuals" },
      { id: "PE.L1-3.10.3", title: "Escort visitors and monitor visitor activity" },
      { id: "PE.L1-3.10.4", title: "Maintain audit logs of physical access" },
      { id: "PE.L1-3.10.5", title: "Control and manage physical access devices" },
    ],
  },
  {
    family: "System & Communications Protection (SC)",
    short: "SC",
    practices: [
      { id: "SC.L1-3.13.1", title: "Monitor and control communications at boundaries" },
      { id: "SC.L1-3.13.5", title: "Use subnetworks for publicly accessible systems" },
    ],
  },
  {
    family: "System & Information Integrity (SI)",
    short: "SI",
    practices: [
      { id: "SI.L1-3.14.1", title: "Identify, report, and correct system flaws" },
      { id: "SI.L1-3.14.2", title: "Provide protection from malicious code" },
      { id: "SI.L1-3.14.4", title: "Update malicious-code protection mechanisms" },
      { id: "SI.L1-3.14.5", title: "Perform periodic and real-time scans" },
    ],
  },
] as const;

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What is CMMC Level 1?",
    a: "CMMC Level 1 is the lowest tier of the Department of Defense's Cybersecurity Maturity Model Certification program. It applies to any contractor that handles Federal Contract Information (FCI) on a DoD contract and requires implementation of the 15 basic safeguarding requirements from FAR 52.204-21(b)(1), annual self-assessment, and a senior official affirmation posted in the Supplier Performance Risk System (SPRS). It is binary — MET or NOT MET — not a numeric score.",
  },
  {
    q: "Who needs CMMC Level 1?",
    a: "Any organization that holds or seeks a DoD contract or subcontract that flows down FAR 52.204-21 and handles Federal Contract Information (FCI) — but not Controlled Unclassified Information (CUI). That generally means small primes and subcontractors providing non-classified products and services to DoD where the contract data is not public but is not marked CUI. Contractors handling CUI need CMMC Level 2.",
  },
  {
    q: "How many requirements are in CMMC Level 1?",
    a: "Fifteen. They come directly from FAR 52.204-21(b)(1)(i)–(xv) and cover six security families: Access Control, Identification and Authentication, Media Protection, Physical Protection, System and Communications Protection, and System and Information Integrity. The CMMC Assessment Guide expresses these as 17 practice IDs because one FAR requirement splits into multiple sub-practices.",
  },
  {
    q: "Is CMMC Level 1 self-attested or third-party assessed?",
    a: "Self-attested. The contractor performs the annual self-assessment, a senior official affirms the result, and the affirmation is posted in SPRS. Unlike CMMC Level 2 (which requires a C3PAO assessment for most contracts), Level 1 does not require a third-party assessor.",
  },
  {
    q: "How often do I have to renew my CMMC Level 1 affirmation?",
    a: "Annually. The senior official affirmation in SPRS must be renewed every 12 months. Each affirmation covers the prior assessment cycle. Per 32 CFR § 170.21(a)(2), the senior official is personally responsible for the affirmation's accuracy.",
  },
  {
    q: "What does CMMC Level 1 cost in 2026?",
    a: "There is no government filing fee. Real costs are time (20–40 hours DIY) and tooling. Typical 2026 paths: do-it-yourself with existing Microsoft 365 or Google Workspace tenants ($0 cash + 30 hours), vCISO consultant ($6,000–$18,000), or guided SaaS like Custodia ($249/month Self Service — or $2,496/year on annual — or $397/month with a credentialed Custodia Compliance Officer assigned to your account). The SPRS affirmation itself is free.",
  },
  {
    q: "Can I bid on DoD contracts without CMMC Level 1?",
    a: "Increasingly, no. Under the 48 CFR phased rollout that began November 10, 2025, more DoD solicitations require a current SPRS affirmation at the time of award. For Level 1 set-aside opportunities, the affirmation is the bid-eligibility step. Solicitations vary — some require it at proposal submission, others at award.",
  },
  {
    q: "What happens if I file a false CMMC Level 1 affirmation in SPRS?",
    a: "A false SPRS affirmation is a federal false statement under 18 U.S.C. § 1001 and actionable under the False Claims Act (31 U.S.C. § 3729). The DOJ has prosecuted multiple FCA cases against contractors for misrepresenting NIST 800-171 / CMMC posture; settlements have ranged from $300,000 to over $9 million. The senior official who signs the affirmation is personally exposed.",
  },
  {
    q: "What's the difference between CMMC Level 1 and CMMC Level 2?",
    a: "Level 1 covers 15 FAR safeguards for handling Federal Contract Information (FCI), self-attested annually in SPRS. Level 2 covers all 110 NIST SP 800-171 controls for handling Controlled Unclassified Information (CUI), typically requires a third-party C3PAO assessment every three years, and yields a numeric SPRS score from –203 to 110.",
  },
  {
    q: "How long does it take to get CMMC Level 1 ready?",
    a: "A small contractor on a modern cloud tenant (Microsoft 365 Business Premium or Google Workspace Business Plus) typically gets to a defensible package in 3–5 business days. Most of the technical safeguards (MFA, antivirus, account lockout, boundary protection) are already enabled in the default tenant configuration and only need to be documented in a System Security Plan. The longer items are media-sanitization procedures and physical-access log routines.",
  },
];

const HOWTO_STEPS = [
  {
    name: "Confirm CMMC Level 1 applies to you",
    text: "Verify your contract or solicitation includes FAR 52.204-21 (and DFARS 252.204-7021 at Level 1), and that the data you handle is Federal Contract Information — not Controlled Unclassified Information. If you handle any CUI, you need Level 2 instead.",
    url: `${APP_URL}/blog/do-i-need-cmmc-decision-tree`,
  },
  {
    name: "Inventory your FCI assets",
    text: "List every device, account, and location that stores, processes, or transmits FCI. This is your assessment scope. For most small contractors it is one cloud tenant (M365 or Workspace), 5–25 endpoints, and one office.",
  },
  {
    name: "Implement the 15 FAR 52.204-21 safeguarding requirements",
    text: "Enable MFA on all accounts, restrict admin privileges, install endpoint anti-malware, configure boundary controls, sanitize media before disposal, lock the office, escort visitors, and patch systems. Most of this is configuration of tools you already have.",
    url: `${APP_URL}/blog/cmmc-level-1-17-practices-explained`,
  },
  {
    name: "Draft a System Security Plan (SSP)",
    text: "Document — in writing — how your environment satisfies each of the 15 safeguards. The SSP is the single artifact a prime, contracting officer, or DIBCAC reviewer will ask for. It does not need to be long, but it must be specific.",
  },
  {
    name: "Run the annual self-assessment",
    text: "Walk through each of the 17 CMMC practice IDs (mapped from the 15 FAR requirements) and confirm MET against the NIST SP 800-171A assessment objectives. Document evidence (screenshots, logs, policies) for each.",
  },
  {
    name: "Have a senior official sign the affirmation",
    text: "A senior company official (typically owner, CEO, or CISO) signs the SPRS affirmation, attesting under 32 CFR § 170.22 to the accuracy of the assessment. This person is personally responsible.",
  },
  {
    name: "Post the affirmation in SPRS",
    text: "Log into PIEE (piee.eb.mil), open the SPRS module, select 'CMMC Level 1 (Self) Affirmation', enter the assessment date and CAGE code, and submit. The post is free. Save the confirmation.",
    url: `${APP_URL}/blog/sprs-score-explained-and-how-to-respond-to-prime`,
  },
  {
    name: "Maintain continuously and re-affirm annually",
    text: "Patch, monitor, train staff, and update evidence as systems change. Re-affirm in SPRS every 12 months. Custodia handles continuous monitoring and the annual re-affirmation for paid members.",
  },
];

export default function CmmcLevel1PillarPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "CMMC Level 1: The Complete Plain-English Guide (2026)",
    description:
      "Everything a small DoD contractor needs to know about CMMC Level 1: the 15 FAR 52.204-21 safeguarding requirements, the annual SPRS affirmation, real 2026 costs, and how to get bid-ready in a week.",
    url: PAGE_URL,
    mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
    datePublished: "2026-05-13",
    dateModified: LAST_UPDATED,
    inLanguage: "en-US",
    author: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
      logo: { "@type": "ImageObject", url: `${APP_URL}/custodia-logo.png` },
    },
    isAccessibleForFree: true,
    about: [
      { "@type": "Thing", name: "CMMC Level 1" },
      { "@type": "Thing", name: "FAR 52.204-21" },
      { "@type": "Thing", name: "Federal Contract Information" },
      { "@type": "Thing", name: "Supplier Performance Risk System" },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Custodia", item: APP_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "CMMC Level 1",
        item: PAGE_URL,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to get CMMC Level 1 ready in a week",
    description:
      "Eight steps to a defensible CMMC Level 1 self-assessment and a current SPRS affirmation, for a small DoD contractor.",
    totalTime: "P7D",
    estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "149" },
    step: HOWTO_STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
    })),
  };

  const definedTermJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: "CMMC Level 1",
    description:
      "The lowest tier of the U.S. Department of Defense's Cybersecurity Maturity Model Certification program. Applies to contractors handling Federal Contract Information (FCI), requires 15 safeguarding requirements from FAR 52.204-21(b)(1), and is satisfied by an annual self-assessment with a senior official affirmation posted in SPRS.",
    inDefinedTermSet: "https://www.acquisition.gov/far/52.204-21",
    termCode: "CMMC L1",
    url: PAGE_URL,
  };

  const posts = getAllPosts();

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }}
      />

      {/* Hero */}
      <header className="relative overflow-hidden bg-[#08201a] px-6 py-16 text-white md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -10%, rgba(141,210,177,0.16), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#7aab98]"
          >
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[#bdf2cf]">CMMC Level 1</span>
          </nav>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            CMMC Level 1: The Complete Plain-English Guide (2026)
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            Everything a small DoD contractor actually needs to know about
            CMMC Level 1 — the 15 FAR 52.204-21 safeguarding requirements,
            the annual SPRS affirmation, real 2026 costs, and a 7-day path
            to bid-ready. Written for the founder who never asked to
            become a cybersecurity expert.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-5 text-xs text-[#7aab98]">
            <span>
              Last updated{" "}
              <strong className="text-white">
                {new Date(LAST_UPDATED + "T12:00:00Z").toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
                )}
              </strong>
            </span>
            <span aria-hidden className="opacity-40">/</span>
            <span>~12 minute read</span>
            <span aria-hidden className="opacity-40">/</span>
            <span>Primary sources cited throughout</span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/cmmc-check"
              className="bg-[#bdf2cf] px-5 py-3 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
            >
              Take the free 5-min scoping check &rarr;
            </Link>
            <Link
              href="/sign-up"
              className="border border-[#bdf2cf]/40 px-5 py-3 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-white/5"
            >
              Start 14-day free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        {/* AEO lead — the 50-word answer crawlers extract */}
        <div className="mb-10 border-l-4 border-[#2f8f6d] bg-[#f4faf6] px-5 py-4 text-base leading-relaxed text-[#10231d]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            The answer in 50 words
          </p>
          <p className="mt-2">
            <strong>CMMC Level 1</strong> is the DoD&apos;s lowest cybersecurity
            requirement, mandatory for any contractor handling{" "}
            <strong>Federal Contract Information (FCI)</strong>. It requires you
            to meet <strong>15 safeguarding requirements</strong> from{" "}
            <strong>FAR 52.204-21</strong>, self-assess annually, and have a
            senior official affirm the result in <strong>SPRS</strong>. There
            is <em>no score</em> — it is <strong>binary</strong>: MET or NOT MET.
          </p>
        </div>

        {/* Two-quiz funnel — answers "where do I start?" in two clicks */}
        <div className="mb-12 grid gap-4 md:grid-cols-2">
          <Link
            href="/cmmc-check"
            className="group block border-2 border-[#2f8f6d] bg-white px-5 py-5 transition-colors hover:bg-[#f4faf6]"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Step 1 &middot; 5 minutes
            </div>
            <div className="mt-1 font-serif text-lg font-bold text-[#10231d]">
              Do I even need CMMC?
            </div>
            <p className="mt-1 text-sm text-[#5a7d70]">
              Free 4-question scoping check. Tells you Level 1, Level 2, or
              not applicable — same logic a DoD contracting officer uses.
            </p>
            <div className="mt-3 text-sm font-bold text-[#2f8f6d] underline group-hover:no-underline">
              Take the scoping check &rarr;
            </div>
          </Link>
          <Link
            href="/sprs-check"
            className="group block border-2 border-[#2f8f6d] bg-white px-5 py-5 transition-colors hover:bg-[#f4faf6]"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Step 2 &middot; 4 minutes
            </div>
            <div className="mt-1 font-serif text-lg font-bold text-[#10231d]">
              Am I ready to attest in SPRS?
            </div>
            <p className="mt-1 text-sm text-[#5a7d70]">
              Free 15-question readiness quiz against FAR 52.204-21. Shows
              exactly which safeguards are MET and which still need work
              before your senior official signs the affirmation.
            </p>
            <div className="mt-3 text-sm font-bold text-[#2f8f6d] underline group-hover:no-underline">
              Take the SPRS quiz &rarr;
            </div>
          </Link>
        </div>

        {/* Public CMMC Level 1 helper agent — Charlie answers questions live */}
        <section id="ask" className="mb-12 scroll-mt-24">
          <div className="mb-4">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Ask Charlie · free · no signup
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
              Have a CMMC Level 1 question? Ask it now.
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#44695c]">
              Charlie is Custodia&apos;s public vCO (virtual compliance
              officer), grounded in the official DoD CMMC Level 1
              documents on this site. Ask anything — scoping, evidence,
              SPRS, Level 1 vs Level 2, whether you even need it. No
              email, no signup, no sales pitch.
            </p>
          </div>
          <PublicCmmcL1Agent />
        </section>

        {/* "Why this matters" — reframes compliance as the door to bigger contracts */}
        <div className="mb-12 border border-[#cfe3d9] bg-[#fffdf3] px-6 py-5">
          <h2 className="font-serif text-xl font-bold text-[#10231d] md:text-2xl">
            Why CMMC Level 1 is a business opportunity, not a tax
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#10231d]">
            Federal contracting is the largest single buyer in the world.
            DoD alone obligated <strong>over $400 billion</strong> in
            contracts in FY 2024, and roughly a quarter of that flowed to
            small businesses — much of it to firms doing the exact work
            you already do for commercial customers: IT, machining,
            staffing, construction, electrical, logistics, software,
            engineering, facilities.
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#10231d]">
            What gates access is not capability. It&apos;s a current{" "}
            <strong>CMMC Level 1 affirmation in SPRS</strong>. Get the
            affirmation and you unlock:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm">
            <li>DoD subcontracts that flow FAR 52.204-21 down from primes (Lockheed, RTX, GD, Northrop, L3Harris, etc.).</li>
            <li>Small-business set-aside primes (SDVOSB, WOSB, 8(a), HUBZone, SDB).</li>
            <li>SBIR/STTR Phase I and Phase II awards.</li>
            <li>Agency direct buys and micro-purchase windows (under $250k threshold).</li>
            <li>GSA Multiple Award Schedule (MAS) federal sales pipelines that increasingly require CMMC posture.</li>
          </ul>
          <p className="mt-3 text-base leading-relaxed text-[#10231d]">
            The work is the same work you already do. The credential is
            what lets a contracting officer give you the contract.
          </p>
        </div>

        {/* TOC */}
        <nav
          aria-label="Table of contents"
          className="mb-12 border border-[#cfe3d9] bg-white/60 px-6 py-5"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            On this page
          </p>
          <ol className="mt-3 grid list-decimal gap-y-1 pl-5 text-sm md:grid-cols-2">
            <li><a href="#ask" className="text-[#2f8f6d] hover:underline">Ask Charlie (free)</a></li>
            <li><a href="#what" className="text-[#2f8f6d] hover:underline">What CMMC Level 1 actually is</a></li>
            <li><a href="#who" className="text-[#2f8f6d] hover:underline">Who needs CMMC Level 1</a></li>
            <li><a href="#requirements" className="text-[#2f8f6d] hover:underline">The 15 safeguarding requirements</a></li>
            <li><a href="#sprs" className="text-[#2f8f6d] hover:underline">SPRS and the annual affirmation</a></li>
            <li><a href="#cost" className="text-[#2f8f6d] hover:underline">Real cost in 2026</a></li>
            <li><a href="#vs-level-2" className="text-[#2f8f6d] hover:underline">Level 1 vs Level 2</a></li>
            <li><a href="#how-to" className="text-[#2f8f6d] hover:underline">7-day path to bid-ready</a></li>
            <li><a href="#timeline" className="text-[#2f8f6d] hover:underline">Regulatory timeline</a></li>
            <li><a href="#faq" className="text-[#2f8f6d] hover:underline">FAQ</a></li>
            <li><a href="#sources" className="text-[#2f8f6d] hover:underline">Official DoD source documents</a></li>
            <li><a href="#related" className="text-[#2f8f6d] hover:underline">Plain-English explainers</a></li>
          </ol>
        </nav>

        <section id="what" className="prose prose-slate max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            What CMMC Level 1 actually is
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            CMMC stands for <strong>Cybersecurity Maturity Model Certification</strong>.
            It is the Department of Defense&apos;s program for verifying that
            contractors handling sensitive government information have basic
            cybersecurity hygiene in place. The program is codified at{" "}
            <a
              href="https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-170"
              target="_blank"
              rel="noopener nofollow"
              className="text-[#2f8f6d] underline"
            >
              32 CFR Part 170
            </a>{" "}
            and enforced through the DFARS clause{" "}
            <a
              href="https://www.acquisition.gov/dfars/252.204-7021"
              target="_blank"
              rel="noopener nofollow"
              className="text-[#2f8f6d] underline"
            >
              252.204-7021
            </a>
            .
          </p>
          <p className="mt-4 text-base leading-relaxed">
            <strong>Level 1</strong> is the entry tier. It applies to
            contractors that handle <strong>Federal Contract Information
            (FCI)</strong> — non-public information provided by or generated
            for the government under a contract — but not{" "}
            <strong>Controlled Unclassified Information (CUI)</strong>.
            The requirements come straight from{" "}
            <a
              href="https://www.acquisition.gov/far/52.204-21"
              target="_blank"
              rel="noopener nofollow"
              className="text-[#2f8f6d] underline"
            >
              FAR 52.204-21(b)(1)
            </a>{" "}
            — the same 15 basic safeguards every federal contractor has
            owed since 2016.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            What CMMC adds is a verification layer: the contractor must
            now self-assess annually, document the result, and have a
            senior official affirm in <strong>SPRS</strong> (the DoD
            Supplier Performance Risk System) that the 15 safeguards
            are <em>met</em>. A false affirmation is a federal false
            statement and a False Claims Act exposure. The compliance
            standard is the same; the accountability is new.
          </p>
        </section>

        <section id="who" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            Who needs CMMC Level 1
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            You need CMMC Level 1 if all four are true:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base">
            <li>
              You hold or seek a <strong>DoD contract or subcontract</strong>.
            </li>
            <li>
              The contract incorporates <strong>FAR 52.204-21</strong> and/or
              DFARS 252.204-7021 (it flows down to subs automatically when
              the prime is in scope).
            </li>
            <li>
              You handle <strong>Federal Contract Information (FCI)</strong> —
              non-public information shared as part of the contract.
            </li>
            <li>
              You do <strong>not</strong> handle{" "}
              <strong>Controlled Unclassified Information (CUI)</strong>. If
              you do, you need <Link href="/blog/cmmc-level-1-vs-level-2" className="text-[#2f8f6d] underline">CMMC Level 2</Link>{" "}
              instead.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            If you only sell commercial products to commercial customers,
            CMMC does not apply. If you sell to civilian agencies (GSA,
            DHS, HHS), FAR 52.204-21 still applies but CMMC affirmation
            in SPRS does not — yet. The pending FAR CUI Rule (RIN
            9000-AN56) may extend similar requirements government-wide.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            Not sure? Walk the{" "}
            <Link href="/blog/do-i-need-cmmc-decision-tree" className="text-[#2f8f6d] underline">
              4-question decision tree
            </Link>{" "}
            — it&apos;s the same tree a DoD contracting officer would use.
          </p>

          <h3 className="mt-8 font-serif text-xl font-bold text-[#10231d]">
            Concrete examples of who needs CMMC Level 1
          </h3>
          <p className="mt-3 text-base leading-relaxed">
            If you see your business in this list, you almost certainly
            need CMMC Level 1. None of these businesses are
            &quot;cybersecurity companies&quot; — they&apos;re ordinary firms
            doing ordinary work for DoD:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base">
            <li>
              <strong>An electrical contractor</strong> wiring a hangar at
              a Navy base under a subcontract from a prime.
            </li>
            <li>
              <strong>A machine shop</strong> producing non-classified
              metal parts for a DoD aerospace supplier.
            </li>
            <li>
              <strong>An IT staffing firm</strong> placing developers on a
              DoD project where the contract data isn&apos;t marked CUI.
            </li>
            <li>
              <strong>A janitorial or facilities subcontractor</strong>{" "}
              servicing a DoD installation.
            </li>
            <li>
              <strong>A logistics or freight firm</strong> moving
              non-sensitive DoD cargo.
            </li>
            <li>
              <strong>A SBIR Phase I winner</strong> in a non-CUI topic
              area — the Phase I contract triggers FAR 52.204-21
              flow-down. See{" "}
              <Link href="/blog/cmmc-for-sbir-phase-1-winners" className="text-[#2f8f6d] underline">
                the CMMC timeline for SBIR Phase I winners
              </Link>
              .
            </li>
            <li>
              <strong>A software development sub</strong> building a
              non-CUI internal tool for a DoD agency.
            </li>
            <li>
              <strong>A construction subcontractor</strong> on a base
              renovation contract.
            </li>
          </ul>
          <p className="mt-3 text-base leading-relaxed">
            If your work touches anything marked <strong>CUI</strong> —
            technical drawings of weapons systems, ITAR-controlled data,
            export-controlled engineering specs — you need{" "}
            <Link href="/blog/cmmc-level-1-vs-level-2" className="text-[#2f8f6d] underline">
              CMMC Level 2
            </Link>
            , not Level 1.
          </p>
        </section>

        <section id="requirements" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            The 15 safeguarding requirements (and 17 CMMC practices)
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            CMMC Level 1 maps to 15 plain-language requirements at FAR
            52.204-21(b)(1)(i)–(xv). The CMMC Assessment Guide expresses
            those as <strong>17 practice IDs</strong> across six security
            families. Every Level 1 affirmation in SPRS rolls up to a
            single &quot;MET&quot;: every practice must be implemented for the
            overall affirmation to be valid (32 CFR § 170.24).
          </p>
          <div className="mt-6 space-y-6">
            {PRACTICE_FAMILIES.map((fam) => (
              <div
                key={fam.short}
                className="border border-[#cfe3d9] bg-white px-5 py-4"
              >
                <h3 className="font-serif text-lg font-bold text-[#10231d]">
                  {fam.family}
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {fam.practices.map((p) => (
                    <li key={p.id} className="flex gap-3">
                      <code className="shrink-0 font-mono text-xs text-[#2f8f6d]">
                        {p.id}
                      </code>
                      <span>{p.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-base leading-relaxed">
            Each requirement is unpacked in plain English — including
            what evidence satisfies it — in{" "}
            <Link href="/blog/cmmc-level-1-17-practices-explained" className="text-[#2f8f6d] underline">
              the full walkthrough of the 15 FAR 52.204-21 requirements
            </Link>
            .
          </p>
        </section>

        <section id="sprs" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            SPRS and the annual affirmation
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            The <strong>Supplier Performance Risk System (SPRS)</strong> is
            the DoD&apos;s central system for supplier risk data. For CMMC
            Level 1, your record in SPRS contains one thing: a senior
            official&apos;s annual affirmation that your organization meets
            the 15 FAR 52.204-21 safeguarding requirements.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            There is <strong>no numeric &quot;SPRS score&quot; at Level 1</strong>.
            The 0–110 score you may have read about applies only to
            CMMC Level 2 (the NIST SP 800-171 Basic Assessment). At
            Level 1 the affirmation is binary. Read{" "}
            <Link href="/blog/cmmc-level-1-binary-no-score" className="text-[#2f8f6d] underline">
              CMMC Level 1 Is Binary — There Is No Score
            </Link>{" "}
            for the long version, and{" "}
            <Link href="/blog/prime-asking-for-sprs-score-level-1-response" className="text-[#2f8f6d] underline">
              what to send a prime that asks for your score
            </Link>{" "}
            for the email template.
          </p>
        </section>

        <section id="cost" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            What CMMC Level 1 actually costs in 2026
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            There is no government filing fee. The DoD does not charge
            you to post the affirmation. Real costs are time and
            tooling:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base">
            <li>
              <strong>DIY:</strong> $0–$1,500 in cash if you already pay
              for Microsoft 365 Business Premium or Google Workspace
              Business Plus + 20–40 hours of founder/admin time.
            </li>
            <li>
              <strong>vCISO / consultant:</strong> $6,000–$18,000 for a
              full Level 1 engagement at $150–$300/hour.
            </li>
            <li>
              <strong>Guided SaaS (Custodia):</strong>{" "}
              <strong>$249/month</strong> Self Service (or $2,496/year on
              annual — two months free) or{" "}
              <strong>$397/month</strong> with a credentialed Custodia
              compliance officer on call. 14-day free trial, no card.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            See the full breakdown in{" "}
            <Link href="/blog/cmmc-level-1-cost-diy-vs-consultant-vs-saas" className="text-[#2f8f6d] underline">
              CMMC Level 1 Cost in 2026: DIY vs Consultant vs SaaS
            </Link>
            .
          </p>
        </section>

        <section id="vs-level-2" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            CMMC Level 1 vs CMMC Level 2
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse border border-[#cfe3d9] text-sm">
              <thead className="bg-[#08201a] text-white">
                <tr>
                  <th className="border border-[#cfe3d9] px-3 py-2 text-left">Dimension</th>
                  <th className="border border-[#cfe3d9] px-3 py-2 text-left">Level 1</th>
                  <th className="border border-[#cfe3d9] px-3 py-2 text-left">Level 2</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#cfe3d9] px-3 py-2 font-medium">Data type</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">FCI</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">CUI</td>
                </tr>
                <tr className="bg-[#f4faf6]">
                  <td className="border border-[#cfe3d9] px-3 py-2 font-medium">Controls</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">15 FAR safeguards (17 CMMC practices)</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">110 NIST SP 800-171 controls</td>
                </tr>
                <tr>
                  <td className="border border-[#cfe3d9] px-3 py-2 font-medium">Assessment</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">Annual self-assessment</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">Triennial C3PAO assessment (most)</td>
                </tr>
                <tr className="bg-[#f4faf6]">
                  <td className="border border-[#cfe3d9] px-3 py-2 font-medium">SPRS result</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">Binary (MET / NOT MET)</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">Score –203 to 110</td>
                </tr>
                <tr>
                  <td className="border border-[#cfe3d9] px-3 py-2 font-medium">Typical cost</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">$0–$18k one-time + $249/mo SaaS</td>
                  <td className="border border-[#cfe3d9] px-3 py-2">$20k–$200k+ per assessment cycle</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-base leading-relaxed">
            Long version with side-by-side examples:{" "}
            <Link href="/blog/cmmc-level-1-vs-level-2" className="text-[#2f8f6d] underline">
              CMMC Level 1 vs Level 2
            </Link>
            . If you&apos;re unsure which data type you handle, start with{" "}
            <Link href="/blog/what-is-fci-federal-contract-information" className="text-[#2f8f6d] underline">
              What Is FCI?
            </Link>
          </p>
        </section>

        <section id="how-to" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            7-day path to a CMMC Level 1 SPRS affirmation
          </h2>
          <ol className="mt-4 space-y-4">
            {HOWTO_STEPS.map((s, i) => (
              <li key={s.name} className="border-l-2 border-[#2f8f6d] pl-4">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                  Step {i + 1}
                </div>
                <div className="mt-1 font-serif text-lg font-bold text-[#10231d]">
                  {s.name}
                </div>
                <p className="mt-1 text-sm leading-relaxed">{s.text}</p>
                {s.url ? (
                  <Link
                    href={s.url.replace(APP_URL, "")}
                    className="mt-1 inline-block text-xs text-[#2f8f6d] underline"
                  >
                    Deep dive &rarr;
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section id="timeline" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            Regulatory timeline
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base">
            <li>
              <strong>2016</strong> — FAR 52.204-21 published. The 15 basic
              safeguarding requirements become federal acquisition law for
              all contractors handling FCI.
            </li>
            <li>
              <strong>2020</strong> — DFARS Interim Rule (252.204-7019/7020)
              requires NIST 800-171 self-assessment scores in SPRS for
              DoD contractors handling CUI.
            </li>
            <li>
              <strong>Oct 15, 2024</strong> — CMMC Final Rule (32 CFR Part 170)
              published. Effective <strong>December 16, 2024</strong>.
            </li>
            <li>
              <strong>Nov 10, 2025</strong> — 48 CFR rule (the contract-clause
              side, DFARS 252.204-7021 amendment) begins phased rollout in
              DoD solicitations. Phase 1 of 4.
            </li>
            <li>
              <strong>Through Nov 2028</strong> — Phases 2–4 expand the
              clause to most DoD solicitations. By the end of the rollout,
              substantially all DoD contracts handling FCI or CUI carry
              the CMMC requirement.
            </li>
          </ul>
        </section>

        <section id="faq" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            CMMC Level 1: Frequently Asked Questions
          </h2>
          <div className="mt-6 space-y-6">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="font-serif text-lg font-bold text-[#10231d]">
                  {f.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="sources" className="mt-12 border-2 border-[#2f8f6d] bg-[#f4faf6] p-6 md:p-8">
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Read the real source · mirrored on this site
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
            The official DoD CMMC Level 1 documents (PDFs)
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#1d3a30]">
            Everything on this page is derived from the three documents
            below. They are the U.S. Department of Defense Chief Information
            Officer&apos;s authoritative publications for CMMC Level 1,
            released September 2024, version 2.13. &ldquo;DISTRIBUTION
            STATEMENT A. Approved for public release. Distribution is
            unlimited.&rdquo; We mirror them here so you can verify every
            claim against the actual regulation.
          </p>
          <ul className="mt-5 space-y-3 not-prose">
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/regulations/scoping-guide-level-1"
                  className="font-serif text-base font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Scoping Guide — Level 1 (v2.13)
                </Link>
                <div className="text-xs text-[#5a7d70]">
                  How to draw the boundary around your in-scope systems · 6 pages
                </div>
              </div>
              <Link
                href="/regulations/scoping-guide-level-1"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Read the PDF
              </Link>
            </li>
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/regulations/assessment-guide-level-1"
                  className="font-serif text-base font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Assessment Guide — Level 1 (v2.13)
                </Link>
                <div className="text-xs text-[#5a7d70]">
                  Per-practice objectives, evidence examples, MET/NOT MET rules · 53 pages
                </div>
              </div>
              <Link
                href="/regulations/assessment-guide-level-1"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Read the PDF
              </Link>
            </li>
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/regulations/model-overview"
                  className="font-serif text-base font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Model Overview (v2.13)
                </Link>
                <div className="text-xs text-[#5a7d70]">
                  Full model: 3 levels, 14 domains, complete practice matrix · 46 pages
                </div>
              </div>
              <Link
                href="/regulations/model-overview"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Read the PDF
              </Link>
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-[#5a7d70]">
            Documents reproduced under DoD Distribution Statement A.
            Custodia is not affiliated with or endorsed by the Department
            of Defense. Authoritative DoD copy:{" "}
            <a
              href="https://dodcio.defense.gov/CMMC/Documentation/"
              target="_blank"
              rel="noopener nofollow"
              className="underline hover:text-[#2f8f6d]"
            >
              dodcio.defense.gov/CMMC/Documentation
            </a>
            . Full curated index of all CMMC, SPRS, FAR, DFARS, and NIST
            primary sources on the{" "}
            <Link href="/regulations" className="underline hover:text-[#2f8f6d]">
              regulations hub
            </Link>
            .
          </p>
        </section>

        <section id="related" className="prose prose-slate mt-12 max-w-none">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            Plain-English CMMC Level 1 explainers
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            Every post on the Custodia blog is written for the founder who
            never asked to become a cybersecurity expert. Each one cites
            primary sources (32 CFR Part 170, FAR 52.204-21, DFARS,
            NIST 800-171A) so you can verify every claim.
          </p>
          <ul className="mt-4 space-y-3">
            {posts.map((p) => (
              <li key={p.meta.slug}>
                <Link
                  href={`/blog/${p.meta.slug}`}
                  className="text-base font-medium text-[#2f8f6d] underline"
                >
                  {p.meta.title}
                </Link>
                <p className="mt-1 text-sm text-[#5a7d70]">
                  {p.meta.excerpt}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Bottom CTA */}
        <section className="mt-16 border border-[#2f8f6d] bg-[#08201a] px-6 py-10 text-white">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">
            Get CMMC Level 1 done in a week
          </h2>
          <p className="mt-3 text-base text-[#a8cfc0]">
            Custodia walks you through all 15 FAR 52.204-21 safeguarding
            requirements, drafts your SSP and affirmation memo, and posts
            you to SPRS — all inside a 14-day free trial. No credit card.
            $249/month after if you stay (or $2,496/year on annual — two
            months free), or $397/month with a credentialed Custodia
            compliance officer on call.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="bg-[#bdf2cf] px-5 py-3 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
            >
              Start 14-day free trial &rarr;
            </Link>
            <Link
              href="/cmmc-check"
              className="border border-[#bdf2cf]/40 px-5 py-3 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-white/5"
            >
              Take the free scoping check
            </Link>
            <Link
              href="/bid-digest"
              className="border border-[#bdf2cf]/40 px-5 py-3 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-white/5"
            >
              Get the Monday Bid Digest
            </Link>
          </div>
        </section>
      </article>
    </BlogShell>
  );
}
