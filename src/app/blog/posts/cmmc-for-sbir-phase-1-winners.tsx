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
  slug: "cmmc-for-sbir-phase-1-winners",
  title:
    "Just Won an SBIR Phase I? Here's Your CMMC Timeline (2026 Edition)",
  description:
    "If you just won an SBIR Phase I award, here's the realistic CMMC timeline: what Phase I needs (usually Level 1), what Phase II needs (often Level 2), and the milestones that decide whether you'll be ready when the 48 CFR rule lands on your contract type.",
  excerpt:
    "Congrats on the Phase I award. Now the question that ambushes most founders: do you need CMMC to start work, or only at Phase II? The honest answer depends on what kind of data the agency hands you on day one.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "SBIR & Small Business",
  keywords: [
    "sbir cmmc",
    "sbir phase 1 cmmc",
    "sbir phase ii cmmc",
    "cmmc timeline sbir",
    "do sbir winners need cmmc",
    "cmmc for startups",
    "sbir phase 2 cmmc level 2",
  ],
  readingMinutes: 10,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Does SBIR Phase I require CMMC?",
      answer:
        "Usually yes — but at Level 1, not Level 2. Most DoD SBIR Phase I awards include FAR 52.204-21, which obligates you to meet the 15 basic safeguarding requirements and (under 32 CFR Part 170) post an annual CMMC Level 1 affirmation in SPRS. Some Phase I awards involving Controlled Unclassified Information (CUI) include DFARS 252.204-7012 and require Level 2; check the clauses in your award letter. If you only see FAR 52.204-21, you owe Level 1.",
    },
    {
      question: "When during the SBIR cycle do I need CMMC Level 2?",
      answer:
        "Typically when you receive a Phase II award that flows down DFARS 252.204-7012 or transmits Controlled Unclassified Information (CUI). For many DoD topics, Phase II is the first stage where the agency shares technical data that meets the CUI definition. The 48 CFR CMMC clause (DFARS 252.204-7021) is rolling into new DoD solicitations on a phased schedule from November 10, 2025 through November 10, 2028, so your specific contract's clause-flow-down is what matters, not the rule's existence in the abstract.",
    },
    {
      question:
        "How long does it take to get CMMC Level 2 ready from a Phase I baseline?",
      answer:
        "For a typical 3-10 person SBIR startup, 6 to 12 months of focused effort, plus the C3PAO assessment scheduling time (often 2-4 months out). Phase I performance periods are usually 6-9 months. If your topic anticipates a Phase II that touches CUI, start the Level 2 readiness work at month 2 of Phase I — don't wait for the Phase II award letter to land.",
    },
    {
      question: "Can I use a third-party platform or MSP for SBIR CMMC?",
      answer:
        "Yes, and it's usually the right move for small SBIR teams. Phase I (Level 1) is self-assessed and well-suited to a guided platform that drafts your system security plan, walks you through evidence collection, and posts your affirmation in SPRS. Phase II (Level 2) requires a third-party C3PAO assessment, but you can still use a platform or MSP to handle the bulk of implementation and evidence work leading up to that assessment.",
    },
    {
      question: "Does a Phase I award include CUI?",
      answer:
        "Usually not. Most Phase I work is feasibility study and concept development, and the agency typically does not transmit Controlled Unclassified Information during this phase. Check the data rights clause and any technical reference documents in your award package for CUI banner markings. If you see CUI in your Phase I — or DFARS 252.204-7012 in your contract — you are a Level 2 contractor from day one.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — your CMMC timeline" },
  { id: "phase-one", label: "Phase I: which level applies?" },
  { id: "phase-two", label: "Phase II: when Level 2 enters the picture" },
  { id: "phase-three", label: "Phase III: commercialization and sustainment" },
  { id: "milestones", label: "The Phase I → Phase II readiness milestones" },
  { id: "cost", label: "What this actually costs an SBIR team" },
  { id: "common-mistakes", label: "Four mistakes SBIR founders make" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          Most <strong>SBIR Phase I</strong> awards trigger{" "}
          <strong>CMMC Level 1</strong>: 15 safeguarding requirements,
          self-assessed annually, posted in SPRS. <strong>Phase II</strong>{" "}
          frequently triggers <strong>Level 2</strong> once the agency
          shares CUI (or DFARS 252.204-7012 flows down). The fastest path
          for a small team: knock out Level 1 in month 1 of Phase I,
          then start Level 2 readiness around month 2&ndash;3.
        </p>
      </Callout>

      <P>
        The SBIR-to-CMMC question lands the same way every time. A
        founder gets the award letter, the contracting officer
        introduces the cybersecurity flow-downs, and the founder &mdash;
        who is two months out of a PhD lab or three years deep into a
        startup &mdash; opens a Google search and falls into a Slack
        channel arguing about &ldquo;NIST 800-171&rdquo; and
        &ldquo;Level 2&rdquo; and panics that they need a $150K third-
        party assessment to begin Phase I.
      </P>
      <P>
        You probably don&apos;t. Here&apos;s the actual timeline.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; your CMMC timeline</H2>
      <UL>
        <li>
          <strong>Day 1 of Phase I:</strong> Read your award for the
          clauses. FAR 52.204-21 only &rarr; Level 1. DFARS 252.204-7012
          present &rarr; Level 2 from day one.
        </li>
        <li>
          <strong>Month 1&ndash;2 of Phase I (Level 1 path):</strong>{" "}
          Knock out the 15 requirements and post the annual affirmation
          in SPRS. Most SBIR teams finish in 1&ndash;3 weeks of focused
          founder time.
        </li>
        <li>
          <strong>Month 2&ndash;3 of Phase I:</strong> If your topic
          anticipates a Phase II with CUI, start Level 2 readiness
          (implementation of NIST 800-171, SSP draft, evidence
          collection).
        </li>
        <li>
          <strong>Phase II award:</strong> Be ready to either affirm
          Level 2 readiness or be on a credible POA&amp;M.
        </li>
        <li>
          <strong>Phase III:</strong> Sustain whichever level
          applies. Re-affirm annually for Level 1; reassess every 3
          years for Level 2.
        </li>
      </UL>

      <H2 id="phase-one">Phase I: which level applies?</H2>
      <P>
        Open your award letter and search for two things:
      </P>
      <OL>
        <li>
          <strong>The clause &ldquo;FAR 52.204-21&rdquo;</strong>{" "}
          (Basic Safeguarding of Covered Contractor Information Systems)
          &mdash; almost certainly present.
        </li>
        <li>
          <strong>The clause &ldquo;DFARS 252.204-7012&rdquo;</strong>{" "}
          (Safeguarding Covered Defense Information and Cyber Incident
          Reporting) &mdash; present only if the agency anticipates CUI.
        </li>
      </OL>
      <P>What you find determines your tier:</P>
      <TableSimple
        head={["Found in your award", "Your CMMC tier", "What you owe"]}
        rows={[
          [
            "Only FAR 52.204-21",
            "<strong>Level 1</strong>",
            "15 safeguarding requirements + annual SPRS affirmation",
          ],
          [
            "DFARS 252.204-7012 (with or without 52.204-21)",
            "<strong>Level 2</strong>",
            "110 NIST 800-171 controls + C3PAO assessment every 3 years",
          ],
          [
            "Neither (rare for DoD)",
            "<strong>Likely none</strong>",
            "Confirm with your contracting officer in writing",
          ],
        ]}
      />
      <Callout tone="info" title="The Phase I default for most DoD topics">
        <p>
          Most DoD SBIR Phase I topics are feasibility studies that do
          <em> not</em> transmit CUI. The award includes FAR 52.204-21
          but not DFARS 252.204-7012, which puts you at{" "}
          <strong>Level 1</strong>. Read{" "}
          <Link
            href="/blog/cmmc-level-1-vs-level-2"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            our full L1 vs L2 guide
          </Link>{" "}
          for the decision tree.
        </p>
      </Callout>

      <H2 id="phase-two">Phase II: when Level 2 enters the picture</H2>
      <P>
        Phase II is where the SBIR program shifts from feasibility study
        to prototype development. For many DoD topics, that&apos;s also
        where the agency starts handing you the kind of technical data
        that meets the <strong>CUI definition</strong> &mdash; export-
        controlled drawings, threat intelligence, sensor-system
        specifications, weapon-adjacent R&amp;D, designated technical
        data packages.
      </P>
      <P>
        Two things drive your obligation at Phase II:
      </P>
      <OL>
        <li>
          <strong>What clauses appear in the Phase II contract.</strong>{" "}
          DFARS 252.204-7012 + DFARS 252.204-7021 (the CMMC clause) =
          Level 2 with a C3PAO assessment.
        </li>
        <li>
          <strong>The 48 CFR phased rollout.</strong> The final DFARS
          rule (90 Fed. Reg. 41,765 from September 10, 2025) phases the
          CMMC clause into new solicitations starting{" "}
          <strong>November 10, 2025</strong> and reaches steady state on{" "}
          <strong>November 10, 2028</strong>. Phase II awards issued
          after their slot in the phase-in schedule will carry the
          clause.
        </li>
      </OL>

      <H2 id="phase-three">Phase III: commercialization and sustainment</H2>
      <P>
        Phase III is open-ended &mdash; it can run for years as the
        SBIR-developed technology gets commercialized through full
        contracts. Whatever level you carried into Phase III is the
        level you sustain. The annual affirmation (Level 1) or triennial
        reassessment (Level 2) doesn&apos;t pause because the work is
        going well.
      </P>

      <H2 id="milestones">The Phase I &rarr; Phase II readiness milestones</H2>
      <P>
        If your topic anticipates a Phase II with CUI, the practical
        sequence is:
      </P>
      <TableSimple
        head={["When", "Milestone", "Why"]}
        rows={[
          [
            "Month 1",
            "Complete CMMC Level 1 self-assessment & affirmation",
            "Required for Phase I performance under FAR 52.204-21.",
          ],
          [
            "Month 2&ndash;3",
            "Boundary diagram + SSP shell for Level 2",
            "Hardest piece to get right; easiest to start early.",
          ],
          [
            "Month 4&ndash;6",
            "Implement the NIST 800-171 control gaps",
            "MFA, audit logging, encryption-at-rest, vulnerability scanning, incident response plan.",
          ],
          [
            "Month 6&ndash;9",
            "Internal NIST 800-171 Basic Assessment (score in SPRS)",
            "Required by DFARS 252.204-7019 as soon as 7012 is in a contract.",
          ],
          [
            "Month 9&ndash;12",
            "Schedule C3PAO assessment (book early — months out)",
            "Phase II award letters often condition payment on Level 2 status.",
          ],
        ]}
      />

      <H2 id="cost">What this actually costs an SBIR team</H2>
      <P>
        For a typical small SBIR team (1&ndash;10 people), planning
        ranges:
      </P>
      <UL>
        <li>
          <strong>Level 1, DIY:</strong> 1&ndash;3 weeks of founder
          time. Out-of-pocket cost: low hundreds (mostly tooling like
          MFA, password manager, endpoint security).
        </li>
        <li>
          <strong>Level 1, guided platform:</strong> Few hours of
          founder time. Platform fee under $1K per year. Useful when
          you want a defensible paper trail and don&apos;t want to be
          the one drafting the SSP from scratch.
        </li>
        <li>
          <strong>Level 2, full readiness + C3PAO:</strong>{" "}
          $50K&ndash;$250K+ in the first cycle including implementation
          work, plus 6&ndash;12 months of calendar time.
        </li>
      </UL>
      <P>
        For most SBIR teams the right move is to land Level 1 cheaply
        in month 1 and decide about Level 2 once the Phase II topic and
        clauses are visible.
      </P>

      <H2 id="common-mistakes">Four mistakes SBIR founders make</H2>
      <OL>
        <li>
          <strong>Assuming Phase I = Level 2.</strong> You&apos;ve been
          scared into thinking the worst case is the only case.
          Read your award.
        </li>
        <li>
          <strong>Waiting until the Phase II award letter to start.</strong>{" "}
          By the time you read &ldquo;DFARS 252.204-7021&rdquo; in the
          PWS, you have 30 days and a C3PAO that&apos;s six months out.
        </li>
        <li>
          <strong>Posting a fabricated SPRS score to satisfy a
          PM.</strong> Federal false statement under 18 U.S.C. § 1001.
          Read our{" "}
          <Link
            href="/blog/prime-asking-for-sprs-score-level-1-response"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            response template
          </Link>{" "}
          instead.
        </li>
        <li>
          <strong>Choosing &ldquo;use my personal laptop&rdquo; as the
          scope.</strong> That puts your spouse&apos;s tax returns
          inside the assessment boundary. Separate work and personal
          environments before you scope.
        </li>
      </OL>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          Open your Phase I award. Search for &ldquo;52.204-21&rdquo;
          and &ldquo;7012.&rdquo; Confirm your tier.
        </li>
        <li>
          Take the free{" "}
          <Link
            href="/cmmc-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            CMMC check
          </Link>{" "}
          (5 minutes, no signup) to confirm independently.
        </li>
        <li>
          If you&apos;re Level 1, plan a one-week sprint with a guided
          platform &mdash; most SBIR teams finish in 5 working days.
        </li>
        <li>
          <Link
            href="/bid-digest"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Subscribe to the Monday Bid Digest
          </Link>{" "}
          &mdash; we surface follow-on opportunities that align with
          common Phase I topic areas.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>Does SBIR Phase I require CMMC?</H3>
      <P>
        Usually Level 1 (not Level 2). Phase I awards typically include
        FAR 52.204-21 but not DFARS 252.204-7012, putting you at
        Level 1.
      </P>
      <H3>When does SBIR Phase II require Level 2?</H3>
      <P>
        When the Phase II contract flows down DFARS 252.204-7012, or
        when the agency starts transmitting CUI. Many DoD topics hit
        this at Phase II; some never do.
      </P>
      <H3>How long does Level 2 readiness take from a Phase I baseline?</H3>
      <P>
        6&ndash;12 months for a 3&ndash;10-person team, plus C3PAO
        scheduling lead time of 2&ndash;4 months.
      </P>
      <H3>Can I use a platform or MSP for SBIR CMMC?</H3>
      <P>
        Yes &mdash; usually the right move for small teams. A guided
        platform handles Level 1 end-to-end; for Level 2 it carries the
        implementation work up to the C3PAO assessment.
      </P>
      <H3>Does Phase I include CUI?</H3>
      <P>
        Usually not. Phase I is feasibility study. Check your award for
        CUI banner markings or DFARS 252.204-7012 to be sure.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
