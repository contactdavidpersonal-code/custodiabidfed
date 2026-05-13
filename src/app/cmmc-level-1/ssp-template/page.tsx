import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../_components/ResourceShell";
import { ResourceCard } from "../_components/ResourceCard";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/ssp-template`;

export const metadata: Metadata = {
  title:
    "Free CMMC Level 1 System Security Plan (SSP) Template — Printable | Custodia",
  description:
    "A free, fill-in-the-blank System Security Plan template for CMMC Level 1 and FAR 52.204-21. Plain English, 15 controls covered, printable. No email required.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Free CMMC Level 1 System Security Plan (SSP) Template",
    description:
      "Free, fill-in-the-blank SSP template for CMMC Level 1. Printable. No email required.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free CMMC Level 1 SSP Template (printable)",
    description:
      "Fill in the blanks. Print or save as PDF. Covers all 15 FAR 52.204-21 controls.",
  },
  robots: { index: true, follow: true },
};

const CONTROLS: Array<{
  family: string;
  letter: string;
  items: Array<{ id: string; title: string; prompt: string }>;
}> = [
  {
    family: "Access Control",
    letter: "AC",
    items: [
      {
        id: "AC.L1-3.1.1",
        title: "Limit access to authorized users",
        prompt:
          "Describe how user accounts are created, who approves them, and where the list of active users is maintained.",
      },
      {
        id: "AC.L1-3.1.2",
        title: "Limit access to authorized functions",
        prompt:
          "Describe how role-based or permission-based access is granted (who has admin, who has standard, who reviews this).",
      },
      {
        id: "AC.L1-3.1.20",
        title: "Control external system connections",
        prompt:
          "List the third-party services (cloud apps, VPNs, vendor portals) approved for federal contract work and who approves new ones.",
      },
      {
        id: "AC.L1-3.1.22",
        title: "Control public posting of information",
        prompt:
          "Describe the review/approval process before federal contract information is posted publicly (site, social, conferences).",
      },
    ],
  },
  {
    family: "Identification & Authentication",
    letter: "IA",
    items: [
      {
        id: "IA.L1-3.5.1",
        title: "Identify users and devices",
        prompt:
          "Describe how each user gets a unique account, and how company devices are inventoried.",
      },
      {
        id: "IA.L1-3.5.2",
        title: "Authenticate users and devices",
        prompt:
          "Describe your password policy and where multi-factor authentication is enforced (email, cloud apps, remote access).",
      },
    ],
  },
  {
    family: "Media Protection",
    letter: "MP",
    items: [
      {
        id: "MP.L1-3.8.3",
        title: "Sanitize media before disposal",
        prompt:
          "Describe how laptops, drives, phones, and paper are wiped or destroyed before disposal, and where the disposal log lives.",
      },
    ],
  },
  {
    family: "Physical Protection",
    letter: "PE",
    items: [
      {
        id: "PE.L1-3.10.1",
        title: "Limit physical access",
        prompt:
          "Describe the physical work area, how it is secured (locks, badges, alarm), and who has access.",
      },
      {
        id: "PE.L1-3.10.3",
        title: "Escort visitors",
        prompt:
          "Describe the visitor escort policy and who is responsible for visitors on-site.",
      },
      {
        id: "PE.L1-3.10.4",
        title: "Maintain audit logs of physical access",
        prompt:
          "Describe how visitors are logged (clipboard, badge system, receptionist log) and how long records are kept.",
      },
      {
        id: "PE.L1-3.10.5",
        title: "Control physical access devices",
        prompt:
          "Describe how keys, badges, fobs, and alarm codes are issued, tracked, and collected when staff leave.",
      },
    ],
  },
  {
    family: "System & Communications Protection",
    letter: "SC",
    items: [
      {
        id: "SC.L1-3.13.1",
        title: "Monitor and control the network boundary",
        prompt:
          "Describe the firewall (where it is, who manages it) and how inbound/outbound traffic is controlled.",
      },
      {
        id: "SC.L1-3.13.5",
        title: "Separate public-facing systems",
        prompt:
          "Describe how guest Wi-Fi and public-facing systems are separated from the internal work network.",
      },
    ],
  },
  {
    family: "System & Information Integrity",
    letter: "SI",
    items: [
      {
        id: "SI.L1-3.14.1",
        title: "Fix flaws in a timely manner",
        prompt:
          "Describe how OS and application updates are installed, who is responsible, and the target patch window.",
      },
      {
        id: "SI.L1-3.14.2",
        title: "Use malicious code protection",
        prompt:
          "List the antivirus / endpoint protection product on every device and who confirms it is enabled.",
      },
      {
        id: "SI.L1-3.14.4",
        title: "Update malicious code protection",
        prompt:
          "Describe how AV signatures and firewall threat lists are kept current (automatic / manual).",
      },
      {
        id: "SI.L1-3.14.5",
        title: "Run periodic scans",
        prompt:
          "Describe the scheduled scan frequency and that real-time protection is enabled.",
      },
    ],
  },
];

const Blank = ({ lines = 1 }: { lines?: number }) => (
  <div className="mt-2 space-y-2.5">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-px w-full border-b border-dashed border-[#aabcb3]" />
    ))}
  </div>
);

const Field = ({ label }: { label: string }) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
      {label}
    </div>
    <Blank />
  </div>
);

export default function SspTemplatePage() {
  const totalControls = CONTROLS.reduce((n, f) => n + f.items.length, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Free CMMC Level 1 System Security Plan (SSP) Template — Printable",
    description:
      "Free fill-in-the-blank System Security Plan template for CMMC Level 1 and FAR 52.204-21. Plain English. Printable.",
    url: PAGE_URL,
    mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
    author: { "@type": "Organization", name: "Custodia", url: APP_URL },
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
      logo: { "@type": "ImageObject", url: `${APP_URL}/custodia-logo.png` },
    },
    datePublished: "2026-05-13",
    dateModified: "2026-05-13",
    isAccessibleForFree: true,
  };

  return (
    <ResourceShell title="SSP template">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResourceCard
        eyebrow="Custodia · Free template · 2026 edition"
        title="The CMMC Level 1"
        italic="System Security Plan"
        trailing="template."
        subtitle={
          <>
            A fill-in-the-blank SSP for the 15 safeguarding requirements in{" "}
            <strong>FAR 52.204-21</strong>. Hand-write or type into the
            blanks; print or save as PDF when you&apos;re done.
          </>
        }
        stats={[
          { n: String(totalControls), l: "Controls covered" },
          { n: "~60 min", l: "To complete" },
          { n: "1", l: "Living document" },
        ]}
      >
        {/* How to use */}
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            How to use this SSP
          </h2>
          <ol className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#10231d]">
            <li>
              <strong>1.</strong> Fill in the cover page &mdash; company,
              system name (often &ldquo;Corporate IT&rdquo;), system
              owner.
            </li>
            <li>
              <strong>2.</strong> For each of the {totalControls} controls,
              write 2&ndash;4 sentences answering the prompt. Plain English
              beats jargon every time.
            </li>
            <li>
              <strong>3.</strong> Sign the attestation. Date it. Save the
              file (PDF or Word). Schedule a calendar reminder to review
              annually.
            </li>
            <li>
              <strong>4.</strong> Keep this with your evidence folder.
              When a prime asks &ldquo;do you have an SSP?&rdquo; the
              answer is now <em>yes</em>.
            </li>
          </ol>
          <p className="mt-5 text-[13px] leading-relaxed text-[#5a7d70]">
            For Level 1 self-assessment, an SSP is recommended but not
            strictly required by the FAR clause. It is required when a
            prime or DCMA asks for proof, and it is the single document
            that makes <em>every</em> other CMMC step easier later.
          </p>
        </section>

        {/* Cover page */}
        <section className="print-page-break print-avoid-break mt-12">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 01 &middot; Cover page
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            System identification
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Company / organization name" />
            <Field label="CAGE code" />
            <Field label="System name (e.g., Corporate IT)" />
            <Field label="SPRS ID / UEI" />
            <Field label="System owner (name + title)" />
            <Field label="Date of this SSP" />
            <Field label="Primary work address" />
            <Field label="Next scheduled review date" />
          </div>

          <div className="mt-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
              System description &mdash; what this SSP covers
            </div>
            <p className="mt-1 text-[12px] text-[#5a7d70]">
              In 3&ndash;5 sentences: what the system is, what people
              use it for, whether it touches federal contract
              information (FCI).
            </p>
            <Blank lines={4} />
          </div>

          <div className="mt-8">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
              Scope &mdash; what is in / out
            </div>
            <p className="mt-1 text-[12px] text-[#5a7d70]">
              List the people, devices, networks, and cloud apps that
              are <em>in scope</em>. Anything not listed is out of
              scope.
            </p>
            <Blank lines={5} />
          </div>
        </section>

        {/* Each control family */}
        {CONTROLS.map((fam, fIdx) => (
          <section
            key={fam.family}
            className="print-page-break mt-12"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
              Section {String(fIdx + 2).padStart(2, "0")} &middot;{" "}
              {fam.letter} &middot; {fam.family}
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
              {fam.family}
            </h2>

            <div className="mt-6 space-y-7">
              {fam.items.map((item) => (
                <div
                  key={item.id}
                  className="print-avoid-break border border-[#cfe3d9] bg-[#f7fcf9] p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg font-bold text-[#10231d]">
                      {item.title}
                    </h3>
                    <code className="font-mono text-[10px] text-[#2f8f6d]">
                      {item.id}
                    </code>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#44695c]">
                    <strong>Prompt:</strong> {item.prompt}
                  </p>
                  <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                      Implementation (your answer)
                    </div>
                    <Blank lines={4} />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field label="Tool / system used" />
                    <Field label="Owner / responsible" />
                    <Field label="Evidence location" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Attestation */}
        <section className="print-page-break mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Final section &middot; Attestation
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Signature &amp; affirmation
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-[#10231d]">
            I affirm that the information in this System Security Plan
            is true and accurate to the best of my knowledge, that the
            implementations described reflect the actual practices of
            the organization, and that I am authorized to attest on
            behalf of the company.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            <div>
              <div className="h-12 border-b border-[#10231d]" />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Signature
              </div>
            </div>
            <div>
              <div className="h-12 border-b border-[#10231d]" />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Printed name &amp; title
              </div>
            </div>
            <div>
              <div className="h-12 border-b border-[#10231d]" />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Date
              </div>
            </div>
            <div>
              <div className="h-12 border-b border-[#10231d]" />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Next review (within 12 months)
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-14 border-t border-[#cfe3d9] pt-6 text-center text-[10px] uppercase tracking-[0.24em] text-[#5a7d70]">
          Custodia &middot; bidfedcmmc.com &middot; Built from{" "}
          <span className="text-[#2f8f6d]">FAR 52.204-21</span> &amp;{" "}
          <span className="text-[#2f8f6d]">32 CFR Part 170</span>{" "}
          &middot; Not legal advice
        </footer>

        {/* Related links — screen only */}
        <div className="no-print mt-12 border-t border-[#cfe3d9] pt-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Keep going
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link
              href="/cmmc-level-1/scoping-worksheet"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Scoping worksheet &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Define the boundary before you write the SSP.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/policy-templates"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">8 policy templates &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                The policies your SSP will reference.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/checklist"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Self-assessment checklist &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Once your SSP is done, score yourself in 30 min.
              </div>
            </Link>
          </div>
        </div>
      </ResourceCard>
    </ResourceShell>
  );
}
