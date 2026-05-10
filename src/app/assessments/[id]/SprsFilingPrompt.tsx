import Link from "next/link";
import { recordSprsFilingAction } from "../actions";

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
}: {
  assessmentId: string;
  fiscalYear: number;
  sprsFiledAt: string;
  sprsConfirmationNumber: string;
}) {
  const filed = new Date(sprsFiledAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="border border-emerald-300 bg-emerald-50/70 p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Filed in SPRS · FY{fiscalYear}
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-emerald-900">
            Confirmation number recorded.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Your CMMC Level 1 annual affirmation is on record with the federal
            government. The confirmation number is saved with this assessment
            and listed below — if you mistyped it, paste the correct value on
            the right and we&rsquo;ll amend the record (every change is
            audit-logged).
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/assessments/${assessmentId}/statement`}
              className="bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
            >
              Download Statement of Compliance →
            </Link>
            <Link
              href={`/assessments/${assessmentId}`}
              className="border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 hover:border-emerald-400"
            >
              Back to overview
            </Link>
          </div>
        </div>
        <form
          action={recordSprsFilingAction}
          className="min-w-0 border border-emerald-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <label
            htmlFor="confirmationNumber"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Edit confirmation number
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
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Updates the recorded number and writes the change to the audit
            log. Use only to correct a typo from the original paste.
          </p>
          <button
            type="submit"
            className="mt-4 w-full bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Save changes
          </button>
        </form>
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
