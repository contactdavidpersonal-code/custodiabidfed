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
} from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "sprs-score-explained-and-how-to-respond-to-prime",
  title:
    "How to Read Your SPRS Score (And What to Send When Your Prime Asks)",
  description:
    "A defense-contractor's guide to the Supplier Performance Risk System (SPRS): what your score means, how it's calculated, what to send a prime that asks for it, and how to fix a low number fast.",
  excerpt:
    "Your prime just asked for your SPRS score. Here's what to send by Monday — including the exact email template and the math behind the number.",
  datePublished: "2026-05-03",
  dateModified: "2026-05-11",
  category: "SPRS",
  keywords: [
    "sprs score",
    "sprs submission",
    "what is sprs score",
    "sprs cmmc",
    "sprs cybersecurity score",
    "supplier performance risk system",
    "sprs affirmation",
  ],
  readingMinutes: 9,
  author: {
    name: "Custodia Compliance Team",
    title: "Information security engineers, Custodia",
  },
  faq: [
    {
      question: "What is an SPRS score?",
      answer:
        "SPRS (Supplier Performance Risk System) is the DoD's central system for supplier risk data. The 'SPRS score' commonly refers to the NIST SP 800-171 Basic Assessment score — a number from –203 to 110 that reflects how many of the 110 NIST 800-171 controls a contractor has implemented. It is only required at CMMC Level 2. CMMC Level 1 contractors do not have a numeric score; they post a binary affirmation (MET / NOT MET) in SPRS instead.",
    },
    {
      question: "How is the SPRS score calculated?",
      answer:
        "You start at 110 (full implementation of all 110 NIST 800-171 controls). For each unimplemented control, you subtract its weighted value — 1, 3, or 5 points depending on the control's security impact, per the DoD NIST SP 800-171 Assessment Methodology v1.2.1. The lowest possible score is –203. The score is self-reported and the contractor affirms its accuracy through a senior official affirmation in SPRS.",
    },
    {
      question:
        "My prime asked for my SPRS score and I'm Level 1. What do I send?",
      answer:
        "At Level 1 you do not have a numeric SPRS score — you have a current SPRS affirmation (MET) for the 15 FAR 52.204-21 safeguarding requirements. Send the prime: (1) your CAGE code, (2) the date of your most recent annual affirmation, (3) the assessment scope ('Level 1, all FCI-handling assets'), and (4) confirmation that the affirmation is current in SPRS. They can verify directly in SPRS.",
    },
    {
      question: "Where do I find my SPRS score?",
      answer:
        "Log into the Procurement Integrated Enterprise Environment (PIEE) at piee.eb.mil, then open the SPRS module. Your Cyber Reports and Cyber Risk Assessment pages show your assessment record, score, and affirmation status. Only authorized roles (e.g., Contractor SPRS Cyber Vendor User) can view assessment data for your CAGE code.",
    },
    {
      question: "What happens if my SPRS affirmation is false?",
      answer:
        "A false SPRS affirmation is a federal false statement under 18 U.S.C. § 1001 and a potential False Claims Act violation under 31 U.S.C. § 3729. The senior official who signs the affirmation is personally on the hook. The DOJ has already prosecuted multiple FCA cases against contractors for misrepresenting NIST 800-171 / CMMC posture — settlements have ranged from $300,000 to $9 million.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "what-is-sprs", label: "What SPRS actually is" },
  { id: "score-math", label: "How the score is calculated" },
  { id: "where-to-find", label: "Where to find your score" },
  { id: "what-to-send", label: "What to send when a prime asks" },
  { id: "low-score", label: "How to fix a low score in a week" },
  { id: "fca-risk", label: "False Claims Act exposure" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <P>
        It usually arrives on a Wednesday afternoon, in an email with the
        subject line <em>&ldquo;Cybersecurity self-assessment request.&rdquo;</em>{" "}
        Your prime contractor &mdash; Lockheed, RTX, Booz, GDIT, take your
        pick &mdash; needs your <strong>SPRS score</strong> by end of week,
        or your subcontract is at risk. You&apos;ve never heard of SPRS.
        You&apos;re an engineering company, not a cybersecurity company.
      </P>
      <P>
        This guide tells you exactly what SPRS is, what your score means,
        what to send your prime, and how to fix a low number fast.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="what-is-sprs">What SPRS actually is</H2>
      <P>
        SPRS is the <strong>Supplier Performance Risk System</strong> &mdash;
        the Department of Defense&apos;s central database for tracking how
        risky a contractor is to do business with. It&apos;s run by the
        Naval Sea Systems Command (NAVSEA) and lives at{" "}
        <a
          href="https://www.sprs.csd.disa.mil/"
          rel="noopener noreferrer"
          target="_blank"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          sprs.csd.disa.mil
        </a>
        . There are several scores in SPRS &mdash; price risk, item risk,
        supplier risk &mdash; but the one your prime cares about is your
        <strong> NIST SP 800-171 self-assessment score</strong>, sometimes
        called the &ldquo;Basic Assessment&rdquo; score or the
        &ldquo;cyber score.&rdquo;
      </P>
      <P>
        Under <strong>DFARS 252.204-7019/7020</strong>, anyone handling
        Controlled Unclassified Information (CUI) on a DoD contract has to
        post a current NIST 800-171 score in SPRS. And under the new CMMC
        rule, anyone handling FCI has to also file a CMMC Level 1
        affirmation. Most primes ask for both.
      </P>
      <Callout tone="info" title="Quick clarification">
        If you only handle <strong>FCI</strong> (Federal Contract
        Information) &mdash; not CUI &mdash; your obligation is{" "}
        <Link
          href="/blog/cmmc-level-1-17-practices-explained"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          CMMC Level 1
        </Link>
        , a 15-requirement self-affirmation. The &ldquo;score&rdquo; primes
        usually ask for is the NIST 800-171 number, but for L1-only
        contractors a successful affirmation in SPRS is what they need to
        see. The two work the same way: you self-attest, you sign your
        name, the record lives in SPRS.
      </Callout>

      <H2 id="score-math">How the score is calculated</H2>
      <P>
        The NIST 800-171 score starts at <strong>+110</strong>. For every
        control you don&apos;t fully meet, points are subtracted. Some
        controls are worth <strong>5 points</strong>, some are worth{" "}
        <strong>3</strong>, some are worth <strong>1</strong>. There are
        110 controls and the worst possible score is <strong>-203</strong>{" "}
        (negative two hundred three) because some controls have multiple
        components and weighted deductions.
      </P>
      <TableSimple
        head={["Score range", "What it means", "Prime's typical reaction"]}
        rows={[
          [
            "<strong>+110</strong>",
            "All NIST 800-171 controls implemented. Perfect score.",
            "Pass-through. You&apos;re bid-eligible everywhere.",
          ],
          [
            "+88 to +109",
            "A handful of controls partial or missing.",
            "Generally accepted; many primes require a POA&amp;M.",
          ],
          [
            "+50 to +87",
            "Significant gaps. POA&amp;M required.",
            "Some primes will flow down work, some won&apos;t.",
          ],
          [
            "0 to +49",
            "Major gaps. Most primes will require remediation before award.",
            "You&apos;re losing the bid in this range.",
          ],
          [
            "Negative score",
            "Most NIST controls not implemented.",
            "Effectively non-affirming. Lose the contract.",
          ],
        ]}
      />
      <P>
        For CMMC Level 1, the math is simpler: you either implement all 15
        safeguarding requirements and affirm, or you don&apos;t. The SPRS record shows
        either &ldquo;Affirmed&rdquo; with a date or it doesn&apos;t.
      </P>

      <H2 id="where-to-find">Where to find your score</H2>
      <OL>
        <li>
          Log into{" "}
          <a
            href="https://www.sprs.csd.disa.mil/"
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            SPRS
          </a>{" "}
          using your PIEE / Procurement Integrated Enterprise Environment
          credentials. (If you don&apos;t have PIEE access, you have to
          request it through SAM.gov first; that takes about 5 business
          days.)
        </li>
        <li>
          Click <strong>NIST SP 800-171 Assessments</strong> in the left
          nav. Your most recent submitted score is at the top.
        </li>
        <li>
          For CMMC Level 1, click <strong>CMMC Status</strong> &mdash;
          your affirmation date and the affirming senior official are
          listed there.
        </li>
        <li>
          Hit <strong>Print/Export</strong> to get the PDF version your
          prime wants.
        </li>
      </OL>

      <H2 id="what-to-send">What to send when a prime asks</H2>
      <P>
        Primes don&apos;t want your SSP. They don&apos;t want your evidence
        ZIP. They want one PDF and a one-paragraph email. Here&apos;s the
        template that works:
      </P>
      <Callout tone="ok" title="Email template — copy/paste">
        <p className="font-mono text-[13px] leading-relaxed">
          <strong>Subject:</strong> Cybersecurity self-assessment for
          [Your Company] &mdash; [Contract / RFP number]
          <br />
          <br />
          Hi [Name],
          <br />
          <br />
          Attached is our current SPRS posture for the cybersecurity
          self-assessment request on [contract / RFP / sub package].
          <br />
          <br />
          1. <strong>NIST SP 800-171 Basic Assessment</strong>: score
          [your number], submitted [date], next assessment due [date].
          <br />
          2. <strong>CMMC Level 1 affirmation</strong>: affirmed [date],
          covering all 15 safeguarding requirements in FAR 52.204-21(b)(1), signed by [name,
          title].
          <br />
          3. <strong>Supporting artifacts available on request</strong>:
          System Security Plan (SSP), affirmation memo, evidence index.
          <br />
          <br />
          Happy to walk through any of this on a call. Let me know if you
          need anything additional.
          <br />
          <br />
          Best,
          <br />
          [Senior Official, Title]
        </p>
      </Callout>
      <P>
        The PDFs you attach: the SPRS export from step 4 above, plus your
        signed CMMC L1 affirmation memo. That&apos;s it. Don&apos;t volunteer
        the SSP unless they specifically ask &mdash; it&apos;s 30+ pages
        and creates more questions than it answers.
      </P>

      <H2 id="low-score">How to fix a low score in a week</H2>
      <P>
        If your prime just asked and your score is under 88 (or you have
        no CMMC L1 affirmation on file), you have roughly five business
        days to act. Here&apos;s the right order:
      </P>
      <OL>
        <li>
          <strong>Take the free SPRS quiz</strong> &mdash; the{" "}
          <Link
            href="/sprs-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Custodia SPRS quiz
          </Link>{" "}
          scores you against all 15 CMMC L1 safeguarding requirements in 4 minutes and
          tells you exactly what&apos;s missing.
        </li>
        <li>
          <strong>Hit the high-leverage controls first.</strong> MFA
          (IA.L1-3.5.2), endpoint AV (SI.L1-3.14.2), and authorized-users
          roster (AC.L1-3.1.1) are typically the three biggest score
          movers. All three are configurable in M365 / Google Workspace
          in under an hour each.
        </li>
        <li>
          <strong>Build the artifact pack.</strong> Authorized users
          roster, role matrix, visitor log, media disposal log, patch
          log, AV inventory, network boundary inventory. Those seven CSVs
          cover ~80% of evidence.
        </li>
        <li>
          <strong>Draft your SSP.</strong> One paragraph per practice
          describing how it&apos;s implemented. Custodia auto-drafts these
          from your inputs.
        </li>
        <li>
          <strong>Sign and submit.</strong> Senior official signs the
          affirmation memo, you log into SPRS, you file the CMMC Level 1
          affirmation. Done.
        </li>
      </OL>
      <P>
        Most Custodia customers go from &ldquo;prime just asked&rdquo; to
        &ldquo;affirmation filed&rdquo; in 3&ndash;5 business days using
        the platform. The 14-day free trial covers the entire build &mdash;
        no credit card required.
      </P>

      <H2 id="fca-risk">False Claims Act exposure (read this)</H2>
      <Callout tone="warn" title="This is the part nobody tells you">
        Filing an inaccurate SPRS score or a false CMMC Level 1
        affirmation is a federal false statement under{" "}
        <strong>18 U.S.C. § 1001</strong> and is actionable under the{" "}
        <strong>False Claims Act (31 U.S.C. § 3729)</strong>. The DOJ&apos;s
        Civil Cyber-Fraud Initiative has produced settlements ranging
        from $1M to $9M+ since 2022. Verizon paid $4.09M (2023). Aerojet
        Rocketdyne paid $9M (2022). Comprehensive Health Services paid
        $930K (2022). The pattern: a senior official signed a SPRS
        attestation that wasn&apos;t true. They knew, or they should
        have known, and a relator filed.
      </Callout>
      <P>
        The fix is simple and structural: don&apos;t inflate your score.
        If a control isn&apos;t fully implemented, mark it as such, write
        a Plan of Action &amp; Milestones (POA&amp;M), and remediate. The
        DOJ doesn&apos;t prosecute honest gaps with a remediation plan.
        It prosecutes inflated attestations.
      </P>

      <H2 id="faq">FAQ</H2>

      <H3>How long is a SPRS score valid?</H3>
      <P>
        NIST 800-171 self-assessments are valid for <strong>3 years</strong>{" "}
        from submission. CMMC Level 1 affirmations are{" "}
        <strong>annual</strong> &mdash; you re-affirm every year.
      </P>

      <H3>Can I edit my score after submitting?</H3>
      <P>
        Yes. You can re-submit anytime. The most recent score in SPRS is
        what primes see.
      </P>

      <H3>What if I don&apos;t have CUI, just FCI?</H3>
      <P>
        You only need CMMC Level 1 (the 15-requirement affirmation), not the
        110-control NIST 800-171 score.{" "}
        <Link
          href="/blog/far-vs-nist-vs-cmmc-level-1-vs-level-2-comparison"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          Here&apos;s the difference.
        </Link>
      </P>

      <H3>How do I get PIEE access?</H3>
      <P>
        Register at{" "}
        <a
          href="https://piee.eb.mil/"
          rel="noopener noreferrer"
          target="_blank"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          piee.eb.mil
        </a>
        , request the SPRS role, get your supervisor to approve. Takes
        about 5 business days end-to-end.
      </P>

      <Quote cite="The Custodia Compliance Team">
        The contractors who lose work to SPRS aren&apos;t the ones with
        gaps. They&apos;re the ones who didn&apos;t answer the prime&apos;s
        email by Monday.
      </Quote>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
