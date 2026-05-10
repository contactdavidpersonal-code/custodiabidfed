import Link from "next/link";
import { recordSprsFilingAction } from "../actions";

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
