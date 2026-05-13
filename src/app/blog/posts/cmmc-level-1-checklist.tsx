import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import {
  Callout,
  H2,
  H3,
  OL,
  P,
  Prose,
  TOC,
  UL,
} from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-level-1-checklist",
  title:
    "The CMMC Level 1 Self-Assessment Checklist (Free, Printable PDF) — 2026",
  description:
    "All 15 FAR 52.204-21 safeguarding requirements in plain English, in a free printable checklist. Walk through it with a pen, your IT person, or both — and post your SPRS affirmation when every box is ticked.",
  excerpt:
    "Every CMMC Level 1 requirement, in plain English, on a printable page. No email gate. No upsell. Just the checklist.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cmmc level 1 checklist",
    "cmmc self assessment checklist",
    "cmmc level 1 pdf",
    "far 52.204-21 checklist",
    "cmmc compliance checklist",
    "cmmc level 1 requirements list",
    "free cmmc checklist",
  ],
  readingMinutes: 7,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Is there an official CMMC Level 1 self-assessment checklist?",
      answer:
        "Yes. The 15 safeguarding requirements come directly from FAR 52.204-21(b)(1) and are mirrored in 32 CFR 170.14 Table 1. The DoD does not publish a single 'official' checklist PDF, but the requirements themselves are the checklist — every Level 1 contractor must self-attest to all 15. Custodia's printable version puts each one in plain English on a single page.",
    },
    {
      question: "How long does a CMMC Level 1 self-assessment take?",
      answer:
        "For a small contractor (1-20 employees) with normal IT (modern operating systems, cloud email, antivirus, a firewall), the self-assessment itself takes 2-4 hours of walking through the 15 requirements. If you discover gaps, fixing them is what takes the time — usually one to two weeks of focused work.",
    },
    {
      question: "Do I need to keep the checklist on file?",
      answer:
        "Yes. While you don't submit the checklist to the government, you do need to retain evidence that you performed the self-assessment. The SPRS affirmation in PIEE is the official artifact, but a completed checklist (signed and dated by a senior official) is the standard internal record auditors and primes ask to see.",
    },
    {
      question: "Who has to sign the CMMC Level 1 self-assessment?",
      answer:
        "An 'affirming official' — a senior officer of the company who has the authority to bind it to the affirmation. For most small contractors, this is the CEO, owner, or president. The same person submits the annual affirmation in SPRS.",
    },
    {
      question: "Is this checklist enough to satisfy a prime contractor?",
      answer:
        "For Level 1, yes. Primes flow down FAR 52.204-21 and ask their subs to attest that they meet the 15 safeguarding requirements. A completed checklist + a current SPRS affirmation is the standard package they expect. For Level 2 (CUI), the requirements are far broader and a checklist alone is not sufficient.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — get the checklist" },
  { id: "download", label: "Download / print the checklist" },
  { id: "how-it-works", label: "How the checklist is built" },
  { id: "use-it", label: "How to use it in one afternoon" },
  { id: "after", label: "After you finish: file SPRS" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 30 seconds">
        <p>
          <strong>15 safeguarding requirements.</strong> All on one page,
          in plain English, free to print, no email gate.{" "}
          <Link
            href="/cmmc-level-1/checklist"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            Open the checklist &rarr;
          </Link>
        </p>
      </Callout>

      <P>
        CMMC Level 1 is shorter than people expect. There are{" "}
        <strong>15 safeguarding requirements</strong> &mdash; not 110,
        not 320 &mdash; and they come from a single regulation:{" "}
        <strong>FAR 52.204-21</strong>. Every Level 1 contractor in
        America has to self-attest to the same 15 items, then post a
        one-page affirmation in SPRS.
      </P>

      <P>
        We built a free, printable version that turns each requirement
        into one paragraph of plain English plus a single question
        you can answer yes or no. If you can honestly tick every box,
        you&apos;re bid-ready.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; what&apos;s in the checklist</H2>
      <UL>
        <li>
          <strong>All 15 requirements</strong>, grouped into the 6 NIST
          control families (Access Control, Identification &amp;
          Authentication, Media Protection, Physical Protection, System
          &amp; Communications Protection, System &amp; Information
          Integrity).
        </li>
        <li>
          For each item: the regulation citation, a plain-English
          explanation, and a <em>quick test</em> question you can answer
          yes/no.
        </li>
        <li>
          A signature block for your senior official to date and sign
          when you&apos;ve completed it.
        </li>
        <li>
          Print-optimized layout &mdash; fits on roughly 5 letter-size
          pages without cutting items in half.
        </li>
        <li>
          <strong>Free, no email, no signup.</strong>
        </li>
      </UL>

      <H2 id="download">Download / print the checklist</H2>
      <div className="not-prose mt-6 overflow-hidden border border-[#0e2a23] bg-[#08201a] p-8 text-white">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdf2cf]">
          The Custodia Library &middot; Free
        </div>
        <h3 className="mt-4 font-serif text-2xl font-bold leading-tight md:text-3xl">
          CMMC Level 1 Self-Assessment Checklist (2026)
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">
          Print-ready. Hit <kbd className="rounded border border-white/20 bg-white/[0.05] px-1.5 py-0.5 font-mono text-xs">Cmd/Ctrl + P</kbd>{" "}
          to save as a PDF. Branded, signed, and ready to keep on file.
        </p>
        <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row">
          <Link
            href="/cmmc-level-1/checklist"
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[#bdf2cf] px-5 py-3 text-sm font-bold text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
          >
            Open the checklist
            <span aria-hidden>&rarr;</span>
          </Link>
          <Link
            href="/sprs-check"
            className="inline-flex flex-1 items-center justify-center gap-2 border border-[#2f8f6d]/60 px-5 py-3 text-sm font-semibold text-[#cce5da] transition-colors hover:border-[#8dd2b1]/80 hover:text-white"
          >
            Take the 4-min SPRS quiz instead
          </Link>
        </div>
      </div>

      <H2 id="how-it-works">How the checklist is built</H2>
      <P>
        The structure follows the same six NIST control families the
        DoD uses internally, but the language is rewritten so an owner
        of a 12-person shop can read it without a compliance
        translator. Every item has three layers:
      </P>
      <OL>
        <li>
          <strong>What the regulation says.</strong> The official
          requirement and citation (e.g.{" "}
          <em>FAR 52.204-21(b)(1)(i)</em>).
        </li>
        <li>
          <strong>What it actually means.</strong> The same idea,
          translated into one paragraph of normal English.
        </li>
        <li>
          <strong>A quick test.</strong> One question you can answer
          yes or no without consulting a lawyer. If yes, tick the box.
          If no, you&apos;ve found a gap.
        </li>
      </OL>

      <Callout tone="info" title="Why this format works">
        <p>
          The CMMC self-assessment is a binary process. You either meet
          the 15 requirements or you don&apos;t &mdash; there are no
          partial credits, no scores, no maturity levels. A yes/no
          format mirrors that reality and gives you a finite punch list
          instead of a vague gap analysis.
        </p>
      </Callout>

      <H2 id="use-it">How to use it in one afternoon</H2>

      <H3>1. Block off 3 hours and gather the right people</H3>
      <P>
        The decision-maker (owner, president, CEO) needs to be in the
        room. So does whoever runs your IT &mdash; an internal admin,
        an MSP rep, or the office manager if that&apos;s honestly who
        does it. Most items have an &ldquo;ops&rdquo; component and a
        &ldquo;tech&rdquo; component; you&apos;ll need both lenses.
      </P>

      <H3>2. Print it or use it on screen</H3>
      <P>
        The printable layout is designed for a pen-and-clipboard pass.
        If you&apos;d rather, open it on a laptop and check things off
        digitally with a screenshot tool. Either works.
      </P>

      <H3>3. Walk it requirement by requirement</H3>
      <P>
        For each of the 15, read the &ldquo;In plain English&rdquo;
        paragraph aloud. Then answer the &ldquo;Quick test&rdquo;
        question. If you can honestly say yes, tick the box. If not,
        write the gap in the margin.
      </P>

      <H3>4. Total the gaps</H3>
      <P>
        Anything you couldn&apos;t tick is your punch list. Most small
        contractors finish with 2&ndash;5 gaps. Common ones: no formal
        visitor log, no documented vendor list, MFA missing on one
        cloud account, antivirus not turned on for one laptop.
      </P>

      <H3>5. Fix the gaps</H3>
      <P>
        Pick the easy ones first &mdash; turning on Windows Defender
        takes 30 seconds. Then the medium ones (writing down a vendor
        list, putting a clipboard at the front desk). Most punch lists
        get cleared in a focused week.
      </P>

      <H3>6. Sign and date</H3>
      <P>
        The senior official signs and dates the bottom of the
        checklist. Keep the signed copy on file &mdash; this is the
        evidence you&apos;ll show a prime, an auditor, or your future
        self.
      </P>

      <Callout tone="warn" title="One thing to watch for">
        <p>
          Don&apos;t check a box you can&apos;t defend. The SPRS
          affirmation is signed under the same penalties as any false
          federal statement, and the DoD has been clear that
          self-assessments are subject to spot-checks under the
          False Claims Act. Honesty here costs you a week. Dishonesty
          can cost you the company.
        </p>
      </Callout>

      <H2 id="after">After every box is ticked: file SPRS</H2>
      <P>
        The checklist is your internal evidence; the{" "}
        <strong>SPRS annual affirmation</strong> is the official
        government-facing artifact. You file it in{" "}
        <strong>PIEE</strong> (the Procurement Integrated Enterprise
        Environment) and it makes you bid-eligible.
      </P>
      <P>
        We wrote a separate walkthrough on the SPRS submission process:{" "}
        <Link
          href="/blog/sprs-score-explained"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          SPRS Score Explained: What It Is and How to Post One
        </Link>
        .
      </P>

      <Callout tone="ok" title="Do this once a year, forever">
        <p>
          The CMMC Level 1 affirmation is <strong>annual</strong>.
          Reuse the checklist next year. Most small contractors find
          year two takes about 90 minutes &mdash; nothing has changed
          structurally, you&apos;re just confirming the controls are
          still in place.
        </p>
      </Callout>

      <H2 id="faq">Frequently asked questions</H2>
      {meta.faq?.map((f) => (
        <div key={f.question} className="mt-8">
          <H3>{f.question}</H3>
          <P>{f.answer}</P>
        </div>
      ))}

      <div className="mt-16 border-t border-[#cfe3d9] pt-8 text-sm italic text-[#5a7d70]">
        <p>
          The CMMC Level 1 checklist on this page is a plain-English
          summary of FAR 52.204-21(b)(1) and 32 CFR 170.14 Table 1. It
          is not legal advice. The authoritative requirements live in
          the regulations themselves.
        </p>
      </div>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
