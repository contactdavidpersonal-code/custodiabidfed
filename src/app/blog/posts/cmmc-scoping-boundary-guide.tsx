import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Callout, H2, H3, OL, P, Prose, TOC, UL } from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-scoping-boundary-guide",
  title: "CMMC Level 1 Scoping — How to Draw the Boundary (Free Worksheet) — 2026",
  description:
    "Scoping is the single most expensive decision in CMMC Level 1. Here's how to draw a defensible boundary in 20 minutes — and a free worksheet to write it down.",
  excerpt:
    "Treating the whole company as in-scope doubles your work for no compliance benefit. Here's the right way to scope CMMC Level 1.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cmmc scoping",
    "cmmc level 1 scoping",
    "fci boundary",
    "cmmc boundary diagram",
    "cmmc scoping worksheet",
    "what is in scope cmmc",
  ],
  readingMinutes: 6,
  author: { name: "David Fuentes", title: "Compliance Officer, Custodia" },
  faq: [
    {
      question: "What is FCI?",
      answer:
        "Federal Contract Information. It's information provided by or generated for the government under a contract, not intended for public release. Examples: contract performance status, proposal drafts, technical specifications shared with you for delivery. See our CUI vs FCI guide for the line between FCI (Level 1) and CUI (Level 2).",
    },
    {
      question: "Can I exclude a laptop from scope?",
      answer:
        "Yes — if it never touches FCI. The receptionist's laptop, the bookkeeper's laptop used only for QuickBooks, the warehouse tablet used only for inventory: these can be out of scope if they're segregated. Document the segregation in your scoping worksheet.",
    },
    {
      question: "Do I need a fancy network diagram?",
      answer:
        "No. At Level 1 a pencil sketch is acceptable evidence. What matters is that someone unfamiliar with your company can look at it and understand where FCI lives, who can access it, and where the boundary stops.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "why", label: "Why scoping matters" },
  { id: "five-things", label: "Five things to scope" },
  { id: "out-of-scope", label: "What can be out of scope" },
  { id: "diagram", label: "Drawing the boundary diagram" },
  { id: "worksheet", label: "Get the free worksheet" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="Get the worksheet">
        <p>
          The free scoping worksheet is here:{" "}
          <Link href="/cmmc-level-1/scoping-worksheet" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>Scoping worksheet &rarr;</strong></Link>
          {" "}— printable, ~20 minutes, signed evidence at the end.
        </p>
      </Callout>

      <H2 id="why">Why scoping is the 90% lever</H2>
      <P>
        Every CMMC dollar you spend is multiplied by the size of your
        scope. If you treat &ldquo;everything in the company&rdquo; as
        in-scope, you owe the 15 controls on every laptop, every cloud
        app, every room, every joiner. If you scope carefully, a
        typical 6-person defense contractor has 3 laptops, 2 cloud
        apps, and one network in scope.
      </P>
      <P>
        Scoping is also the area where consultants extract the most
        margin &mdash; a 30-minute scoping conversation often becomes a
        $4,000 line item. It shouldn&apos;t. Here is what the work
        actually looks like.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="five-things">The five things to scope</H2>
      <OL>
        <li><strong>People who touch FCI.</strong> Names and roles. Not every employee &mdash; only those who handle, view, or store federal contract info.</li>
        <li><strong>Devices that touch FCI.</strong> Laptops, desktops, phones, tablets, on-prem servers. Identified by hostname or serial.</li>
        <li><strong>Cloud apps that store, transmit, or process FCI.</strong> Email is almost always in. CRM &mdash; depends. Accounting &mdash; usually out.</li>
        <li><strong>The network and physical area.</strong> Which Wi-Fi, which firewall, which physical room.</li>
        <li><strong>External connections.</strong> VPNs to primes, B2B portals, MSP remote access.</li>
      </OL>

      <H2 id="out-of-scope">What can legitimately be out of scope</H2>
      <UL>
        <li>A phone or laptop that never touches federal contract info or your work email</li>
        <li>The bookkeeping computer if it&apos;s on its own login and doesn&apos;t hold FCI</li>
        <li>A guest Wi-Fi that&apos;s isolated from the work network</li>
        <li>A shared printer with no scanned FCI in its history</li>
        <li>Personal phones if you don&apos;t allow work email on them</li>
      </UL>
      <Callout tone="info" title="Document the exclusion">
        <p>
          When you exclude something from scope, write down <em>why</em>{" "}
          in the worksheet. &ldquo;Receptionist laptop &mdash; no
          email access, no FCI handled, separate user account.&rdquo;
          That sentence is the difference between defensible scoping
          and arbitrary scope shrinkage.
        </p>
      </Callout>

      <H2 id="diagram">Drawing the boundary diagram</H2>
      <P>
        A boundary diagram is a sketch that shows what&apos;s inside
        the boundary (in scope) and what&apos;s outside. A typical one
        for a small contractor:
      </P>
      <UL>
        <li>A box labeled &ldquo;In-scope work area&rdquo; with the 3 laptops, the work Wi-Fi, the firewall.</li>
        <li>An arrow to &ldquo;M365 / Email&rdquo; in the cloud.</li>
        <li>Outside the box: guest Wi-Fi, personal phones, the front desk computer.</li>
        <li>An arrow showing the connection to your prime&apos;s portal.</li>
      </UL>
      <P>
        Pencil on paper is fine. So is Lucidchart or draw.io or a
        screenshot of a whiteboard. What matters is clarity.
      </P>

      <H2 id="worksheet">Get the free worksheet</H2>
      <P>
        The Custodia scoping worksheet walks you through all five
        elements with tables to fill in and signature blocks:{" "}
        <Link href="/cmmc-level-1/scoping-worksheet" className="underline decoration-[#2f8f6d] underline-offset-2">
          <strong>Open the worksheet &rarr;</strong>
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
