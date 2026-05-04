import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SAM.gov registration walkthrough | BidFed",
  description:
    "Step-by-step guide to registering on SAM.gov for federal contracts: get your Unique Entity ID, complete the All Awards registration, and capture your industry codes for CMMC Level 1.",
};

type Step = {
  n: number;
  title: string;
  image: string;
  alt: string;
  body: React.ReactNode;
  tip?: React.ReactNode;
};

const steps: Step[] = [
  {
    n: 1,
    title: "Open SAM.gov and click Get Started",
    image: "/sam.gov/sam1.png",
    alt: "SAM.gov homepage with the Get Started button highlighted on the right side.",
    body: (
      <>
        Go to <a className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]" href="https://sam.gov" target="_blank" rel="noreferrer noopener">sam.gov</a>.
        On the right side of the homepage you&apos;ll see a panel titled
        <strong> &ldquo;Register Your Entity or Get a Unique Entity ID.&rdquo;</strong>
        Click the green <strong>Get Started</strong> button.
      </>
    ),
    tip: (
      <>
        SAM.gov registration is <strong>100% free</strong>. If a website asks you to
        pay, you&apos;re on the wrong site. The only official URL is{" "}
        <code>sam.gov</code>.
      </>
    ),
  },
  {
    n: 2,
    title: "Sign in with Login.gov (or create an account)",
    image: "/sam.gov/sam2.png",
    alt: "Login.gov sign-in page with email and password fields.",
    body: (
      <>
        SAM.gov uses <strong>Login.gov</strong> to handle sign-in. If you already
        have a Login.gov account, sign in here. If not, click
        <strong> Create an account</strong> and complete the email + multi-factor
        setup. You&apos;ll be bounced back to SAM.gov automatically.
      </>
    ),
    tip: (
      <>
        Use a real business email you&apos;ll keep long-term. Login.gov only
        recognizes <em>one</em> email per account, and you&apos;ll need this email
        every year to renew your registration.
      </>
    ),
  },
  {
    n: 3,
    title: "Read the &ldquo;Before You Get Started&rdquo; overview",
    image: "/sam.gov/sam3.png",
    alt: "SAM.gov Get Started with Registration and the Unique Entity ID page showing four numbered steps.",
    body: (
      <>
        SAM walks you through a 4-step pre-registration overview. You don&apos;t
        need to do anything here yet &mdash; just read it and click through.
        It explains the difference between getting only a Unique Entity ID and
        completing a full registration. <strong>For CMMC Level 1, you want the
        full registration</strong> so you can bid on DoD contracts as a prime.
      </>
    ),
  },
  {
    n: 4,
    title: "Click Create New Entity",
    image: "/sam.gov/sam4.png",
    alt: "SAM.gov Welcome page with a green Create New Entity button.",
    body: (
      <>
        On the Welcome screen, click the green <strong>Create New Entity</strong>{" "}
        button. SAM will ask a few short questions to recommend the best
        registration option for you.
      </>
    ),
    tip: (
      <>
        Already have an entity from a prior year? Use <strong>Go to Workspace</strong>{" "}
        and pick &ldquo;Renew/Update&rdquo; on your existing record instead of creating a
        new one.
      </>
    ),
  },
  {
    n: 5,
    title: "What is your goal? &mdash; pick &ldquo;Directly with the U.S. federal government&rdquo;",
    image: "/sam.gov/sam5.png",
    alt: "SAM.gov What is your goal page with three radio options.",
    body: (
      <>
        First question: <em>I want to do business&hellip;</em>
        <br />
        Select the first option:{" "}
        <strong>&ldquo;Directly with the U.S. federal government.&rdquo;</strong>
      </>
    ),
    tip: (
      <>
        This is the right choice for any business that wants to win federal
        contracts as the prime awardee. Subcontractors only? Pick the second
        option instead &mdash; but most CMMC L1 shops want optionality to bid
        directly, so go with the first.
      </>
    ),
  },
  {
    n: 6,
    title: "Pick &ldquo;Bid on a federal procurement opportunity as a prime contractor&rdquo;",
    image: "/sam.gov/sam6.png",
    alt: "SAM.gov goal selection showing prime contractor option selected.",
    body: (
      <>
        After the first answer, a second list appears asking for your specific
        intention. Pick:{" "}
        <strong>&ldquo;Bid on a federal procurement opportunity as a prime contractor.&rdquo;</strong>
        Click <strong>Next</strong>.
      </>
    ),
    tip: (
      <>
        This is what triggers the <strong>All Awards</strong> registration path
        &mdash; the only one that gives you everything CMMC Level 1 needs.
      </>
    ),
  },
  {
    n: 7,
    title: "Are you a government entity? &mdash; No",
    image: "/sam.gov/sam7.png",
    alt: "SAM.gov Are you registering a government entity page with No selected and physically located in the United States checked.",
    body: (
      <>
        Select <strong>No</strong>, then check
        <strong> &ldquo;My entity is physically located in the United States.&rdquo;</strong>
        Click <strong>Next</strong>.
      </>
    ),
    tip: (
      <>
        &ldquo;Yes&rdquo; is only for actual government bodies (state agencies,
        cities, tribal nations). A private LLC is always <strong>No</strong>.
      </>
    ),
  },
  {
    n: 8,
    title: "Who required you to be in SAM? &mdash; I decided on my own",
    image: "/sam.gov/sam8.png",
    alt: "SAM.gov Who required your entity to be in SAM page with I decided on my own selected.",
    body: (
      <>
        Pick <strong>&ldquo;I decided on my own.&rdquo;</strong> This is just SAM
        tracking why you&apos;re registering &mdash; it doesn&apos;t affect
        your registration outcome at all.
      </>
    ),
    tip: (
      <>
        Only pick <em>Federal government</em> if a contracting officer literally
        told you &ldquo;you must register in SAM to receive this award&rdquo; (with
        a solicitation or award notice). Pick <em>APEX Accelerators</em> only
        if a PTAC advisor walked you through this.
      </>
    ),
  },
  {
    n: 9,
    title: "Choose registration type &mdash; All Awards (Recommended)",
    image: "/sam.gov/sam9.png",
    alt: "SAM.gov three-column comparison: Unique Entity ID Only, Financial Assistance, and All Awards (Recommended).",
    body: (
      <>
        SAM shows three options. <strong>For CMMC Level 1, click
        Select under the &ldquo;All Awards&rdquo; column on the right.</strong>{" "}
        That&apos;s the only one that gives you a CAGE code, which you need
        for any DoD contract.
      </>
    ),
    tip: (
      <>
        <strong>Don&apos;t pick Unique Entity ID Only.</strong> It&apos;s faster,
        but you can&apos;t bid on contracts as a prime, and you won&apos;t get a
        CAGE code &mdash; both of which CMMC L1 expects.
      </>
    ),
  },
  {
    n: 10,
    title: "Do you already have a CAGE code? &mdash; No",
    image: "/sam.gov/sam10.png",
    alt: "SAM.gov Do you already have a CAGE code page with No selected.",
    body: (
      <>
        Select <strong>No</strong>. SAM will automatically request a CAGE code
        from the Defense Logistics Agency (DLA) for you as part of this
        registration. Click <strong>Next</strong>.
      </>
    ),
    tip: (
      <>
        Only pick <em>Yes</em> if you have a CAGE from a previous registration
        that lapsed. Most first-time registrants don&apos;t.
      </>
    ),
  },
  {
    n: 11,
    title: "Confirm: Business or Organization + All Awards",
    image: "/sam.gov/sam11.png",
    alt: "SAM.gov confirmation page showing Entity Type: Business or Organization and Purpose of Registration: All Awards.",
    body: (
      <>
        SAM confirms what you&apos;re registering. You should see two green
        checks:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Entity Type:</strong> Business or Organization</li>
          <li><strong>Purpose of Registration:</strong> All Awards</li>
        </ul>
        If both are correct, click <strong>Next</strong>.
      </>
    ),
  },
  {
    n: 12,
    title: "Fill out Business Information (and the rest of the sidebar)",
    image: "/sam.gov/sam14.png",
    alt: "SAM.gov Business Information page showing the full left sidebar with Entity Search, Confirm Details, Business Types, Taxpayer Information, Goods & Services, etc.",
    body: (
      <>
        This is the longest part &mdash; <strong>the full registration
        questionnaire</strong>. The left sidebar shows every section you&apos;ll
        complete:
        <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 pl-5 sm:grid-cols-2">
          <li>&middot; Business Information</li>
          <li>&middot; Entity Search</li>
          <li>&middot; Confirm Details</li>
          <li>&middot; Review Entity Information</li>
          <li>&middot; Add Incorporation Details</li>
          <li>&middot; Document Upload</li>
          <li>&middot; Review</li>
          <li>&middot; Business Types</li>
          <li>&middot; Taxpayer Information</li>
          <li>&middot; Entity Relationships</li>
          <li>&middot; Financial Information</li>
          <li>&middot; Legal Proceedings</li>
          <li>&middot; <strong>Goods &amp; Services</strong> (NAICS codes!)</li>
          <li>&middot; Business Operations</li>
          <li>&middot; Points of Contact</li>
        </ul>
        <p className="mt-3">
          Have these documents ready before you start: <strong>EIN</strong>,
          <strong> legal business name</strong> (exactly as on your IRS letter),
          <strong> physical address</strong> (no PO boxes), <strong>incorporation date</strong>,
          <strong> bank routing + account number</strong> (for EFT payments),
          and an <strong>IRS CP-575/147C letter</strong> or
          <strong> Articles of Incorporation</strong> for the Document Upload step.
        </p>
        <p className="mt-3">
          <strong>When you reach the Goods &amp; Services section</strong>,
          this is where you pick your <strong>NAICS codes</strong> &mdash; the
          six-digit numbers that describe what your business does. Look up
          codes that match your work at{" "}
          <a className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-2 hover:text-[#2f8f6d]" href="https://www.census.gov/naics/" target="_blank" rel="noreferrer noopener">census.gov/naics</a>{" "}
          and write them down &mdash; you&apos;ll paste the same ones into BidFed.
        </p>
      </>
    ),
    tip: (
      <>
        <strong>The #1 reason registrations fail validation:</strong> the legal
        name + address you enter must match your IRS records <em>exactly</em>{" "}
        (LLC vs L.L.C. matters; suite numbers matter). If you&apos;ve moved
        since getting your EIN, file IRS Form 8822-B <em>before</em> finishing
        this section &mdash; otherwise SAM will reject the registration and
        you&apos;ll lose a week.
      </>
    ),
  },
  {
    n: 13,
    title: "Review & Submit",
    image: "/sam.gov/sam12.png",
    alt: "SAM.gov Submit Registration page in the Review & Submit dashboard.",
    body: (
      <>
        After all sections are green, you&apos;ll land on the
        <strong> Review &amp; Submit</strong> dashboard. Confirm both
        <strong> Review Entity Data</strong> and{" "}
        <strong>Review Representations and Certifications</strong> have green
        checks, then read the certification statement and click the green
        <strong> Submit</strong> button.
      </>
    ),
    tip: (
      <>
        You&apos;re certifying everything you entered is accurate under penalty
        of federal law. Take a final pass through Reps &amp; Certs before clicking
        Submit &mdash; corrections after submission require a renewal, which is
        slower.
      </>
    ),
  },
  {
    n: 14,
    title: "Entity Registration Submitted &mdash; copy your UEI",
    image: "/sam.gov/sam13.png",
    alt: "SAM.gov Entity Registration Submitted success page showing the legal business name and Unique Entity ID.",
    body: (
      <>
        You&apos;re done with SAM. The success page shows your{" "}
        <strong>Unique Entity ID (UEI)</strong> &mdash; a 12-character code
        like <code>ABC123XYZ987</code>. <strong>Copy it now.</strong>
        <p className="mt-3">
          <strong>What happens next behind the scenes:</strong>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>IRS taxpayer validation</strong> &mdash; 2 to 5 business days</li>
          <li><strong>CAGE code assignment</strong> by DLA &mdash; 3 to 10 business days</li>
        </ul>
        <p className="mt-3">
          When both finish, your registration flips from
          <em> Submitted</em> to <strong>Active</strong> and your CAGE code
          appears in your Workspace. You&apos;ll get an email from SAM.
        </p>
      </>
    ),
  },
];

export default function SamGuidePage() {
  // 5-day reminder for CAGE code follow-up. Build a Google Calendar URL +
  // an inline .ics so the user can add it to whichever calendar they use.
  const reminderTitle = "Add CAGE code to BidFed (SAM.gov should have issued it by now)";
  const reminderDetails =
    "Open your SAM.gov Workspace, copy your CAGE code from your active entity, and paste it into BidFed's Federal contractor registration page so the 17 CMMC Level 1 practices stay unlocked.";
  const reminderLocation = "https://sam.gov/workspace";

  // Pick a date 5 business days out (skip weekends).
  const fiveBusinessDaysOut = (() => {
    const d = new Date();
    let added = 0;
    while (added < 5) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added += 1;
    }
    return d;
  })();
  const yyyy = fiveBusinessDaysOut.getUTCFullYear();
  const mm = String(fiveBusinessDaysOut.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(fiveBusinessDaysOut.getUTCDate()).padStart(2, "0");
  const dateStamp = `${yyyy}${mm}${dd}`;
  // 9 AM local-ish: use 14:00 UTC as a sane all-tz default morning anchor.
  const start = `${dateStamp}T140000Z`;
  const end = `${dateStamp}T143000Z`;

  const gcal =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(reminderTitle)}` +
    `&dates=${start}/${end}` +
    `&details=${encodeURIComponent(reminderDetails)}` +
    `&location=${encodeURIComponent(reminderLocation)}`;

  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BidFed//SAM.gov Guide//EN",
      "BEGIN:VEVENT",
      `UID:bidfed-cage-reminder-${dateStamp}@bidfed`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${reminderTitle}`,
      `DESCRIPTION:${reminderDetails}`,
      `LOCATION:${reminderLocation}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${reminderTitle}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[#10231d]">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          BidFed walkthrough
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Register on SAM.gov &mdash; the guided version
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a7d70]">
          The federal government&apos;s entity registration system isn&apos;t
          intuitive the first time. We took screenshots of every screen and
          marked exactly what to click so you finish correctly the first
          time. By the end you&apos;ll have a <strong>Unique Entity ID</strong>,
          your <strong>industry codes</strong>, your <strong>entity type</strong>{" "}
          on file in BidFed, and a 5-day reminder set to add your CAGE code
          when SAM issues it.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="https://sam.gov"
            target="_blank"
            rel="noreferrer noopener"
            className=" bg-[#0e2a23] px-4 py-2 font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Open SAM.gov in a new tab &rarr;
          </a>
          <Link
            href="#unlock"
            className=" border border-[#cfe3d9] px-4 py-2 font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Skip to: paste UEI into BidFed
          </Link>
        </div>
      </header>

      <section className="mb-10  border border-[#cfe3d9] bg-[#f6fbf8] p-5">
        <h2 className="font-serif text-base font-bold tracking-tight">
          Before you start &mdash; have these on hand
        </h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm leading-relaxed text-[#264a3d] sm:grid-cols-2">
          <li>&middot; EIN (employer identification number)</li>
          <li>&middot; Legal business name (exactly as on your IRS letter)</li>
          <li>&middot; Physical address (no PO boxes)</li>
          <li>&middot; Mailing address</li>
          <li>&middot; Date your business was legally formed</li>
          <li>&middot; Fiscal year end date (usually 12/31)</li>
          <li>&middot; State of incorporation</li>
          <li>&middot; Bank routing + account number (for EFT)</li>
          <li>&middot; IRS CP-575 / 147C or Articles of Incorporation (PDF)</li>
          <li>&middot; A list of NAICS codes that fit your work</li>
        </ul>
        <p className="mt-3 text-xs text-[#5a7d70]">
          Plan on 45&ndash;90 minutes for the questionnaire. You can save and
          come back &mdash; SAM keeps your draft.
        </p>
      </section>

      <ol className="space-y-12">
        {steps.map((s) => (
          <li key={s.n} className="scroll-mt-20" id={`step-${s.n}`}>
            <div className="flex items-baseline gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
                {s.n}
              </span>
              <h2
                className="font-serif text-xl font-bold tracking-tight md:text-2xl"
                dangerouslySetInnerHTML={{ __html: s.title }}
              />
            </div>
            <div className="mt-3 ml-10 max-w-2xl text-sm leading-relaxed text-[#264a3d]">
              {s.body}
            </div>
            {s.tip && (
              <div className="mt-3 ml-10 max-w-2xl border-l-4 border-[#e6d3a8] bg-[#fdf6e3] px-4 py-3 text-xs leading-relaxed text-[#5c4a1d]">
                <strong className="text-[#3d3210]">Heads up: </strong>
                {s.tip}
              </div>
            )}
            <figure className="mt-4 ml-10  border border-[#cfe3d9] bg-white p-2 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
              <Image
                src={s.image}
                alt={s.alt}
                width={1600}
                height={1000}
                className="h-auto w-full"
                sizes="(max-width: 768px) 100vw, 720px"
                priority={s.n <= 2}
              />
            </figure>
          </li>
        ))}
      </ol>

      <section
        id="unlock"
        className="mt-16  border-2 border-[#2f8f6d] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]"
      >
        <h2 className="font-serif text-2xl font-bold tracking-tight">
          You&apos;re back from SAM.gov &mdash; here&apos;s what to do in BidFed
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#264a3d]">
          Open the BidFed <strong>Federal contractor registration</strong> page
          (Step 2 of 7 in your assessment) and fill it in:
        </p>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#264a3d]">
          <li>
            <strong>1. Unique Entity ID</strong> &mdash; paste the 12-character
            code from your SAM.gov success screen.
          </li>
          <li>
            <strong>2. CAGE code</strong> &mdash; <em>leave blank for now.</em>{" "}
            DLA hasn&apos;t issued it yet. We&apos;ll remind you.
          </li>
          <li>
            <strong>3. Entity type</strong> &mdash; pick the legal structure
            you registered under (LLC, C-Corp, S-Corp, Sole proprietor, etc.).
          </li>
          <li>
            <strong>4. Industry codes (NAICS)</strong> &mdash; paste the same
            six-digit codes you selected in SAM&apos;s Goods &amp; Services
            section, comma-separated. Example:{" "}
            <code className="bg-[#f1f6f3] px-1.5 py-0.5">541512, 541519</code>.
          </li>
          <li>
            <strong>5. Click &ldquo;Save and continue.&rdquo;</strong> The 17
            CMMC Level 1 safeguarding practices unlock immediately.
          </li>
        </ol>

        <div className="mt-6 border-t border-[#cfe3d9] pt-5">
          <h3 className="font-serif text-lg font-bold tracking-tight">
            Set a 5-business-day reminder for your CAGE code
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#264a3d]">
            DLA typically issues your CAGE code within 3&ndash;10 business
            days. We&apos;ll set a reminder for you on{" "}
            <strong>
              {fiveBusinessDaysOut.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>{" "}
            so you remember to check your SAM Workspace, copy the CAGE code,
            and paste it into BidFed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <a
              href={gcal}
              target="_blank"
              rel="noreferrer noopener"
              className=" bg-[#0e2a23] px-4 py-2 font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
            >
              Add to Google Calendar &rarr;
            </a>
            <a
              href={icsHref}
              download="bidfed-cage-reminder.ics"
              className=" border border-[#cfe3d9] px-4 py-2 font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
            >
              Download .ics (Apple / Outlook)
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-[#5a7d70]">
          Once your UEI and at least one NAICS code are saved in BidFed, the
          third section &mdash; the 17 CMMC Level 1 practices &mdash; unlocks.
          You can start working through them while DLA finishes issuing your
          CAGE code in the background.
        </p>
      </section>

      <p className="mt-12 text-center text-xs text-[#7a9c90]">
        Need to step away? This guide stays at this URL &mdash; bookmark it
        and come back any time.
      </p>
    </main>
  );
}
