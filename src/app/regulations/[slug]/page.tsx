import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

type Doc = {
  slug: string;
  title: string;
  shortTitle: string;
  cite: string;
  pages: number;
  released: string;
  file: string;
  blurb: string;
  whatItIs: string;
};

const DOCS: Record<string, Doc> = {
  "scoping-guide-level-1": {
    slug: "scoping-guide-level-1",
    title: "CMMC Scoping Guide — Level 1 (v2.13)",
    shortTitle: "CMMC Scoping Guide — Level 1",
    cite: "DoD-CIO-00005, v2.13",
    pages: 6,
    released: "September 2024",
    file: "/regulations/ScopingGuideL1v2.pdf",
    blurb:
      "How to draw the boundary around your in-scope systems for a Level 1 self-assessment. Defines FCI assets, specialized assets, out-of-scope assets, and the people, technology, facilities, and external service providers that count.",
    whatItIs:
      "Official DoD CIO publication. Distribution Statement A — approved for public release, distribution unlimited.",
  },
  "assessment-guide-level-1": {
    slug: "assessment-guide-level-1",
    title: "CMMC Assessment Guide — Level 1 (v2.13)",
    shortTitle: "CMMC Assessment Guide — Level 1",
    cite: "DoD-CIO-00002, v2.13",
    pages: 53,
    released: "September 2024",
    file: "/regulations/AssessmentGuideL1v2.pdf",
    blurb:
      "Per-practice assessment objectives (NIST SP 800-171A objectives [a]–[f]), assessment methods (Examine / Interview / Test), evidence examples, and the MET / NOT MET / NOT APPLICABLE rules used in a Level 1 self-assessment.",
    whatItIs:
      "Official DoD CIO publication. Distribution Statement A — approved for public release, distribution unlimited.",
  },
  "model-overview": {
    slug: "model-overview",
    title: "CMMC Model Overview (v2.13)",
    shortTitle: "CMMC Model Overview",
    cite: "DoD-CIO-00001, v2.13",
    pages: 46,
    released: "September 2024",
    file: "/regulations/ModelOverviewv2.pdf",
    blurb:
      "The full model: three levels, fourteen domains, the complete practice matrix, and every practice mapped to FAR 52.204-21 and NIST SP 800-171.",
    whatItIs:
      "Official DoD CIO publication. Distribution Statement A — approved for public release, distribution unlimited.",
  },
};

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) return {};
  return {
    title: `${doc.shortTitle} — Read the official DoD PDF`,
    description: `Read the official ${doc.title} in your browser. ${doc.cite}, ${doc.pages} pages, released ${doc.released}. Mirrored from the U.S. Department of Defense Chief Information Officer.`,
    alternates: { canonical: `${APP_URL}/regulations/${doc.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${doc.shortTitle} (${doc.cite})`,
      description: doc.blurb,
      url: `${APP_URL}/regulations/${doc.slug}`,
      type: "article",
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <main className="bg-[#f4faf6]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <nav className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#2f8f6d]">
          <Link href="/cmmc-level-1" className="hover:underline">
            CMMC Level 1
          </Link>
          <span className="mx-2 text-[#86a89a]">/</span>
          <Link href="/regulations" className="hover:underline">
            Regulations
          </Link>
          <span className="mx-2 text-[#86a89a]">/</span>
          <span className="text-[#10231d]">{doc.shortTitle}</span>
        </nav>

        <header className="border-2 border-[#2f8f6d] bg-white p-6 md:p-8">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Official DoD document · mirrored on this site
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
            {doc.title}
          </h1>
          <div className="mt-2 text-xs text-[#5a7d70]">
            {doc.cite} · {doc.pages} pages · Released {doc.released}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[#1d3a30] md:text-base">
            {doc.blurb}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#5a7d70]">
            {doc.whatItIs} Custodia is not affiliated with or endorsed by the
            Department of Defense.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={doc.file}
              target="_blank"
              rel="noopener"
              className="bg-[#08201a] px-4 py-2 text-xs font-bold text-[#bdf2cf] hover:bg-[#0c2a22]"
            >
              Open PDF in new tab
            </a>
            <a
              href={doc.file}
              download
              className="border border-[#08201a] px-4 py-2 text-xs font-bold text-[#08201a] hover:bg-[#08201a] hover:text-[#bdf2cf]"
            >
              Download
            </a>
            <Link
              href="/cmmc-level-1"
              className="border border-[#2f8f6d] px-4 py-2 text-xs font-bold text-[#2f8f6d] hover:bg-[#2f8f6d] hover:text-white"
            >
              Back to CMMC Level 1 guide
            </Link>
          </div>
        </header>

        <section className="mt-6 border border-[#cfe3d9] bg-white p-2 md:p-3">
          <object
            data={`${doc.file}#view=FitH&toolbar=1&navpanes=1`}
            type="application/pdf"
            className="block h-[80vh] w-full"
            aria-label={doc.title}
          >
            <div className="p-6 text-sm text-[#1d3a30]">
              Your browser can&apos;t display this PDF inline.{" "}
              <a
                href={doc.file}
                target="_blank"
                rel="noopener"
                className="font-bold text-[#2f8f6d] underline"
              >
                Open the PDF in a new tab
              </a>{" "}
              instead.
            </div>
          </object>
        </section>

        <section className="mt-8 border border-[#cfe3d9] bg-white p-6">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Other official CMMC Level 1 documents
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {Object.values(DOCS)
              .filter((d) => d.slug !== doc.slug)
              .map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/regulations/${d.slug}`}
                    className="font-serif font-bold text-[#10231d] hover:text-[#2f8f6d]"
                  >
                    {d.title}
                  </Link>
                  <span className="ml-2 text-xs text-[#5a7d70]">
                    {d.cite} · {d.pages} pages
                  </span>
                </li>
              ))}
          </ul>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-[#5a7d70]">
          Source: U.S. Department of Defense, Office of the Chief Information
          Officer. Reproduced under DoD Distribution Statement A. Authoritative
          DoD copy:{" "}
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
      </div>
    </main>
  );
}
