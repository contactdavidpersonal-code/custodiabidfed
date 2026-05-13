import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Callout, H2, H3, P, Prose, TOC, UL } from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-policies-free-templates",
  title: "The 8 CMMC Level 1 Policies You Need (Free Templates) — 2026",
  description:
    "CMMC Level 1's 15 controls roll up into 8 one-page policies. Here is the full list, what each covers, and a link to the free, printable templates.",
  excerpt:
    "Eight one-page policies cover every CMMC Level 1 control. Here's the list, with free templates — no 40-page manual required.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cmmc policy templates",
    "cmmc level 1 policies",
    "cmmc policies free",
    "cmmc policy template free",
    "information security policy template",
    "cmmc policy pack",
  ],
  readingMinutes: 5,
  author: { name: "David Fuentes", title: "Compliance Officer, Custodia" },
  faq: [
    {
      question: "Do I really need 8 policies?",
      answer:
        "You need enough policy coverage that every one of the 15 controls is governed by a written statement of intent. Eight one-page policies is the cleanest way to do that. You could combine them into 2 or 3 longer documents — but the eight one-pagers are easier to maintain, sign, and produce on demand.",
    },
    {
      question: "Can I use ChatGPT to draft them?",
      answer:
        "You can — but the output will be generic and won't reflect what your company actually does. Our templates give you the structure; you fill in the specifics (your tools, your processes, your roles). A policy that doesn't reflect operational reality is worse than no policy.",
    },
    {
      question: "How often do these need to be reviewed?",
      answer:
        "At minimum annually, before your SPRS affirmation. Also when scope changes, when you adopt a new tool, or when an incident reveals a gap.",
    },
  ],
};

const TOC_ITEMS = [
  { id: "list", label: "The 8 policies" },
  { id: "rules", label: "Rules for good policy" },
  { id: "templates", label: "Get the free pack" },
  { id: "faq", label: "FAQ" },
];

const POLICIES = [
  { t: "Access Control", c: "Who gets access to what, how access is reviewed, how it's revoked." },
  { t: "Identification & Authentication", c: "How users prove who they are. MFA. Password rules. Service accounts." },
  { t: "Media Protection & Disposal", c: "How USBs, hard drives, and printed FCI are handled and destroyed." },
  { t: "Physical Protection", c: "Visitor logs. Locked doors. Where FCI is physically stored." },
  { t: "Network & Boundary Protection", c: "Firewall, guest Wi-Fi separation, what crosses the boundary." },
  { t: "System Integrity & Patching", c: "Antivirus, patch cycles, monitoring for malicious activity." },
  { t: "Incident Response", c: "What counts as an incident. Who to call. The 72-hour DoD reporting rule." },
  { t: "Acceptable Use", c: "What employees may and may not do with company devices and FCI." },
];

function Body() {
  return (
    <Prose>
      <Callout tone="ok" title="Get the templates">
        <p>
          The free policy pack (all 8, one page each, ready to sign):{" "}
          <Link href="/cmmc-level-1/policy-templates" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>Open the policy pack &rarr;</strong></Link>
        </p>
      </Callout>

      <P>
        Consultants love selling Information Security Manuals. We&apos;ve
        seen $8,000 invoices for 40-page documents that nobody on the
        contractor&apos;s team ever reads. For CMMC Level 1, that&apos;s
        unnecessary. The 15 safeguarding requirements roll cleanly into
        eight one-page policies. Each one fits on a single sheet, gets
        signed by the affirming official, and lives in a folder you can
        produce on demand.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="list">The 8 policies (and what each covers)</H2>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {POLICIES.map((p, i) => (
          <div key={p.t} className="border border-[#cfe3d9] bg-white p-5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Policy {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-1 font-serif text-lg font-bold text-[#10231d]">
              {p.t}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#44695c]">
              {p.c}
            </p>
          </div>
        ))}
      </div>

      <H2 id="rules">Rules for policies that actually work</H2>
      <UL>
        <li><strong>One page each.</strong> If it&apos;s longer, it&apos;s not getting read.</li>
        <li><strong>Plain English.</strong> &ldquo;Users must lock their screens when away&rdquo; beats &ldquo;Users shall ensure session termination upon physical departure from the workstation.&rdquo;</li>
        <li><strong>Signed and dated.</strong> By the affirming official. Re-sign annually.</li>
        <li><strong>Reflects what you actually do.</strong> Don&apos;t write &ldquo;quarterly penetration tests&rdquo; if you don&apos;t do them.</li>
        <li><strong>Lives somewhere findable.</strong> A shared drive, a /compliance folder, a binder &mdash; just not someone&apos;s personal laptop.</li>
      </UL>

      <H2 id="templates">Get the free pack</H2>
      <P>
        All 8 policies, printable, in the Rhetorich style. Sign once,
        file, done:{" "}
        <Link href="/cmmc-level-1/policy-templates" className="underline decoration-[#2f8f6d] underline-offset-2">
          <strong>Open the policy pack &rarr;</strong>
        </Link>
      </P>
      <P>
        Full DIY path:{" "}
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
