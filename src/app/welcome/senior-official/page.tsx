import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ensureOrgForUser } from "@/lib/assessment";
import { acknowledgeSeniorOfficialAction } from "../../assessments/actions";

export const dynamic = "force-dynamic";

/**
 * Senior Official designation acknowledgement screen.
 *
 * Pre-flight gate before any assessment work begins. Surfaces the
 * personal-liability language from 32 CFR § 170.21(a)(2), the False
 * Claims Act exposure (31 U.S.C. §§ 3729-3733), and 18 U.S.C. § 1001,
 * then asks the user to confirm — once — that they understand they
 * are the designated Senior Official and that the affirmation they
 * will eventually sign is their personal act, not the platform's.
 *
 * Visited only by users whose Clerk userId matches
 * `organizations.senior_official_user_id` AND for whom
 * `senior_official_acknowledged_at IS NULL`. Existing orgs were
 * backfilled as already-acknowledged at migration time, so this is
 * effectively a screen for brand-new signups.
 *
 * The "reassign to a teammate" link is a soft stub for PR #1 — the
 * team-invite UX ships in PR #2. The button explains the timeline
 * honestly so a user who landed here by accident isn't trapped.
 */
export default async function SeniorOfficialWelcomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);

  // If the user isn't the designated senior official, they shouldn't
  // see this page. Route them back to the workspace.
  if (org.senior_official_user_id !== userId) {
    redirect("/assessments");
  }
  // Already acknowledged — nothing to do here.
  if (org.senior_official_acknowledged_at) {
    redirect("/assessments");
  }

  return (
    <div className="min-h-screen bg-[#e9efea] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia &middot; Before you begin
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
                Senior Official designation
              </div>
            </div>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          One-time acknowledgement
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          You&rsquo;re the Senior Official for{" "}
          <span className="text-[#2f8f6d]">{org.name}</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3d564d]">
          The CMMC Level 1 affirmation is a personal act &mdash; not a
          corporate one. Federal law names a single human and places the
          liability on them. Before you spend hours walking the
          15&nbsp;safeguarding requirements, we need you to read the
          three paragraphs below and confirm you understand what you
          are signing up for.
        </p>

        <section className="mt-8 border border-[#0e2a23] bg-[#0e2a23] px-6 py-6 text-[#bdf2cf] shadow-[0_24px_48px_-32px_rgba(14,42,35,0.45)] md:px-8 md:py-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]/70">
            32 CFR &sect; 170.21(a)(2) &mdash; verbatim
          </p>
          <blockquote className="mt-3 font-serif text-lg leading-snug text-[#f3f9f2]">
            &ldquo;The senior official of the contractor responsible for
            ensuring compliance with the CMMC requirements must affirm
            continuing compliance with the security requirements after every
            assessment&hellip; and annually thereafter.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm leading-relaxed text-[#cfeedb]">
            That is you. By signing your affirmation in SPRS at the end of
            this assessment, you are making a personal representation to
            the U.S. Government that the 15 safeguarding requirements at
            FAR&nbsp;52.204-21(b)(1) are implemented at{" "}
            <span className="font-bold text-white">{org.name}</span>.
          </p>
        </section>

        <ol className="mt-8 space-y-5">
          <Bullet
            n={1}
            title="It is your name on the record."
            body="The signed memo lives on the SPRS Cyber Reports tab with your name, your title, and your work email. Auditors, primes, and DCMA can pull it for years."
          />
          <Bullet
            n={2}
            title="A knowing false statement is a federal crime."
            body="18 U.S.C. § 1001 makes it a felony to knowingly make a material false statement to the U.S. Government. The False Claims Act (31 U.S.C. §§ 3729-3733) carries treble damages plus per-claim penalties — recent CMMC-adjacent settlements have run $300k to $9M against contractors who attested to controls they hadn't actually implemented."
          />
          <Bullet
            n={3}
            title="Custodia helps you tell the truth — we never sign for you."
            body="Charlie and the assessment workspace are designed to gather, document, and prove what is actually true at your business. Your teammates (and any outside CMMC professional you invite) can help you fill the workspace. They cannot sign. The only person who can sign is you."
          />
        </ol>

        <form action={acknowledgeSeniorOfficialAction} className="mt-10">
          <div className="border border-[#cfe3d9] bg-white px-6 py-6">
            <p className="font-serif text-lg font-bold text-[#10231d]">
              Confirm you are the Senior Official for {org.name}.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#5a7d70]">
              You can transfer this designation to another teammate later
              from <span className="font-mono text-xs">/settings/team</span>{" "}
              once team invites ship. For now, only the designated Senior
              Official can sign the SPRS affirmation through Custodia.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                className="inline-flex items-center justify-center bg-[#0e2a23] px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-[#bdf2cf] transition hover:bg-[#10231d]"
              >
                I acknowledge &mdash; let&rsquo;s begin
              </button>
              <Link
                href="/sign-out"
                className="text-xs font-medium uppercase tracking-[0.18em] text-[#7a9c90] underline-offset-4 hover:text-[#10231d] hover:underline"
              >
                Not me &mdash; sign out and let the senior official log in
              </Link>
            </div>
          </div>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-[#7a9c90]">
          We log this acknowledgement to the audit trail with a UTC
          timestamp, your Clerk user id, and the verbatim regulation
          citation. If you ever need to reproduce the record for an OIG
          or DCMA review, it&rsquo;s in your bid-package export.
        </p>
      </main>
    </div>
  );
}

function Bullet({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center bg-[#bdf2cf] font-serif text-sm font-bold text-[#0e2a23]"
      >
        {n}
      </span>
      <div>
        <p className="font-serif text-base font-bold text-[#10231d]">
          {title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[#3d564d]">{body}</p>
      </div>
    </li>
  );
}
