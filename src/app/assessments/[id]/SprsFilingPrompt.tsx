import Link from "next/link";
import { publishVerifiedPageAction, recordSprsFilingAction } from "../actions";

/**
 * Post-filing receipt card with an editable confirmation number — small
 * businesses occasionally mistype on first paste, so the form stays available
 * and the server action audits any amendment.
 */
export function SprsFilingReceiptCard({
  assessmentId,
  fiscalYear,
  sprsFiledAt,
  sprsConfirmationNumber,
  custodiaVerificationId,
}: {
  assessmentId: string;
  fiscalYear: number;
  sprsFiledAt: string;
  sprsConfirmationNumber: string;
  custodiaVerificationId: string | null;
}) {
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
    <div className="border border-emerald-300 bg-emerald-50/70 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Filed in SPRS · FY{fiscalYear}
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-emerald-900">
            You&rsquo;re bid-eligible for this fiscal year.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Your CMMC Level 1 annual affirmation is on record with the federal
            government. Custodia will monitor your connectors, push freshness
            reminders, and nudge you 60 / 30 / 14 days before your next
            re-affirmation.
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
              <dd className="mt-1 break-all font-mono text-base font-semibold text-emerald-900">
                {sprsConfirmationNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Filed
              </dt>
              <dd className="mt-1 font-semibold text-emerald-900">{filed}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Next re-affirmation
              </dt>
              <dd className="mt-1 font-semibold text-emerald-900">{nextDue}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/assessments/${assessmentId}/statement`}
            className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Download Statement of Compliance
          </Link>
          <Link
            href="/opportunities"
            className="border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition-colors hover:border-emerald-400"
          >
            Find bids →
          </Link>
        </div>
      </div>

      <form
        action={recordSprsFilingAction}
        className="mt-6 border-t border-emerald-200 pt-5"
      >
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="confirmationNumber"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Edit SPRS confirmation number
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
              defaultValue={sprsConfirmationNumber}
              className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Save changes
          </button>
        </div>
        <p className="mt-2 text-xs leading-snug text-slate-500">
          Use only to correct a typo from your original paste. Every change is
          audit-logged.
        </p>
      </form>
    </div>
  );
}

/**
 * Custodia Verified offer card — only shown on the bid-packet page (step 6)
 * after the user has filed in SPRS. Two states: not-yet-published (offer +
 * benefits + Publish button) and published (live page receipt + manage link).
 * The customer's SPRS confirmation number is NEVER shown on the public page;
 * the public identifier is the human-friendly Custodia Verification ID.
 */
export function VerifiedPageOfferCard({
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
      <div className="border border-emerald-300 bg-white p-6 shadow-sm">
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
              <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono font-semibold text-emerald-900">
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
              className="bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Manage Verified page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/40 shadow-sm">
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
          <p className="mt-4 border border-slate-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
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
              className="w-full bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
            >
              Publish my Verified page
            </button>
          </form>
          <Link
            href={`/assessments/${assessmentId}/verified`}
            className="mt-2 block w-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400"
          >
            Preview &amp; customize first
          </Link>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            Not now? You can publish any time from this bid-ready packet page.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Prompt card for the SPRS filing step. Rendered ONLY on the bid-packet
 * page (step 6) — the overview shows just a small pointer until the user
 * has filed.
 */
export function SprsFilingPromptCard({
  assessmentId,
  fiscalYear,
}: {
  assessmentId: string;
  fiscalYear: number;
}) {
  return (
    <div className="border border-amber-300 bg-amber-50/60 p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
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
          className="min-w-0 border border-amber-200 bg-white p-5 shadow-sm"
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
            placeholder="CMMC-AFF-XXXXXX"
            className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Letters, numbers, dashes, underscores. Paste exactly what SPRS
            returned — it&rsquo;s the legal artifact of your federal filing.
          </p>
          <button
            type="submit"
            className="mt-4 w-full bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
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
 * Tiny pointer shown on the overview when attested-but-unfiled. Sends the
 * user back to step 6 (Bid-ready packet) to do the actual SPRS filing.
 */
export function SprsFilingPointer({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border border-amber-300 bg-amber-50/60 p-5 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Final step · File in SPRS
        </div>
        <p className="mt-1 text-sm text-slate-800">
          Your affirmation is signed and locked. Head to the{" "}
          <strong>Bid-ready packet</strong> step to file in SPRS and record
          the confirmation number.
        </p>
      </div>
      <Link
        href={`/assessments/${assessmentId}/bid-packet`}
        className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
      >
        Go to Bid-ready packet →
      </Link>
    </div>
  );
}
