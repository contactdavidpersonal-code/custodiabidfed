import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Callout, H2, H3, OL, P, Prose, TOC, UL } from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-annual-affirmation",
  title: "The CMMC Annual Affirmation: The One Thing That Breaks DIY Compliance — 2026",
  description:
    "Most DIY CMMC contractors do the first year fine — then forget the annual affirmation. Here's why it matters, when it's due, and the 10-point review to do before re-signing.",
  excerpt:
    "Year-one DIY CMMC is easy. Year two is where most contractors quietly lose compliance. Here's how to not be one of them.",
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  category: "CMMC Level 1",
  keywords: [
    "cmmc annual affirmation",
    "cmmc level 1 annual",
    "cmmc renewal",
    "sprs annual affirmation",
    "cmmc affirming official",
    "cmmc yearly affirmation",
  ],
  readingMinutes: 5,
  author: { name: "David Fuentes", title: "Compliance Officer, Custodia" },
  faq: [
    {
      question: "When is the annual affirmation due?",
      answer:
        "Within one year of the previous affirmation. If you posted on June 15, 2025, the next affirmation is due by June 15, 2026. There is no DoD-wide due date — your clock starts on the day you posted.",
    },
    {
      question: "What happens if I miss it?",
      answer:
        "Your SPRS record goes stale. Primes who check your status will see an expired affirmation and treat you as non-compliant. Contracting officers may exclude you from awards until you re-affirm.",
    },
    {
      question: "Does the same person have to sign each year?",
      answer:
        "Not necessarily — the affirming official can change (new CEO, new delegated CIO). But it must still be a senior official authorized to bind the company.",
    },
    {
      question: "Do I have to redo the SSP and scoping every year?",
      answer:
        "You have to review them and update anything that changed. If nothing changed, the review itself is the deliverable — usually a single line: 'Reviewed 2026-06-15, no material changes.'",
    },
  ],
};

const TOC_ITEMS = [
  { id: "why", label: "Why the annual is the hardest part" },
  { id: "calendar", label: "The three-reminder calendar" },
  { id: "review", label: "The 10-point review" },
  { id: "guide", label: "Get the printable guide" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <Callout tone="warn" title="The DIY failure mode">
        <p>
          The most common way DIY CMMC contractors lose compliance is
          not the first-year work &mdash; it&apos;s the annual
          affirmation. A year goes by, business gets busy, the calendar
          reminder gets snoozed, and suddenly you&apos;re 14 months past
          your last attestation. Primes notice.
        </p>
      </Callout>

      <P>
        CMMC Level 1 isn&apos;t a one-time thing. It&apos;s a yearly
        cycle: review, refresh, sign, post. The annual affirmation is
        the single artifact that keeps your bid-ready status alive in
        SPRS. Skip it and your status quietly goes stale.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="why">Why the annual is the hardest part</H2>
      <UL>
        <li>There is no built-in reminder from DoD &mdash; the burden is on you.</li>
        <li>It&apos;s 11 months after the work that made it easy to remember.</li>
        <li>It requires the affirming official, who is usually the busiest person in the company.</li>
        <li>The review work is real (not just a signature), so it can&apos;t be done in five minutes the night before.</li>
      </UL>

      <H2 id="calendar">The three-reminder calendar (steal this)</H2>
      <P>
        Set three calendar reminders today, on the affirming official&apos;s
        calendar:
      </P>
      <OL>
        <li><strong>11 months after posting:</strong> &ldquo;CMMC annual affirmation due next month &mdash; start review.&rdquo;</li>
        <li><strong>11.5 months after posting:</strong> &ldquo;CMMC annual review due in 2 weeks &mdash; block 1 hour.&rdquo;</li>
        <li><strong>11.75 months after posting:</strong> &ldquo;CMMC annual: do not let this slip past today.&rdquo;</li>
      </OL>
      <P>
        Three reminders feels like overkill until you&apos;re the
        person who almost missed it.
      </P>

      <H2 id="review">The 10-point review</H2>
      <P>Before re-signing, walk through:</P>
      <OL>
        <li>Did anyone in scope leave the company? Were their accounts revoked?</li>
        <li>Did anyone new join who handles FCI? Are they listed in the worksheet?</li>
        <li>Did we add or remove cloud apps in scope?</li>
        <li>Did the network change (new firewall, new ISP, new office)?</li>
        <li>Is MFA still enforced everywhere? Spot-check.</li>
        <li>Is endpoint AV / Defender still active on every in-scope device?</li>
        <li>Are patches current? Spot-check 2&ndash;3 devices.</li>
        <li>Did we have any security incidents this year? Are they documented?</li>
        <li>Are the 8 policies still accurate? Re-sign with this year&apos;s date.</li>
        <li>Does the SSP still reflect reality? Update anything that drifted.</li>
      </OL>

      <H2 id="guide">Get the printable guide</H2>
      <P>
        The Custodia annual affirmation guide includes the calendar
        template, the 10-point review checklist, and the sign-off
        block, all on a printable page:{" "}
        <Link href="/cmmc-level-1/annual-affirmation" className="underline decoration-[#2f8f6d] underline-offset-2"><strong>Open the annual affirmation guide &rarr;</strong></Link>
      </P>
      <P>
        Or follow the full DIY path:{" "}
        <Link href="/cmmc-level-1/diy" className="underline decoration-[#2f8f6d] underline-offset-2">
          <strong>The Free DIY CMMC Level 1 Handbook</strong>
        </Link>
        .
      </P>
      <Callout tone="info" title="When this is the breaking point">
        <p>
          If you&apos;ve done the work yourself and the annual is
          what&apos;s genuinely hard to maintain, that&apos;s the
          honest case for paying for a platform. Ours is $149/mo and
          we run the renewal cycle for you. The 14-day free trial
          re-creates everything from your existing artifacts.{" "}
          <Link href="/sign-up" className="underline decoration-[#2f8f6d] underline-offset-2">Start the trial &rarr;</Link>
        </p>
      </Callout>

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
