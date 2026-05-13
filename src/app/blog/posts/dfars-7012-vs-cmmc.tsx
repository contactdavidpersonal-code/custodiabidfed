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

const meta = {
  slug: "dfars-7012-vs-cmmc",
  title:
    "DFARS 252.204-7012 vs CMMC: Which One Applies to Me? (2026 Guide)",
  description:
    "DFARS 7012 has been the DoD's cybersecurity clause since 2017. CMMC is the new audit framework that proves you actually meet it. Here's what each one is, how they relate, and which one a small contractor needs to act on first.",
  excerpt:
    "DFARS 7012 says 'protect CUI to NIST 800-171.' CMMC says 'prove it.' One is the rule. The other is the audit. Here's how they fit together.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "Regulations",
  keywords: [
    "dfars 252.204-7012",
    "dfars 7012",
    "dfars vs cmmc",
    "cmmc vs dfars",
    "dfars 7012 cmmc",
    "what is dfars 7012",
    "dfars 252.204-7020",
    "dfars 252.204-7021",
    "nist 800-171 dfars",
  ],
  readingMinutes: 9,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Is DFARS 7012 the same as CMMC?",
      answer:
        "No. DFARS 252.204-7012 is the contract clause that has required DoD contractors to safeguard CUI under NIST SP 800-171 since 2017. CMMC is a newer assessment program (codified at 32 CFR Part 170 and 48 CFR DFARS 252.204-7021) that verifies compliance with those same NIST controls through a tiered, audited certification. DFARS 7012 sets the rule; CMMC enforces the rule.",
    },
    {
      question: "Do I still need to comply with DFARS 7012 if I have CMMC certification?",
      answer:
        "Yes. CMMC does not replace DFARS 7012 — it builds on it. DFARS 7012 still flows down through DoD contracts and still requires you to implement NIST SP 800-171, report cyber incidents within 72 hours, and submit malicious software to DC3. CMMC adds the certification, the audited assessment, and the SPRS posting requirement on top.",
    },
    {
      question: "Does DFARS 252.204-7012 apply to all DoD contractors?",
      answer:
        "It applies to any DoD contract or subcontract that involves Covered Defense Information (a category that includes CUI). It does not apply to commercial-off-the-shelf (COTS) items, and it does not apply to contracts that involve only FCI (no CUI). If your DoD contracts include CUI — typically signaled by a CUI marking or a DFARS 7012 clause in the contract — it applies.",
    },
    {
      question: "What's the difference between DFARS 7012, 7019, 7020, and 7021?",
      answer:
        "DFARS 7012 (since 2017) requires you to implement NIST SP 800-171 to protect CUI. DFARS 7019 (since 2020) requires you to upload a self-assessed SPRS score reflecting your NIST 800-171 implementation. DFARS 7020 (since 2020) requires you to allow the DoD to conduct a verification assessment. DFARS 7021 (since 2024, finalized 2025) is the CMMC clause that requires the formal certification at Level 1, 2, or 3 depending on the contract.",
    },
    {
      question: "If I only handle FCI, does DFARS 7012 apply?",
      answer:
        "No. DFARS 7012 protects CUI, not FCI. If you only handle FCI (the routine, unmarked non-public information of doing federal business), DFARS 7012 does not flow down to you and CMMC Level 1 — not Level 2 — is what you owe. The trigger for DFARS 7012 is CUI; the trigger for CMMC Level 1 is FCI alone.",
    },
    {
      question: "Has DFARS 7012 changed in 2025 or 2026?",
      answer:
        "The 7012 clause itself has been stable since 2017, but the surrounding ecosystem has changed substantially. DFARS 252.204-7021 (the CMMC clause) finalized in 2025 and now flows into contracts on a rolling schedule. DoD has also clarified enforcement against false self-assessments via the DOJ Civil Cyber-Fraud Initiative. The substantive obligation under 7012 — implement NIST 800-171, report incidents in 72 hours — is unchanged.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — what each one is" },
  { id: "dfars-7012", label: "What DFARS 7012 actually says" },
  { id: "cmmc", label: "What CMMC actually is" },
  { id: "relationship", label: "How the two fit together" },
  { id: "dash-family", label: "The 7012/7019/7020/7021 family" },
  { id: "small-biz", label: "What this means for a small contractor" },
  { id: "next", label: "Your next move" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The 30-second answer">
        <p>
          <strong>DFARS 252.204-7012</strong> is the rule: protect
          Controlled Unclassified Information using NIST SP 800-171, and
          report cyber incidents within 72 hours. Active since 2017.
        </p>
        <p className="mt-2">
          <strong>CMMC</strong> is the audit: a tiered certification
          (Levels 1, 2, 3) that <em>proves</em> you meet the rule.
          Codified at 32 CFR Part 170 in 2024 and flowing into
          contracts since 2025 via DFARS 252.204-<strong>7021</strong>.
        </p>
        <p className="mt-2">
          You do not pick one. <strong>You comply with both.</strong>
        </p>
      </Callout>

      <P>
        Small defense contractors hear &ldquo;DFARS&rdquo; and
        &ldquo;CMMC&rdquo; from different consultants, in different
        contexts, on different invoices &mdash; and it&apos;s easy to
        come away thinking they&apos;re two competing frameworks. They
        aren&apos;t. They&apos;re two layers of the same stack. This
        post explains exactly how they relate, what each one demands,
        and which one you actually need to act on first.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; which is which</H2>
      <TableSimple
        head={["", "DFARS 252.204-7012", "CMMC"]}
        rows={[
          [
            "<strong>What it is</strong>",
            "A contract clause (the rule)",
            "An assessment program (the audit)",
          ],
          [
            "<strong>In effect since</strong>",
            "December 2017",
            "Rule final 2024, contract flow-down began 2025",
          ],
          [
            "<strong>Triggered by</strong>",
            "Contracts involving CUI",
            "FCI (Level 1) or CUI (Level 2 / 3)",
          ],
          [
            "<strong>What it requires</strong>",
            "Implement NIST SP 800-171 + 72-hour incident reporting",
            "A certified assessment proving you meet the controls",
          ],
          [
            "<strong>How you comply</strong>",
            "Self-attestation under contract",
            "Self-assessment (L1), C3PAO assessment (L2), DIBCAC (L3)",
          ],
          [
            "<strong>Who enforces</strong>",
            "DoD contracting officers + DOJ (False Claims Act)",
            "The Cyber AB (accreditation body) + DoD CIO",
          ],
        ]}
      />

      <H2 id="dfars-7012">What DFARS 252.204-7012 actually says</H2>
      <P>
        DFARS 7012 is one clause buried in the Defense Federal
        Acquisition Regulation Supplement, but it carries the entire
        DoD&apos;s pre-CMMC cybersecurity regime. The clause has three
        substantive obligations:
      </P>

      <H3>1. Implement NIST SP 800-171</H3>
      <P>
        You must provide &ldquo;adequate security&rdquo; for systems
        that hold Covered Defense Information &mdash; defined as
        implementing the 110 security requirements in{" "}
        <strong>NIST Special Publication 800-171</strong>. These cover
        access control, audit logging, configuration management,
        incident response, media protection, personnel security,
        physical protection, and more.
      </P>

      <H3>2. Report cyber incidents within 72 hours</H3>
      <P>
        If you discover a cyber incident affecting a covered system or
        CUI, you must report it to <strong>DoD Cyber Crime Center
        (DC3)</strong> within <strong>72 hours</strong> of discovery.
        This is a hard deadline. The report goes to{" "}
        <code>dibnet.dod.mil</code>.
      </P>

      <H3>3. Submit malicious software</H3>
      <P>
        If you isolate malicious software in connection with the
        incident, you submit it to DC3 for analysis &mdash; encrypted
        and through their portal.
      </P>

      <Callout tone="info" title="The 'system security plan + POAM' loophole that wasn't">
        <p>
          DFARS 7012 originally allowed contractors to claim compliance
          if they had a System Security Plan (SSP) and Plan of Action
          &amp; Milestones (POAM) showing progress toward the 110
          controls. For years, that was the working interpretation. The
          DOJ&apos;s 2022 Civil Cyber-Fraud Initiative and a string of
          False Claims Act settlements have made clear: an SSP and POAM
          is not a substitute for actual implementation. CMMC closes
          that gap by making the implementation auditable.
        </p>
      </Callout>

      <H2 id="cmmc">What CMMC actually is</H2>
      <P>
        CMMC stands for <strong>Cybersecurity Maturity Model
        Certification</strong>. It is a certification program codified
        in <strong>32 CFR Part 170</strong> (the substance) and flowed
        into contracts through <strong>DFARS 252.204-7021</strong>{" "}
        (the clause). The DoD&apos;s Q&amp;A is unambiguous: CMMC is
        the verification mechanism for the same NIST 800-171 controls
        DFARS 7012 has required since 2017.
      </P>

      <P>
        CMMC has three levels, tiered to the sensitivity of the
        information involved:
      </P>
      <TableSimple
        head={["Level", "What it covers", "Who assesses", "Typical cost"]}
        rows={[
          [
            "<strong>Level 1</strong>",
            "15 basic safeguarding requirements (FAR 52.204-21). Protects FCI.",
            "Self-assessment + annual SPRS affirmation",
            "$0&ndash;$5k (DIY) · $149/mo guided",
          ],
          [
            "<strong>Level 2</strong>",
            "110 controls from NIST SP 800-171 Rev 2. Protects CUI.",
            "C3PAO (third-party) assessment every 3 years",
            "$20k&ndash;$80k year 1",
          ],
          [
            "<strong>Level 3</strong>",
            "Level 2 + a subset of NIST SP 800-172 enhancements. High-priority CUI.",
            "DIBCAC (government) assessment",
            "$100k+ year 1",
          ],
        ]}
      />

      <Callout tone="ok" title="Why CMMC exists">
        <p>
          The DoD wanted a way to know &mdash; with audited evidence
          &mdash; that the 200,000+ contractors in the Defense
          Industrial Base were actually doing the security work they had
          contractually claimed to do for the better part of a decade.
          CMMC is that audit.
        </p>
      </Callout>

      <H2 id="relationship">How DFARS 7012 and CMMC fit together</H2>
      <P>
        Picture it as a two-story building. DFARS 7012 is the
        foundation; CMMC is the inspector that signs off on the
        foundation.
      </P>
      <UL>
        <li>
          <strong>Same controls.</strong> CMMC Level 2 = the 110 NIST
          SP 800-171 controls that DFARS 7012 has required since 2017.
          You aren&apos;t doing new security work for CMMC; you&apos;re
          proving what you should have been doing.
        </li>
        <li>
          <strong>Added enforcement.</strong> CMMC adds a tiered,
          audited certification &mdash; replacing the SSP+POAM
          self-attestation that DFARS 7012 alone allowed.
        </li>
        <li>
          <strong>Layered, not replaced.</strong> Both clauses flow
          into modern DoD contracts. You comply with DFARS 7012
          obligations <em>and</em> hold the CMMC certification.
        </li>
        <li>
          <strong>Level 1 contractors get a break.</strong> If your
          contracts involve FCI only (no CUI), DFARS 7012 doesn&apos;t
          apply to you. You only owe CMMC Level 1 &mdash; 15
          requirements, self-assessed.
        </li>
      </UL>

      <H2 id="dash-family">
        The 7012 / 7019 / 7020 / 7021 family
      </H2>
      <P>
        DFARS 7012 doesn&apos;t live alone &mdash; it sits in a family
        of four cybersecurity clauses that have stacked up since 2020.
        Here&apos;s what each one does:
      </P>
      <TableSimple
        head={["Clause", "Year", "What it requires"]}
        rows={[
          [
            "<strong>DFARS 252.204-7012</strong>",
            "2017",
            "Implement NIST SP 800-171 + 72-hour incident reporting.",
          ],
          [
            "<strong>DFARS 252.204-7019</strong>",
            "2020",
            "Upload a current NIST 800-171 self-assessment score to SPRS before contract award.",
          ],
          [
            "<strong>DFARS 252.204-7020</strong>",
            "2020",
            "Allow DoD (specifically DIBCAC) to conduct higher-confidence verification assessments.",
          ],
          [
            "<strong>DFARS 252.204-7021</strong>",
            "2024-25",
            "Hold the appropriate CMMC certification (L1/L2/L3) at time of contract award.",
          ],
        ]}
      />
      <P>
        For a CUI contractor: 7012 is the substantive rule, 7019 is
        the &ldquo;tell us your score,&rdquo; 7020 is the &ldquo;let
        us verify,&rdquo; and 7021 is the &ldquo;hold the cert.&rdquo;
      </P>

      <H2 id="small-biz">What this means for a small contractor</H2>

      <H3>If you handle FCI only (no CUI)</H3>
      <P>
        DFARS 7012 does <strong>not</strong> apply to you. The 7019,
        7020, 7021 clauses with respect to NIST 800-171 do not apply
        either &mdash; they ride on the same CUI trigger. Your
        obligation is the simpler one:{" "}
        <strong>CMMC Level 1</strong>. Fifteen requirements. A
        self-assessment. A one-page annual SPRS affirmation. You can
        finish in a week.
      </P>

      <H3>If you handle CUI</H3>
      <P>
        DFARS 7012 applies in full. You must implement NIST SP 800-171
        across the systems that touch CUI, be ready to report incidents
        within 72 hours, and post a current self-assessed SPRS score.
        On top of that, when DFARS 7021 flows down (the schedule is
        rolling through 2026&ndash;2028), you&apos;ll need a current
        CMMC Level 2 certification before contract award.
      </P>

      <Callout tone="warn" title="The False Claims Act exposure is real">
        <p>
          Since 2022, the DOJ&apos;s Civil Cyber-Fraud Initiative has
          settled several cases against contractors who claimed
          DFARS-7012 compliance they did not have. Settlements have run
          into the millions. Self-attestation is not optional, and it
          is not safe to over-state.
        </p>
      </Callout>

      <H2 id="next">Your next move</H2>
      <OL>
        <li>
          <strong>Pull your last three DoD contracts.</strong> Search
          for the strings <code>DFARS 252.204-7012</code>,{" "}
          <code>7019</code>, <code>7020</code>, and <code>7021</code>.
          The clauses that flow down to you tell you exactly what you
          owe.
        </li>
        <li>
          <strong>Determine whether you hold CUI.</strong> See our{" "}
          <Link
            href="/blog/cui-vs-fci"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            CUI vs FCI breakdown
          </Link>{" "}
          for the one-question test.
        </li>
        <li>
          <strong>Pick your starting level.</strong> FCI only &rarr;
          CMMC Level 1. CUI &rarr; DFARS 7012 + CMMC Level 2.
        </li>
        <li>
          <strong>If you&apos;re Level 1: start here.</strong> The{" "}
          <Link
            href="/cmmc-level-1/checklist"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            free printable checklist
          </Link>{" "}
          and the{" "}
          <Link
            href="/sprs-check"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            4-minute SPRS quiz
          </Link>{" "}
          will tell you in under an hour where you stand.
        </li>
      </OL>

      <Callout tone="ok" title="The reframe">
        <p>
          DFARS 7012 and CMMC aren&apos;t two compliance projects.
          They&apos;re one. DFARS 7012 says &ldquo;do the
          security.&rdquo; CMMC says &ldquo;prove it.&rdquo; Treating
          them as separate spreadsheets is the single most expensive
          mistake small contractors make in this space &mdash; it
          doubles the cost without doubling the protection.
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
