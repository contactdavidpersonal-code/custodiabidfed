import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Callout, H2, H3, OL, P, Prose, TOC, UL } from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "how-to-post-sprs-score",
  title: "How to Post Your CMMC Affirmation to SPRS (Step by Step) — 2026",
  description:
    "The complete walkthrough for posting your CMMC Level 1 affirmation in SPRS via PIEE. Eight steps, the gotchas to avoid, and what to do if you don't have a PIEE account yet.",
  excerpt:
    "Posting your SPRS affirmation is the action that makes you bid-ready. Here's the exact 8-step walkthrough.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "how to post sprs score",
    "sprs cmmc level 1",
    "post cmmc affirmation",
    "sprs walkthrough",
    "submit cmmc level 1 sprs",
    "piee sprs cmmc",
  ],
  readingMinutes: 7,
  author: { name: "David Fuentes", title: "Compliance Officer, Custodia" },
  faq: [
    {
      question: "Do I need a PIEE account first?",
      answer:
        "Yes. PIEE (Procurement Integrated Enterprise Environment) is the wrapper that owns SPRS access. If you don't have a PIEE account already, set one up at piee.eb.mil before you try to post. New accounts can take 1–3 business days to approve.",
    },
    {
      question: "What role do I request in SPRS?",
      answer:
        "Cyber Reports — Contractor. This is the role that lets the affirming official post the Level 1 affirmation. Your CAGE/HLO administrator approves it.",
    },
    {
      question: "Is there a numerical score at Level 1?",
      answer:
        "No. Level 1 is a binary affirmation — MET or NOT MET on all 15 controls. The numerical SPRS score on the -203 to +110 scale is for NIST SP 800-171 / CMMC Level 2.",
    },
    {
      question: "What if I can't mark MET on all 15?",
      answer:
        "Don't post yet. Level 1 doesn't have a plan-of-action substitute — you need MET on all 15 to be Level 1 compliant. Fix the gap, then post. Posting a knowingly inaccurate affirmation is the False Claims Act exposure.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "prereqs", label: "Prerequisites" },
  { id: "steps", label: "The 8 steps" },
  { id: "gotchas", label: "Common gotchas" },
  { id: "walkthrough", label: "Get the printable walkthrough" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="Need the printable version?">
        <p>
          The full step-by-step printable walkthrough is here:{" "}
          <Link href="/cmmc-level-1/sprs-walkthrough" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>SPRS walkthrough &rarr;</strong></Link>
        </p>
      </Callout>

      <P>
        Posting your CMMC Level 1 affirmation in SPRS is the action
        that takes you from &ldquo;we&apos;re compliant&rdquo; to
        &ldquo;we&apos;re bid-ready.&rdquo; Until it&apos;s posted,
        primes can&apos;t verify your status and contracting officers
        can&apos;t award. This guide walks you through the actual
        click-by-click process.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="prereqs">Before you start</H2>
      <UL>
        <li><strong>PIEE account</strong> for the affirming official (owner, CEO, or delegated CIO)</li>
        <li><strong>SPRS &ldquo;Cyber Reports&rdquo; role</strong> granted on that account</li>
        <li><strong>Your CAGE code</strong> from SAM.gov</li>
        <li><strong>Your SSP and self-assessment</strong> showing MET on all 15</li>
        <li><strong>30 minutes</strong> &mdash; longer if PIEE setup is needed</li>
      </UL>

      <H2 id="steps">The 8 steps (summary)</H2>
      <OL>
        <li><strong>Confirm PIEE access.</strong> Log into piee.eb.mil with the affirming official&apos;s account.</li>
        <li><strong>Add the SPRS role</strong> if it&apos;s not there. Request via your CAGE/HLO admin.</li>
        <li><strong>Open Cyber Reports</strong> in the SPRS application.</li>
        <li><strong>Click CMMC Status</strong> (Level 1 affirmations are filed here, distinct from NIST SP 800-171 assessments).</li>
        <li><strong>Enter required fields</strong> &mdash; CAGE, system name, affirmation date, scope description.</li>
        <li><strong>Submit the affirmation.</strong> The affirming official must click the affirmation checkbox personally.</li>
        <li><strong>Verify the posting appears</strong> by refreshing and confirming the affirmation date is now on record.</li>
        <li><strong>Calendar the renewal</strong> for 11 months from today. The annual affirmation is the easiest part to forget.</li>
      </OL>
      <P>
        Each step (with screenshots and the specific gotchas) is on
        the printable walkthrough:{" "}
        <Link href="/cmmc-level-1/sprs-walkthrough" className="underline decoration-[#2f8f6d] underline-offset-2">SPRS walkthrough &rarr;</Link>
      </P>

      <H2 id="gotchas">Common gotchas</H2>
      <UL>
        <li><strong>The wrong person tries to affirm.</strong> Only the formally designated affirming official can post.</li>
        <li><strong>New PIEE account, no SPRS role.</strong> You&apos;ll log in and see nothing useful. Add the Cyber Reports role first.</li>
        <li><strong>CAGE mismatch.</strong> The CAGE in PIEE must match the CAGE in SAM.gov exactly.</li>
        <li><strong>Confusing Level 1 with Level 2 forms.</strong> NIST SP 800-171 score entry is the Level 2 path. Level 1 is the CMMC Status affirmation.</li>
      </UL>

      <H2 id="walkthrough">Get the printable walkthrough</H2>
      <P>
        <Link href="/cmmc-level-1/sprs-walkthrough" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>Open the SPRS walkthrough &rarr;</strong></Link>
      </P>
      <P>
        Or follow the full DIY path:{" "}
        <Link href="/cmmc-level-1/diy" className="underline decoration-[#2f8f6d] underline-offset-2">
          <strong>The Free DIY CMMC Level 1 Handbook</strong>
        </Link>
        .
      </P>

      <H2 id="faq">FAQ</H2>
      {meta.faq?.map((f) => (
        <div key={f.question} className="mt-6">
          <H3>{f.question}</H3>
          <P>{f.answer}</P>
        </div>
      ))}
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
