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
import {
  CMMCLevelDecisionTree,
  FCIvsCUI,
} from "@/app/blog/_components/visuals";

const meta = {
  slug: "cmmc-level-1-vs-level-2",
  title:
    "CMMC Level 1 vs Level 2: Which One Do You Actually Need? (2026 Plain-English Guide)",
  description:
    "A small-business owner's decision guide to CMMC Level 1 vs Level 2. The single question that decides it, what each level costs in time and money, and the trap of getting it wrong. Updated for the 2026 SPRS affirmation cycle and the 48 CFR rule phased rollout.",
  excerpt:
    "Most small defense contractors are Level 1, not Level 2 — but the wrong answer here costs you a year and tens of thousands of dollars. Here's the single question that decides it.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "CMMC Level 1",
  keywords: [
    "cmmc level 1 vs level 2",
    "do I need cmmc level 1 or 2",
    "cmmc levels explained",
    "fci vs cui",
    "which cmmc level",
    "cmmc for small business",
    "cmmc 2026",
  ],
  readingMinutes: 12,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question:
        "What is the difference between CMMC Level 1 and CMMC Level 2?",
      answer:
        "CMMC Level 1 protects Federal Contract Information (FCI) and requires you to meet 15 safeguarding requirements from FAR 52.204-21, with an annual self-assessment and a senior official affirmation posted in SPRS. CMMC Level 2 protects Controlled Unclassified Information (CUI) and requires you to meet all 110 NIST SP 800-171 controls, assessed by a third-party C3PAO every three years. Level 1 is binary (MET / NOT MET). Level 2 produces a numeric score on a -203 to +110 scale.",
    },
    {
      question: "Which CMMC level do I need?",
      answer:
        "You need Level 1 if you receive Federal Contract Information (FCI) on a federal contract but never receive Controlled Unclassified Information (CUI). You need Level 2 if you receive CUI from the Department of Defense (commonly indicated by a CUI banner marking on documents or by the presence of DFARS 252.204-7012 in your contract). You need Level 3 only if you are assigned to a high-priority DoD program. Most small defense contractors handle FCI only and are Level 1.",
    },
    {
      question: "Can a contractor self-assess for CMMC Level 1?",
      answer:
        "Yes. CMMC Level 1 is self-assessed annually. The contractor implements the 15 FAR 52.204-21 safeguarding requirements, performs the assessment, and a senior company official affirms the result in the Supplier Performance Risk System (SPRS). No third-party assessor is required at Level 1. CMMC Level 2 requires a third-party C3PAO assessment every three years.",
    },
    {
      question: "How much does CMMC Level 1 cost compared to Level 2?",
      answer:
        "CMMC Level 1 typically costs a small business a few hundred to a few thousand dollars per year when done with a guided platform, or one to two weeks of founder time if done entirely DIY. CMMC Level 2 typically costs $50,000 to $250,000+ for the initial third-party C3PAO assessment, plus implementation costs to meet all 110 NIST SP 800-171 controls. The difference reflects scope: Level 1 is 15 safeguarding requirements; Level 2 is 110 controls plus an outside assessor.",
    },
    {
      question:
        "What happens if I implement Level 1 but my contract actually requires Level 2?",
      answer:
        "Filing a Level 1 affirmation when the contract requires Level 2 is a false statement to the federal government under 18 U.S.C. § 1001 and creates False Claims Act exposure under 31 U.S.C. § 3729. Affirmations submitted to SPRS are signed by a named senior official, who is personally on the hook. The fix is to confirm your level before you affirm — look for a CUI marking on contract documents, check whether DFARS 252.204-7012 is in your contract, and if either is true, you are Level 2 (or higher).",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the single question that decides it" },
  { id: "fci-vs-cui", label: "The actual difference: FCI vs CUI" },
  { id: "level-1", label: "What CMMC Level 1 requires" },
  { id: "level-2", label: "What CMMC Level 2 requires" },
  { id: "comparison", label: "Side-by-side comparison" },
  { id: "decision-tree", label: "The decision tree" },
  { id: "wrong-answer", label: "What happens if you pick the wrong level" },
  { id: "small-business", label: "What 'most small businesses' actually means" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      {/* AEO lead — 50-word answer that AI engines extract verbatim */}
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          You need <strong>CMMC Level 1</strong> if you handle Federal
          Contract Information (FCI) on a federal contract. You need{" "}
          <strong>CMMC Level 2</strong> if you handle Controlled
          Unclassified Information (CUI). Level 1 is 15 safeguarding
          requirements, self-assessed annually. Level 2 is 110 controls,
          third-party assessed every three years. Most small defense
          contractors are Level 1.
        </p>
      </Callout>

      <P>
        If you&apos;ve been on the receiving end of a prime&apos;s supplier
        cybersecurity questionnaire and you&apos;ve walked away with the
        question <em>&ldquo;Wait, do I need Level 1 or Level 2?&rdquo;</em>{" "}
        you are not alone. This is the single most consequential decision
        in the CMMC program, and most online answers are written for the
        wrong reader. They&apos;re written for a Fortune-500 compliance
        team, in language a five-person electrical contractor outside
        Norfolk cannot reasonably parse.
      </P>
      <P>
        This post is the answer in the language a small business owner
        actually uses. By the time you finish it, you&apos;ll know which
        level applies to you, what each one really requires, and what
        happens if you guess wrong. (Spoiler: do not guess.)
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; the single question that decides it</H2>
      <P>
        Forget every flowchart with eight branches. There is one question
        that decides Level 1 vs Level 2, and it&apos;s about{" "}
        <strong>what kind of information your contract gives you</strong>:
      </P>
      <Callout tone="info" title="The decisive question">
        <p>
          Does any document, file, or email from this federal contract
          carry a <strong>CUI marking</strong> &mdash; or does your contract
          contain <strong>DFARS clause 252.204-7012</strong>?
        </p>
        <UL>
          <li>
            <strong>No to both:</strong> You&apos;re a Level 1 contractor.
            Implement the 15 FAR 52.204-21 safeguarding requirements,
            self-assess annually, post the affirmation in SPRS.
          </li>
          <li>
            <strong>Yes to either:</strong> You&apos;re Level 2 (at least).
            You need a third-party assessor (C3PAO) and all 110 NIST SP
            800-171 controls.
          </li>
        </UL>
      </Callout>
      <P>
        That&apos;s 95% of the answer. The rest of this post explains why,
        what each level actually requires, and the small minority of
        cases where it gets more nuanced.
      </P>

      <H2 id="fci-vs-cui">The actual difference: FCI vs CUI</H2>
      <P>
        The CMMC level you owe is decided by the <strong>type of data</strong>{" "}
        the government hands you under your contract. Not the size of
        your company. Not your NAICS code. Not the size of the award.
        The data.
      </P>
      <FCIvsCUI />
      <P>
        <strong>Federal Contract Information (FCI)</strong> is the default
        category. Defined at <a href="https://www.acquisition.gov/far/4.1901" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]">FAR 4.1901</a>,
        it covers any non-public information the government provides or
        you generate <em>under</em> a federal contract. It is not marked
        with anything special. It is the routine paperwork of doing
        government business: delivery schedules, pricing, scopes of work,
        emails from the contracting officer.
      </P>
      <P>
        <strong>Controlled Unclassified Information (CUI)</strong> is the
        upgrade. Defined at{" "}
        <a
          href="https://www.ecfr.gov/current/title-32/subtitle-B/chapter-XX/part-2002"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          32 CFR Part 2002
        </a>
        , CUI is information the government has <em>specifically
        designated</em> for safeguarding. It is identified by a banner
        marking on the document or system, almost always with a category
        code &mdash; <code>CUI//SP-EXPT</code> for export-controlled,{" "}
        <code>CUI//SP-PRIV</code> for privacy, and so on.
      </P>
      <Callout tone="info" title="The 30-second test">
        <p>
          Open every document, drawing, dataset, and email attachment
          you&apos;ve received from this contract. Look at the top of each
          page or the header of each file. If you see the word{" "}
          <strong>CUI</strong> or the word <strong>CONTROLLED</strong> on
          any of them, you are Level 2. If you don&apos;t, and your
          contract does not contain DFARS 252.204-7012, you are Level 1.
        </p>
      </Callout>

      <H2 id="level-1">What CMMC Level 1 requires</H2>
      <P>
        CMMC Level 1 is the <strong>basic safeguarding tier</strong>. It is
        built on a clause the government has been quietly putting in
        federal contracts since 2016: <strong>FAR 52.204-21</strong>.
        Subsection <code>(b)(1)(i)&ndash;(xv)</code> of that clause lists
        the <strong>15 safeguarding requirements</strong> that constitute
        Level 1 in their entirety.
      </P>
      <P>The requirements are not exotic. Plain-English:</P>
      <UL>
        <li>Only authorized people can sign in to your systems</li>
        <li>People can only do the work their job requires</li>
        <li>Connections to outside networks are controlled</li>
        <li>What you post on public sites is reviewed</li>
        <li>Users and devices are identified and authenticated</li>
        <li>Media is wiped before you throw it out</li>
        <li>Physical access to your office is controlled</li>
        <li>Visitors are escorted and logged</li>
        <li>Boundaries of your network are monitored</li>
        <li>Public-facing systems are isolated from internal ones</li>
        <li>You patch known flaws</li>
        <li>You run anti-malware and keep it current</li>
      </UL>
      <P>
        That is the entire Level 1 program. Most of it is common-sense
        business hygiene that any well-run 12-person company is already
        doing in some form &mdash; CMMC just asks you to{" "}
        <strong>do it deliberately and document the evidence</strong>.
      </P>
      <Callout tone="ok" title="How Level 1 is assessed">
        <p>
          <strong>Self-assessed annually.</strong> The contractor
          implements the 15 requirements, performs the self-assessment,
          and a senior company official affirms the result in SPRS
          (Supplier Performance Risk System). No third-party assessor.
          No 0&ndash;110 numeric score. The result is binary &mdash;{" "}
          <strong>MET</strong> or <strong>NOT MET</strong>. (Per 32 CFR §
          170.21(a), every requirement must roll up to MET.)
        </p>
      </Callout>

      <H2 id="level-2">What CMMC Level 2 requires</H2>
      <P>
        CMMC Level 2 protects <strong>CUI</strong>. The control set is{" "}
        <strong>NIST SP 800-171</strong> &mdash; all 110 of them, mapped
        to 320 assessment objectives in <strong>NIST SP 800-171A</strong>.
        Implementation is meaningfully harder than Level 1, and the
        assessment regime is a different planet:
      </P>
      <UL>
        <li>
          <strong>Triennial third-party assessment</strong> by a CMMC
          Third-Party Assessment Organization (C3PAO) authorized by the
          Cyber AB. Self-assessment is permitted only for a narrow slice
          of Level 2 work; for most DoD contracts touching CUI, a C3PAO
          is required.
        </li>
        <li>
          <strong>Score range: &minus;203 to +110.</strong> The familiar
          &ldquo;SPRS score out of 110&rdquo; that primes ask about
          belongs to Level 2 (NIST 800-171 Basic Assessment), not
          Level 1.
        </li>
        <li>
          <strong>POA&amp;M allowed (limited).</strong> Some controls can
          temporarily sit on a Plan of Action and Milestones, but the
          minimum acceptable score is 88/110 and any open POA&amp;M items
          must be closed within 180 days. (32 CFR § 170.21(c).)
        </li>
        <li>
          <strong>Cost:</strong> typically $50K&ndash;$250K+ for the first
          assessment cycle, including implementation work to bring the
          environment up to standard.
        </li>
      </UL>
      <P>
        If you genuinely handle CUI, Level 2 is the right and necessary
        burden. If you don&apos;t, paying for Level 2 is a six-figure
        mistake.
      </P>

      <H2 id="comparison">Side-by-side comparison</H2>
      <TableSimple
        head={["Dimension", "Level 1", "Level 2"]}
        rows={[
          [
            "Data protected",
            "Federal Contract Information (FCI)",
            "Controlled Unclassified Information (CUI)",
          ],
          [
            "Control set",
            "<strong>15</strong> safeguarding requirements (FAR 52.204-21)",
            "<strong>110</strong> controls (NIST SP 800-171)",
          ],
          [
            "Assessment objectives",
            "59 (mapped from NIST 800-171A)",
            "320 (NIST 800-171A)",
          ],
          [
            "Who assesses",
            "<strong>Yourself</strong>, annually",
            "<strong>C3PAO</strong>, every 3 years",
          ],
          [
            "Result format",
            "Binary &mdash; MET or NOT MET",
            "Numeric score &minus;203 to +110",
          ],
          [
            "POA&amp;M permitted",
            "No &mdash; every requirement must be MET",
            "Yes (limited; minimum 88/110, close in 180 days)",
          ],
          [
            "Affirmation",
            "Senior official, annual, in SPRS",
            "Senior official, annual, in SPRS (plus C3PAO record)",
          ],
          [
            "Typical cost (initial)",
            "Hundreds to low thousands &mdash; mostly your time",
            "$50K&ndash;$250K+ including remediation",
          ],
          [
            "Recurring annual cost",
            "Hours of attention; platform fee if guided",
            "Sustainment + reassessment every 3 years",
          ],
          [
            "Contract clause that triggers it",
            "FAR 52.204-21 (already in nearly every federal contract)",
            "DFARS 252.204-7012, 7019, 7020, 7021",
          ],
        ]}
      />

      <H2 id="decision-tree">The decision tree</H2>
      <P>
        Drawn out, here is how the rule is actually applied:
      </P>
      <CMMCLevelDecisionTree />
      <P>
        Two notes on edge cases:
      </P>
      <UL>
        <li>
          <strong>Mixed environments.</strong> Some firms have one
          contract line item that touches CUI and another that touches
          only FCI. The CMMC level applies <em>per contract</em>, and the
          environment that processes CUI must be at the higher level. In
          practice, most small firms can&apos;t cleanly segment, so the
          whole firm becomes Level 2 the moment any one contract requires
          it.
        </li>
        <li>
          <strong>Civilian agency work.</strong> CMMC is a DoD program. A
          civilian agency contract still requires FAR 52.204-21
          safeguarding for FCI, but the CMMC affirmation regime does not
          apply. If you only work for HHS, USDA, or DOI, you implement
          the 15 requirements as a matter of contract compliance but you
          do not post a CMMC affirmation in SPRS.
        </li>
      </UL>

      <H2 id="wrong-answer">What happens if you pick the wrong level</H2>
      <P>
        This is the section nobody wants to write but everyone needs to
        read.
      </P>
      <Callout tone="warn" title="False affirmation = federal exposure">
        <p>
          A SPRS affirmation is a written statement made to the federal
          government. Filing one that&apos;s materially false is a federal
          crime under <strong>18 U.S.C. § 1001</strong> and a civil
          violation under the{" "}
          <strong>False Claims Act (31 U.S.C. § 3729)</strong>. The DOJ&apos;s
          Civil Cyber-Fraud Initiative has produced settlements ranging
          from <strong>$1M to $9M+</strong> against contractors since 2022,
          and the affirming official is named personally.
        </p>
      </Callout>
      <P>
        There are two failure modes:
      </P>
      <OL>
        <li>
          <strong>You file Level 1 when the contract required Level 2.</strong>{" "}
          This is the worse mistake. You&apos;ve attested that you meet a
          standard you do not meet, and the data category gives the
          government strong evidence you should have known.
        </li>
        <li>
          <strong>You file Level 2 when you only needed Level 1.</strong>{" "}
          Less legally dangerous, but expensive. You&apos;ve spent
          $50K&ndash;$250K on an assessment that contributes nothing to
          your eligibility and burdened your team with controls you
          didn&apos;t owe.
        </li>
      </OL>
      <P>
        The fix in either direction is to confirm{" "}
        <strong>before</strong> you sign:
      </P>
      <OL>
        <li>Read every contract document for the word &ldquo;CUI.&rdquo;</li>
        <li>Search your contract for &ldquo;252.204-7012.&rdquo;</li>
        <li>Email the prime&apos;s contracts manager in writing if either is unclear; their answer becomes part of your file.</li>
      </OL>

      <H2 id="small-business">What &ldquo;most small businesses&rdquo; actually means</H2>
      <P>
        The DoD&apos;s own regulatory impact analysis estimates the
        Defense Industrial Base at roughly 220,000 firms. Of those, the
        rule projects approximately <strong>139,000 to be Level 1</strong>{" "}
        and approximately <strong>80,000 to be Level 2 or 3</strong>.
        Translation: the typical small DoD subcontractor &mdash; the
        electrical firm, the machine shop, the IT services company, the
        janitorial outfit &mdash; is Level 1. Level 2 lives further up
        the food chain, with the firms doing weapon-system engineering,
        export-controlled software, classified-adjacent R&amp;D, and the
        like.
      </P>
      <P>
        If you&apos;ve never seen a CUI banner on a document and your
        contract doesn&apos;t cite DFARS 252.204-7012, you&apos;re very
        likely in the L1 majority. The rest of this site is built for you.
      </P>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          <strong>Verify your level in 5 minutes</strong> using our free{" "}
          <Link
            href="/cmmc-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            CMMC check
          </Link>
          . No signup, no card.
        </li>
        <li>
          <strong>If you&apos;re Level 1</strong>, take the 4-minute{" "}
          <Link
            href="/sprs-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            SPRS readiness quiz
          </Link>{" "}
          to see where you stand against the 15 requirements.
        </li>
        <li>
          <strong>Get on the Monday Bid Digest</strong> &mdash; weekly
          SAM.gov opportunities a CMMC L1-fit small business can bid on,
          free, in your inbox.{" "}
          <Link
            href="/bid-digest"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Subscribe here
          </Link>
          .
        </li>
        <li>
          <strong>Read the regulation yourself</strong> if you want to
          verify any claim on this page &mdash; we keep an annotated{" "}
          <Link
            href="/regulations"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            regulations index
          </Link>{" "}
          of every primary source.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>What&apos;s the difference between CMMC Level 1 and Level 2?</H3>
      <P>
        Level 1 protects FCI with 15 self-assessed safeguarding
        requirements. Level 2 protects CUI with 110 NIST 800-171 controls
        assessed by a C3PAO every three years. Level 1 is binary; Level 2
        is scored 0&ndash;110.
      </P>
      <H3>Which level do I need?</H3>
      <P>
        Level 1 if you handle FCI only. Level 2 if you handle CUI (look
        for a CUI banner marking, or check whether DFARS 252.204-7012 is
        in your contract). Level 3 only if you&apos;re on a designated
        high-priority DoD program.
      </P>
      <H3>Can I self-assess for Level 1?</H3>
      <P>
        Yes. Level 1 is self-assessed annually with a senior official
        affirmation posted in SPRS. No C3PAO is required at Level 1.
      </P>
      <H3>How much does Level 1 cost compared to Level 2?</H3>
      <P>
        Level 1 is typically a few hundred to a few thousand dollars per
        year on a guided platform &mdash; or one to two weeks of founder
        time DIY. Level 2 typically runs $50K&ndash;$250K+ in the first
        cycle, plus ongoing sustainment.
      </P>
      <H3>What happens if I get my level wrong?</H3>
      <P>
        Filing a Level 1 affirmation when Level 2 was required is a
        federal false statement under 18 U.S.C. § 1001 with False Claims
        Act exposure under 31 U.S.C. § 3729 &mdash; signed personally by
        the affirming official. Verify your level before you affirm.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
