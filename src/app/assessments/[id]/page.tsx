import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  computeProgress,
  getAssessmentForUser,
  listCarryForwardPending,
  listResponsesForAssessment,
  type ControlResponseRow,
  type OrganizationRow,
} from "@/lib/assessment";
import { controlDomains, playbook } from "@/lib/playbook";
import { loadTrustPageForOrg } from "@/lib/trust-page";
import { recordSprsFilingAction, publishVerifiedPageAction } from "../actions";

const statusLabels: Record<ControlResponseRow["status"], string> = {
  unanswered: "Not started",
  yes: "MET",
  partial: "Partial",
  no: "NOT MET",
  not_applicable: "N/A",
};

const statusDotStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#cfe3d9]",
  yes: "bg-[#2f8f6d]",
  partial: "bg-[#a06b1a]",
  no: "bg-[#b03a2e]",
  not_applicable: "bg-[#5a7d70]",
};

const statusPillStyles: Record<ControlResponseRow["status"], string> = {
  unanswered: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
  yes: "bg-[#eaf3ee] text-[#0e2a23] ring-[#bde0cc]",
  partial: "bg-[#fff4e0] text-[#a06b1a] ring-[#f1d9a5]",
  no: "bg-[#fbe9e6] text-[#b03a2e] ring-[#f1c4bd]",
  not_applicable: "bg-[#f1f6f3] text-[#5a7d70] ring-[#cfe3d9]",
};

const domainLabels: Record<(typeof controlDomains)[number], string> = {
  AC: "Access Control",
  IA: "Identification & Authentication",
  MP: "Media Protection",
  PE: "Physical Protection",
  SC: "System & Communications",
  SI: "System & Information Integrity",
};

function isProfileComplete(org: OrganizationRow): boolean {
  return Boolean(
    org.name && org.name !== "My Organization" && org.scoped_systems,
  );
}

export default async function AssessmentOverviewPage(
  props: PageProps<"/assessments/[id]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const [responses, carryForward, trustPage] = await Promise.all([
    listResponsesForAssessment(id),
    listCarryForwardPending(id),
    loadTrustPageForOrg(ctx.organization.id),
  ]);
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const progress = computeProgress(responses);
  const profileDone = isProfileComplete(ctx.organization);
  const allAnswered = progress.unanswered === 0;
  const hasBlockers = progress.notMet > 0 || progress.partial > 0;
  const attested = ctx.assessment.status === "attested";
  const search = await props.searchParams;
  const justSigned = search?.signed === "1" && attested;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {justSigned && <CelebrationBanner assessmentId={ctx.assessment.id} />}

      {attested && (
        <SprsFilingSection
          assessmentId={ctx.assessment.id}
          fiscalYear={ctx.assessment.fiscal_year}
          sprsFiledAt={ctx.assessment.sprs_filed_at}
          sprsConfirmationNumber={ctx.assessment.sprs_confirmation_number}
          custodiaVerificationId={ctx.assessment.custodia_verification_id}
          verifiedPagePublic={trustPage?.is_public ?? false}
          verifiedPageSlug={trustPage?.verification_slug ?? null}
        />
      )}

      <section className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          CMMC Level 1 • FY{ctx.assessment.fiscal_year}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
              Your annual affirmation
            </h1>
            <p className="mt-2 text-sm text-[#5a7d70]">
              {ctx.organization.name !== "My Organization"
                ? `${ctx.organization.name} — work the 17 practices below to MET, then sign and file with SPRS.`
                : "Business profile not set yet"}
            </p>
          </div>
          <ProgressRing percent={progress.percentAnswered} />
        </div>
      </section>

      {(carryForward.responses.length > 0 ||
        carryForward.artifacts.length > 0) && (
        <CarryForwardReviewBanner
          assessmentId={ctx.assessment.id}
          pendingResponseCount={carryForward.responses.length}
          pendingArtifactCount={carryForward.artifacts.length}
          firstControlId={
            carryForward.responses[0]?.control_id ??
            carryForward.artifacts[0]?.control_id
          }
        />
      )}

      <NextStepBanner
        profileDone={profileDone}
        allAnswered={allAnswered}
        hasBlockers={hasBlockers}
        attested={attested}
        assessmentId={ctx.assessment.id}
      />

      <section className="mb-10 grid gap-3 md:grid-cols-5">
        <ProgressPill label="Met" value={progress.met} tone="emerald" />
        <ProgressPill label="Partial" value={progress.partial} tone="amber" />
        <ProgressPill label="Not met" value={progress.notMet} tone="rose" />
        <ProgressPill label="N/A" value={progress.notApplicable} tone="sky" />
        <ProgressPill
          label="Not started"
          value={progress.unanswered}
          tone="slate"
        />
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-[#10231d]">
              The 17 practices
            </h2>
            <p className="mt-1 text-sm text-[#5a7d70]">
              Every practice must be MET or N/A before you can sign. Click any
              card to drop evidence into your vault and mark it MET.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {controlDomains.map((domain) => {
            const domainPractices = playbook.filter((p) => p.domain === domain);
            const answered = domainPractices.filter((p) => {
              const s = responseByControl.get(p.id)?.status ?? "unanswered";
              return s !== "unanswered";
            }).length;
            return (
              <div key={domain}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <span className="rounded-sm bg-[#0e2a23] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
                      {domain}
                    </span>
                    <h3 className="font-serif text-base font-bold text-[#10231d]">
                      {domainLabels[domain]}
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-[#5a7d70]">
                    {answered} of {domainPractices.length} done
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {domainPractices.map((practice) => {
                    const resp = responseByControl.get(practice.id);
                    const status = resp?.status ?? "unanswered";
                    return (
                      <Link
                        key={practice.id}
                        href={`/assessments/${ctx.assessment.id}/controls/${practice.id}`}
                        className="group block rounded-md border border-[#cfe3d9] bg-white p-4 shadow-[0_2px_0_rgba(14,48,37,0.04)] transition-all hover:border-[#2f8f6d] hover:shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 h-2 w-2 flex-none rounded-sm ${statusDotStyles[status]}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-[#5a7d70]">
                                {practice.id}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1 ring-inset ${statusPillStyles[status]}`}
                              >
                                {statusLabels[status]}
                              </span>
                            </div>
                            <h4 className="mt-2 truncate font-serif font-bold text-[#10231d]">
                              {practice.shortName}
                            </h4>
                            <p className="mt-1.5 line-clamp-2 text-sm text-[#5a7d70]">
                              {practice.plainEnglish}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CarryForwardReviewBanner({
  assessmentId,
  pendingResponseCount,
  pendingArtifactCount,
  firstControlId,
}: {
  assessmentId: string;
  pendingResponseCount: number;
  pendingArtifactCount: number;
  firstControlId: string | undefined;
}) {
  const total = pendingResponseCount + pendingArtifactCount;
  return (
    <div className="mb-6 rounded-2xl border border-sky-300 bg-sky-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
            Last year&apos;s answers imported
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {total} item{total === 1 ? "" : "s"} need a quick currency check.
          </h2>
          <p className="mt-1 text-sm text-sky-900">
            {pendingResponseCount > 0 && (
              <>
                {pendingResponseCount} answer
                {pendingResponseCount === 1 ? "" : "s"} carried over.{" "}
              </>
            )}
            {pendingArtifactCount > 0 && (
              <>
                {pendingArtifactCount} evidence file
                {pendingArtifactCount === 1 ? "" : "s"} need re-confirmation.
              </>
            )}{" "}
            Walk each practice to confirm or replace — same as TurboTax
            importing last year&apos;s return.
          </p>
        </div>
        {firstControlId && (
          <Link
            href={`/assessments/${assessmentId}/controls/${firstControlId}`}
            className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-600"
          >
            Start reviewing &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

function CelebrationBanner({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            You&apos;re signed and bid-ready
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Congratulations — your affirmation is locked.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Download your bid-ready package below — it bundles your SSP,
            signed affirmation memo, control inventory, and every evidence
            artifact in one zip. File it in SPRS and you&apos;re CMMC Level 1
            compliant for this cycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/assessments/${assessmentId}/bid-package`}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            Affirmation only
          </Link>
          <Link
            href="/opportunities"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Step 7 → Find &amp; submit bids
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Post-attestation, pre-SPRS-filing panel — and once filed, the receipt.
 *
 * The signed affirmation memo only matters once the federal record exists.
 * This panel walks the user from the platform to https://piee.eb.mil for
 * the SPRS step they have to do themselves (we can't file on their behalf),
 * captures the confirmation number when they're back, and from then on
 * shows the receipt + a link to download their Statement of Compliance.
 */
function SprsFilingSection({
  assessmentId,
  fiscalYear,
  sprsFiledAt,
  sprsConfirmationNumber,
  custodiaVerificationId,
  verifiedPagePublic,
  verifiedPageSlug,
}: {
  assessmentId: string;
  fiscalYear: number;
  sprsFiledAt: string | null;
  sprsConfirmationNumber: string | null;
  custodiaVerificationId: string | null;
  verifiedPagePublic: boolean;
  verifiedPageSlug: string | null;
}) {
  if (sprsFiledAt && sprsConfirmationNumber) {
    const filed = new Date(sprsFiledAt).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const nextDue = new Date(
      Date.UTC((fiscalYear ?? new Date().getUTCFullYear()) + 1, 8, 30),
    ).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return (
      <>
        <div className="mb-8 rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Filed in SPRS · FY{fiscalYear}
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-emerald-900">
                You&apos;re bid-eligible for this fiscal year.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Your CMMC Level 1 annual affirmation is on record with the
                federal government. Custodia will monitor your connectors,
                push freshness reminders, and nudge you 60 / 30 / 14 days
                before your next re-affirmation.
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Custodia ID
                  </dt>
                  <dd className="mt-1 font-mono text-base font-semibold text-emerald-900">
                    {custodiaVerificationId ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    SPRS confirmation #
                  </dt>
                  <dd className="mt-1 font-mono text-base font-semibold text-emerald-900">
                    {sprsConfirmationNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Filed
                  </dt>
                  <dd className="mt-1 font-semibold text-emerald-900">
                    {filed}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Next re-affirmation
                  </dt>
                  <dd className="mt-1 font-semibold text-emerald-900">
                    {nextDue}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/assessments/${assessmentId}/statement`}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
              >
                Download Statement of Compliance
              </Link>
              <Link
                href="/opportunities"
                className="rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition-colors hover:border-emerald-400"
              >
                Find bids →
              </Link>
            </div>
          </div>
        </div>

        <VerifiedPageOfferCard
          assessmentId={assessmentId}
          custodiaVerificationId={custodiaVerificationId}
          verifiedPagePublic={verifiedPagePublic}
          verifiedPageSlug={verifiedPageSlug}
        />
      </>
    );
  }

  // Not yet filed — capture form.
  return (
    <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50/60 p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Final step · File in SPRS
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            One last step the government has to see — file your affirmation in
            SPRS.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            CMMC Level 1 is annual self-attestation, not third-party
            certification. Your signed affirmation memo isn&rsquo;t the
            federal record — the SPRS confirmation is. Log into PIEE, submit
            your affirmation in SPRS, then come back and paste the
            confirmation number we&apos;ll record it with your assessment and
            email you a Statement of Compliance.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Open{" "}
              <a
                href="https://piee.eb.mil"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-emerald-700 underline hover:text-emerald-800"
              >
                piee.eb.mil
              </a>{" "}
              and sign in with your PIEE account.
            </li>
            <li>
              Open <strong>SPRS</strong> → <strong>Cyber Reports</strong> →{" "}
              <strong>CMMC Affirmations</strong>.
            </li>
            <li>
              Submit your annual affirmation for FY{fiscalYear}. SPRS will
              return a confirmation number.
            </li>
            <li>Paste that number into the form on the right.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Don&rsquo;t have a PIEE account yet? You can register at
            piee.eb.mil/xhtml/unauth/web/homepage/vendorRegistration.xhtml —
            this is the same login you use for SAM.gov contracting workflows.
          </p>
        </div>
        <form
          action={recordSprsFilingAction}
          className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <label
            htmlFor="confirmationNumber"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            SPRS confirmation number
          </label>
          <input
            id="confirmationNumber"
            name="confirmationNumber"
            type="text"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            pattern="[A-Za-z0-9_\-]+"
            placeholder="e.g. CMMC-AFF-XXXXXX"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <p className="mt-2 text-xs text-slate-500">
            Letters, numbers, dashes, underscores. Recorded as the legal
            artifact of your federal filing — please paste exactly what SPRS
            returned.
          </p>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Record SPRS filing
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            We&rsquo;ll email you a receipt + Statement of Compliance.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * Custodia Verified offer card — only shown after SPRS filing is recorded.
 * Two states: not-yet-published (offer + benefits + Publish button) and
 * published (live page receipt + manage link). The customer's SPRS
 * confirmation number is NEVER shown on the public page; the public
 * identifier is the human-friendly Custodia Verification ID.
 */
function VerifiedPageOfferCard({
  assessmentId,
  custodiaVerificationId,
  verifiedPagePublic,
  verifiedPageSlug,
}: {
  assessmentId: string;
  custodiaVerificationId: string | null;
  verifiedPagePublic: boolean;
  verifiedPageSlug: string | null;
}) {
  if (verifiedPagePublic && verifiedPageSlug) {
    return (
      <div className="mb-8 rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Custodia Verified · Live
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
              Your public Verified page is live.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Share your page or badge with primes and contracting officers.
              The page updates automatically as Custodia&rsquo;s monitoring
              signals change. Your SPRS confirmation number stays private —
              only your Custodia ID is shown publicly.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono font-semibold text-emerald-900">
                {custodiaVerificationId ?? "—"}
              </span>
              <a
                href={`/verified/${verifiedPageSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 underline hover:text-emerald-800"
              >
                View public page →
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/assessments/${assessmentId}/verified`}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Manage Verified page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not yet published — the opt-in offer.
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/40 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="p-6 lg:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            New · Available now
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Your Custodia Verified page is ready.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A live, federally-professional profile primes can use to vet you
            in 30 seconds. Continuously monitored. Updates automatically when
            your evidence freshens or your Microsoft 365 / Google Workspace
            tenant signals drift.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                <strong>Custodia ID:</strong>{" "}
                <span className="font-mono">
                  {custodiaVerificationId ?? "—"}
                </span>{" "}
                — your public identifier (your SPRS number stays private).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                UEI, CAGE, NAICS, set-asides — pulled from your bid-ready
                profile.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                Live <em>Healthy</em> badge with a timestamped freshness
                signal.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                &ldquo;Verify on SAM.gov&rdquo; + &ldquo;Verify SPRS by
                UEI&rdquo; outbound links so primes can independently confirm
                your federal record.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                Embeddable badge for your website, capability statement, and
                email signature.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>500-character custom about section — your words.</span>
            </li>
          </ul>
          <p className="mt-4 rounded-md border border-slate-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
            <strong>Privacy:</strong> your SPRS confirmation number is never
            shown on the public page or in the URL. The Custodia Verification
            ID is the only public identifier and reveals nothing private. You
            can unpublish, customize, or rotate the ID any time from{" "}
            <em>Manage Verified page</em>.
          </p>
        </div>
        <div className="border-t border-slate-200 bg-white p-6 lg:border-t-0 lg:border-l">
          <h3 className="text-sm font-bold text-slate-900">
            Publish your page
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            One click. You can review and edit content from the manage panel
            after publishing.
          </p>
          <form action={publishVerifiedPageAction} className="mt-4 space-y-2">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
            >
              Publish my Verified page
            </button>
          </form>
          <Link
            href={`/assessments/${assessmentId}/verified`}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400"
          >
            Preview &amp; customize first
          </Link>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            Not now? You can publish any time from the assessment overview.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-slate-100"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-amber-400 transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-slate-900">
          {percent}%
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Progress
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {percent === 100 ? "All answered" : "Keep going"}
        </div>
      </div>
    </div>
  );
}

function NextStepBanner({
  profileDone,
  allAnswered,
  hasBlockers,
  attested,
  assessmentId,
}: {
  profileDone: boolean;
  allAnswered: boolean;
  hasBlockers: boolean;
  attested: boolean;
  assessmentId: string;
}) {
  if (attested) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Attested
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            This assessment is signed and ready to file.
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            The bid-ready package bundles your SSP, signed affirmation, and
            every evidence artifact — everything a prime or SPRS filing might
            ask for.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/assessments/${assessmentId}/bid-package`}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <Link
            href={`/assessments/${assessmentId}/ssp`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            SSP only
          </Link>
          <Link
            href={`/assessments/${assessmentId}/affirmation`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-400"
          >
            Affirmation only
          </Link>
        </div>
      </div>
    );
  }

  if (!profileDone) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Action needed · Step 1 of 7
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Finish telling the officer about your business
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Legal name, UEI/CAGE, and the systems in scope — captured through a
            quick chat, not a form.
          </p>
        </div>
        <Link
          href="/onboard"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          Open onboarding &rarr;
        </Link>
      </div>
    );
  }

  if (!allAnswered) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Step 3 of 7 · You are here
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Answer the 17 practices
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Click any practice below. We&apos;ll explain it in plain English and
            show exactly what evidence to capture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Ready for step 4 · Sign &amp; affirm
        </div>
        <h2 className="mt-1 text-lg font-bold">
          {hasBlockers
            ? "All answered — but some practices need fixing first"
            : "You're ready to affirm."}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {hasBlockers
            ? "'Not met' or 'Partial' practices must become 'Met' or 'N/A' before you can sign the SPRS affirmation."
            : "A senior official signs the SPRS annual affirmation. This locks the assessment and generates your SSP."}
        </p>
      </div>
      {!hasBlockers && (
        <Link
          href={`/assessments/${assessmentId}/sign`}
          className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-300"
        >
          Review & sign &rarr;
        </Link>
      )}
    </div>
  );
}

function ProgressPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "sky" | "slate";
}) {
  const toneStyles: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    slate: "border-slate-200 bg-white text-slate-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneStyles[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ProfileSection({
  organization,
  profileDone,
}: {
  organization: OrganizationRow;
  profileDone: boolean;
}) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Legal name", value: organization.name !== "My Organization" ? organization.name : null },
    { label: "Entity type", value: organization.entity_type },
    { label: "SAM UEI", value: organization.sam_uei },
    { label: "CAGE code", value: organization.cage_code },
    {
      label: "NAICS codes",
      value: organization.naics_codes.length > 0 ? organization.naics_codes.join(", ") : null,
    },
  ];
  return (
    <section
      id="profile"
      className="mb-10 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Business profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Captured conversationally through your officer. Ask them to update
            anything — no forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profileDone && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Complete
            </span>
          )}
          <Link
            href="/onboard"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Refine with officer
          </Link>
        </div>
      </div>
      <dl className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {r.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {r.value ?? (
                <span className="italic font-normal text-slate-400">
                  Not captured yet
                </span>
              )}
            </dd>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 md:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Systems in scope
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
            {organization.scoped_systems ?? (
              <span className="italic text-slate-400">Not captured yet</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
