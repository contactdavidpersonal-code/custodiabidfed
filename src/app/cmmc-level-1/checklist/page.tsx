import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "./PrintButton";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title:
    "CMMC Level 1 Self-Assessment Checklist (Free, Printable) | Custodia",
  description:
    "The complete CMMC Level 1 self-assessment checklist — all 15 FAR 52.204-21 safeguarding requirements in plain English. Free, printable, no email required. Updated for 2026.",
  alternates: { canonical: `${APP_URL}/cmmc-level-1/checklist` },
  openGraph: {
    title: "CMMC Level 1 Self-Assessment Checklist (Free, Printable)",
    description:
      "All 15 FAR 52.204-21 safeguarding requirements in plain English. Free, printable, no email required.",
    type: "article",
    url: `${APP_URL}/cmmc-level-1/checklist`,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "CMMC Level 1 Self-Assessment Checklist (Free, Printable)",
    description:
      "All 15 FAR 52.204-21 safeguarding requirements in plain English. Free, printable, no email required.",
  },
  robots: { index: true, follow: true },
};

/**
 * The full 15-requirement checklist. Plain-English titles + the "show this
 * to the prime" question + the practical answer guidance. Source of truth:
 * FAR 52.204-21(b)(1) and 32 CFR 170.14 Table 1 (Level 1 practices).
 */
const FAMILIES: Array<{
  family: string;
  letter: string;
  blurb: string;
  items: Array<{
    id: string;
    title: string;
    citation: string;
    plain: string;
    test: string;
  }>;
}> = [
  {
    family: "Access Control",
    letter: "AC",
    blurb: "Only let the right people in. To your systems, and to the data.",
    items: [
      {
        id: "AC.L1-3.1.1",
        title: "Limit access to authorized users",
        citation: "FAR 52.204-21(b)(1)(i) · 3.1.1",
        plain:
          "Every person who can sign into a company computer or cloud account is a named, authorized employee or contractor. No shared logins. No 'admin / admin'.",
        test:
          "Can you produce a list of every active user account and tie each one to a real person?",
      },
      {
        id: "AC.L1-3.1.2",
        title: "Limit access to authorized functions",
        citation: "FAR 52.204-21(b)(1)(ii) · 3.1.2",
        plain:
          "People only get the permissions they need to do their job. The intern doesn't have admin. The bookkeeper doesn't have access to engineering files.",
        test: "Are admin rights restricted to people who actually need them?",
      },
      {
        id: "AC.L1-3.1.20",
        title: "Control external system connections",
        citation: "FAR 52.204-21(b)(1)(iii) · 3.1.20",
        plain:
          "You know which third-party services (Dropbox, personal Gmail, a vendor's portal) your team uses with company data — and you've approved them.",
        test: "Do you have a written list of approved cloud apps and vendors?",
      },
      {
        id: "AC.L1-3.1.22",
        title: "Control public posting of information",
        citation: "FAR 52.204-21(b)(1)(iv) · 3.1.22",
        plain:
          "Before someone posts anything from a federal contract to the company website, LinkedIn, a conference talk, or a press release, somebody approves it.",
        test:
          "Who reviews public posts that might touch federal contract info?",
      },
    ],
  },
  {
    family: "Identification & Authentication",
    letter: "IA",
    blurb: "Prove who you are before you get in.",
    items: [
      {
        id: "IA.L1-3.5.1",
        title: "Identify users and devices",
        citation: "FAR 52.204-21(b)(1)(v) · 3.5.1",
        plain:
          "Every user has a unique username. Every company device is on a list. Nothing logs in anonymously.",
        test:
          "Can you list every user and every device that has access to company systems?",
      },
      {
        id: "IA.L1-3.5.2",
        title: "Authenticate users and devices",
        citation: "FAR 52.204-21(b)(1)(vi) · 3.5.2",
        plain:
          "Real passwords (not 'password123'), and ideally multi-factor authentication, before anyone gets in. Same for devices joining the network.",
        test:
          "Is MFA on email, cloud apps, and remote access? Is there a real password policy?",
      },
    ],
  },
  {
    family: "Media Protection",
    letter: "MP",
    blurb: "Wipe drives before you throw them out. Same with phones.",
    items: [
      {
        id: "MP.L1-3.8.3",
        title: "Sanitize media before disposal",
        citation: "FAR 52.204-21(b)(1)(vii) · 3.8.3",
        plain:
          "Old laptops, drives, USB sticks, phones, and even paper get wiped or shredded before they leave the building. You keep a log.",
        test:
          "Do you have a record of what was destroyed, when, and by whom?",
      },
    ],
  },
  {
    family: "Physical Protection",
    letter: "PE",
    blurb: "Lock the office. Walk visitors. Watch the door.",
    items: [
      {
        id: "PE.L1-3.10.1",
        title: "Limit physical access",
        citation: "FAR 52.204-21(b)(1)(viii) · 3.10.1",
        plain:
          "Strangers can't walk into the area where federal contract work happens. Doors lock. Badges or keys are required.",
        test:
          "What stops a random person from walking into your work area today?",
      },
      {
        id: "PE.L1-3.10.3",
        title: "Escort visitors",
        citation: "FAR 52.204-21(b)(1)(ix) · 3.10.3",
        plain:
          "When a visitor (vendor, family member, delivery driver, prospective client) comes into the work area, an employee is with them the whole time.",
        test:
          "Are visitors escorted by an employee while in work areas?",
      },
      {
        id: "PE.L1-3.10.4",
        title: "Maintain audit logs of physical access",
        citation: "FAR 52.204-21(b)(1)(x) · 3.10.4",
        plain:
          "You keep a visitor log: name, date, who they were here to see, time in, time out. A clipboard at the front desk counts.",
        test:
          "Could you show 60 days of visitor entries on demand?",
      },
      {
        id: "PE.L1-3.10.5",
        title: "Control physical access devices",
        citation: "FAR 52.204-21(b)(1)(xi) · 3.10.5",
        plain:
          "Keys, badges, fobs, alarm codes — you know who has each one, and you collect them back when someone leaves the company.",
        test:
          "When the last employee quit, did you get their keys and fobs back?",
      },
    ],
  },
  {
    family: "System & Communications Protection",
    letter: "SC",
    blurb: "Put a wall between you and the open internet.",
    items: [
      {
        id: "SC.L1-3.13.1",
        title: "Monitor and control the network boundary",
        citation: "FAR 52.204-21(b)(1)(xii) · 3.13.1",
        plain:
          "A firewall stands between your network and the public internet. Inbound traffic is blocked by default. You know what's coming in and going out.",
        test:
          "Is there a firewall — on the router, in the cloud, or both — and is it actually turned on?",
      },
      {
        id: "SC.L1-3.13.5",
        title: "Separate public-facing systems",
        citation: "FAR 52.204-21(b)(1)(xiii) · 3.13.5",
        plain:
          "Your public website (or a guest Wi-Fi) is not on the same network as the laptop where you handle federal contract work.",
        test:
          "Is the guest Wi-Fi separate from the work Wi-Fi? Is the marketing site on a different host than internal files?",
      },
    ],
  },
  {
    family: "System & Information Integrity",
    letter: "SI",
    blurb: "Patch known holes. Run antivirus. Pay attention to alerts.",
    items: [
      {
        id: "SI.L1-3.14.1",
        title: "Fix flaws in a timely manner",
        citation: "FAR 52.204-21(b)(1)(xiv) · 3.14.1",
        plain:
          "Windows, macOS, your apps, and your firewall get updates installed in a reasonable timeframe. 'Reasonable' = within 30 days for most things, faster for critical security patches.",
        test:
          "Are operating systems and apps set to auto-update? Are you actually rebooting when prompted?",
      },
      {
        id: "SI.L1-3.14.2",
        title: "Use malicious code protection",
        citation: "FAR 52.204-21(b)(1)(xv) · 3.14.2",
        plain:
          "Antivirus is installed and turned on, on every computer. Windows Defender counts. So does the built-in protection on a Mac.",
        test:
          "If you opened every laptop right now, would each one show active AV protection?",
      },
      {
        id: "SI.L1-3.14.4",
        title: "Update malicious code protection",
        citation: "FAR 52.204-21(b)(1)(xvi) · 3.14.4",
        plain:
          "The antivirus updates its definitions automatically. Same for your firewall's threat lists. Nobody's running a 2018 signature file.",
        test:
          "Are AV signatures updated within the last 7 days on every device?",
      },
      {
        id: "SI.L1-3.14.5",
        title: "Run periodic scans",
        citation: "FAR 52.204-21(b)(1)(xvii) · 3.14.5",
        plain:
          "A full-system AV scan runs on a schedule (weekly is fine for most). Real-time scanning is on by default for files you open or download.",
        test:
          "Is there a recurring full scan scheduled, and does real-time protection say 'on'?",
      },
    ],
  },
];

const totalItems = FAMILIES.reduce((n, f) => n + f.items.length, 0);

export default function ChecklistPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "CMMC Level 1 Self-Assessment Checklist — All 15 Safeguarding Requirements in Plain English",
    description:
      "The complete CMMC Level 1 self-assessment checklist with all 15 FAR 52.204-21 safeguarding requirements in plain English.",
    url: `${APP_URL}/cmmc-level-1/checklist`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${APP_URL}/cmmc-level-1/checklist`,
    },
    author: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/custodia-logo.png`,
      },
    },
    datePublished: "2026-05-13",
    dateModified: "2026-05-13",
    isAccessibleForFree: true,
  };

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Print-specific styles. When someone hits Cmd/Ctrl+P this becomes a
          clean PDF. */}
      <style>{`
        @media print {
          @page { size: Letter; margin: 0.6in 0.5in; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { box-shadow: none !important; border: 0 !important; padding: 0 !important; background: white !important; }
          .print-page-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
        }
      `}</style>

      {/* ---------- Top bar (screen only) ---------- */}
      <header className="no-print border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia"
              className="h-8 w-auto"
            />
            <span className="font-serif text-lg font-bold tracking-tight text-[#10231d]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="hidden text-sm font-medium text-[#44695c] hover:text-[#10231d] sm:inline"
            >
              &larr; Back to blog
            </Link>
            <PrintButton>Print / Save as PDF</PrintButton>
          </div>
        </div>
      </header>

      {/* ---------- Main printable card ---------- */}
      <main className="px-4 py-10 md:px-6 md:py-16">
        <article className="print-container mx-auto max-w-4xl border border-[#cfe3d9] bg-white p-8 shadow-[0_24px_80px_-30px_rgba(14,48,37,0.18)] md:p-14">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 border-b border-[#cfe3d9] pb-8">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
                Custodia &middot; Free Tool &middot; 2026 edition
              </div>
              <h1 className="mt-4 font-serif text-3xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-[2.6rem]">
                The CMMC Level 1
                <br className="hidden md:block" />{" "}
                <span className="italic text-[#2f8f6d]">self-assessment</span>{" "}
                checklist.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#44695c]">
                All {totalItems} safeguarding requirements from{" "}
                <strong>FAR 52.204-21</strong> &mdash; the rule behind CMMC
                Level 1 &mdash; in plain English. Walk through it with a
                pen, your IT person, or both. If you can honestly tick
                every box, you can post a SPRS affirmation and stay
                bid-ready.
              </p>
            </div>
            <div className="hidden flex-shrink-0 text-right md:block">
              <img
                src="/custodia-logo.png"
                alt="Custodia"
                className="ml-auto h-10 w-auto opacity-90"
              />
              <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#7a9c90]">
                bidfedcmmc.com
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <dl className="mt-8 grid grid-cols-3 divide-x divide-[#cfe3d9] border border-[#cfe3d9] bg-[#f7fcf9]">
            {[
              { n: "15", l: "Requirements" },
              { n: "6", l: "Control families" },
              { n: "1 page", l: "Annual SPRS affirmation" },
            ].map((s) => (
              <div key={s.l} className="px-4 py-5 text-center">
                <dt className="font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
                  {s.n}
                </dt>
                <dd className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a9c90]">
                  {s.l}
                </dd>
              </div>
            ))}
          </dl>

          {/* How to use this */}
          <section className="mt-10 border-l-4 border-[#2f8f6d] bg-[#f7fcf9] px-6 py-5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              How to use this checklist
            </div>
            <ol className="mt-3 space-y-2 text-[14px] leading-relaxed text-[#1d3a30]">
              <li>
                <strong>1.</strong> Read the &ldquo;In plain English&rdquo;
                explanation under each item.
              </li>
              <li>
                <strong>2.</strong> Answer the &ldquo;Quick test&rdquo;
                question. If yes, tick the box.
              </li>
              <li>
                <strong>3.</strong> Anything you can&apos;t tick is your
                punch list. Fix it, then come back.
              </li>
              <li>
                <strong>4.</strong> When all 15 are ticked, log into{" "}
                <a
                  href="https://piee.eb.mil"
                  className="underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#0e2a23]"
                >
                  PIEE / SPRS
                </a>{" "}
                and post your annual affirmation.
              </li>
            </ol>
          </section>

          {/* Families & items */}
          <section className="mt-12 space-y-12">
            {FAMILIES.map((fam, fi) => (
              <div
                key={fam.letter}
                className={`print-avoid-break ${fi === 3 ? "print-page-break" : ""}`}
              >
                <div className="mb-5 flex items-baseline gap-4 border-b border-[#cfe3d9] pb-4">
                  <span className="font-serif text-4xl font-bold leading-none text-[#2f8f6d]/30">
                    {fam.letter}
                  </span>
                  <div>
                    <h2 className="font-serif text-2xl font-bold leading-tight text-[#10231d] md:text-3xl">
                      {fam.family}
                    </h2>
                    <p className="mt-1 text-sm italic text-[#5a7d70]">
                      {fam.blurb}
                    </p>
                  </div>
                </div>

                <ol className="space-y-5">
                  {fam.items.map((item, idx) => {
                    const globalIdx =
                      FAMILIES.slice(0, fi).reduce(
                        (n, f) => n + f.items.length,
                        0,
                      ) +
                      idx +
                      1;
                    return (
                      <li
                        key={item.id}
                        className="print-avoid-break grid grid-cols-[auto_1fr] gap-4 border border-[#e6efe9] bg-white p-5 md:gap-5 md:p-6"
                      >
                        {/* Checkbox */}
                        <div className="flex flex-col items-center gap-2 pt-1">
                          <div className="h-7 w-7 border-2 border-[#2f8f6d]" />
                          <div className="font-mono text-[10px] font-bold text-[#7a9c90]">
                            {String(globalIdx).padStart(2, "0")}
                          </div>
                        </div>

                        {/* Body */}
                        <div>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-serif text-[19px] font-bold leading-snug text-[#10231d] md:text-xl">
                              {item.title}
                            </h3>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                              {item.id}
                            </span>
                          </div>

                          <p className="mt-3 text-[14.5px] leading-[1.7] text-[#1d3a30]">
                            <strong className="text-[#2f8f6d]">
                              In plain English:
                            </strong>{" "}
                            {item.plain}
                          </p>

                          <div className="mt-3 border-l-2 border-[#cfe3d9] pl-3 text-[13.5px] italic leading-relaxed text-[#44695c]">
                            <strong className="not-italic text-[#10231d]">
                              Quick test:
                            </strong>{" "}
                            {item.test}
                          </div>

                          <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[#7a9c90]">
                            {item.citation}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>

          {/* Sign-off block — looks great on print */}
          <section className="print-avoid-break mt-14 border-t-2 border-[#08201a] pt-8">
            <h2 className="font-serif text-2xl font-bold text-[#10231d]">
              When every box is ticked
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#44695c]">
              You&apos;re ready to post your annual SPRS affirmation.
              That&apos;s a one-page statement, filed in the{" "}
              <strong>Procurement Integrated Enterprise Environment</strong>{" "}
              (PIEE), saying that your business meets all 15 safeguarding
              requirements. That single act is what makes you{" "}
              <strong>bid-eligible</strong> on contracts that flow down
              FAR 52.204-21.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                  Senior official sign-off
                </div>
                <div className="mt-6 border-b border-[#7a9c90]" />
                <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a9c90]">
                  Name &amp; title
                </div>
                <div className="mt-5 border-b border-[#7a9c90]" />
                <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a9c90]">
                  Signature &amp; date
                </div>
              </div>
              <div className="border border-[#cfe3d9] bg-white p-5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                  Next steps
                </div>
                <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-[#1d3a30]">
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2f8f6d]">&rarr;</span>
                    Log in to <strong>PIEE</strong> (piee.eb.mil)
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2f8f6d]">&rarr;</span>
                    Open the <strong>SPRS</strong> module
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2f8f6d]">&rarr;</span>
                    Submit the <strong>CMMC Level 1 annual affirmation</strong>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[#2f8f6d]">&rarr;</span>
                    Re-affirm every <strong>12 months</strong> thereafter
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Footer — branded */}
          <footer className="mt-12 border-t border-[#cfe3d9] pt-6 text-center">
            <div className="font-serif text-lg font-bold text-[#10231d]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </div>
            <p className="mt-1 text-xs italic text-[#5a7d70]">
              Guided CMMC Level 1 compliance &middot; bidfedcmmc.com
            </p>
            <p className="mt-3 max-w-2xl mx-auto text-[11px] leading-relaxed text-[#7a9c90]">
              This checklist is a plain-English summary of FAR 52.204-21(b)(1)
              and 32 CFR 170.14 (CMMC Level 1 practices). It is not legal
              advice. The authoritative requirements are the regulations
              themselves.
            </p>
          </footer>
        </article>

        {/* ---------- Off-print platform CTA (Rhetorich-style stat ad) ---------- */}
        <aside className="no-print mx-auto mt-14 max-w-4xl">
          <div className="relative overflow-hidden border border-[#0e2a23] bg-[#08201a] p-8 text-white md:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(141,210,177,1) 1px, transparent 1px), linear-gradient(90deg, rgba(141,210,177,1) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#bdf2cf]">
                  Stop printing. Start filing.
                </div>
                <h2 className="mt-4 font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-[2.2rem]">
                  The same 15 items &mdash;{" "}
                  <span className="italic text-[#8dd2b1]">
                    done for you
                  </span>
                  .
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[#a8cfc0]">
                  Custodia is the guided platform that turns this checklist
                  into a finished, signed, bid-ready package &mdash;
                  policies, SSP, SPRS affirmation, and a one-page summary
                  you can hand to any prime. 14-day free trial, no card.
                </p>
                <Link
                  href="/sign-up"
                  className="mt-6 inline-flex items-center gap-2 bg-[#bdf2cf] px-6 py-3 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
                >
                  Start 14-day free trial
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-white/[0.1] border border-white/[0.1] bg-[#0a261e]/40">
                {[
                  { n: "7 days", l: "To bid-ready" },
                  { n: "$0", l: "Setup fee" },
                  { n: "100%", l: "Money-back guarantee" },
                ].map((s) => (
                  <div key={s.l} className="px-3 py-5 text-center">
                    <dt className="font-serif text-xl font-bold text-white md:text-2xl">
                      {s.n}
                    </dt>
                    <dd className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#7aab98]">
                      {s.l}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
