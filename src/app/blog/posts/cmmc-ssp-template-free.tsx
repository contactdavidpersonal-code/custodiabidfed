import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Callout, H2, H3, OL, P, Prose, TOC, UL } from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-ssp-template-free",
  title: "The Free CMMC Level 1 SSP Template (Fill-in-the-Blank) — 2026",
  description:
    "A free, fill-in-the-blank System Security Plan template for CMMC Level 1. Covers all 15 FAR 52.204-21 safeguarding requirements. Built by engineers, used by hundreds of small defense contractors.",
  excerpt:
    "Your SSP is the one document a prime will actually ask for. Here is the free template that gets you a defensible one in 60 minutes.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cmmc ssp template",
    "cmmc level 1 ssp",
    "system security plan template",
    "ssp template free",
    "cmmc ssp example",
    "far 52.204-21 ssp",
  ],
  readingMinutes: 7,
  author: { name: "David Fuentes", title: "Compliance Officer, Custodia" },
  faq: [
    {
      question: "Is an SSP required for CMMC Level 1?",
      answer:
        "Yes. While the FAR clause itself doesn't use the word 'SSP,' 32 CFR Part 170 and DoD assessment guidance treat the SSP as the canonical evidence artifact for Level 1. Primes routinely request it as part of subcontract flow-down. Practically: if you don't have an SSP and a prime asks, you fail their gate.",
    },
    {
      question: "How long does the SSP need to be?",
      answer:
        "For Level 1, 3–6 pages is normal. Two to four sentences per control, plus a cover page describing your scope. Longer is not better — auditors and primes want to find the answer to 'how do you implement AC.L1-3.1.1?' in 30 seconds.",
    },
    {
      question: "Who signs the SSP?",
      answer:
        "The affirming official — the same person who will sign your SPRS attestation. This is the owner, CEO, or formally delegated CIO. Not an external consultant, not your MSP, not a junior staffer.",
    },
    {
      question: "Does it need to be updated?",
      answer:
        "Yes — at minimum once a year before your annual affirmation, and whenever scope changes materially (new in-scope cloud app, new office, new joiner with FCI access).",
    },
  ],
};

const TOC_ITEMS = [
  { id: "what", label: "What an SSP actually is" },
  { id: "structure", label: "The required structure" },
  { id: "fillout", label: "How to fill it out" },
  { id: "common-mistakes", label: "Common mistakes" },
  { id: "template", label: "Get the free template" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="Get the template now">
        <p>
          The free, fill-in-the-blank SSP template is here:{" "}
          <Link href="/cmmc-level-1/ssp-template" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>SSP template &rarr;</strong></Link>
          {" "}— printable, 15 controls, 60 minutes start to finish.
        </p>
      </Callout>

      <P>
        Every CMMC Level 1 contractor needs a System Security Plan.
        Not because the rule literally says so, but because every
        prime, every government program office, and every assessor
        will ask for one. The SSP is your single source of truth: how
        your company implements each of the 15 FAR 52.204-21
        safeguarding requirements, who is responsible, and where the
        evidence lives.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="what">What an SSP actually is</H2>
      <P>
        An SSP is a short document &mdash; for Level 1, typically 3 to
        6 pages &mdash; that describes how your company implements
        each control. It is not a policy document. Policies describe
        what your company <em>requires</em>. The SSP describes what
        your company <em>does</em> in operational terms.
      </P>
      <UL>
        <li><strong>A policy says:</strong> &ldquo;All users must authenticate with MFA.&rdquo;</li>
        <li><strong>An SSP says:</strong> &ldquo;MFA is enforced on M365 via Conditional Access. The IT admin reviews exception requests monthly. Evidence: the Conditional Access policy export saved in /compliance/2026/.&rdquo;</li>
      </UL>

      <H2 id="structure">The required structure</H2>
      <P>The Custodia template includes:</P>
      <OL>
        <li><strong>Cover page</strong> — company name, CAGE/UEI, system owner, affirming official, version, dates.</li>
        <li><strong>System description</strong> — what the system does, who uses it, what FCI it handles. Two paragraphs.</li>
        <li><strong>Boundary &amp; scope summary</strong> — references your scoping worksheet.</li>
        <li><strong>Control-by-control implementation</strong> — one section per requirement. Prompt: <em>How does your organization implement this? Who is responsible? Where is the evidence?</em></li>
        <li><strong>Attestation block</strong> — signature, title, date.</li>
      </OL>

      <H2 id="fillout">How to fill it out (in 60 minutes)</H2>
      <OL>
        <li><strong>Block 60 uninterrupted minutes.</strong> Have your <Link href="/cmmc-level-1/scoping-worksheet" className="underline decoration-[#2f8f6d] underline-offset-2">scoping worksheet</Link> and policy pack open.</li>
        <li><strong>Fill the cover page first.</strong> Three minutes.</li>
        <li><strong>For each of the 15 controls,</strong> write 2&ndash;4 sentences answering: what we do, who&apos;s responsible, where the evidence lives.</li>
        <li><strong>Reference your policies and inventory.</strong> Don&apos;t repeat them &mdash; cite the document and the file path.</li>
        <li><strong>Sign and date.</strong> Save the PDF in a folder you can find under pressure.</li>
      </OL>

      <H2 id="common-mistakes">Common mistakes</H2>
      <UL>
        <li><strong>Writing aspirational descriptions.</strong> The SSP describes what you actually do, not what you wish you did.</li>
        <li><strong>Pasting policy language verbatim.</strong> Auditors recognize this immediately. It signals the SSP isn&apos;t operational.</li>
        <li><strong>Forgetting evidence pointers.</strong> Every control implementation should say where the proof lives.</li>
        <li><strong>Skipping the annual review.</strong> A 2-year-old SSP is treated as stale.</li>
      </UL>

      <H2 id="template">Get the free template</H2>
      <P>
        The Custodia SSP template is here, free, printable, no email
        gate:{" "}
        <Link href="/cmmc-level-1/ssp-template" className="underline decoration-[#2f8f6d] underline-offset-2">
          <strong>Open the SSP template &rarr;</strong>
        </Link>
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
