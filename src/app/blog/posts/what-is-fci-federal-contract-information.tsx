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
  slug: "what-is-fci-federal-contract-information",
  title:
    "What Is FCI? The 90-Second Definition That Decides Your CMMC Level (2026)",
  description:
    "Federal Contract Information (FCI), defined in plain English, with the exact regulation citation, six real examples, and the single question that tells you whether what you're holding is FCI, CUI, or neither. Updated for 2026.",
  excerpt:
    "FCI is the routine non-public information you handle under a federal contract. It's what triggers CMMC Level 1 — and it's almost certainly already in your inbox.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "CMMC Level 1",
  keywords: [
    "what is fci",
    "federal contract information",
    "fci definition",
    "fci vs cui",
    "far 4.1901",
    "cmmc level 1 fci",
    "fci examples",
  ],
  readingMinutes: 8,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "What is Federal Contract Information (FCI)?",
      answer:
        "Federal Contract Information (FCI) is non-public information provided by or generated for the federal government under a contract to develop or deliver a product or service. It is defined in FAR 4.1901 and excludes information the government has cleared for public release (like a press release) and simple transactional data (like an invoice). FCI is the trigger for CMMC Level 1.",
    },
    {
      question: "What is an example of FCI?",
      answer:
        "Common examples of FCI include: a statement of work emailed by a contracting officer, a delivery schedule on a federal task order, internal correspondence about a federal contract, pricing details on a non-public proposal, technical specifications for non-classified parts, and a contract modification. None of these typically carry a CUI marking — that is what makes them FCI rather than CUI.",
    },
    {
      question: "What is the difference between FCI and CUI?",
      answer:
        "FCI is non-public contract information without a special government designation. CUI (Controlled Unclassified Information) is information the government has specifically designated for safeguarding, identified by a banner marking like CUI//SP-EXPT on the document. FCI triggers CMMC Level 1 (15 safeguarding requirements, self-assessed). CUI triggers CMMC Level 2 (110 NIST SP 800-171 controls, C3PAO-assessed).",
    },
    {
      question: "Is an email from a federal contracting officer FCI?",
      answer:
        "Usually yes. If the email contains non-public information about the contract — schedules, pricing, technical direction, performance feedback, or instructions for delivery — it is FCI under FAR 4.1901, and the system that received it falls inside the CMMC Level 1 scope. Routine administrative emails that contain only public information are not FCI.",
    },
    {
      question: "Does FCI apply to civilian agency contracts?",
      answer:
        "Yes. FAR 52.204-21 (the clause that defines the 15 safeguarding requirements for FCI) applies to all federal contractors above the micro-purchase threshold — DoD and civilian. The CMMC affirmation requirement in SPRS, however, is currently a DoD program. Civilian-only contractors still owe the safeguarding requirements as a matter of contract compliance.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — FCI in 90 seconds" },
  { id: "definition", label: "The actual regulatory definition" },
  { id: "examples", label: "Six examples (and three things FCI isn't)" },
  { id: "fci-vs-cui", label: "FCI vs CUI: the one-question test" },
  { id: "why-it-matters", label: "Why FCI matters: it triggers CMMC Level 1" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          <strong>Federal Contract Information (FCI)</strong> is non-public
          information you receive or generate <em>under</em> a federal
          contract. Defined at <strong>FAR 4.1901</strong>. It is not
          marked with anything special &mdash; it&apos;s the routine
          paperwork of doing federal business: schedules, pricing, scopes
          of work, contracting-officer emails. If you handle FCI,{" "}
          <strong>CMMC Level 1 applies to you</strong>.
        </p>
      </Callout>

      <P>
        Of every term in the CMMC universe, <strong>FCI</strong> is the
        one that decides the most and explains the least. The acronym
        sounds technical. The reality is mundane: FCI is almost certainly
        already sitting in your inbox, on your laptop, and printed in a
        folder on your desk. This post is the plain-English walkthrough
        so you can identify it on sight.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; FCI in 90 seconds</H2>
      <UL>
        <li>
          <strong>FCI = Federal Contract Information.</strong> Non-public
          info you receive or create under a federal contract.
        </li>
        <li>
          <strong>It&apos;s the default.</strong> If you have a federal
          contract, you almost certainly have FCI.
        </li>
        <li>
          <strong>It is NOT marked.</strong> No banner. No header. No
          special handling instructions. Unlike CUI.
        </li>
        <li>
          <strong>It triggers CMMC Level 1.</strong> The 15 FAR 52.204-21
          safeguarding requirements, self-assessed annually.
        </li>
        <li>
          <strong>It is NOT CUI.</strong> CUI is information the
          government has specifically designated for protection.
        </li>
      </UL>

      <H2 id="definition">The actual regulatory definition</H2>
      <P>
        The authoritative definition is in{" "}
        <a
          href="https://www.acquisition.gov/far/4.1901"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          FAR 4.1901
        </a>
        . The clean version:
      </P>
      <Callout tone="info" title="FAR 4.1901 — Federal Contract Information">
        <p>
          <em>
            &ldquo;Information, not intended for public release, that is
            provided by or generated for the Government under a contract
            to develop or deliver a product or service to the
            Government, but not including information provided by the
            Government to the public &hellip; or simple transactional
            information, such as necessary to process payments.&rdquo;
          </em>
        </p>
      </Callout>
      <P>Three pieces matter:</P>
      <OL>
        <li>
          <strong>Not intended for public release.</strong> If the
          government has cleared it &mdash; a press release, a
          published FAQ on agency.gov, a SAM.gov public solicitation
          notice &mdash; it is <em>not</em> FCI.
        </li>
        <li>
          <strong>Under a contract.</strong> It has to come from or be
          generated for an active federal contract. Information from a
          state contract, a commercial contract, or pre-award marketing
          conversations is not FCI.
        </li>
        <li>
          <strong>Not pure transactional data.</strong> An invoice or
          payment confirmation by itself is not FCI. Almost everything
          else is.
        </li>
      </OL>

      <H2 id="examples">Six examples (and three things FCI isn&apos;t)</H2>
      <P>The fastest way to internalize FCI is to see it next to its near-misses.</P>
      <TableSimple
        head={["Document", "FCI?", "Why"]}
        rows={[
          [
            "Statement of work from the contracting officer",
            "<strong>Yes</strong>",
            "Non-public, given to you under the contract.",
          ],
          [
            "Delivery schedule for non-classified parts",
            "<strong>Yes</strong>",
            "Generated for the government under the contract.",
          ],
          [
            "Email thread negotiating change-order pricing",
            "<strong>Yes</strong>",
            "Non-public contract correspondence.",
          ],
          [
            "Technical drawing for a routine MRO part (unmarked)",
            "<strong>Yes</strong>",
            "Contract deliverable; no CUI marking = FCI, not CUI.",
          ],
          [
            "Internal performance feedback from the COR",
            "<strong>Yes</strong>",
            "Non-public information about the contract.",
          ],
          [
            "Subcontract flow-down language and the prime's task list",
            "<strong>Yes</strong>",
            "FCI flows down to subs; the prime's package is yours to protect.",
          ],
          [
            "The public SAM.gov solicitation notice itself",
            "No",
            "Cleared for public release by the government.",
          ],
          [
            "A press release announcing the award",
            "No",
            "Public release by definition.",
          ],
          [
            "A Treasury-issued payment confirmation",
            "No",
            "Pure transactional data.",
          ],
          [
            "Anything marked <strong>CUI</strong>",
            "No &mdash; it&apos;s CUI",
            "Different category. Triggers Level 2.",
          ],
        ]}
      />

      <H2 id="fci-vs-cui">FCI vs CUI: the one-question test</H2>
      <P>
        This is the question that decides whether your CMMC obligation is
        Level 1 or Level 2 (or higher):
      </P>
      <Callout tone="warn" title="The 30-second test">
        <p>
          Open every document, drawing, dataset, and email attachment
          you&apos;ve received from this contract. Look at the top of
          each page or the header of each file. <strong>If you see the
          word CUI or the word CONTROLLED anywhere, that piece is CUI,
          not FCI.</strong>{" "}
          If you also have DFARS clause 252.204-7012 in your contract,
          your contract anticipates CUI even if no documents have
          arrived yet.
        </p>
      </Callout>
      <FCIvsCUI />
      <P>
        For an exhaustive comparison see our{" "}
        <Link
          href="/blog/cmmc-level-1-vs-level-2"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          CMMC Level 1 vs Level 2 guide
        </Link>
        .
      </P>

      <H2 id="why-it-matters">Why FCI matters: it triggers CMMC Level 1</H2>
      <P>
        The presence of FCI on your systems is what makes you a CMMC
        Level 1 contractor. The DoD&apos;s rule at{" "}
        <a
          href="https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-170"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          32 CFR Part 170
        </a>{" "}
        defines Level 1 as the tier that protects FCI. The implementing
        clause &mdash; FAR 52.204-21(b)(1) &mdash; lists{" "}
        <strong>15 safeguarding requirements</strong> you must meet on
        any system that processes, stores, or transmits FCI. The
        requirements have been in federal contracts since 2016; what
        changed with CMMC is the annual senior-official affirmation
        posted in SPRS.
      </P>
      <Callout tone="info" title="The scope rule">
        <p>
          Only the systems that touch FCI are in CMMC Level 1 scope. If
          your accounting laptop never sees an FCI document, it&apos;s
          out of scope. If it does, it&apos;s in. Drawing this boundary
          honestly is the first step of any Level 1 assessment.
        </p>
      </Callout>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          <strong>Audit your inbox.</strong> Search your email for the
          contracting officer&apos;s name and the contract number. Every
          non-public attachment you find is FCI.
        </li>
        <li>
          <strong>Identify the systems</strong> those documents touch:
          which email account, which laptop, which file share, which
          backup. Those systems are in your CMMC Level 1 scope.
        </li>
        <li>
          <strong>Take the free{" "}
          <Link
            href="/cmmc-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            CMMC check
          </Link>
          </strong>{" "}
          to confirm Level 1 actually applies.
        </li>
        <li>
          <strong>
            <Link
              href="/bid-digest"
              className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
            >
              Subscribe to the Monday Bid Digest
            </Link>
          </strong>{" "}
          &mdash; weekly Level 1-fit federal opportunities, free.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>What is Federal Contract Information (FCI)?</H3>
      <P>
        Non-public information you receive or generate under a federal
        contract. Defined at FAR 4.1901. Triggers CMMC Level 1.
      </P>
      <H3>Is an email from a contracting officer FCI?</H3>
      <P>
        Usually yes &mdash; any non-public contract correspondence
        (schedules, pricing, technical direction, feedback) is FCI under
        FAR 4.1901.
      </P>
      <H3>Is FCI the same as CUI?</H3>
      <P>
        No. CUI is information the government has specifically designated
        for safeguarding, identified by a banner marking. FCI has no
        marking. CUI triggers Level 2; FCI triggers Level 1.
      </P>
      <H3>Does FCI apply to civilian agency contracts?</H3>
      <P>
        Yes. FAR 52.204-21 applies to all federal contracts above the
        micro-purchase threshold. The SPRS affirmation piece is currently
        DoD only.
      </P>
      <H3>If I never get a document marked CUI, am I always Level 1?</H3>
      <P>
        Almost always &mdash; unless your contract contains DFARS
        252.204-7012, which anticipates CUI even before the first
        document arrives. Check the clauses in your contract.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
