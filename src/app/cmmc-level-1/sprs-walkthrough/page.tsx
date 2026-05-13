import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../_components/ResourceShell";
import { ResourceCard } from "../_components/ResourceCard";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/sprs-walkthrough`;

export const metadata: Metadata = {
  title:
    "How to Post Your SPRS Score: Step-by-Step CMMC L1 Walkthrough (Free) | Custodia",
  description:
    "Free step-by-step walkthrough for posting your CMMC Level 1 self-assessment to the Supplier Performance Risk System (SPRS). Plain English, screenshots inline. No email required.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How to Post Your SPRS Score (Step-by-Step Walkthrough)",
    description:
      "Free step-by-step walkthrough for posting your CMMC L1 self-assessment to SPRS.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Post Your SPRS Score",
    description: "Step-by-step walkthrough. Plain English. Free.",
  },
  robots: { index: true, follow: true },
};

type Step = {
  n: string;
  title: string;
  body: string[];
  gotcha?: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Confirm you have a PIEE account",
    body: [
      "SPRS is accessed through PIEE (Procurement Integrated Enterprise Environment) at piee.eb.mil.",
      "You need a PIEE account with the SPRS module added. If you already invoice DoD through WAWF, you have PIEE — you just need to add SPRS.",
      "If you do not have PIEE, register your company first (this takes ~3 business days for the CAM, Contractor Administrator, to be approved).",
    ],
    gotcha:
      "If you've never logged into PIEE, plan for a 3–5 business day delay. Start here before doing anything else.",
  },
  {
    n: "02",
    title: "Add the SPRS role in PIEE",
    body: [
      "Log into PIEE at piee.eb.mil.",
      "Go to 'My Account' → 'Add Roles.'",
      "Select 'SPRS' as the application and 'Cyber Vendor User' as the role.",
      "Your company's CAM (Contractor Administrator) approves the request. If you are the CAM, you self-approve.",
    ],
    gotcha:
      "Pick 'Cyber Vendor User,' not 'Contractor / Vendor (Read Only).' The read-only role cannot post scores.",
  },
  {
    n: "03",
    title: "Open the Cyber Reports module in SPRS",
    body: [
      "From PIEE, click the SPRS tile.",
      "Inside SPRS, select 'Cyber Reports' from the left menu.",
      "Choose your company from the CAGE / DUNS / UEI selector.",
    ],
  },
  {
    n: "04",
    title: "Click 'NIST SP 800-171 Assessments'",
    body: [
      "For CMMC Level 1, you'll use the same NIST SP 800-171 assessment table — but you'll select 'Basic' as the assessment type and tick the box indicating Level 1 / FCI scope.",
      "(As of mid-2025, DoD added a dedicated 'CMMC Level 1 Self-Assessment Affirmation' workflow inside SPRS. If your view shows it, use that instead — the fields are nearly identical.)",
    ],
  },
  {
    n: "05",
    title: "Enter the required fields",
    body: [
      "Assessment date: the date you ran the self-assessment.",
      "Assessment scope: a short description of the boundary you defined. ('Corporate IT, 3 laptops, M365 tenant, Cisco firewall.')",
      "Score: for Level 1, this is binary — your system meets all 15 controls (MET) or it does not (NOT MET).",
      "Plan of action completion date: leave blank for Level 1 (no POAMs allowed at L1).",
      "Affirming official: name, title, email, phone. This must be a senior official with authority to attest on behalf of the company.",
    ],
    gotcha:
      "There is no partial credit at Level 1. If you cannot truthfully mark MET on all 15, fix the gap before submitting.",
  },
  {
    n: "06",
    title: "Submit the affirmation",
    body: [
      "Review the screen for typos. The affirming official's name, title, and email are public to DoD contracting officers — accuracy matters.",
      "Click 'Submit.'",
      "SPRS records the submission with a date-stamped record. Take a screenshot of the confirmation screen and save it with your evidence.",
    ],
  },
  {
    n: "07",
    title: "Verify your score appears",
    body: [
      "Return to the assessment table within 5 minutes. Your most recent submission should appear at the top, with the affirmation date and the affirming official.",
      "If it doesn't appear, refresh; if still missing, contact SPRS support (the link is in the SPRS footer).",
    ],
  },
  {
    n: "08",
    title: "Calendar the renewal",
    body: [
      "Level 1 requires an annual affirmation. Set a calendar reminder for 11 months from today.",
      "If anything in your environment changes materially (new office, new cloud app holding FCI, change in IT contact), update the SPRS posting at that point rather than waiting for the annual.",
    ],
    gotcha:
      "Missing the annual renewal is the #1 way Level 1 contractors lose 'bid-ready' status. Calendar it twice.",
  },
];

export default function SprsWalkthroughPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Post Your CMMC Level 1 Self-Assessment to SPRS",
    description:
      "Step-by-step walkthrough for posting a CMMC Level 1 self-assessment affirmation to the Supplier Performance Risk System (SPRS).",
    url: PAGE_URL,
    totalTime: "PT30M",
    step: STEPS.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: s.body.join(" "),
    })),
  };

  return (
    <ResourceShell title="SPRS walkthrough">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResourceCard
        eyebrow="Custodia · Free walkthrough · 2026 edition"
        title="How to post your"
        italic="SPRS score"
        trailing="— step by step."
        subtitle={
          <>
            The eight steps to take a finished CMMC Level 1
            self-assessment and post the affirmation into SPRS, the
            DoD&apos;s Supplier Performance Risk System. Plain English,
            no jargon, no gates.
          </>
        }
        stats={[
          { n: "8", l: "Steps" },
          { n: "~30 min", l: "If PIEE is set up" },
          { n: "1×", l: "Annually" },
        ]}
      >
        {/* What this is */}
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            What posting to SPRS actually means
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
            SPRS is where DoD contracting officers look up your
            cybersecurity posture before awarding contracts. Posting
            your CMMC Level 1 affirmation here is the official act that
            tells the government &ldquo;we&apos;ve done the
            self-assessment, and we meet the 15 safeguarding
            requirements.&rdquo;
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[#44695c]">
            Until your posting appears in SPRS, you cannot bid on
            FAR-52.204-21 contracts as a prime, and primes who require
            an SPRS lookup will skip your bid as a sub.
          </p>
        </section>

        {/* Before you start */}
        <section className="mt-10 border border-[#cfe3d9] bg-[#f7fcf9] p-6 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Before you start
          </div>
          <h3 className="mt-2 font-serif text-xl font-bold text-[#10231d]">
            You should already have:
          </h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#10231d]">
            <li>A completed Level 1 self-assessment (use our{" "}
              <Link href="/cmmc-level-1/checklist" className="underline decoration-[#2f8f6d] underline-offset-2">
                free checklist
              </Link>
              )</li>
            <li>A defined scope (use our{" "}
              <Link href="/cmmc-level-1/scoping-worksheet" className="underline decoration-[#2f8f6d] underline-offset-2">
                scoping worksheet
              </Link>
              )</li>
            <li>Your company&apos;s CAGE code and UEI</li>
            <li>The name, title, email, and phone of an &ldquo;affirming official&rdquo; with authority to attest</li>
            <li>A PIEE account (or time to register one)</li>
          </ul>
        </section>

        {/* Steps */}
        {STEPS.map((s) => (
          <section
            key={s.n}
            className={`${s.n === "01" ? "print-page-break " : ""}mt-12 print-avoid-break`}
          >
            <div className="flex items-start gap-6">
              <div className="font-serif text-5xl font-bold text-[#2f8f6d]">
                {s.n}
              </div>
              <div className="flex-1">
                <h2 className="font-serif text-2xl font-bold leading-tight text-[#10231d]">
                  {s.title}
                </h2>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[#10231d]">
                  {s.body.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
                {s.gotcha && (
                  <div className="mt-4 border-l-4 border-[#cfa747] bg-[#fdf7e8] p-4 text-[13px] leading-relaxed text-[#5a4514]">
                    <strong>Gotcha:</strong> {s.gotcha}
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}

        {/* What if you fail */}
        <section className="print-page-break mt-12 print-avoid-break">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Special case
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
            What if you can&apos;t mark MET on all 15?
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#10231d]">
            CMMC Level 1 is binary. You can&apos;t submit a partial
            posting and you can&apos;t list POAMs (plan of action items
            you&apos;ll do later). The right move:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-[#10231d]">
            <li>Identify exactly which control(s) you&apos;re short on. Our checklist makes this easy.</li>
            <li>Fix them. Most L1 gaps (MFA on email, antivirus turned on, visitor log started) can be closed in days.</li>
            <li>Re-run the self-assessment. Sign the new attestation.</li>
            <li>Then submit to SPRS.</li>
          </ol>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5a7d70]">
            Submitting MET when you don&apos;t actually meet the
            controls is a False Claims Act exposure. Don&apos;t.
          </p>
        </section>

        <footer className="mt-14 border-t border-[#cfe3d9] pt-6 text-center text-[10px] uppercase tracking-[0.24em] text-[#5a7d70]">
          Custodia &middot; bidfedcmmc.com &middot; SPRS portal:{" "}
          <span className="text-[#2f8f6d]">piee.eb.mil</span> &middot;
          Not legal advice
        </footer>

        <div className="no-print mt-12 border-t border-[#cfe3d9] pt-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Next
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Link
              href="/cmmc-level-1/annual-affirmation"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Annual affirmation guide &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                The part everyone forgets and then loses bid-ready
                status.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/diy"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">The whole DIY handbook &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                All seven steps in one place.
              </div>
            </Link>
          </div>
        </div>
      </ResourceCard>
    </ResourceShell>
  );
}
