import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../_components/ResourceShell";
import { ResourceCard } from "../_components/ResourceCard";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/scoping-worksheet`;

export const metadata: Metadata = {
  title:
    "Free CMMC Level 1 Scoping Worksheet (Printable, Plain English) | Custodia",
  description:
    "A free fill-in-the-blank scoping worksheet for CMMC Level 1. Define your FCI boundary, list in-scope assets and people, and draw your boundary diagram. No email required.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Free CMMC Level 1 Scoping Worksheet (printable)",
    description:
      "Define your FCI boundary, list in-scope assets, draw your diagram. Free, printable, no email.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free CMMC Level 1 Scoping Worksheet",
    description:
      "Define your FCI boundary the right way the first time.",
  },
  robots: { index: true, follow: true },
};

const Blank = ({ lines = 1 }: { lines?: number }) => (
  <div className="mt-2 space-y-2.5">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-px w-full border-b border-dashed border-[#aabcb3]" />
    ))}
  </div>
);

const TableHead = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr className="border-b-2 border-[#10231d]">
      {cols.map((c) => (
        <th
          key={c}
          className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#10231d]"
        >
          {c}
        </th>
      ))}
    </tr>
  </thead>
);

const BlankRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-dashed border-[#aabcb3]">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-3 py-4">&nbsp;</td>
    ))}
  </tr>
);

export default function ScopingWorksheetPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Free CMMC Level 1 Scoping Worksheet",
    description:
      "Free fill-in-the-blank scoping worksheet for CMMC Level 1.",
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
    <ResourceShell title="scoping worksheet">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResourceCard
        eyebrow="Custodia · Free worksheet · 2026 edition"
        title="The CMMC Level 1"
        italic="scoping"
        trailing="worksheet."
        subtitle={
          <>
            Scoping is the single most expensive decision in CMMC. Get it
            right and your work shrinks 90%. Get it wrong and you secure
            your entire company when you only needed to secure a corner
            of it.
          </>
        }
        stats={[
          { n: "20 min", l: "To complete" },
          { n: "1", l: "Boundary you defend" },
          { n: "90%", l: "Less work if scoped right" },
        ]}
      >
        {/* Intro */}
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            What scoping is
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            Scoping means drawing a line around the people, devices,
            networks, and cloud apps that touch <strong>Federal
            Contract Information (FCI)</strong>. Anything inside the
            line has to meet the 15 CMMC L1 controls. Anything outside
            does not.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[#44695c]">
            The mistake everyone makes: treating <em>everything in the
            company</em> as in-scope. A 6-person shop with one
            federal contract often has 3 laptops, 2 cloud apps, and a
            firewall in scope &mdash; not 20 systems.
          </p>
        </section>

        {/* Section 1: contracts */}
        <section className="mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 01
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            The contracts that trigger CMMC for you
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            List every active federal contract or subcontract that
            references FAR 52.204-21 or contains FCI. If none, you
            don&apos;t need CMMC L1 yet.
          </p>
          <table className="mt-5 w-full border-collapse text-sm">
            <TableHead
              cols={[
                "Contract / PO #",
                "Prime or agency",
                "FAR 52.204-21?",
                "Contains CUI?",
              ]}
            />
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <BlankRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-[#5a7d70]">
            If <strong>any row</strong> says yes to &ldquo;Contains
            CUI?&rdquo;, you need CMMC <strong>Level 2</strong>, not
            Level 1. Stop here and see{" "}
            <Link
              href="/blog/cui-vs-fci"
              className="underline decoration-[#2f8f6d] underline-offset-2"
            >
              CUI vs FCI
            </Link>
            .
          </p>
        </section>

        {/* Section 2: people */}
        <section className="print-page-break mt-12">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 02
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            People who touch FCI
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            Every person whose job involves opening, editing, emailing,
            or filing FCI. Front desk staff who only stamp envelopes
            usually aren&apos;t in scope; the project lead and
            engineers usually are.
          </p>
          <table className="mt-5 w-full border-collapse text-sm">
            <TableHead
              cols={["Name", "Role", "Why they need access", "Access type"]}
            />
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <BlankRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </section>

        {/* Section 3: devices */}
        <section className="mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 03
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Devices in scope
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            Any laptop, desktop, phone, or server that processes,
            stores, or transmits FCI.
          </p>
          <table className="mt-5 w-full border-collapse text-sm">
            <TableHead
              cols={["Device (make / model)", "Assigned to", "OS", "MFA / AV on?"]}
            />
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <BlankRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </section>

        {/* Section 4: cloud apps */}
        <section className="print-page-break mt-12">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 04
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Cloud apps &amp; external connections
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            Email, file storage, accounting, project management, vendor
            portals &mdash; anything cloud-hosted where FCI lives or
            travels.
          </p>
          <table className="mt-5 w-full border-collapse text-sm">
            <TableHead
              cols={["App / service", "What it holds", "MFA enforced?", "Owner"]}
            />
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <BlankRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </section>

        {/* Section 5: network */}
        <section className="mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 05
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Network &amp; physical boundary
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Internal work network (SSID / VLAN)
              </div>
              <Blank />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Guest Wi-Fi (separated?)
              </div>
              <Blank />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Firewall (make / model / where)
              </div>
              <Blank />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Physical work area (room / building)
              </div>
              <Blank />
            </div>
          </div>
        </section>

        {/* Section 6: boundary diagram */}
        <section className="print-page-break mt-12">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 06
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Boundary diagram &mdash; draw it
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            On the grid below, sketch your boundary. Inside the box:
            in-scope people, devices, cloud apps. Outside: everything
            else. A 30-second drawing is a 100% acceptable Level 1
            diagram.
          </p>
          <div
            className="mt-5 aspect-[4/3] w-full border-2 border-[#10231d] bg-white"
            style={{
              backgroundImage:
                "linear-gradient(rgba(16,35,29,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,35,29,0.08) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="mt-4 grid gap-3 text-[11px] uppercase tracking-[0.18em] text-[#5a7d70] md:grid-cols-3">
            <div>&mdash; &mdash; &mdash; In-scope boundary</div>
            <div>&#9633; Device / asset</div>
            <div>&#9675; Cloud app</div>
          </div>
        </section>

        {/* Section 7: out of scope */}
        <section className="mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Section 07
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Out of scope &mdash; declared
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            Anything that does <em>not</em> touch FCI. Listing this
            explicitly protects you when a prime asks &ldquo;is X part
            of your assessment boundary?&rdquo; The answer is on file.
          </p>
          <Blank lines={6} />
        </section>

        {/* Sign */}
        <section className="print-page-break mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Final section
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            Sign-off
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-[#10231d]">
            I confirm that the scope defined above accurately reflects
            the systems, people, and information that touch federal
            contract information at our organization, and that anything
            not listed has been intentionally excluded.
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
                Next review (12 months)
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-[#cfe3d9] pt-6 text-center text-[10px] uppercase tracking-[0.24em] text-[#5a7d70]">
          Custodia &middot; bidfedcmmc.com &middot; Built from{" "}
          <span className="text-[#2f8f6d]">32 CFR 170.19</span>{" "}
          (CMMC scoping guidance) &middot; Not legal advice
        </footer>
      </ResourceCard>
    </ResourceShell>
  );
}
