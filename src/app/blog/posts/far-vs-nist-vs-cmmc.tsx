import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import {
  Callout,
  H2,
  H3,
  OL,
  P,
  Prose,
  Quote,
  TableSimple,
  TOC,
  UL,
} from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "far-vs-nist-vs-cmmc-level-1-vs-level-2-comparison",
  title:
    "FAR 52.204-21 vs NIST 800-171 vs CMMC Level 1 vs Level 2: A Plain-English Comparison",
  description:
    "Four federal cybersecurity frameworks, one acronym soup. Which one applies to your DoD work, what it requires, and which contracts you can bid on at each level.",
  excerpt:
    "Four overlapping frameworks, one decision: which one do you actually have to comply with? A side-by-side comparison for small DoD contractors.",
  datePublished: "2026-05-03",
  category: "Frameworks",
  keywords: [
    "far 52.204-21 vs nist 800-171",
    "cmmc level 1 vs level 2",
    "nist 800-171 vs cmmc",
    "far vs cmmc",
    "cmmc levels explained",
    "fci vs cui",
  ],
  readingMinutes: 11,
  author: {
    name: "Custodia Compliance Team",
    title: "Carnegie Mellon-trained information security engineers",
  },
};

const TOC_ITEMS = [
  { id: "data-types", label: "Start here: FCI vs CUI" },
  { id: "far", label: "FAR 52.204-21 — the original 17 practices" },
  { id: "nist", label: "NIST SP 800-171 — the 110-control standard" },
  { id: "cmmc-l1", label: "CMMC Level 1 — self-attestation against the 17" },
  { id: "cmmc-l2", label: "CMMC Level 2 — assessed against the 110" },
  { id: "comparison", label: "Side-by-side comparison" },
  { id: "decision", label: "Decision tree: which one applies to you" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <P>
        Federal cybersecurity acronyms are an industry by themselves.
        Contractors get pulled into FAR 52.204-21, NIST 800-171, DFARS
        7012, CMMC Level 1, CMMC Level 2, FedRAMP, and StateRAMP &mdash;
        sometimes all in the same week, often by people who can&apos;t
        explain the difference. This post is the plain-English map.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="data-types">Start here: FCI vs CUI</H2>
      <P>
        Before any of this matters, figure out what kind of government
        data you handle. The framework that applies depends entirely on
        the data type.
      </P>
      <TableSimple
        head={["Data type", "Definition", "Examples"]}
        rows={[
          [
            "<strong>FCI</strong> &mdash; Federal Contract Information",
            "Information not intended for public release that&apos;s provided by or generated for the government under a contract.",
            "Statement of work, contract correspondence, delivery schedules, internal status reports.",
          ],
          [
            "<strong>CUI</strong> &mdash; Controlled Unclassified Information",
            "Information that requires safeguarding under a specific law, regulation, or government-wide policy.",
            "Technical data subject to ITAR, controlled technical info under DFARS 252.204-7012, PII under the Privacy Act, draft solicitations.",
          ],
        ]}
      />
      <Callout tone="info" title="The 90% rule">
        About <strong>90%</strong> of small DoD contractors handle FCI but
        not CUI. If your contract paperwork doesn&apos;t mention DFARS
        252.204-7012, ITAR, or specific export-controlled technical data,
        you&apos;re almost certainly an FCI-only shop. That puts you in
        the CMMC Level 1 / FAR 52.204-21 lane &mdash; not Level 2.
      </Callout>

      <H2 id="far">FAR 52.204-21 — the original 17 practices</H2>
      <P>
        <strong>FAR 52.204-21</strong> &mdash; &ldquo;Basic Safeguarding of
        Covered Contractor Information Systems&rdquo; &mdash; is the
        clause the federal government has been writing into contracts
        since 2016 for any contractor handling FCI. It defines the
        baseline 17 cybersecurity practices that became, almost verbatim,
        CMMC Level 1.
      </P>
      <P>
        FAR 52.204-21 is a <strong>contract clause</strong>. There&apos;s
        no submission or registration. If you signed a contract with the
        clause in it, you&apos;ve agreed to comply. Most contractors
        don&apos;t notice until a prime asks for proof.
      </P>

      <H2 id="nist">NIST SP 800-171 — the 110-control standard</H2>
      <P>
        <strong>NIST Special Publication 800-171</strong> is the National
        Institute of Standards and Technology&apos;s standard for protecting
        CUI in non-federal systems. It defines 110 controls across 14
        families, scored against the SPRS rubric (110 maximum, deductions
        per missing control). NIST 800-171 is required by{" "}
        <strong>DFARS 252.204-7012</strong> for any contractor handling
        CUI.
      </P>
      <P>
        Important: NIST 800-171 is what your{" "}
        <Link
          href="/blog/sprs-score-explained-and-how-to-respond-to-prime"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          SPRS score
        </Link>{" "}
        measures. The 17 FAR practices are a strict subset of the 110
        NIST controls. If you implement all 110, you&apos;ve also
        implemented the 17.
      </P>

      <H2 id="cmmc-l1">CMMC Level 1 — self-attestation against the 17</H2>
      <P>
        <strong>CMMC Level 1</strong> took the 17 FAR 52.204-21 practices,
        added a self-attestation requirement, and made it{" "}
        <strong>annual</strong>. The DoD&apos;s final rule (32 CFR 170,
        effective Dec 16, 2024) requires:
      </P>
      <UL>
        <li>Annual self-assessment against all 17 practices</li>
        <li>
          Annual affirmation in SPRS, signed by a senior official of the
          contractor (i.e., your CEO/COO &mdash; their name on a federal
          attestation)
        </li>
        <li>System Security Plan (SSP) documenting how each practice is implemented</li>
        <li>Affirmation memo retained for record</li>
      </UL>
      <P>
        No third-party assessor required. No assessment cost. Just a
        signed self-attestation by a senior official, and the False Claims
        Act exposure that comes with one.
      </P>

      <H2 id="cmmc-l2">CMMC Level 2 — assessed against the 110</H2>
      <P>
        <strong>CMMC Level 2</strong> requires implementation of all 110
        NIST 800-171 controls and is the floor for any contractor handling
        CUI. There are two sub-tiers:
      </P>
      <OL>
        <li>
          <strong>Level 2 self-assessment</strong> &mdash; permitted for
          some lower-risk CUI scenarios. Self-attestation, like L1.
        </li>
        <li>
          <strong>Level 2 third-party assessment</strong> (the common
          case) &mdash; required for prioritized CUI work. Conducted by a{" "}
          <strong>C3PAO</strong> (Certified Third-Party Assessment
          Organization). Typical engagement: 6&ndash;9 months,{" "}
          <strong>$80,000&ndash;$250,000</strong> for an SMB.
        </li>
      </OL>
      <Callout tone="warn" title="Custodia is L1-only">
        Custodia handles <strong>CMMC Level 1 only</strong>. We do not
        scope, prepare, or remediate against CMMC Level 2 / DFARS 7012 /
        FedRAMP. If you handle CUI, you need a different kind of partner
        &mdash; a 3PAO-aligned firm that runs 6&ndash;9-month engagements.
        We&apos;ll happily refer you, but it&apos;s not what we do.
      </Callout>

      <H2 id="comparison">Side-by-side comparison</H2>
      <TableSimple
        head={[
          "",
          "FAR 52.204-21",
          "NIST 800-171",
          "CMMC Level 1",
          "CMMC Level 2",
        ]}
        rows={[
          [
            "<strong>Data covered</strong>",
            "FCI",
            "CUI",
            "FCI",
            "CUI",
          ],
          [
            "<strong>Number of controls</strong>",
            "17",
            "110",
            "17",
            "110",
          ],
          [
            "<strong>Assessment type</strong>",
            "Contract clause; no formal assessment",
            "Self-assessment with SPRS score",
            "Annual self-attestation",
            "Self or 3PAO depending on tier",
          ],
          [
            "<strong>Frequency</strong>",
            "Continuous (contract obligation)",
            "Every 3 years",
            "Annual",
            "Every 3 years (3PAO) / annual self",
          ],
          [
            "<strong>Filed in SPRS?</strong>",
            "No",
            "Yes (Basic Assessment score)",
            "Yes (CMMC Status)",
            "Yes (CMMC Status)",
          ],
          [
            "<strong>Senior official sign-off?</strong>",
            "Implied",
            "Yes",
            "Yes &mdash; FCA exposure",
            "Yes &mdash; FCA exposure",
          ],
          [
            "<strong>Typical cost (SMB)</strong>",
            "$0&ndash;$5K (template work)",
            "$10K&ndash;$60K",
            "$0&ndash;$10K (SaaS) / $9K&ndash;$30K (consultant)",
            "$80K&ndash;$250K (3PAO engagement)",
          ],
          [
            "<strong>Custodia covers it?</strong>",
            "<strong>Yes</strong>",
            "No",
            "<strong>Yes</strong>",
            "No",
          ],
        ]}
      />

      <H2 id="decision">Decision tree: which one applies to you</H2>
      <OL>
        <li>
          <strong>Do you have any DoD contract paperwork?</strong>{" "}
          If no, none of this applies (yet). If yes, continue.
        </li>
        <li>
          <strong>Does your contract include DFARS 252.204-7012?</strong>{" "}
          If yes &mdash; you handle CUI, you need NIST 800-171 / CMMC L2.
          If no, continue.
        </li>
        <li>
          <strong>Does your contract include FAR 52.204-21?</strong>{" "}
          If yes &mdash; you handle FCI, you need CMMC Level 1. (This is
          the most common case for small DoD contractors.)
        </li>
        <li>
          <strong>You don&apos;t see either clause but a prime asked for a SPRS score?</strong>{" "}
          Get on a call with the prime&apos;s small-business liaison and
          ask which clause applies. Then come back here.
        </li>
      </OL>
      <P>
        If you landed on CMMC Level 1 in step 3, you&apos;re in the right
        place. The{" "}
        <Link
          href="/blog/cmmc-level-1-17-practices-explained"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          17-practice walkthrough
        </Link>{" "}
        is your next read, or skip the reading and take the{" "}
        <Link
          href="/sprs-check"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          free 4-minute SPRS quiz
        </Link>{" "}
        to see where you stand.
      </P>

      <H2 id="faq">FAQ</H2>

      <H3>If I have CMMC Level 2, do I also need Level 1?</H3>
      <P>
        No. Level 2 supersedes Level 1. If you&apos;re assessed at L2,
        the 17 L1 practices are part of that scope.
      </P>

      <H3>Can I do CMMC Level 2 self-assessment instead of paying a 3PAO?</H3>
      <P>
        Only for the subset of L2 contracts the DoD has designated as
        eligible for self-assessment &mdash; typically lower-risk CUI.
        Most prioritized contracts require a C3PAO assessment.
      </P>

      <H3>What about FedRAMP?</H3>
      <P>
        FedRAMP is for cloud service providers selling to the federal
        government. It&apos;s a different regime entirely. If you&apos;re
        not a CSP selling SaaS to federal agencies, you don&apos;t need it.
      </P>

      <H3>Does StateRAMP affect DoD work?</H3>
      <P>
        No. StateRAMP is for cloud services sold to state and local
        governments. Federal DoD contractors are unaffected.
      </P>

      <H3>What&apos;s the cheapest path through CMMC Level 1?</H3>
      <P>
        Self-led with templates and SaaS. Custodia&apos;s entire reason
        for existing is that {`L1 doesn't justify a $9k–$30k consultant`}
        engagement when it&apos;s ultimately a structured data-collection
        problem.{" "}
        <Link
          href="/blog/cmmc-level-1-cost-diy-vs-consultant-vs-saas"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          See the cost comparison.
        </Link>
      </P>

      <Quote cite="The Custodia Compliance Team">
        The L1 vs L2 question almost always comes down to the data type.
        If your contract doesn&apos;t flow CUI down, you don&apos;t need
        the $150,000 engagement. You need a week and a checklist.
      </Quote>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
