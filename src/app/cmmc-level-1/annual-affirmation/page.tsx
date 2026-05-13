import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../_components/ResourceShell";
import { ResourceCard } from "../_components/ResourceCard";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/annual-affirmation`;

export const metadata: Metadata = {
  title:
    "The CMMC Level 1 Annual Affirmation Guide (Free, Printable) | Custodia",
  description:
    "What the CMMC Level 1 annual affirmation is, who signs it, when it's due, and how to renew it in SPRS. Free, printable, plain English.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "The CMMC Level 1 Annual Affirmation Guide",
    description:
      "What it is, who signs, when it's due, how to renew. Free, printable.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "CMMC Level 1 Annual Affirmation Guide",
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

export default function AnnualAffirmationPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "CMMC Level 1 Annual Affirmation Guide",
    description:
      "What the CMMC Level 1 annual affirmation is, who signs it, when it's due, and how to renew it.",
    url: PAGE_URL,
    datePublished: "2026-05-13",
    dateModified: "2026-05-13",
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "Custodia", url: APP_URL },
  };

  return (
    <ResourceShell title="annual affirmation guide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResourceCard
        eyebrow="Custodia · Free guide · 2026 edition"
        title="The CMMC Level 1"
        italic="annual affirmation"
        trailing="guide."
        subtitle={
          <>
            The part everyone forgets, the part that costs you the next
            contract. Here&apos;s what it is, who signs, when it&apos;s
            due, and how to renew &mdash; in about 15 minutes a year.
          </>
        }
        stats={[
          { n: "1×", l: "Per year" },
          { n: "~15 min", l: "To renew" },
          { n: "1", l: "Signer" },
        ]}
      >
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            What it is
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            The CMMC Level 1 annual affirmation is a senior official
            attesting, in SPRS, that your company continues to meet
            all 15 safeguarding requirements of FAR 52.204-21. It is
            required every 12 months. There is no third-party assessor
            involved at Level 1 &mdash; you affirm; DoD trusts; DoD
            also enforces if you lied.
          </p>
        </section>

        <section className="mt-10 print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            Who can sign it
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            The affirming official must be a senior official with
            authority to attest on behalf of the company. In practice
            this is:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#10231d]">
            <li>The owner / president, for sole-proprietor or small LLC</li>
            <li>The CEO or COO, for incorporated small businesses</li>
            <li>The CIO or CISO, if formally delegated authority</li>
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            The IT contractor, the part-time MSP, or the office
            manager cannot sign. The signer must be in a position to
            bind the company.
          </p>
        </section>

        <section className="mt-10 print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            When it&apos;s due
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            Within 12 months of your previous affirmation. If your
            last affirmation was March 15, your next is due by March
            14 the following year &mdash; not &ldquo;sometime that
            quarter.&rdquo;
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            If you miss the deadline, your SPRS posting becomes
            <em> stale</em>. Contracting officers and primes treat a
            stale posting as if no posting exists. You can renew at
            any time to refresh the date.
          </p>
        </section>

        <section className="mt-10 print-avoid-break border border-[#cfe3d9] bg-[#f7fcf9] p-6">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Calendar template
          </div>
          <h3 className="mt-2 font-serif text-xl font-bold text-[#10231d]">
            Three reminders to set, today
          </h3>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#10231d]">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#10231d]">
                  When
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#10231d]">
                  What
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#10231d]">
                  Who
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-dashed border-[#aabcb3]">
                <td className="px-3 py-3 text-[14px] text-[#10231d]">11 months from last affirmation</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">First reminder &mdash; start review</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">System owner</td>
              </tr>
              <tr className="border-b border-dashed border-[#aabcb3]">
                <td className="px-3 py-3 text-[14px] text-[#10231d]">11.5 months</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">Run self-assessment &amp; sign attestation</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">Affirming official</td>
              </tr>
              <tr className="border-b border-dashed border-[#aabcb3]">
                <td className="px-3 py-3 text-[14px] text-[#10231d]">11.75 months</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">Post new affirmation in SPRS</td>
                <td className="px-3 py-3 text-[14px] text-[#10231d]">Affirming official</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="print-page-break mt-12 print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            What to review before re-affirming
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#10231d]">
            Don&apos;t copy-paste last year&apos;s affirmation. The
            environment changes. Walk through this 10-minute checklist:
          </p>

          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[14px] leading-relaxed text-[#10231d]">
            <li><strong>Scope changes.</strong> New office, new cloud apps, new contracts with FCI? Update the boundary.</li>
            <li><strong>People.</strong> Has anyone left who had access? Was their access revoked? Were keys/fobs returned?</li>
            <li><strong>Devices.</strong> Any new laptops or phones holding FCI? Are they on the inventory? AV and updates current?</li>
            <li><strong>Cloud apps.</strong> Any new SaaS used for federal work? MFA enforced?</li>
            <li><strong>Policies.</strong> Are all eight policies still current? Re-sign / re-date them annually.</li>
            <li><strong>Incidents.</strong> Any reportable incidents in the last 12 months? Documented?</li>
            <li><strong>Disposal log.</strong> Any laptops / drives / phones disposed of? Logged?</li>
            <li><strong>Visitor log.</strong> Up to date for the last year?</li>
            <li><strong>Firewall &amp; network.</strong> Any architecture changes? Still segmenting guest Wi-Fi?</li>
            <li><strong>Self-assessment.</strong> Run the 15-question checklist again. Score MET on all 15.</li>
          </ol>
        </section>

        <section className="mt-10 print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            Sign-off
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#10231d]">
            I affirm that, as of the date below, the company continues
            to implement all 15 safeguarding requirements of FAR
            52.204-21, and that I am authorized to attest on behalf of
            the company.
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
                Date of affirmation
              </div>
            </div>
            <div>
              <div className="h-12 border-b border-[#10231d]" />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                Next affirmation due
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-[#cfe3d9] pt-6 text-center text-[10px] uppercase tracking-[0.24em] text-[#5a7d70]">
          Custodia &middot; bidfedcmmc.com &middot; Not legal advice
        </footer>

        <div className="no-print mt-12 border-t border-[#cfe3d9] pt-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Resources
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Link
              href="/cmmc-level-1/sprs-walkthrough"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">SPRS walkthrough &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Where to actually post the affirmation.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/checklist"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Self-assessment checklist &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Re-run the 15 controls before you re-affirm.
              </div>
            </Link>
          </div>
        </div>
      </ResourceCard>
    </ResourceShell>
  );
}
