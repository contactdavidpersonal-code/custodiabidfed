import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SPRS CMMC Level 1 filing walkthrough | Custodia",
  description:
    "Step-by-step guide to filing your CMMC Level 1 annual self-assessment in SPRS via PIEE: provision the Cyber Vendor User role, post your assessment, transfer to the Affirming Official if needed, and capture the CMMC Status Date for your Custodia bid packet.",
};

/**
 * Public walkthrough for filing a CMMC Level 1 self-assessment in SPRS.
 *
 * Mirrors `/sam-guide` in tone and structure but is text-first because the
 * SPRS / PIEE portals don't have a public anonymous surface we can
 * screenshot the same way SAM.gov does — screenshots go under
 * `/public/sprs/` once a user shares them with us. Until then the steps
 * are narrative-only.
 *
 * Source authority for every step on this page:
 *   - SPRS CMMC Quick Entry Guide v4.0 (DEC 2024)
 *   - SPRS Access for Cyber Reports v4.0
 *   - 32 CFR § 170.15 (Level 1 self-assessment) and § 170.22 (annual
 *     affirmation cadence)
 *   - DFARS 252.204-7021 (the SPRS-filing obligation itself)
 */
type Step = {
  n: number;
  title: string;
  body: React.ReactNode;
  tip?: React.ReactNode;
};

const steps: Step[] = [
  {
    n: 1,
    title: "Confirm the right PIEE role on your CAGE",
    body: (
      <>
        SPRS is a tile inside the{" "}
        <a
          className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]"
          href="https://piee.eb.mil"
          target="_blank"
          rel="noreferrer noopener"
        >
          Procurement Integrated Enterprise Environment (PIEE)
        </a>
        . To post a CMMC Level 1 self-assessment you need the{" "}
        <strong>SPRS Cyber Vendor User</strong> role on the CAGE your
        company files under. The default{" "}
        <em>Contractor/Vendor (Support Role)</em> is view-only and cannot
        file. If you don&rsquo;t see &ldquo;Cyber Reports&rdquo; inside the
        SPRS tile, your role isn&rsquo;t Cyber Vendor User yet.
      </>
    ),
    tip: (
      <>
        Don&rsquo;t have a PIEE account at all? Register at{" "}
        <a
          className="font-mono text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2"
          href="https://piee.eb.mil/xhtml/unauth/web/homepage/vendorRegistration.xhtml"
          target="_blank"
          rel="noreferrer noopener"
        >
          piee.eb.mil → Vendor Registration
        </a>
        . PIEE uses the same identity provider as SAM.gov for vendor
        logins; the first-time setup takes ~10 minutes.
      </>
    ),
  },
  {
    n: 2,
    title: "Wait for your CAM to activate the role (1–5 business days)",
    body: (
      <>
        Every PIEE role request is reviewed by your company&rsquo;s{" "}
        <strong>Contract Account Manager (CAM)</strong>. If you are the
        first / only person on your CAGE, the CAM is <em>you</em> — but
        you can&rsquo;t activate your own SPRS Cyber Vendor User role from
        inside the PIEE UI. You have to email the DISA Global Service Desk
        to do it for you. Activation typically takes <strong>1–5
        business days</strong>; don&rsquo;t start the SPRS filing until
        the role shows active.
      </>
    ),
    tip: (
      <>
        Self-CAM activation email:{" "}
        <code className="bg-[#f1f6f3] px-1 py-0.5 text-[12px]">
          disa.global.servicedesk.mbx.eb-ticket-requests@mail.mil
        </code>
        . Include your CAGE, the PIEE username you registered with, and the
        sentence &ldquo;Please activate SPRS Cyber Vendor User on this
        CAGE — I am the only CAM on the account.&rdquo;
      </>
    ),
  },
  {
    n: 3,
    title: "Log into PIEE and open SPRS → Cyber Reports",
    body: (
      <>
        Go to{" "}
        <a
          className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]"
          href="https://piee.eb.mil"
          target="_blank"
          rel="noreferrer noopener"
        >
          piee.eb.mil
        </a>{" "}
        and log in. On the PIEE landing screen click the{" "}
        <strong>SPRS</strong> tile. Inside SPRS, click{" "}
        <strong>Cyber Reports</strong> in the left navigation. (If you
        don&rsquo;t see Cyber Reports, your role activation from step 2
        hasn&rsquo;t taken effect yet.)
      </>
    ),
  },
  {
    n: 4,
    title: "Pick your CAGE from the hierarchy dropdown",
    body: (
      <>
        SPRS shows a <strong>Highest Level Owner (HLO)</strong> dropdown
        seeded from the CAGE hierarchy SAM imports automatically. Pick the
        CAGE you&rsquo;re filing for. CAGEs your Cyber Vendor User role
        covers are marked with an asterisk (
        <code className="bg-[#f1f6f3] px-1 py-0.5 text-[12px]">*</code>) —
        if your CAGE isn&rsquo;t starred, go back to step 1 and check the
        role provisioning.
      </>
    ),
    tip: (
      <>
        Multi-CAGE companies: pick the CAGE that matches the entity
        signing the affirmation memo. SPRS keys every CMMC record on a
        single CAGE; you can post separate assessments per CAGE if your
        boundary differs across them.
      </>
    ),
  },
  {
    n: 5,
    title: "Open the CMMC Assessments tab → Add New Level 1 CMMC Self-Assessment",
    body: (
      <>
        Inside Cyber Reports, click the <strong>CMMC Assessments</strong>{" "}
        tab (the tab where Level 1 / Level 2 records live — distinct from
        the legacy NIST 800-171 scoring tab). Click{" "}
        <strong>Add New Level 1 CMMC Self-Assessment</strong>. SPRS opens
        a form titled &ldquo;Level 1 CMMC Self-Assessment.&rdquo;
      </>
    ),
  },
  {
    n: 6,
    title: "Fill in the assessment details (Custodia gives you every value)",
    body: (
      <>
        SPRS asks for a handful of fields: <em>Assessment Date</em>,{" "}
        <em>Assessment Scope</em>, <em>Compliance Status</em>,{" "}
        <em>Affirming Official Name / Title / Email</em>,{" "}
        <em>System Security Plan reference</em>. Each one is already
        captured inside your Custodia workspace — open your{" "}
        <Link
          href="/assessments"
          className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]"
        >
          assessment&rsquo;s bid-ready packet
        </Link>{" "}
        and use the &ldquo;Copy these into SPRS&rdquo; card to paste each
        field in order. When the form is complete click{" "}
        <strong>Continue to Affirmation</strong>.
      </>
    ),
    tip: (
      <>
        <strong>Compliance Status</strong> is binary — Level 1 is{" "}
        &ldquo;all 15 requirements MET&rdquo; or you can&rsquo;t file.
        Custodia&rsquo;s sign-time gate already enforces this, so by the
        time you&rsquo;re on this screen the answer is always{" "}
        &ldquo;Met.&rdquo;
      </>
    ),
  },
  {
    n: 7,
    title: "Affirm — or Transfer to the Affirming Official",
    body: (
      <>
        If you ARE the Affirming Official (e.g. owner / CISO / Senior
        Official with binding authority), click <strong>Affirm</strong>.
        Otherwise enter the AO&rsquo;s email and click{" "}
        <strong>Transfer to AO</strong>. SPRS will email them with a link
        to come into PIEE, open this record, and click Affirm themselves.
        Until the AO affirms, the record stays in a draft state and is
        not visible to government contracting personnel.
      </>
    ),
    tip: (
      <>
        Per 32 CFR § 170.22, the Affirming Official is a Senior Official
        of your organization with authority to bind the company to the
        attestation. Most small businesses use the owner / president /
        CISO.
      </>
    ),
  },
  {
    n: 8,
    title: "Status flips to Final Level 1 Self-Assessment — note the CMMC Status Date",
    body: (
      <>
        Once the Affirming Official clicks Affirm, the SPRS record posts
        with two visible fields:{" "}
        <strong>Status: Final Level 1 Self-Assessment</strong> and a{" "}
        <strong>CMMC Status Date</strong> (the posting date). The status
        line is the ONLY status string government personnel see; the
        Status Date is the ONLY date that constitutes the federal
        artifact. SPRS does <strong>not</strong> issue a separate
        confirmation number — the Status + Status Date <em>are</em> the
        record.
      </>
    ),
    tip: (
      <>
        Write the CMMC Status Date down somewhere. Take a screenshot of
        the posted record for your own files; primes will sometimes ask
        for proof while they verify in SPRS independently by your
        CAGE / UEI.
      </>
    ),
  },
  {
    n: 9,
    title: "Return to Custodia and paste the CMMC Status Date",
    body: (
      <>
        Come back to Custodia → your assessment&rsquo;s{" "}
        <Link
          href="/assessments"
          className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]"
        >
          bid-ready packet
        </Link>
        . The &ldquo;Final step · File in SPRS&rdquo; card has a date
        picker for the CMMC Status Date. Pick the date SPRS posted and
        click <strong>Record SPRS filing</strong>. We&rsquo;ll email you
        a receipt, unlock your <strong>Statement of Compliance</strong>,
        and start counting down to your next annual re-affirmation (Sep
        30 of the following federal fiscal year, per 32 CFR § 170.22).
      </>
    ),
    tip: (
      <>
        Optional &ldquo;Internal reference&rdquo; field on the same form
        is for your own tracking — paste a ticket number, screenshot ID,
        or anything else you want logged alongside the federal record.
        Custodia keeps it private; it&rsquo;s never shown on your public
        Verified page.
      </>
    ),
  },
];

export default function SprsGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[#10231d]">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Custodia walkthrough
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          File your CMMC Level 1 self-assessment in SPRS &mdash; the guided version
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a7d70]">
          SPRS and PIEE aren&rsquo;t intuitive the first time. We wrote out
          every screen and every click so you finish the federal-side step
          correctly the first time. By the end you&rsquo;ll have a posted{" "}
          <strong>Final Level 1 Self-Assessment</strong> record with a{" "}
          <strong>CMMC Status Date</strong>, and your Custodia bid packet
          will be unlocked along with your Statement of Compliance.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="https://piee.eb.mil"
            target="_blank"
            rel="noreferrer noopener"
            className="bg-[#0e2a23] px-4 py-2 font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Open PIEE in a new tab &rarr;
          </a>
          <Link
            href="/assessments"
            className="border border-[#cfe3d9] px-4 py-2 font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Open my Custodia assessment
          </Link>
        </div>
      </header>

      <section className="mb-10 border border-[#cfe3d9] bg-[#f6fbf8] p-5">
        <h2 className="font-serif text-base font-bold tracking-tight">
          Before you start &mdash; have these on hand
        </h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm leading-relaxed text-[#264a3d] sm:grid-cols-2">
          <li>&middot; Your PIEE username + password</li>
          <li>&middot; The CAGE code you&rsquo;re filing under</li>
          <li>&middot; Your SAM UEI (for cross-reference)</li>
          <li>&middot; Your Affirming Official&rsquo;s name + title + email</li>
          <li>&middot; The date you signed your affirmation memo</li>
          <li>&middot; A short Assessment Scope description (Custodia auto-generates this)</li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#5a7d70]">
          Don&rsquo;t worry — your Custodia bid packet renders every one of
          these as a copy-to-clipboard chip, so you can paste them straight
          into SPRS without retyping.
        </p>
      </section>

      <section className="mb-10 border border-amber-200 bg-amber-50/60 p-5">
        <h2 className="font-serif text-base font-bold tracking-tight text-amber-900">
          What SPRS does NOT issue
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          A common misconception: SPRS does not issue a confirmation number,
          tracking code, or government-issued certificate when you post your
          Level 1 self-assessment. The federal record is the combination of{" "}
          <strong>Status: &ldquo;Final Level 1 Self-Assessment&rdquo;</strong>{" "}
          and the <strong>CMMC Status Date</strong> SPRS stamps on the
          record. That date is what Custodia stores, what your Statement of
          Compliance quotes, and what primes will look up by your CAGE
          when they verify your filing.
        </p>
      </section>

      <ol className="space-y-10">
        {steps.map((step) => (
          <li key={step.n} className="grid gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
                {step.n}
              </span>
              <h2 className="font-serif text-xl font-bold tracking-tight md:text-2xl">
                {step.title}
              </h2>
            </div>
            <div className="text-sm leading-relaxed text-[#264a3d] md:pl-10">
              {step.body}
            </div>
            {step.tip ? (
              <aside className="border border-[#cfe3d9] bg-[#f6fbf8] p-4 text-sm leading-relaxed text-[#264a3d] md:ml-10">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#2f8f6d]">
                  Tip
                </p>
                {step.tip}
              </aside>
            ) : null}
          </li>
        ))}
      </ol>

      <section
        id="unlock"
        className="mt-12 border border-emerald-300 bg-emerald-50/70 p-6"
      >
        <h2 className="font-serif text-xl font-bold tracking-tight text-emerald-950">
          Once SPRS posts your record &mdash; come back here
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900">
          Open your Custodia assessment&rsquo;s bid-ready packet, paste the
          CMMC Status Date into the &ldquo;Final step · File in SPRS&rdquo;
          card, and you&rsquo;re done for this fiscal year. We&rsquo;ll
          email a receipt, unlock your Statement of Compliance, and start
          your 60 / 30 / 14-day reminders before next year&rsquo;s
          re-affirmation deadline.
        </p>
        <Link
          href="/assessments"
          className="mt-4 inline-block bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
        >
          Go to my assessment &rarr;
        </Link>
      </section>

      <footer className="mt-12 border-t border-[#cfe3d9] pt-6 text-xs leading-relaxed text-[#5a7d70]">
        Steps reflect the{" "}
        <strong>SPRS CMMC Quick Entry Guide v4.0 (DEC 2024)</strong> and{" "}
        <strong>SPRS Access for Cyber Reports v4.0</strong>, the
        government&rsquo;s own published walkthroughs. If DoD updates either
        guide, this page gets updated within a week. Authoritative
        regulatory basis: 32 CFR § 170.15 (Level 1 self-assessment), 32 CFR
        § 170.22 (annual affirmation), DFARS 252.204-7021 (the SPRS-filing
        obligation), FAR 52.204-21 (the 15 safeguarding requirements).
      </footer>
    </main>
  );
}
