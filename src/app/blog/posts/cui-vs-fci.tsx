import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import {
  Callout,
  H2,
  H3,
  OL,
  P,
  Prose,
  TableSimple,
  TOC,
  UL,
} from "@/app/blog/_components/BlogShell";
import { FCIvsCUI } from "@/app/blog/_components/visuals";

const meta = {
  slug: "cui-vs-fci",
  title:
    "CUI vs FCI: What's the Difference? (With 12 Real Examples) — 2026",
  description:
    "The plain-English difference between Controlled Unclassified Information (CUI) and Federal Contract Information (FCI), with 12 real-world examples and the one-question test that decides which CMMC level you owe.",
  excerpt:
    "FCI triggers CMMC Level 1. CUI triggers CMMC Level 2. Mix them up and you'll either over-spend by $20k or under-comply on a federal contract.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cui vs fci",
    "fci vs cui",
    "controlled unclassified information",
    "federal contract information",
    "what is the difference between cui and fci",
    "cmmc cui",
    "cmmc fci",
    "cui examples",
    "fci examples",
  ],
  readingMinutes: 9,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "What is the difference between CUI and FCI?",
      answer:
        "FCI (Federal Contract Information) is routine non-public information you receive or generate under a federal contract — schedules, internal emails, pricing, statements of work. It has no special marking. CUI (Controlled Unclassified Information) is information the government has specifically designated for safeguarding, identified by a 'CUI' banner marking. FCI triggers CMMC Level 1 (15 safeguarding requirements, self-assessed). CUI triggers CMMC Level 2 (110 NIST SP 800-171 controls, C3PAO-assessed).",
    },
    {
      question: "Is CUI also FCI?",
      answer:
        "Technically yes — CUI is a subset of FCI. All CUI is FCI, but not all FCI is CUI. The distinction matters because CUI brings additional handling rules and triggers a much higher CMMC level. If you hold CUI, you also hold FCI, but your obligations follow the CUI rules.",
    },
    {
      question: "How do I know if I have CUI or just FCI?",
      answer:
        "Look at the documents. CUI is required to be marked with a 'CUI' banner at the top and bottom of the document (or as part of an electronic banner), often with a category code like CUI//SP-CTI or CUI//SP-EXPT. If there is no CUI marking on any of your federal contract documents, you almost certainly have FCI only — which means CMMC Level 1 applies, not Level 2.",
    },
    {
      question: "Can a contracting officer make information CUI verbally?",
      answer:
        "No. CUI must be designated in writing, typically through the contract itself (DFARS 252.204-7012 or a CUI clause), a Statement of Work, or a marked document. A verbal instruction does not create CUI obligations. If a contracting officer tells you something is 'sensitive', ask for the written CUI designation before treating it as Level 2 information.",
    },
    {
      question: "What if my contract has both CUI and FCI?",
      answer:
        "You're scoped at the higher level — CMMC Level 2. The DoD does not let you carve out FCI-only systems and treat them separately if they share a network or boundary with CUI systems. The cleanest answer is to either (a) implement Level 2 across the whole environment, or (b) build a separate, isolated CUI enclave so the rest of the business stays Level 1.",
    },
    {
      question: "Does FAR 52.204-21 apply to CUI?",
      answer:
        "Yes, but it's not enough on its own. FAR 52.204-21 establishes the 15 basic safeguarding requirements that protect FCI. When CUI is involved, DFARS 252.204-7012 layers on top and requires the 110 controls in NIST SP 800-171 — the foundation of CMMC Level 2. So a contract with CUI typically flows down both clauses.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the 30-second answer" },
  { id: "definitions", label: "What each one actually is" },
  { id: "test", label: "The one-question test" },
  { id: "examples", label: "12 real-world examples" },
  { id: "cmmc-impact", label: "Why it decides your CMMC level" },
  { id: "mixed", label: "What if I have both?" },
  { id: "next", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The 30-second answer">
        <p>
          <strong>FCI</strong> = routine federal-contract information. No
          special marking. Triggers <strong>CMMC Level 1</strong>.{" "}
          <br />
          <strong>CUI</strong> = the government has formally designated
          it as sensitive. Marked with a &ldquo;CUI&rdquo; banner.
          Triggers <strong>CMMC Level 2</strong>.
        </p>
        <p className="mt-2">
          The cost difference between getting this right and getting it
          wrong is roughly <strong>$20,000&ndash;$80,000</strong> in
          first-year compliance spend.
        </p>
      </Callout>

      <P>
        These two acronyms are the most-confused pair in federal
        compliance. They sound the same, the government uses them in the
        same sentence, and the contracts themselves rarely spell out
        which one you have. Get the answer wrong in either direction
        and you either overspend by a factor of ten or under-comply on
        an active contract.
      </P>

      <P>
        Below is the plain-English breakdown, twelve examples drawn from
        real contracts, and the single question that resolves 95% of the
        confusion in under a minute.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; which is which</H2>
      <TableSimple
        head={["", "FCI", "CUI"]}
        rows={[
          [
            "<strong>Stands for</strong>",
            "Federal Contract Information",
            "Controlled Unclassified Information",
          ],
          [
            "<strong>Defined in</strong>",
            "FAR 4.1901 / FAR 52.204-21",
            "32 CFR Part 2002 / DFARS 252.204-7012",
          ],
          [
            "<strong>Marking required?</strong>",
            "No marking. It's the default.",
            "Yes — must say 'CUI' on the document.",
          ],
          [
            "<strong>CMMC level</strong>",
            "Level 1 (15 requirements)",
            "Level 2 (110 NIST 800-171 controls)",
          ],
          [
            "<strong>Assessment</strong>",
            "Self-assessment + SPRS affirmation",
            "C3PAO assessment every 3 years",
          ],
          [
            "<strong>Typical cost</strong>",
            "$0&ndash;$5k (DIY) or $149&ndash;$297/mo (guided)",
            "$20k&ndash;$80k first year, $10k+/yr ongoing",
          ],
          [
            "<strong>Who has it?</strong>",
            "Anyone with a federal contract.",
            "A subset — typically DoD prime/sub work involving CTI, EXPT, or specific designated info.",
          ],
        ]}
      />

      <FCIvsCUI />

      <H2 id="definitions">What each one actually is</H2>

      <H3>FCI &mdash; Federal Contract Information</H3>
      <P>
        FCI is defined at <strong>FAR 4.1901</strong> as &ldquo;information,
        not intended for public release, that is provided by or generated
        for the Government under a contract to develop or deliver a
        product or service to the Government.&rdquo;
      </P>
      <P>
        In English: the routine non-public paperwork of doing federal
        business. It excludes information the government has cleared
        for public release (a press release, a SAM.gov posting) and
        simple transactional data (the dollar amount on an invoice).
        Everything else under a federal contract is, by default, FCI.
      </P>
      <P>
        FCI is <strong>not marked</strong>. There is no banner. No
        header. No special handling instructions. It is the default
        category for federal contract data &mdash; which is exactly why
        people miss it.
      </P>

      <H3>CUI &mdash; Controlled Unclassified Information</H3>
      <P>
        CUI is defined under <strong>Executive Order 13556</strong> and
        codified at <strong>32 CFR Part 2002</strong>. It is information
        the executive branch has specifically designated as requiring
        safeguarding or dissemination controls &mdash; short of
        classified, but more sensitive than ordinary FCI.
      </P>
      <P>
        Critically, CUI <strong>must be marked</strong>. A document
        carrying CUI bears a banner at the top and bottom (usually
        formatted like <code>CUI</code> or{" "}
        <code>CUI//SP-CTI</code>) and is governed by either the broad
        CUI rule (32 CFR 2002), the contract-specific clause (typically{" "}
        <strong>DFARS 252.204-7012</strong> for DoD work), or both.
      </P>

      <Callout tone="info" title="The hierarchy">
        <p>
          All CUI is also FCI. But not all FCI is CUI. CUI is a
          tightened, marked subset of the broader FCI universe. If you
          have CUI, you automatically also have FCI &mdash; but your
          obligations follow the stricter CUI rules.
        </p>
      </Callout>

      <H2 id="test">The one-question test</H2>
      <Callout tone="ok" title="Ask yourself this">
        <p className="font-serif text-xl italic leading-snug">
          &ldquo;Is there a CUI banner marking on any document the
          government has sent me under this contract?&rdquo;
        </p>
      </Callout>
      <P>
        If <strong>yes</strong>: you have CUI. CMMC Level 2 applies.
        Take it seriously &mdash; the assessment is performed by a
        third party (a C3PAO) and the gap between &ldquo;feels
        compliant&rdquo; and &ldquo;is compliant&rdquo; is wide.
      </P>
      <P>
        If <strong>no</strong>: you have FCI only. CMMC Level 1
        applies. The path is short: 15 safeguarding requirements, a
        self-assessment, and an annual SPRS affirmation. Most small
        contractors finish it in a week.
      </P>
      <P>
        If you&apos;re <strong>unsure</strong>: write to your
        contracting officer and ask in writing whether the contract
        involves CUI. CUI must be designated in writing &mdash; an
        absence of designation is a meaningful signal.
      </P>

      <H2 id="examples">Twelve real-world examples</H2>
      <P>
        Drawn from the kinds of contracts a small business actually
        signs. Identifiable details changed.
      </P>

      <H3>Examples of FCI (not CUI)</H3>
      <UL>
        <li>
          A statement of work emailed by a contracting officer for a
          $40k machined-parts order. No CUI marking. <strong>FCI</strong>.
        </li>
        <li>
          A delivery schedule on a federal task order. Not public, but
          unmarked. <strong>FCI</strong>.
        </li>
        <li>
          A non-public price quote you submitted on a federal RFP.{" "}
          <strong>FCI</strong>.
        </li>
        <li>
          A contract modification (Mod 4, extending the period of
          performance by 30 days). No marking. <strong>FCI</strong>.
        </li>
        <li>
          Internal email between two employees discussing the schedule
          on a federal contract. <strong>FCI</strong>.
        </li>
        <li>
          A NIST-style audit-friendly summary of your build process,
          shared with the prime &mdash; unmarked. <strong>FCI</strong>.
        </li>
      </UL>

      <H3>Examples of CUI</H3>
      <UL>
        <li>
          A DoD technical drawing for a non-classified subsystem with a
          banner reading <code>CUI//SP-CTI</code>. <strong>CUI</strong>{" "}
          (Controlled Technical Information).
        </li>
        <li>
          A spreadsheet of military service members&apos; names and
          duty stations marked <code>CUI//SP-PRVCY</code>.{" "}
          <strong>CUI</strong> (Privacy).
        </li>
        <li>
          Export-controlled engineering data marked{" "}
          <code>CUI//SP-EXPT</code>. <strong>CUI</strong>.
        </li>
        <li>
          A research dataset from a DoE national lab marked{" "}
          <code>CUI//SP-OUO</code> (Official Use Only).{" "}
          <strong>CUI</strong>.
        </li>
        <li>
          Critical infrastructure details for a federal facility,
          marked <code>CUI//SP-CRIT</code>. <strong>CUI</strong>.
        </li>
        <li>
          A draft DD Form 254 (security classification specification)
          shared by a prime, marked CUI. <strong>CUI</strong>.
        </li>
      </UL>

      <Callout tone="warn" title="Edge case: 'sensitive' is not a marking">
        <p>
          A contracting officer or prime sometimes calls information
          &ldquo;sensitive&rdquo; or &ldquo;for official use only&rdquo;
          in conversation. Without a written CUI designation or banner
          on the document, this is not CUI. Treat it carefully &mdash;
          but it doesn&apos;t change your CMMC level.
        </p>
      </Callout>

      <H2 id="cmmc-impact">Why it decides your CMMC level</H2>
      <P>
        CMMC has three levels. Which one applies to you is entirely
        determined by what kind of federal information you handle.
      </P>
      <TableSimple
        head={["Level", "What it covers", "Trigger"]}
        rows={[
          [
            "<strong>Level 1</strong>",
            "15 basic safeguarding requirements from FAR 52.204-21",
            "You handle FCI (no CUI)",
          ],
          [
            "<strong>Level 2</strong>",
            "110 controls from NIST SP 800-171 Rev 2",
            "You handle CUI",
          ],
          [
            "<strong>Level 3</strong>",
            "Level 2 + a subset of NIST SP 800-172 enhancements",
            "You handle CUI on a high-priority DoD program (rare)",
          ],
        ]}
      />
      <P>
        For most small defense contractors &mdash; machine shops, IT
        MSPs, R&amp;D firms, software vendors selling to DoD &mdash;
        the question is &ldquo;Level 1 or Level 2?&rdquo;. The
        FCI-vs-CUI test answers it definitively.
      </P>

      <Callout tone="info" title="The cost gap is real">
        <p>
          A typical Level 1 self-assessment costs nothing in cash and
          a week of focused effort. A Level 2 C3PAO assessment costs
          <strong> $20,000&ndash;$80,000</strong> the first year for a
          small business, plus another <strong>$10,000+</strong>
          annually for monitoring and recurring work. Knowing which
          applies to you is the most expensive single distinction in
          the entire CMMC universe.
        </p>
      </Callout>

      <H2 id="mixed">What if I have both?</H2>
      <P>
        Some contractors hold a mix of contracts: Level 1 work for one
        prime, Level 2 work for another. The DoD&apos;s position is
        that <strong>scope follows the data</strong>. You have two
        legitimate paths:
      </P>
      <OL>
        <li>
          <strong>Treat the whole business as Level 2.</strong> Simpler
          to document. More expensive. Common for contractors whose
          entire revenue is federal.
        </li>
        <li>
          <strong>Build a separate CUI enclave.</strong> Isolate
          everything that touches CUI on its own network, with its own
          set of users, devices, and policies. The rest of the
          business stays Level 1. Cheaper long-term, more work to set
          up. This is what mature small contractors typically do.
        </li>
      </OL>
      <P>
        Either way: <strong>do not</strong> let CUI and FCI mingle on
        the same general-purpose laptop or shared drive without
        Level-2 protections. The cleanest physical separation is the
        cheapest insurance you can buy.
      </P>

      <H2 id="next">What to do this week</H2>
      <OL>
        <li>
          <strong>Open your last three federal contracts.</strong> Search
          them for the strings &ldquo;CUI&rdquo; and &ldquo;DFARS
          252.204-7012&rdquo;. Their presence is your first signal.
        </li>
        <li>
          <strong>Look at the documents the government sent you.</strong>{" "}
          Are any of them marked &ldquo;CUI&rdquo; at the top or
          bottom? If not &mdash; you almost certainly have FCI only.
        </li>
        <li>
          <strong>Decide your CMMC level.</strong> FCI only &rarr;
          Level 1. CUI &rarr; Level 2.
        </li>
        <li>
          <strong>Start there.</strong> For Level 1, take our{" "}
          <Link
            href="/sprs-check"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            free SPRS quiz
          </Link>{" "}
          and grab the{" "}
          <Link
            href="/cmmc-level-1/checklist"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            printable Level 1 checklist
          </Link>
          .
        </li>
      </OL>

      <Callout tone="ok" title="The good news">
        <p>
          About <strong>80% of small defense contractors</strong> hold
          FCI only &mdash; not CUI. The path is short, the cost is
          low, and the certification is self-attested. The first job
          is to confirm where you stand. The second job is to stop
          paying consultants to tell you the same thing.
        </p>
      </Callout>

      <H2 id="faq">Frequently asked questions</H2>
      {meta.faq?.map((f) => (
        <div key={f.question} className="mt-8">
          <H3>{f.question}</H3>
          <P>{f.answer}</P>
        </div>
      ))}
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
