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
import { CMMCLevelDecisionTree } from "@/app/blog/_components/visuals";

const meta = {
  slug: "do-i-need-cmmc-decision-tree",
  title:
    "Do I Even Need CMMC? A 4-Question Decision Tree for 2026",
  description:
    "Four yes/no questions tell you whether CMMC applies to your business — and at what level. Federal subcontractor? Civilian agency only? State contracts? Commercial only? Walk the tree and stop guessing.",
  excerpt:
    "Half the small businesses asking about CMMC don't actually need it — and the other half need it more urgently than they realize. Four questions and you'll know where you stand.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "CMMC Level 1",
  keywords: [
    "do i need cmmc",
    "cmmc decision tree",
    "cmmc requirements",
    "who needs cmmc",
    "cmmc subcontractor",
    "cmmc civilian agency",
    "cmmc state contract",
    "cmmc commercial business",
  ],
  readingMinutes: 9,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Do subcontractors need CMMC?",
      answer:
        "Yes, if the prime contract is a DoD contract that includes the CMMC clause (DFARS 252.204-7021) or DFARS 252.204-7012. The prime is required to flow the clause down to subcontractors that handle FCI or CUI. Subs at the FCI-only tier need Level 1; subs that receive CUI need Level 2. If you're a sub on a contract where the prime never gives you FCI or CUI (e.g., you provide a fully commercial off-the-shelf product unrelated to the covered work), you may not be in scope — get that confirmed by the prime in writing.",
    },
    {
      question: "Does CMMC apply to civilian agency contracts (GSA, HHS, DHS)?",
      answer:
        "Not directly today. CMMC is a Department of Defense program established under 32 CFR Part 170 and enforced through the DFARS clause 252.204-7021. Civilian-agency contracts use FAR 52.204-21 (which mirrors the 15 Level 1 safeguards) but do not require CMMC certification or affirmation in SPRS. The pending FAR rule (the 'CUI rule,' RIN 9000-AN56) may extend similar requirements government-wide in future years, but as of 2026 only DoD contracts trigger CMMC obligations.",
    },
    {
      question: "Do state and local contracts require CMMC?",
      answer:
        "No. CMMC is a federal program — specifically a DoD program. State, county, and municipal contracts are governed by state procurement law and any state-specific cybersecurity requirements (e.g., CJIS for criminal justice data, HIPAA for state health data, CMMC-like programs in some states). They do not require CMMC certification.",
    },
    {
      question: "Do I need CMMC if I only have commercial customers?",
      answer:
        "No. CMMC is triggered by federal DoD contracts and the flow-down of FAR 52.204-21 or DFARS 252.204-7012/-7021. If your customers are all commercial (private businesses, no federal pass-through), CMMC does not apply. You may still adopt parts of the framework for security maturity or to win commercial customers that care, but there is no federal obligation.",
    },
    {
      question: "Do I need CMMC just to bid on a DoD opportunity?",
      answer:
        "Often yes — increasingly. Under the 48 CFR phased rollout that began November 10, 2025, more DoD solicitations include the CMMC clause as a condition of award. For Level 1 opportunities, the requirement is to have a current annual affirmation in SPRS at the time of award. For Level 2, a current C3PAO assessment status. Filing the affirmation is the bid-eligibility step; submitting a proposal without it is allowed in some solicitations and disqualifying in others. Read the specific solicitation.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the decision tree at a glance" },
  { id: "q1", label: "Q1: Do you have or seek a federal contract?" },
  { id: "q2", label: "Q2: Is the contract a DoD contract?" },
  { id: "q3", label: "Q3: Does the contract handle CUI?" },
  { id: "q4", label: "Q4: Is it a high-priority program?" },
  { id: "edge-cases", label: "Edge cases people get wrong" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          CMMC applies if &mdash; and only if &mdash; you hold or seek a{" "}
          <strong>DoD contract or subcontract</strong> that flows down{" "}
          <strong>FAR 52.204-21</strong> (triggers Level 1) or{" "}
          <strong>DFARS 252.204-7012</strong> (triggers Level 2 or 3).
          State contracts, commercial customers, and most civilian-agency
          contracts do <em>not</em> require CMMC today.
        </p>
      </Callout>

      <P>
        About half the small businesses who land on a CMMC page don&apos;t
        actually need CMMC at all. The other half need it more urgently
        than they realize. The four-question decision tree below is the
        same one a contracting officer would walk through if you called.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; the decision tree at a glance</H2>
      <CMMCLevelDecisionTree />

      <H2 id="q1">Q1: Do you have or seek a federal contract?</H2>
      <P>
        &ldquo;Federal contract&rdquo; means a direct contract from a
        federal agency <em>or</em> a subcontract under a federal prime.
        Commercial-only businesses, state/local contractors, and
        nonprofits without federal awards stop here.
      </P>
      <Callout tone="info" title="What counts as a subcontract">
        <p>
          If a federal prime sends you a purchase order to deliver
          services that are part of their federal scope of work, that
          purchase order is a subcontract, and any required flow-down
          clauses (including 52.204-21 and 7012) bind you.
        </p>
      </Callout>
      <P>
        <strong>Yes &rarr;</strong> Go to Q2.<br />
        <strong>No &rarr;</strong> CMMC does not apply. (You may still
        adopt parts of the framework for security maturity. There is no
        federal obligation.)
      </P>

      <H2 id="q2">Q2: Is the contract a DoD contract?</H2>
      <P>
        CMMC is a Department of Defense program established under{" "}
        <strong>32 CFR Part 170</strong>. It is enforced through DFARS,
        not through the broader FAR. Today, only DoD contracts (and
        their DoD subcontracts) require CMMC affirmation or
        certification.
      </P>
      <TableSimple
        head={["If your contract is...", "CMMC required?", "What does apply"]}
        rows={[
          [
            "DoD prime or DoD sub",
            "<strong>Yes</strong>",
            "Continue to Q3 to determine level",
          ],
          [
            "Civilian agency (GSA, HHS, DHS, etc.)",
            "Not today",
            "FAR 52.204-21 still obligates the 15 basic safeguards, just no CMMC affirmation",
          ],
          [
            "State / local government",
            "No",
            "State procurement law and any sector-specific rules (CJIS, HIPAA, state-specific)",
          ],
          [
            "Commercial customer",
            "No",
            "Whatever the customer's contract requires",
          ],
        ]}
      />
      <Callout tone="warn" title="Watch the 'pending FAR rule'">
        <p>
          The proposed government-wide CUI rule (RIN 9000-AN56) would
          extend NIST 800-171-like requirements to civilian-agency
          contracts that handle CUI. It is not in effect in 2026.
          Track its progress, but don&apos;t pre-comply unless your
          contracting officer says so in writing.
        </p>
      </Callout>
      <P>
        <strong>Yes (DoD) &rarr;</strong> Go to Q3.<br />
        <strong>No &rarr;</strong> No CMMC obligation today. Watch the
        FAR rule.
      </P>

      <H2 id="q3">Q3: Does the contract handle CUI?</H2>
      <P>
        Look at your award (or the solicitation) for two things:
      </P>
      <OL>
        <li>
          <strong>Documents with the CUI banner marking</strong> &mdash;
          a yellow/black header that reads &ldquo;CUI&rdquo; or
          &ldquo;CONTROLLED UNCLASSIFIED INFORMATION.&rdquo;
        </li>
        <li>
          <strong>The clause &ldquo;DFARS 252.204-7012&rdquo;</strong>{" "}
          (Safeguarding Covered Defense Information and Cyber Incident
          Reporting).
        </li>
      </OL>
      <P>
        Read more in our guide to{" "}
        <Link
          href="/blog/what-is-fci-federal-contract-information"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          FCI vs CUI
        </Link>
        .
      </P>
      <P>
        <strong>No CUI / no 7012 &rarr;</strong> You&apos;re at{" "}
        <strong>Level 1</strong>. 15 requirements, self-assessed
        annually, post the affirmation in SPRS.<br />
        <strong>CUI present or 7012 in the contract &rarr;</strong> Go
        to Q4.
      </P>

      <H2 id="q4">Q4: Is it a high-priority program?</H2>
      <P>
        Most CUI-handling contractors land at <strong>Level 2</strong>
        &mdash; 110 NIST 800-171 controls with a C3PAO assessment
        every three years. A small number of programs are designated
        &ldquo;high-priority&rdquo; by the DoD and require <strong>Level
        3</strong> &mdash; Level 2 plus a subset of NIST SP 800-172
        enhanced controls and a DCMA-led assessment.
      </P>
      <P>
        The contracting officer or PM tells you if you&apos;re Level 3.
        You don&apos;t self-designate.
      </P>
      <P>
        <strong>Standard CUI &rarr;</strong> Level 2.<br />
        <strong>High-priority designation &rarr;</strong> Level 3.
      </P>

      <H2 id="edge-cases">Edge cases people get wrong</H2>
      <H3>1) &ldquo;I&apos;m only a sub &mdash; the prime handles compliance.&rdquo;</H3>
      <P>
        Wrong. Required clauses flow down to subcontractors handling
        FCI or CUI. The prime is required to flow them down; the sub
        is required to comply. The prime cannot &ldquo;cover&rdquo; you.
      </P>
      <H3>2) &ldquo;It&apos;s a civilian agency, so no CMMC.&rdquo;</H3>
      <P>
        Correct today &mdash; but FAR 52.204-21 still applies. You still
        owe the 15 basic safeguards. The difference is no annual SPRS
        affirmation requirement (yet).
      </P>
      <H3>3) &ldquo;We just register in SAM, we don&apos;t have a contract yet.&rdquo;</H3>
      <P>
        SAM registration alone does not trigger CMMC. The trigger is
        being awarded (or seeking award of) a contract with the
        relevant clauses. Some solicitations now require an affirmation
        <em>at proposal time</em>, so check each one.
      </P>
      <H3>4) &ldquo;The data isn&apos;t classified, so it&apos;s not CUI.&rdquo;</H3>
      <P>
        Classified is different from CUI. CUI is the layer
        <em>below</em> classified &mdash; sensitive but not classified.
        You can absolutely be a Level 2 contractor handling CUI without
        ever touching a classified document.
      </P>
      <H3>5) &ldquo;We&apos;re an SBIR Phase I winner, do we need Level 2?&rdquo;</H3>
      <P>
        Usually no &mdash; Phase I is typically Level 1. See our{" "}
        <Link
          href="/blog/cmmc-for-sbir-phase-1-winners"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          SBIR Phase I timeline guide
        </Link>{" "}
        for the full breakdown.
      </P>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          Walk the four questions above against your current and
          pipeline contracts.
        </li>
        <li>
          Take the free{" "}
          <Link
            href="/cmmc-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            CMMC check
          </Link>{" "}
          to confirm independently &mdash; 5 minutes, no signup.
        </li>
        <li>
          If Level 1 applies, take the{" "}
          <Link
            href="/sprs-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            SPRS readiness quiz
          </Link>{" "}
          for a checklist of the 15.
        </li>
        <li>
          <Link
            href="/bid-digest"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Subscribe to the Monday Bid Digest
          </Link>{" "}
          for weekly Level 1-fit opportunities surfaced from SAM.gov.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>Do subcontractors need CMMC?</H3>
      <P>
        Yes, if the prime contract is a DoD contract with the relevant
        clauses. Required clauses flow down.
      </P>
      <H3>Does CMMC apply to civilian agency contracts?</H3>
      <P>
        Not directly in 2026. CMMC is DoD-only. Civilian agencies
        currently use FAR 52.204-21 without the CMMC affirmation
        requirement.
      </P>
      <H3>Do state and local contracts require CMMC?</H3>
      <P>
        No. CMMC is federal. States have their own procurement and
        sector-specific rules.
      </P>
      <H3>Do I need CMMC if I only have commercial customers?</H3>
      <P>
        No. CMMC is triggered by federal DoD contracts and their
        flow-downs.
      </P>
      <H3>Do I need CMMC just to bid?</H3>
      <P>
        Often yes &mdash; many DoD solicitations now require a current
        SPRS affirmation as a condition of award. Read each
        solicitation.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
