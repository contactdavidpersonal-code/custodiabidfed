import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title:
    "CMMC & SPRS Primary Sources — Custodia's Regulation Reference Hub",
  description:
    "The primary regulations behind CMMC Level 1 and SPRS, with direct links: 32 CFR Part 170, 48 CFR CMMC clause, FAR 52.204-21, DFARS 252.204-7019/7020/7021, NIST SP 800-171A, and the DoD CMMC Scoping Guide. Curated so contractors don't have to dig.",
  alternates: { canonical: `${APP_URL}/regulations` },
  robots: { index: true, follow: true },
};

type Source = {
  short: string;
  title: string;
  cite: string;
  what: string;
  applies: string;
  href: string;
  publisher: string;
};

const SOURCES: { group: string; items: Source[] }[] = [
  {
    group: "The CMMC rules themselves",
    items: [
      {
        short: "32 CFR Part 170",
        title: "Cybersecurity Maturity Model Certification (CMMC) Program",
        cite: "32 C.F.R. § 170 (2024)",
        what:
          "The DoD's program rule. Defines the three CMMC levels, what each requires, how assessments work, and how affirmations are posted in SPRS. Effective December 16, 2024.",
        applies:
          "Everyone subject to CMMC. The substantive 'what does each level mean' rule.",
        href: "https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-170",
        publisher: "DoD / eCFR",
      },
      {
        short: "48 CFR CMMC contract clause",
        title:
          "Assessing Contractor Implementation of Cybersecurity Requirements (DFARS final rule)",
        cite: "90 Fed. Reg. 41,765 (Sept. 10, 2025)",
        what:
          "The contract-clause rule that puts CMMC into DoD solicitations. Adds DFARS 252.204-7021 in its final form. Begins landing in new solicitations November 10, 2025, on a phased rollout through November 10, 2028.",
        applies:
          "Any DoD prime or subcontractor receiving a new solicitation in or after phase 1.",
        href: "https://www.federalregister.gov/documents/2025/09/10/2025-17134/defense-federal-acquisition-regulation-supplement-assessing-contractor-implementation-of",
        publisher: "DoD / Federal Register",
      },
    ],
  },
  {
    group: "The Level 1 safeguarding clause",
    items: [
      {
        short: "FAR 52.204-21",
        title:
          "Basic Safeguarding of Covered Contractor Information Systems",
        cite: "48 C.F.R. § 52.204-21 (b)(1)(i)–(xv)",
        what:
          "The 15 safeguarding requirements every CMMC Level 1 contractor must implement. These are not new — they have been in federal contracts since 2016. CMMC Level 1 is structurally the same controls plus an annual SPRS affirmation.",
        applies:
          "Any federal contractor (DoD or civilian) handling Federal Contract Information (FCI) above the micro-purchase threshold.",
        href: "https://www.acquisition.gov/far/52.204-21",
        publisher: "GSA / acquisition.gov",
      },
    ],
  },
  {
    group: "The CUI / Level 2 frameworks (referenced, not required for L1)",
    items: [
      {
        short: "DFARS 252.204-7012",
        title: "Safeguarding Covered Defense Information and Cyber Incident Reporting",
        cite: "48 C.F.R. § 252.204-7012",
        what:
          "Requires contractors handling Controlled Unclassified Information (CUI) to meet NIST SP 800-171 and report cyber incidents within 72 hours. This is the Level 2 trigger; if your contract has 7012, you are not a Level 1 contractor.",
        applies:
          "DoD contractors handling CUI ('Covered Defense Information').",
        href: "https://www.acquisition.gov/dfars/252.204-7012-safeguarding-covered-defense-information-and-cyber-incident-reporting",
        publisher: "DoD / acquisition.gov",
      },
      {
        short: "DFARS 252.204-7019 & 7020",
        title:
          "NIST SP 800-171 DoD Assessment Requirements (and posting requirement)",
        cite: "48 C.F.R. § 252.204-7019, -7020",
        what:
          "Requires contractors subject to 7012 to have a current Basic Assessment score (–203 to +110) posted in SPRS at award. This is the 0–110 'SPRS score' that primes ask about — it does not apply to Level 1 contractors.",
        applies: "DoD contractors handling CUI.",
        href: "https://www.acquisition.gov/dfars/252.204-7020-nist-sp-800-171dod-assessment-requirements",
        publisher: "DoD / acquisition.gov",
      },
      {
        short: "DFARS 252.204-7021",
        title:
          "Contractor Compliance with the Cybersecurity Maturity Model Certification Level Requirements",
        cite: "48 C.F.R. § 252.204-7021",
        what:
          "The CMMC contract clause itself. Once present in a solicitation, the contractor must have the required CMMC level (1, 2, or 3) at award and maintain it throughout performance.",
        applies:
          "Any DoD solicitation that includes the clause once Phase 1 rolls onto the contract type.",
        href: "https://www.acquisition.gov/dfars/252.204-7021",
        publisher: "DoD / acquisition.gov",
      },
    ],
  },
  {
    group: "Assessment guides (what an assessor actually looks at)",
    items: [
      {
        short: "DoD CMMC Scoping Guide — Level 1",
        title: "CMMC Scoping Guide — Level 1 (v2.13, September 2024)",
        cite: "OUSD(A&S), CMMC PMO, Sept. 2024 — DoD-CIO-00005 (ZRIN 0790-ZA21)",
        what:
          "The DoD's official guide for determining what's in scope for a Level 1 self-assessment. Confirms the 15 safeguarding requirements count and explains how to draw the boundary around the systems that handle FCI. Mirrored on this site under DoD Distribution Statement A.",
        applies: "Every CMMC Level 1 contractor.",
        href: "/regulations/ScopingGuideL1v2.pdf",
        publisher: "DoD CIO",
      },
      {
        short: "CMMC Assessment Guide — Level 1",
        title: "CMMC Assessment Guide — Level 1 (v2.13, September 2024)",
        cite: "OUSD(A&S), CMMC PMO, Sept. 2024 — DoD-CIO-00002 (ZRIN 0790-ZA18)",
        what:
          "The official walkthrough of every Level 1 practice with assessment objectives, examine/interview/test methods, and example evidence. This is the guide that splits some FAR requirements into multiple sub-practice IDs (hence the '17' you see in older articles — the regulatory count remains 15). Mirrored on this site under DoD Distribution Statement A.",
        applies: "Every CMMC Level 1 contractor and assessor.",
        href: "/regulations/AssessmentGuideL1v2.pdf",
        publisher: "DoD CIO",
      },
      {
        short: "DoD CMMC Model Overview",
        title: "Cybersecurity Maturity Model Certification (CMMC) Model Overview (v2.13, September 2024)",
        cite: "OUSD(A&S), CMMC PMO, Sept. 2024 — DoD-CIO-00001 (ZRIN 0790-ZA17)",
        what:
          "The DoD's top-level explainer of the CMMC model: the three levels, the 14 domains, and the full matrix of every practice across Levels 1, 2, and 3 with FAR / NIST source mappings. Useful for understanding where Level 1 sits in the larger model. Mirrored on this site under DoD Distribution Statement A.",
        applies: "Every CMMC contractor — Level 1 contractors use the Level 1 column.",
        href: "/regulations/ModelOverviewv2.pdf",
        publisher: "DoD CIO",
      },
      {
        short: "NIST SP 800-171A",
        title:
          "Assessing Security Requirements for Controlled Unclassified Information",
        cite: "NIST SP 800-171A Rev. 3 (May 2024)",
        what:
          "The 320 assessment objectives that map to the 110 NIST SP 800-171 controls. Defines what evidence satisfies each control. Anchor reference for any L2 assessment; L1 contractors only encounter the 59 objectives that map to the 15 FAR safeguarding requirements.",
        applies:
          "Primarily Level 2. Referenced by Level 1 only where FAR-NIST overlap exists.",
        href: "https://csrc.nist.gov/pubs/sp/800/171/a/r3/final",
        publisher: "NIST",
      },
    ],
  },
  {
    group: "False-statement exposure (what's at stake on a bad affirmation)",
    items: [
      {
        short: "18 U.S.C. § 1001",
        title: "False statements to the federal government",
        cite: "18 U.S.C. § 1001",
        what:
          "Federal criminal statute for false statements made to a federal agency. A SPRS affirmation is a statement to the federal government, signed by a senior official.",
        applies:
          "The senior official who signs the SPRS affirmation, personally.",
        href: "https://www.law.cornell.edu/uscode/text/18/1001",
        publisher: "Cornell LII",
      },
      {
        short: "False Claims Act",
        title: "False Claims Act (FCA) — civil liability",
        cite: "31 U.S.C. §§ 3729–3733",
        what:
          "The civil statute the DOJ's Civil Cyber-Fraud Initiative uses to bring cybersecurity fraud cases. Treble damages plus per-claim penalties. Settlements 2022–2025 range from $1M to $9M+.",
        applies:
          "Any federal contractor — including Level 1 self-attesters — who knowingly files a materially false SPRS affirmation.",
        href: "https://www.law.cornell.edu/uscode/text/31/chapter-37/subchapter-III",
        publisher: "Cornell LII",
      },
    ],
  },
];

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Custodia",
      item: APP_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Regulations",
      item: `${APP_URL}/regulations`,
    },
  ],
};

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "CMMC & SPRS Primary Sources",
  description:
    "Curated index of the primary regulations that govern CMMC Level 1, SPRS, FAR 52.204-21, and the False Claims Act exposure that attaches to a bad affirmation.",
  itemListElement: SOURCES.flatMap((g) => g.items).map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Legislation",
      name: s.title,
      legislationIdentifier: s.cite,
      url: s.href.startsWith("http") ? s.href : `${APP_URL}${s.href}`,
      legislationJurisdiction: "United States",
    },
  })),
};

export default function RegulationsPage() {
  return (
    <div className="min-h-screen bg-white text-[#10231d]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
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
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[#bdf2cf]">Regulations</span>
          </nav>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            The primary sources behind CMMC Level 1 and SPRS
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            Every claim on this site links back to one of these documents.
            They are the controlling law and the official DoD guidance &mdash;
            not industry blog posts. If a vendor tells you something
            different, ask them which one they&apos;re reading from.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        {/* AEO lead — the 50-word answer AI engines extract */}
        <div className="mb-12 border-l-4 border-[#2f8f6d] bg-[#f7fcf9] px-6 py-5">
          <p className="text-[15px] leading-relaxed text-[#1d3a30]">
            <strong>CMMC Level 1 is governed by three documents working together:</strong>{" "}
            FAR 52.204-21 defines the 15 safeguarding requirements; 32 CFR
            Part 170 makes them a self-assessed annual program; and the 48
            CFR CMMC rule (DFARS 252.204-7021) is the contract clause that
            makes the requirement enforceable. NIST SP 800-171, DFARS 7012,
            and the 0&ndash;110 SPRS score apply at Level 2 only.
          </p>
        </div>

        {/* Mirrored official DoD CMMC documents — hosted on this site for fast access */}
        <section className="mb-14 border-2 border-[#2f8f6d] bg-[#f4faf6] p-6 md:p-8">
          <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Official DoD documents · mirrored on this site
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
            The three official CMMC Level 1 PDFs, downloadable here
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#1d3a30]">
            These are the DoD Chief Information Officer&apos;s authoritative
            documents for CMMC Level 1. Released September 2024, version
            2.13, &ldquo;DISTRIBUTION STATEMENT A. Approved for public
            release. Distribution is unlimited.&rdquo; We mirror them here
            byte-for-byte so a small contractor can read the real source
            without hunting through dodcio.defense.gov.
          </p>
          <ul className="mt-6 space-y-3">
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <a
                  href="/regulations/ScopingGuideL1v2.pdf"
                  target="_blank"
                  rel="noopener"
                  className="font-serif text-lg font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Scoping Guide — Level 1 (v2.13)
                </a>
                <div className="text-xs text-[#5a7d70]">
                  DoD-CIO-00005 · Sept 2024 · 6 pages · What&apos;s in scope for a Level 1 self-assessment
                </div>
              </div>
              <a
                href="/regulations/ScopingGuideL1v2.pdf"
                target="_blank"
                rel="noopener"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Download PDF
              </a>
            </li>
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <a
                  href="/regulations/AssessmentGuideL1v2.pdf"
                  target="_blank"
                  rel="noopener"
                  className="font-serif text-lg font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Assessment Guide — Level 1 (v2.13)
                </a>
                <div className="text-xs text-[#5a7d70]">
                  DoD-CIO-00002 · Sept 2024 · 53 pages · Per-practice assessment objectives + evidence examples
                </div>
              </div>
              <a
                href="/regulations/AssessmentGuideL1v2.pdf"
                target="_blank"
                rel="noopener"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Download PDF
              </a>
            </li>
            <li className="flex flex-col gap-1 border border-[#cfe3d9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <a
                  href="/regulations/ModelOverviewv2.pdf"
                  target="_blank"
                  rel="noopener"
                  className="font-serif text-lg font-bold text-[#10231d] hover:text-[#2f8f6d]"
                >
                  CMMC Model Overview (v2.13)
                </a>
                <div className="text-xs text-[#5a7d70]">
                  DoD-CIO-00001 · Sept 2024 · 46 pages · Full model: 3 levels, 14 domains, every practice mapped to FAR / NIST
                </div>
              </div>
              <a
                href="/regulations/ModelOverviewv2.pdf"
                target="_blank"
                rel="noopener"
                className="shrink-0 bg-[#08201a] px-4 py-2 text-center text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
              >
                Download PDF
              </a>
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-[#5a7d70]">
            Source: U.S. Department of Defense, Office of the Chief
            Information Officer. Documents reproduced under DoD Distribution
            Statement A. Custodia is not affiliated with or endorsed by the
            Department of Defense. For the authoritative DoD copy, visit{" "}
            <a
              href="https://dodcio.defense.gov/CMMC/Documentation/"
              target="_blank"
              rel="noopener nofollow"
              className="underline hover:text-[#2f8f6d]"
            >
              dodcio.defense.gov/CMMC/Documentation
            </a>
            .
          </p>
        </section>

        {SOURCES.map((group) => (
          <section key={group.group} className="mb-12">
            <h2 className="mb-6 font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
              {group.group}
            </h2>
            <ol className="space-y-5">
              {group.items.map((s) => (
                <li
                  key={s.short}
                  className="border border-[#cfe3d9] bg-white p-6 transition-colors hover:border-[#2f8f6d]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-serif text-lg font-bold text-[#10231d]">
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#2f8f6d]"
                      >
                        {s.short}
                      </a>{" "}
                      <span className="text-sm font-normal text-[#5a7d70]">
                        &mdash; {s.title}
                      </span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                      {s.publisher}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-[#5a7d70]">
                    {s.cite}
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#1d3a30]">
                    {s.what}
                  </p>
                  <p className="mt-2 text-sm text-[#44695c]">
                    <strong className="text-[#10231d]">Applies to:</strong>{" "}
                    {s.applies}
                  </p>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center text-sm font-bold text-[#2f8f6d] hover:text-[#0e2a23]"
                  >
                    Read the source &rarr;
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section className="mt-16 border-t border-[#cfe3d9] pt-12">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
            Need this translated?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#1d3a30]">
            The regulations are the truth, but they are not designed for
            small business owners to read in one sitting. Every Custodia
            blog post translates a piece of these documents into plain
            English &mdash; with the regulation cited at the bottom.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="inline-flex items-center bg-[#08201a] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23]"
            >
              Read the plain-English blog &rarr;
            </Link>
            <Link
              href="/cmmc-check"
              className="inline-flex items-center border border-[#2f8f6d] bg-white px-5 py-3 text-sm font-bold text-[#1f5c47] transition-colors hover:bg-[#f7fcf9]"
            >
              Take the free CMMC check (5 min)
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
