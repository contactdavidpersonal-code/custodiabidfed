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
  TOC,
  UL,
} from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "prime-asking-for-sprs-score-level-1-response",
  title:
    "What to Tell Your Prime When They Ask for Your SPRS Score (And You're Level 1)",
  description:
    "Your prime sent a supplier questionnaire asking for your SPRS score and you're a CMMC Level 1 contractor — which doesn't have a score. Here's the exact email to send back, the regulation to cite, and three sentences you should never say.",
  excerpt:
    "If your prime is asking for a 0–110 SPRS score and you're a Level 1 contractor, the answer is not zero. It's that you're a different tier of the regulation. Here's how to say that without losing the contract.",
  datePublished: "2026-05-11",
  dateModified: "2026-05-11",
  category: "SPRS & Affirmation",
  keywords: [
    "sprs score level 1",
    "prime asking sprs score",
    "do level 1 contractors have sprs score",
    "cmmc level 1 prime questionnaire",
    "supplier cybersecurity questionnaire response",
    "sprs affirmation level 1",
  ],
  readingMinutes: 9,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Do CMMC Level 1 contractors have an SPRS score?",
      answer:
        "No. CMMC Level 1 contractors do not have a 0-110 SPRS score. The numeric score (range -203 to +110) is the NIST SP 800-171 Basic Assessment score required by DFARS 252.204-7019/-7020 for Level 2 contractors who handle Controlled Unclassified Information. Level 1 contractors instead post an annual CMMC Level 1 self-assessment affirmation in SPRS, which is binary: MET or NOT MET.",
    },
    {
      question:
        "What do I tell a prime that asks for my SPRS score when I'm Level 1?",
      answer:
        "Tell them the truth in writing: you are a CMMC Level 1 contractor and the 0-110 SPRS score (from the NIST 800-171 Basic Assessment) does not apply to Level 1 work. Offer the equivalent: your most recent annual CMMC Level 1 self-assessment affirmation, posted in SPRS, with the senior official's name and the date. Cite FAR 52.204-21 as the controlling clause for your work. Most primes accept this answer; it is the correct one under the regulation.",
    },
    {
      question:
        "Can a prime require a Level 1 contractor to have a SPRS score?",
      answer:
        "A prime can ask for whatever it wants in its supplier questionnaire, but it cannot require something the regulation does not require. If the prime's underlying DoD contract does not flow down DFARS 252.204-7012 (the clause that triggers CUI safeguarding and the 0-110 score requirement), then the sub is a Level 1 contractor and does not owe a 0-110 score. If the prime insists, ask which contract clause they are flowing down — that question usually ends the conversation.",
    },
    {
      question: "What does a Level 1 affirmation in SPRS look like?",
      answer:
        "A Level 1 affirmation is an annual record in the Supplier Performance Risk System (SPRS) showing the contractor's CAGE code, the affirmation date, the name and title of the senior company official who affirmed, and the status: MET or NOT MET. It does not produce a numeric score. The affirmation must be renewed annually. Primes can verify Level 1 affirmations directly in SPRS if they have access.",
    },
    {
      question: "Should I just compute a SPRS score to satisfy the prime?",
      answer:
        "No. Submitting a fabricated or unjustified 0-110 score to your prime — and especially to SPRS — is a false statement to the federal government under 18 U.S.C. § 1001 with False Claims Act exposure under 31 U.S.C. § 3729. The DOJ's Civil Cyber-Fraud Initiative has produced settlements of $1M to $9M+ against contractors who misrepresented cybersecurity posture. The right move is to push back politely with the correct answer, in writing.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the 30-second answer" },
  { id: "why-asking", label: "Why your prime is asking" },
  { id: "two-systems", label: "There are two scoring systems. You're in the other one." },
  { id: "email-script", label: "The exact email to send back" },
  { id: "never-say", label: "Three sentences you should never say" },
  { id: "if-they-push", label: "If the prime pushes back" },
  { id: "what-now", label: "What to do this week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The answer in 50 words">
        <p>
          If your prime asks for your <strong>SPRS score</strong> and
          you&apos;re a <strong>CMMC Level 1</strong> contractor, you
          don&apos;t have one &mdash; and that&apos;s the correct answer.
          The 0&ndash;110 SPRS score is required only at Level 2 (DFARS
          252.204-7019/-7020). At Level 1, you affirm annually in SPRS
          with a binary <strong>MET</strong> status. Send that, cite FAR
          52.204-21, and you&apos;re done.
        </p>
      </Callout>

      <P>
        It almost always happens the same way. A prime contractor &mdash;
        Lockheed, Raytheon, General Dynamics, a Tier-2 sub of one of
        them, or somebody&apos;s purchasing department running a generic
        cybersecurity supplier questionnaire &mdash; emails you a PDF
        with a question that looks like this:
      </P>

      <Quote>
        <em>
          &ldquo;Please provide your most recent SPRS NIST SP 800-171
          assessment score. Score must be 88 or above for award.&rdquo;
        </em>
      </Quote>

      <P>
        And if you&apos;re a Level 1 contractor &mdash; the small
        machine shop, the IT services firm, the electrical contractor
        with three federal contracts &mdash; the honest answer is that{" "}
        <em>you don&apos;t have one of those scores</em>. Not because
        you forgot. Because the regulation doesn&apos;t generate one for
        your tier.
      </P>
      <P>
        This post is how to say that without losing the contract.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; the 30-second answer</H2>
      <UL>
        <li>
          The 0&ndash;110 SPRS score is the{" "}
          <strong>NIST SP 800-171 Basic Assessment score</strong>{" "}
          required by DFARS 252.204-7019/-7020 for Level 2 contractors.
        </li>
        <li>
          As a Level 1 contractor under FAR 52.204-21, you don&apos;t
          generate that score &mdash; you instead post an{" "}
          <strong>annual Level 1 affirmation</strong> in SPRS that&apos;s
          binary (MET / NOT MET).
        </li>
        <li>
          Most primes accept the Level 1 affirmation as the correct
          equivalent the moment you explain it in writing with the
          regulation cited.
        </li>
        <li>
          <strong>Do not</strong> compute a number to make the form
          happy. That&apos;s the path to a False Claims Act problem.
        </li>
      </UL>

      <H2 id="why-asking">Why your prime is asking</H2>
      <P>
        Primes are not trying to trip you up. They&apos;re running the
        same questionnaire on 200 suppliers because their compliance team
        wrote it for the worst-case &mdash; the Level 2 sub with CUI
        sitting on their network. The question got copied onto every
        supplier&apos;s onboarding packet because that was easier than
        building two flows. When you push back with the correct answer,
        their compliance team almost always nods and moves on. They
        appreciate that you know the regulation.
      </P>

      <H2 id="two-systems">There are two scoring systems. You&apos;re in the other one.</H2>
      <P>
        The federal cybersecurity regulation has two parallel regimes.
        They live in different parts of the FAR/DFARS and they produce
        different results.
      </P>
      <UL>
        <li>
          <strong>Level 1 / FAR 52.204-21 regime.</strong> Triggered by
          Federal Contract Information (FCI). 15 safeguarding
          requirements. Self-assessed annually. Senior-official
          affirmation posted in SPRS. <strong>Result: MET or NOT MET.</strong>{" "}
          No 0&ndash;110 number.
        </li>
        <li>
          <strong>Level 2 / DFARS 252.204-7012, -7019, -7020 regime.</strong>{" "}
          Triggered by Controlled Unclassified Information (CUI). 110
          NIST SP 800-171 controls. Basic Assessment scored on a
          &ndash;203 to +110 scale; minimum 88 to be eligible.{" "}
          <strong>Result: numeric SPRS score.</strong>
        </li>
      </UL>
      <P>
        Your prime&apos;s questionnaire is asking about the second
        regime. You are correctly affirming in the first. They are not
        contradictory; they are not the same.
      </P>

      <H2 id="email-script">The exact email to send back</H2>
      <P>
        Copy, paste, edit the bracketed bits, and send. Plain English.
        No need to apologize.
      </P>
      <Callout tone="info" title="Suggested reply">
        <p>
          <strong>Subject:</strong> CMMC Level 1 affirmation in lieu of
          SPRS NIST 800-171 score &mdash; [your company name]
        </p>
        <p>Hi [name],</p>
        <p>
          Thanks for the supplier security questionnaire. A quick note
          on the SPRS score question.
        </p>
        <p>
          Our work for [your prime / the underlying federal contract] is
          governed by <strong>FAR 52.204-21</strong> (basic safeguarding
          of Federal Contract Information), not DFARS 252.204-7012, so
          we fall under <strong>CMMC Level 1</strong>. CMMC Level 1
          doesn&apos;t produce a 0&ndash;110 SPRS score &mdash; that
          number is the NIST SP 800-171 Basic Assessment required by
          DFARS 252.204-7019/-7020 for Level 2 contractors who handle
          CUI.
        </p>
        <p>
          What we do post annually in SPRS is the{" "}
          <strong>CMMC Level 1 affirmation</strong>: a senior-official
          attestation that we meet all 15 FAR 52.204-21(b)(1)
          safeguarding requirements. Our most recent affirmation:
        </p>
        <UL>
          <li>CAGE code: [your CAGE]</li>
          <li>Affirmation status: MET</li>
          <li>Affirmation date: [date]</li>
          <li>Affirming official: [name, title]</li>
        </UL>
        <p>
          Happy to send a copy of our system security plan, our
          self-assessment record, or both, if that helps your file.
        </p>
        <p>
          Thanks,<br />
          [Your name]
        </p>
      </Callout>

      <H2 id="never-say">Three sentences you should never say</H2>
      <OL>
        <li>
          <strong>&ldquo;Our score is 110.&rdquo;</strong> &mdash; You
          don&apos;t have a 0&ndash;110 score, and stating one is a
          false statement to the federal government once it gets passed
          up the chain.
        </li>
        <li>
          <strong>&ldquo;We&apos;re working on getting a SPRS
          score.&rdquo;</strong> &mdash; You aren&apos;t. There&apos;s
          nothing to work on. The score does not apply to your tier.
        </li>
        <li>
          <strong>&ldquo;Just put zero.&rdquo;</strong> &mdash; Zero is
          a real Level 2 outcome that means &ldquo;none of the 110
          controls implemented&rdquo; and would torpedo any sub on a
          DFARS 7012 contract. Don&apos;t volunteer a number.
        </li>
      </OL>

      <H2 id="if-they-push">If the prime pushes back</H2>
      <P>
        If after your email the prime still insists on a 0&ndash;110
        number, ask one question:
      </P>
      <Quote>
        <em>
          &ldquo;Could you share which contract clause is being flowed
          down to us &mdash; FAR 52.204-21, or DFARS 252.204-7012? If
          7012 is in the flow-down, we need to know so we can scope
          accordingly. If it&apos;s only 52.204-21, then our Level 1
          affirmation is the regulatory match.&rdquo;
        </em>
      </Quote>
      <P>
        One of two things happens:
      </P>
      <OL>
        <li>
          <strong>They confirm only FAR 52.204-21 flows down.</strong>{" "}
          You&apos;re Level 1. Your affirmation is the answer. The
          conversation ends.
        </li>
        <li>
          <strong>They confirm DFARS 252.204-7012 flows down.</strong>{" "}
          You actually are a Level 2 contractor. The 0&ndash;110 score
          is genuinely required. You need to either implement NIST SP
          800-171 and post a real Basic Assessment score, or decline
          the work. (Read our{" "}
          <Link
            href="/blog/cmmc-level-1-vs-level-2"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            L1 vs L2 guide
          </Link>{" "}
          for the next step.)
        </li>
      </OL>
      <P>
        Either outcome is a win &mdash; you now know your real
        obligation in writing.
      </P>

      <H2 id="what-now">What to do this week</H2>
      <OL>
        <li>
          Take the free{" "}
          <Link
            href="/sprs-check"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            SPRS readiness quiz
          </Link>{" "}
          (4 minutes) to confirm Level 1 actually applies to your
          contracts.
        </li>
        <li>
          If you haven&apos;t posted a Level 1 affirmation in SPRS this
          year, that&apos;s the work in front of you. The full sprint
          takes most small contractors 1&ndash;2 weeks of focused effort.
        </li>
        <li>
          Save the email template above into your prime-response folder.
          You&apos;ll use it again.
        </li>
        <li>
          <Link
            href="/bid-digest"
            className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
          >
            Subscribe to the Monday Bid Digest
          </Link>{" "}
          &mdash; weekly federal opportunities curated for Level 1
          contractors.
        </li>
      </OL>

      <H2 id="faq">FAQ</H2>
      <H3>Do Level 1 contractors have a SPRS score?</H3>
      <P>
        No. The 0&ndash;110 SPRS score is the NIST SP 800-171 Basic
        Assessment score required by DFARS 252.204-7019/-7020 for Level
        2. Level 1 contractors post a binary affirmation (MET / NOT MET)
        in SPRS.
      </P>
      <H3>What do I send my prime instead?</H3>
      <P>
        Your most recent annual CMMC Level 1 affirmation: CAGE code,
        affirmation date, status (MET), and the name and title of the
        senior official who affirmed. Cite FAR 52.204-21 as your
        controlling clause.
      </P>
      <H3>What if the prime won&apos;t accept my Level 1 affirmation?</H3>
      <P>
        Ask which contract clause is flowing down. If only FAR 52.204-21,
        your Level 1 affirmation is regulatorily correct. If DFARS
        252.204-7012, you may actually be Level 2 and need to plan
        accordingly.
      </P>
      <H3>Can I just compute a score to satisfy the form?</H3>
      <P>
        No. Submitting a fabricated number to SPRS or to a prime is a
        federal false statement under 18 U.S.C. § 1001 with False Claims
        Act exposure under 31 U.S.C. § 3729.
      </P>
      <H3>How long does a Level 1 affirmation last?</H3>
      <P>
        One year. It must be renewed annually by a senior company
        official under 32 CFR § 170.22.
      </P>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
