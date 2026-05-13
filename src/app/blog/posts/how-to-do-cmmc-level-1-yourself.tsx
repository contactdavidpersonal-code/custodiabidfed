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
  slug: "how-to-do-cmmc-level-1-yourself",
  title:
    "How to Do CMMC Level 1 Yourself (Free, Complete Guide) — 2026",
  description:
    "The complete, honest, end-to-end guide to doing CMMC Level 1 yourself — for free. Seven steps, eight printable templates, plain English. Built by engineers, not consultants.",
  excerpt:
    "CMMC Level 1 is self-assessed. You don't need a consultant. Here is the entire DIY path, with every template you'll need, written for the small defense contractors actually doing the work.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "how to do cmmc level 1",
    "diy cmmc level 1",
    "do cmmc level 1 yourself",
    "cmmc level 1 free",
    "cmmc level 1 self assessment guide",
    "cmmc level 1 step by step",
    "cmmc level 1 without consultant",
    "cmmc level 1 small business",
  ],
  readingMinutes: 11,
  author: {
    name: "David Fuentes",
    title: "Compliance Officer, Custodia",
  },
  faq: [
    {
      question: "Can I really do CMMC Level 1 by myself?",
      answer:
        "Yes. CMMC Level 1 is explicitly designed for self-assessment — there is no third-party assessor required, no government auditor, no certification body. Every Level 1 contractor self-attests in SPRS annually. The DoD's own rule (32 CFR 170.15) names self-assessment as the default and only mode for Level 1.",
    },
    {
      question: "How long does the DIY path take?",
      answer:
        "About 4 hours of focused work spread across a week, if you start from a reasonably modern IT setup (Microsoft 365 Business or Google Workspace, modern operating systems, a firewall). Add 1–3 days if you need to install MFA across cloud apps, configure antivirus, or set up a separate guest Wi-Fi.",
    },
    {
      question: "What do consultants charge for CMMC Level 1, and what do they actually do?",
      answer:
        "Level 1 engagements typically run $5k–$40k. The deliverables are: a scoping conversation, an SSP, eight or so policies, a gap assessment, and remediation guidance. Every one of those artifacts is something a small contractor can produce themselves with the templates we publish for free. The legitimate work a consultant adds is project management and accountability — not unique knowledge.",
    },
    {
      question: "What's the risk of doing it wrong?",
      answer:
        "Honest mistakes during self-assessment are not the legal exposure. Knowingly false attestations are. Since 2022, the DOJ's Civil Cyber-Fraud Initiative has pursued contractors who claimed compliance they didn't have under the False Claims Act, with settlements in the millions. The protective move is: implement what you can, document what you've done, sign your attestation only when it's truly accurate. If you have a gap, fix it before you submit.",
    },
    {
      question: "When should I use a platform like Custodia instead?",
      answer:
        "Three cases. (1) You're targeting Level 2 — that requires a C3PAO and is genuinely a different process. (2) Your prime requires recurring evidence collection (quarterly logs, change records, screen-shots), and the manual cycle eats more than $149/mo of your time. (3) The annual renewal is what keeps slipping. The free DIY path produces the same artifacts; the platform produces them without you having to think about it.",
    },
    {
      question: "What do I actually post to SPRS at Level 1?",
      answer:
        "An affirmation — your statement that your company meets all 15 safeguarding requirements of FAR 52.204-21. There is no numerical score (that's Level 2's NIST 800-171 score on a -203 to +110 scale). At Level 1 it is binary: MET or NOT MET. Posting is done in PIEE → SPRS → Cyber Reports by an authorized affirming official (owner, CEO, or delegated CIO).",
    },
  ],
};

const TOC_ITEMS = [
  { id: "tldr", label: "TL;DR — the path in 60 seconds" },
  { id: "who", label: "Who this works for" },
  { id: "stack", label: "The seven steps" },
  { id: "templates", label: "Every template you'll need" },
  { id: "time-cost", label: "Real time and real cost" },
  { id: "common-mistakes", label: "Five mistakes to avoid" },
  { id: "when-pay", label: "When to give up and pay someone" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="The honest version">
        <p>
          CMMC Level 1 is self-assessed. The DoD does not require a
          consultant, an assessor, or a platform to do it. If you have
          ~4 focused hours, our printable templates, and a modern IT
          stack, you can finish the entire process in a week and
          appear in SPRS the same day you submit.
        </p>
        <p className="mt-2">
          We sell a platform. We&apos;re still going to tell you how
          to do this for free.
        </p>
      </Callout>

      <P>
        The federal compliance industrial complex would prefer you
        didn&apos;t know any of this. CMMC Level 1 has been treated
        for years as a thing only consultants can navigate, and a
        thing only $20k engagements can deliver. Neither is true. The
        rule is published. The 15 requirements are short. The
        assessment is yours to run. This guide walks you through the
        complete free DIY path &mdash; the same path our platform
        automates for you for $149/mo when you decide you&apos;d
        rather not maintain it manually.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="tldr">TL;DR &mdash; the path in 60 seconds</H2>
      <OL>
        <li>
          <strong>Decide it applies.</strong> If your DoD contracts
          reference <code>FAR 52.204-21</code>, Level 1 applies. If
          they mention CUI or <code>DFARS 252.204-7012</code>, you owe
          Level 2 instead.
        </li>
        <li>
          <strong>Scope the boundary.</strong> List the people,
          devices, and cloud apps that touch federal contract
          information. Sketch the diagram.
        </li>
        <li>
          <strong>Inventory the assets.</strong> Users, devices, keys,
          cloud accounts.
        </li>
        <li>
          <strong>Write eight one-page policies.</strong> Adapt our
          templates. Sign and date them.
        </li>
        <li>
          <strong>Implement the 15 controls.</strong> Most are
          configuration changes in tools you already own.
        </li>
        <li>
          <strong>Write your SSP.</strong> One document, 15 short
          paragraphs.
        </li>
        <li>
          <strong>Self-assess, attest, post to SPRS.</strong> Calendar
          the annual renewal.
        </li>
      </OL>
      <P>
        Each step links to a free, printable template. Full handbook
        is here:{" "}
        <Link
          href="/cmmc-level-1/diy"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>The Free DIY CMMC Level 1 Handbook</strong>
        </Link>
        .
      </P>

      <H2 id="who">Who this works for</H2>
      <P>
        The DIY path is genuinely realistic for the contractor who:
      </P>
      <UL>
        <li>Handles FCI only, not CUI (Level 1 territory, not Level 2)</li>
        <li>Has a modern IT stack &mdash; M365 Business or Google Workspace, modern operating systems, a router or firewall less than 5 years old</li>
        <li>Can carve out 4 focused hours over the next week or two</li>
        <li>Has someone on staff who can navigate cloud admin consoles (or a friendly IT person who can sit with you for an afternoon)</li>
      </UL>
      <P>
        It is <em>not</em> the right path if:
      </P>
      <UL>
        <li>You handle CUI &mdash; see our <Link href="/blog/cui-vs-fci" className="underline decoration-[#2f8f6d] underline-offset-2">CUI vs FCI guide</Link> &mdash; that&apos;s a different game.</li>
        <li>Your prime is asking for evidence on a recurring basis, with audit-style rigor.</li>
        <li>Your &ldquo;IT system&rdquo; is a 2015 desktop, a USB key, and a printer.</li>
      </UL>

      <H2 id="stack">The seven steps</H2>

      <H3>Step 1 &mdash; Decide if you actually need it</H3>
      <P>
        Open your last three federal contracts or subcontracts. Search
        the text for the strings <code>FAR 52.204-21</code> and{" "}
        <code>CUI</code>.
      </P>
      <TableSimple
        head={["What you find", "What that means"]}
        rows={[
          [
            "FAR 52.204-21 only",
            "<strong>Level 1.</strong> Continue this guide.",
          ],
          [
            "CUI mentioned, or DFARS 252.204-7012",
            "<strong>Level 2.</strong> Stop — see <a href='/blog/dfars-7012-vs-cmmc' class='underline'>DFARS 7012 vs CMMC</a>.",
          ],
          [
            "Neither",
            "CMMC may not apply yet. Save this guide.",
          ],
        ]}
      />

      <H3>Step 2 &mdash; Scope your boundary</H3>
      <P>
        This is the single most expensive decision in the whole
        process. Scope means drawing a line around the people,
        devices, cloud apps, and rooms that touch FCI. Anything
        inside has to meet the 15 controls. Anything outside
        doesn&apos;t.
      </P>
      <Callout tone="warn" title="The mistake that doubles your work">
        <p>
          The default move is to treat <em>everything in the
          company</em> as in-scope. A 6-person shop usually has 3
          laptops, 2 cloud apps, and a firewall in scope &mdash; not
          twenty systems. Time spent scoping carefully is time
          you&apos;ll never spend on unnecessary controls.
        </p>
      </Callout>
      <P>
        Use the free{" "}
        <Link
          href="/cmmc-level-1/scoping-worksheet"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>Scoping Worksheet</strong>
        </Link>
        . List in-scope people, devices, cloud apps, network, physical
        area, then draw the boundary diagram. Total time: about 20
        minutes for a small shop.
      </P>

      <H3>Step 3 &mdash; Inventory your assets</H3>
      <P>
        If you completed the scoping worksheet, the asset inventory is
        done &mdash; it&apos;s the same tables. Keep it current. Update
        it when someone joins, someone leaves, or you adopt a new
        cloud app.
      </P>

      <H3>Step 4 &mdash; Write your eight policies</H3>
      <P>
        Level 1 maps cleanly to eight one-page policies, one per
        control family plus incident response and acceptable use. The
        free{" "}
        <Link
          href="/cmmc-level-1/policy-templates"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>Policy Pack</strong>
        </Link>{" "}
        has all eight. Adapt the language to your company, have the
        affirming official sign and date each one, and file them.
      </P>
      <P>
        The eight policies:
      </P>
      <UL>
        <li>Access Control</li>
        <li>Identification &amp; Authentication</li>
        <li>Media Protection &amp; Disposal</li>
        <li>Physical Protection</li>
        <li>Network &amp; Boundary Protection</li>
        <li>System Integrity &amp; Patching</li>
        <li>Incident Response</li>
        <li>Acceptable Use</li>
      </UL>

      <H3>Step 5 &mdash; Implement the 15 controls</H3>
      <P>
        The actual technical work. For most small contractors,
        90% of this is configuration changes in tools you already
        own. The full breakdown of each requirement is in our{" "}
        <Link
          href="/blog/cmmc-level-1-17-practices"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          15 requirements explained
        </Link>{" "}
        post. The highest-leverage moves:
      </P>
      <UL>
        <li><strong>Turn on MFA</strong> across every cloud app, especially email and remote access</li>
        <li><strong>Verify Defender / endpoint AV</strong> is on every in-scope device</li>
        <li><strong>Document who has admin</strong> rights and prune the list</li>
        <li><strong>Start a visitor log</strong> &mdash; a clipboard at the front desk is fine</li>
        <li><strong>Set up a separate guest Wi-Fi</strong> isolated from the work network</li>
        <li><strong>Configure auto-update</strong> on operating systems and apps</li>
        <li><strong>Document a wipe / shred procedure</strong> for old laptops and drives, and start a disposal log</li>
      </UL>
      <Callout tone="info" title="What you do NOT need to buy">
        <p>
          We have seen Level 1 contractors talked into enterprise EDR
          ($30/endpoint/month), a SIEM ($1k+/month), an MSP retainer
          ($3k+/month), or a GRC platform that charges per assessor.
          None of these are required at Level 1. Save the budget for
          Level 2 if you ever get there.
        </p>
      </Callout>

      <H3>Step 6 &mdash; Write your SSP</H3>
      <P>
        The System Security Plan is the one document a prime will
        actually ask for. It says, in plain English, how you
        implement each of the 15 controls. Two to four sentences per
        control, total of about three printable pages.
      </P>
      <P>
        Use the free{" "}
        <Link
          href="/cmmc-level-1/ssp-template"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>SSP Template</strong>
        </Link>
        . Fill in the blanks. Sign and date. Save the PDF where you
        can find it on demand.
      </P>

      <H3>Step 7 &mdash; Self-assess, attest, post to SPRS</H3>
      <P>
        Walk through the{" "}
        <Link
          href="/cmmc-level-1/checklist"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>printable checklist</strong>
        </Link>{" "}
        and honestly score each of the 15 controls as MET or NOT MET.
        At Level 1 there is no partial credit and no plan-of-action
        substitute &mdash; you either meet all 15 or you fix the gaps
        and reassess.
      </P>
      <P>
        Once every control is MET, post the affirmation in SPRS using
        the{" "}
        <Link
          href="/cmmc-level-1/sprs-walkthrough"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          <strong>SPRS walkthrough</strong>
        </Link>
        . Take a screenshot of the confirmation. Save it with your
        SSP. Set a calendar reminder for 11 months from today &mdash;
        the{" "}
        <Link
          href="/cmmc-level-1/annual-affirmation"
          className="underline decoration-[#2f8f6d] underline-offset-2"
        >
          annual affirmation
        </Link>{" "}
        is what keeps your bid-ready status alive.
      </P>

      <H2 id="templates">Every template you&apos;ll need</H2>
      <P>
        All free. All printable. All built from primary sources (FAR
        52.204-21, 32 CFR Part 170). No email gate.
      </P>
      <UL>
        <li><Link href="/cmmc-level-1/scoping-worksheet" className="underline decoration-[#2f8f6d] underline-offset-2">Scoping worksheet</Link> &mdash; 20 minutes, defines the boundary</li>
        <li><Link href="/cmmc-level-1/ssp-template" className="underline decoration-[#2f8f6d] underline-offset-2">SSP template</Link> &mdash; 60 minutes, fill-in-the-blank for all 15 controls</li>
        <li><Link href="/cmmc-level-1/policy-templates" className="underline decoration-[#2f8f6d] underline-offset-2">8 policy templates</Link> &mdash; 45 minutes, one page each</li>
        <li><Link href="/cmmc-level-1/checklist" className="underline decoration-[#2f8f6d] underline-offset-2">Self-assessment checklist</Link> &mdash; 30 minutes, plain English</li>
        <li><Link href="/cmmc-level-1/sprs-walkthrough" className="underline decoration-[#2f8f6d] underline-offset-2">SPRS walkthrough</Link> &mdash; step-by-step posting</li>
        <li><Link href="/cmmc-level-1/annual-affirmation" className="underline decoration-[#2f8f6d] underline-offset-2">Annual affirmation guide</Link> &mdash; 15 minutes/year, keep it alive</li>
      </UL>

      <H2 id="time-cost">Real time and real cost</H2>
      <TableSimple
        head={["Step", "Time", "Out-of-pocket cost"]}
        rows={[
          ["Scope your boundary", "20 min", "$0"],
          ["Inventory assets", "Included in scoping", "$0"],
          ["Write 8 policies", "45 min", "$0"],
          ["Implement 15 controls", "1–3 days", "$0–500 (a new firewall, if needed)"],
          ["Write the SSP", "60 min", "$0"],
          ["Self-assess + checklist", "30 min", "$0"],
          ["Post to SPRS", "30 min (longer if no PIEE)", "$0"],
          ["<strong>Total</strong>", "<strong>~4 hours of focused work</strong>", "<strong>$0–500</strong>"],
        ]}
      />

      <H2 id="common-mistakes">Five mistakes that derail DIY contractors</H2>
      <OL>
        <li>
          <strong>Scoping too wide.</strong> Treating every laptop in
          the company as in-scope doubles or triples your work for no
          compliance benefit.
        </li>
        <li>
          <strong>Copying policies you don&apos;t actually
          follow.</strong> A policy that says &ldquo;we encrypt all
          USB drives&rdquo; when you don&apos;t is worse than no policy.
        </li>
        <li>
          <strong>Submitting before fixing gaps.</strong> Attesting MET
          when you&apos;re NOT MET is the False Claims Act exposure.
          Fix it; then attest.
        </li>
        <li>
          <strong>Forgetting the annual renewal.</strong> A stale
          SPRS posting is treated as no posting. Calendar the renewal
          twice.
        </li>
        <li>
          <strong>Not saving evidence.</strong> When a prime asks for
          your SSP, you need to find it in 60 seconds, not 60 minutes.
        </li>
      </OL>

      <H2 id="when-pay">When to give up DIY and pay someone</H2>
      <P>Three honest cases:</P>
      <UL>
        <li>
          <strong>You handle CUI.</strong> That&apos;s Level 2, not
          Level 1. The DIY path stops working &mdash; you need a
          C3PAO assessment and a different document set.
        </li>
        <li>
          <strong>Your prime requires recurring evidence.</strong>{" "}
          Quarterly logs, monthly screenshots, change records on
          demand. Manual cycles fail under this load. A platform
          (ours or someone else&apos;s) is genuinely worth it.
        </li>
        <li>
          <strong>The annual renewal is what keeps slipping.</strong>{" "}
          The most common failure mode of DIY isn&apos;t doing the
          work the first time &mdash; it&apos;s doing it the second
          and third year. That&apos;s exactly what platforms exist
          to solve.
        </li>
      </UL>
      <P>
        For Level 1 specifically, our platform is $149/mo and
        replaces the manual cycle. The 14-day free trial does the
        first SSP, scope, and policies for you using the same
        templates we&apos;ve linked throughout this guide.
      </P>

      <Callout tone="ok" title="The reframe">
        <p>
          CMMC Level 1 is not a $20k engagement disguised as a
          regulatory requirement. It is a two-page rule with 15 line
          items, a self-attestation, and an annual SPRS posting. Now
          you have the entire path. Go open the{" "}
          <Link
            href="/cmmc-level-1/diy"
            className="underline decoration-[#2f8f6d] underline-offset-2"
          >
            handbook
          </Link>{" "}
          and start.
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
