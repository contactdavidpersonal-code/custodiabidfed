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
import { FifteenRequirements } from "@/app/blog/_components/visuals";

const meta = {
  slug: "cmmc-level-1-binary-no-score",
  title:
    "CMMC Level 1 Is Binary. There Is No Score. Here's What That Means.",
  description:
    "CMMC Level 1 produces a single MET / NOT MET result — not a 0-110 score. Every one of the 15 FAR 52.204-21 safeguarding requirements must be MET to pass. No partial credit, no POA&M, no curve. Here's what that actually means in practice.",
  excerpt:
    "Level 1 isn't graded on a curve. Every one of the 15 requirements has to be MET — or the whole assessment fails. Here's how the rule actually works, and why that's good news for small contractors.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "CMMC Level 1",
  keywords: [
    "cmmc level 1 score",
    "cmmc level 1 binary",
    "cmmc level 1 met not met",
    "cmmc level 1 passing score",
    "cmmc level 1 partial credit",
    "level 1 poam",
    "cmmc level 1 self-assessment",
  ],
  readingMinutes: 8,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "What score do you need to pass CMMC Level 1?",
      answer:
        "There is no numeric score at CMMC Level 1. The Level 1 assessment is binary — MET or NOT MET. To pass, every one of the 15 FAR 52.204-21(b)(1) safeguarding requirements must be MET on every in-scope asset. If one requirement is NOT MET, the entire assessment is NOT MET, and the affirmation cannot be filed in SPRS. The 0-110 numeric score belongs to CMMC Level 2 (NIST SP 800-171 Basic Assessment).",
    },
    {
      question: "Can a Level 1 contractor use a Plan of Action and Milestones (POA&M)?",
      answer:
        "No. CMMC Level 1 does not permit POA&M items. Under 32 CFR § 170.21(a), every safeguarding requirement must be MET at the time of the annual affirmation. POA&M flexibility is a Level 2 feature — there, a contractor can temporarily defer some controls with a minimum score of 88/110 and a 180-day closeout deadline.",
    },
    {
      question: "What happens if one Level 1 requirement is NOT MET?",
      answer:
        "If any of the 15 requirements is NOT MET on any in-scope asset, the entire Level 1 self-assessment is NOT MET, and the senior official cannot truthfully file the annual affirmation in SPRS. The fix is to remediate the failed requirement, re-test, and then affirm. Filing a MET affirmation when a requirement is actually NOT MET is a federal false statement under 18 U.S.C. § 1001.",
    },
    {
      question: "Is there partial credit on CMMC Level 1?",
      answer:
        "No. There is no partial credit at Level 1. Each of the 15 requirements is evaluated as MET, NOT MET, or NOT APPLICABLE. A finding of NOT APPLICABLE requires a documented justification (typically that the asset category does not exist in the environment). Anything short of MET counts as NOT MET for the rollup.",
    },
    {
      question:
        "Is CMMC Level 1 easier or harder than Level 2 because it's binary?",
      answer:
        "Easier overall for most small contractors. Level 1 has 15 requirements (vs. Level 2's 110), no third-party assessor (vs. C3PAO every 3 years at Level 2), and no SSP that has to satisfy a NIST 800-171A objective set of 320. The binary scoring is stricter per requirement, but the number of requirements is much smaller, the scope is narrower (FCI only, not CUI), and the assessor is you.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the rule in one sentence" },
  { id: "what-binary-means", label: "What 'binary' actually means" },
  { id: "the-15", label: "The 15 requirements you have to MET" },
  { id: "vs-level-2", label: "Why Level 2 has a score and Level 1 doesn't" },
  { id: "not-applicable", label: "The one escape valve: NOT APPLICABLE" },
  { id: "what-fails", label: "What an audit failure actually costs" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          <strong>CMMC Level 1 produces a single MET or NOT MET
          result.</strong>{" "}
          There is no 0&ndash;110 score, no partial credit, no
          POA&amp;M. Every one of the 15 FAR 52.204-21 safeguarding
          requirements must be MET on every in-scope system. The
          0&ndash;110 number you&apos;ve heard about is the Level 2
          score &mdash; a different regulation. (32 CFR § 170.21(a))
        </p>
      </Callout>

      <P>
        Two minutes on a federal contracting forum will leave you
        convinced that &ldquo;everyone needs a SPRS score of 88 or
        above.&rdquo; That&apos;s true at Level 2. It&apos;s false at
        Level 1, where most small DoD contractors actually live. This
        post explains how the Level 1 grading regime actually works,
        what &ldquo;binary&rdquo; means in plain English, and the only
        legitimate escape valve in the rule.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; the rule in one sentence</H2>
      <Callout tone="info" title="The rule">
        <p>
          Under <strong>32 CFR § 170.21(a)</strong>, every Level 1
          requirement must be MET on every in-scope asset for the annual
          affirmation in SPRS to be truthful. One NOT MET = the whole
          assessment is NOT MET.
        </p>
      </Callout>

      <H2 id="what-binary-means">What &ldquo;binary&rdquo; actually means</H2>
      <P>
        Three things, in the order they matter:
      </P>
      <OL>
        <li>
          <strong>Per requirement, the finding is one of three values:</strong>{" "}
          MET, NOT MET, or NOT APPLICABLE. There is no &ldquo;mostly
          MET,&rdquo; &ldquo;MET except on one laptop,&rdquo; or
          &ldquo;MET if you don&apos;t look at the warehouse PC.&rdquo;
          The finding applies to your scope as a whole.
        </li>
        <li>
          <strong>No numbers anywhere.</strong> No 0&ndash;110 scale, no
          percentages, no weights. The Level 1 self-assessment is a
          checklist of 15 items.
        </li>
        <li>
          <strong>The overall result is the rollup.</strong> All 15
          MET &rarr; assessment MET. Any NOT MET &rarr; assessment NOT
          MET. The senior official cannot truthfully file a MET
          affirmation if any requirement is actually NOT MET.
        </li>
      </OL>
      <Callout tone="warn" title="Why this matters for primes asking for a 'score'">
        <p>
          If your prime contractor asks for your Level 1 score and you
          give them a number, you&apos;re mixing up regulations. Send
          them your <strong>affirmation status (MET)</strong>, your
          affirmation date, and the name of the affirming official.
          That&apos;s the Level 1 deliverable. See our{" "}
          <Link
            href="/blog/prime-asking-for-sprs-score-level-1-response"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            prime-questionnaire reply template
          </Link>
          .
        </p>
      </Callout>

      <H2 id="the-15">The 15 requirements you have to MET</H2>
      <P>
        These are the safeguarding requirements at FAR
        52.204-21(b)(1)(i)&ndash;(xv), grouped by the six CMMC Level 1
        domains. Every one of them must be MET on every system that
        touches FCI.
      </P>
      <FifteenRequirements />
      <P>
        That&apos;s the entire program. Most are common-sense business
        hygiene a well-run small company is already doing in some form
        &mdash; the Level 1 assessment just asks you to do them
        deliberately and document the evidence.
      </P>

      <H2 id="vs-level-2">Why Level 2 has a score and Level 1 doesn&apos;t</H2>
      <P>
        Two different problems, two different grading regimes.
      </P>
      <TableSimple
        head={["Property", "Level 1", "Level 2"]}
        rows={[
          [
            "Requirement count",
            "15",
            "110",
          ],
          [
            "Source",
            "FAR 52.204-21(b)(1)",
            "NIST SP 800-171 Rev. 2/3",
          ],
          [
            "Scoring",
            "<strong>Binary</strong> &mdash; MET / NOT MET",
            "<strong>Numeric</strong> &mdash; &minus;203 to +110",
          ],
          [
            "Minimum to pass",
            "All 15 MET",
            "88/110 (with POA&amp;M)",
          ],
          [
            "POA&amp;M permitted",
            "No",
            "Yes (close in 180 days)",
          ],
          [
            "Who assesses",
            "Yourself, annually",
            "C3PAO, every 3 years",
          ],
          [
            "Why scored this way",
            "Small fixed set &mdash; either you do them or you don't",
            "Large set &mdash; partial implementation is meaningful info for the government",
          ],
        ]}
      />
      <P>
        Binary scoring at Level 1 is not a quirk &mdash; it&apos;s the
        regulator&apos;s design choice. With only 15 requirements and
        every requirement being a non-negotiable basic hygiene item, a
        numeric score would just be misleading. Either you patch your
        systems or you don&apos;t. Either you run anti-malware or you
        don&apos;t. There is no &ldquo;75 percent of a patch.&rdquo;
      </P>

      <H2 id="not-applicable">The one escape valve: NOT APPLICABLE</H2>
      <P>
        Under the CMMC Assessment Guide &mdash; Level 1, a requirement
        can be marked <strong>NOT APPLICABLE</strong> rather than NOT
        MET in a narrow case: <em>the requirement does not apply to your
        environment</em>. The standard example is the requirement to
        manage <strong>physical access devices</strong> (PE.L1-3.10.5)
        in a fully remote company that has no office. You document the
        reason; you do not magically pass.
      </P>
      <Callout tone="info" title="NOT APPLICABLE is not 'we didn't get to it'">
        <p>
          &ldquo;We don&apos;t have time to set up MFA&rdquo; is NOT
          MET, not NOT APPLICABLE. &ldquo;We have no employees besides
          the owner&rdquo; or &ldquo;we have no physical facility&rdquo;
          are legitimate NOT APPLICABLE cases. Document them clearly in
          your system security plan.
        </p>
      </Callout>

      <H2 id="what-fails">What an audit failure actually costs</H2>
      <P>
        Level 1 has no C3PAO; the audit is your own self-assessment. So
        what&apos;s the consequence of failing? Three real scenarios:
      </P>
      <OL>
        <li>
          <strong>You honestly find one requirement NOT MET.</strong>{" "}
          Remediate it, re-test, and affirm. This is the system working
          as designed. Most first-year Level 1 contractors hit this
          loop once or twice.
        </li>
        <li>
          <strong>You affirm MET when one is actually NOT MET.</strong>{" "}
          A federal false statement under 18 U.S.C. § 1001 with False
          Claims Act exposure under 31 U.S.C. § 3729. The DOJ&apos;s
          Civil Cyber-Fraud Initiative has produced settlements between{" "}
          <strong>$1M and $9M+</strong> against contractors who
          misrepresented cybersecurity posture. The affirming official
          is named personally.
        </li>
        <li>
          <strong>You miss the annual affirmation deadline.</strong>{" "}
          Your status in SPRS lapses. Contracts that condition award on
          a current affirmation become ineligible for you. The fix is
          to affirm; there is no penalty beyond lost eligibility, but
          the eligibility loss is real.
        </li>
      </OL>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          Take the 4-minute{" "}
          <Link
            href="/sprs-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            SPRS readiness quiz
          </Link>{" "}
          to see how you stand on each of the 15 requirements right now.
        </li>
        <li>
          If you haven&apos;t scoped your environment, take the free{" "}
          <Link
            href="/cmmc-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            CMMC check
          </Link>{" "}
          first.
        </li>
        <li>
          Read FAR 52.204-21(b)(1) yourself &mdash; the entire clause
          fits on a single page.
        </li>
        <li>
          <Link
            href="/bid-digest"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Subscribe to the Monday Bid Digest
          </Link>
          {" "}for weekly Level 1-fit federal opportunities.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>What score do you need to pass CMMC Level 1?</H3>
      <P>
        There is no score. Level 1 is binary &mdash; every one of the
        15 requirements must be MET. The 0&ndash;110 score belongs to
        Level 2.
      </P>
      <H3>Can Level 1 use a POA&amp;M?</H3>
      <P>
        No. 32 CFR § 170.21(a) requires every requirement to be MET at
        the time of the annual affirmation. POA&amp;M is a Level 2
        feature.
      </P>
      <H3>What if one requirement is NOT MET?</H3>
      <P>
        The whole assessment is NOT MET. Remediate, re-test, then
        affirm. Don&apos;t file MET when something is NOT MET.
      </P>
      <H3>Is there partial credit?</H3>
      <P>
        No. Each requirement is MET, NOT MET, or NOT APPLICABLE.
        Anything short of MET counts as NOT MET for the rollup.
      </P>
      <H3>Is binary scoring harder than Level 2&apos;s score?</H3>
      <P>
        Easier overall for small contractors &mdash; fewer requirements,
        no C3PAO, no SSP-to-objectives mapping. The per-requirement bar
        is strict, but the total surface area is much smaller.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
