import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import { PrintButton } from "../PrintButton";

/**
 * Statement of Compliance — a one-page customer-prepared artifact that
 * summarizes the org's CMMC Level 1 self-attestation for the current cycle.
 * Defensible language only: this is NOT a third-party certificate. It cites
 * FAR 52.204-21 + 32 CFR Part 170, references the signed annual affirmation
 * memo, and quotes the SPRS confirmation number.
 *
 * Renders only after the user has (a) signed their affirmation memo and
 * (b) recorded their SPRS filing via `recordSprsFilingAction`. Until then
 * we route them back to the assessment overview where they finish those
 * steps.
 */
export default async function StatementOfCompliancePage(
  props: PageProps<"/assessments/[id]/statement">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  // Only available after both the affirmation is signed AND SPRS filing is
  // recorded. We send users back to the overview page (where the SPRS
  // capture form lives) if either step is missing.
  if (
    ctx.assessment.status !== "attested" ||
    !ctx.assessment.sprs_filed_at ||
    !ctx.assessment.sprs_confirmation_number
  ) {
    redirect(`/assessments/${id}`);
  }

  const a = ctx.assessment;
  const org = ctx.organization;

  const generatedDate = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const filedDate = new Date(a.sprs_filed_at!).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const affirmDate = a.affirmed_at
    ? new Date(a.affirmed_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const nextFy = (a.fiscal_year ?? new Date().getUTCFullYear()) + 1;
  const nextDueDate = new Date(Date.UTC(nextFy, 8, 30)).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/assessments/${id}`}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          &larr; Back to overview
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>

      <article className="print-document  border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="mb-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Statement of Compliance
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            CMMC Level 1 — FY{a.fiscal_year}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Self-attestation under FAR 52.204-21 and 32 CFR Part 170
          </p>
        </header>

        <section className="space-y-6 text-sm leading-relaxed text-slate-900">
          <p>
            This Statement of Compliance is provided by{" "}
            <strong>{org.name}</strong>
            {org.entity_type ? ` (${org.entity_type})` : ""} to evidence the
            organization&rsquo;s annual self-attestation of compliance with
            the seventeen (17) basic safeguarding requirements set forth at
            FAR 52.204-21(b)(1) for the protection of Federal Contract
            Information (&ldquo;FCI&rdquo;).
          </p>

          <div className="grid grid-cols-2 gap-6  border border-slate-200 bg-slate-50 p-5 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Organization
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {org.name}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Federal fiscal year
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                FY{a.fiscal_year} (Oct 1 {(a.fiscal_year ?? 0) - 1} &ndash; Sep 30 {a.fiscal_year})
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SAM UEI
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {org.sam_uei ?? "[Not provided]"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                CAGE code
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {org.cage_code ?? "[Not provided]"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Affirmation signed
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {affirmDate ?? "[Pending]"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Senior Official
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {a.affirmed_by_name ?? "[Pending]"}
                {a.affirmed_by_title ? `, ${a.affirmed_by_title}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SPRS confirmation #
              </div>
              <div className="mt-1 font-mono text-base font-semibold text-emerald-800">
                {a.sprs_confirmation_number}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Filed in SPRS
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {filedDate}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-base font-bold text-slate-900">
              Attestation
            </h2>
            <p>
              {org.name} has conducted a self-assessment of all seventeen (17)
              basic safeguarding requirements at FAR 52.204-21(b)(1) using the
              methodology set forth in 32 CFR § 170.15. A Senior Official with
              authority to act on behalf of the organization has signed the
              annual affirmation memo, and the resulting affirmation has been
              filed in the U.S. Department of Defense Supplier Performance
              Risk System (&ldquo;SPRS&rdquo;) and assigned the confirmation
              number shown above. The organization maintains a System
              Security Plan describing how each requirement is implemented,
              together with supporting evidence, and will produce both upon
              request from a Government contracting officer.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-bold text-slate-900">
              Re-affirmation cadence
            </h2>
            <p>
              {org.name} will re-affirm compliance with FAR 52.204-21 not
              later than <strong>{nextDueDate}</strong>, and annually
              thereafter, in accordance with 32 CFR § 170.22.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-bold text-slate-900">
              Important — what this document is not
            </h2>
            <p className="text-slate-700">
              CMMC Level 1 is annual self-attestation under FAR 52.204-21 and
              32 CFR Part 170. There is no third-party certifying body and no
              government-issued certificate at Level 1. This Statement of
              Compliance is a customer-prepared summary intended to
              accompany prime-contractor questionnaires, capability
              statements, and supplier onboarding packets. The authoritative
              federal record is the SPRS confirmation referenced above.
            </p>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          Generated by Custodia on {generatedDate}. Custodia, Pittsburgh, PA
          &middot; bidfedcmmc.com &middot; support@custodia.dev
        </footer>
      </article>
    </main>
  );
}
