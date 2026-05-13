import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

/**
 * "Copy these into SPRS" card — every field SPRS asks for on the
 * `Add New Level 1 CMMC Self-Assessment` form, rendered with a CopyButton
 * per field so the user can paste each one without retyping.
 *
 * Mirrors the field order in the SPRS CMMC Quick Entry Guide v4.0
 * (DEC 2024) so the user can copy top-down as they fill the SPRS form.
 *
 * This is the "white-glove" piece of the SPRS filing experience — the
 * difference between "log into SPRS and figure out what to type" and
 * "log into SPRS, paste, paste, paste, click Affirm". Every value
 * shown here is already in the org / assessment record; we never make
 * anything up.
 */
export function SprsCopyPasteCard({
  cageCode,
  samUei,
  organizationName,
  scopedSystems,
  affirmedAtIso,
  selfAssessmentCompletedAtIso,
  affirmingOfficialName,
  affirmingOfficialTitle,
  affirmingOfficialEmail,
  fiscalYear,
  assessmentId,
}: {
  cageCode: string | null;
  samUei: string | null;
  organizationName: string;
  scopedSystems: string | null;
  affirmedAtIso: string | null;
  selfAssessmentCompletedAtIso: string | null;
  affirmingOfficialName: string | null;
  affirmingOfficialTitle: string | null;
  affirmingOfficialEmail: string | null;
  fiscalYear: number;
  assessmentId: string;
}) {
  // SPRS expects an assessment date — prefer the explicit
  // self-assessment completion date (captured at sign time per
  // P1 #8). Fall back to the affirmation date when the user didn't
  // override at sign time. Format as the YYYY-MM-DD SPRS accepts via
  // its date picker.
  const assessmentSourceIso =
    selfAssessmentCompletedAtIso ?? affirmedAtIso ?? null;
  const assessmentDateIso = assessmentSourceIso
    ? assessmentSourceIso.slice(0, 10)
    : null;
  const assessmentDateHuman = assessmentSourceIso
    ? new Date(assessmentSourceIso).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // The SPRS "System Security Plan" field accepts a free-form reference —
  // we synthesize a unique citation the contracting officer can map back
  // to the Custodia-hosted SSP if requested. The actual SSP bytes are
  // produced on-demand from the locked attestation packet; the citation
  // is the stable handle.
  const sspReference = `Custodia SSP — ${organizationName} — Assessment ${assessmentId} — FY${fiscalYear}`;

  // SPRS Compliance Status for L1 is binary: "Met" once all 15 v2.13
  // requirements are implemented. The sign-time gate enforces this so we
  // can hard-code the value here.
  const complianceStatus = "Met (all 15 FAR 52.204-21(b)(1) requirements implemented)";

  const fields: Array<{
    label: string;
    value: string | null;
    placeholder?: string;
    note?: string;
    monospace?: boolean;
    multiline?: boolean;
  }> = [
    {
      label: "CAGE Code",
      value: cageCode,
      placeholder: "Add your CAGE in registration first",
      monospace: true,
      note: "SPRS keys every CMMC record on this CAGE.",
    },
    {
      label: "SAM UEI",
      value: samUei,
      placeholder: "Add your UEI in registration first",
      monospace: true,
      note: "Cross-reference field — primes verify by either CAGE or UEI.",
    },
    {
      label: "Assessment Date",
      value: assessmentDateIso,
      placeholder: "Sign your affirmation memo first",
      monospace: true,
      note: assessmentDateHuman
        ? `The day you signed your affirmation memo (${assessmentDateHuman}).`
        : "Auto-populated once your affirmation memo is signed.",
    },
    {
      label: "Compliance Status",
      value: complianceStatus,
      note: "Level 1 is binary — Custodia's sign-time gate confirms all 15 are MET.",
    },
    {
      label: "Assessment Scope",
      value: scopedSystems,
      placeholder: "Complete your business profile to capture scope",
      multiline: true,
      note: "The systems-in-scope paragraph from your business profile. Paste exactly into the SPRS Scope field.",
    },
    {
      label: "Affirming Official Name",
      value: affirmingOfficialName,
      placeholder: "Sign your affirmation memo first",
      note: "The Senior Official who signed your annual affirmation memo.",
    },
    {
      label: "Affirming Official Title",
      value: affirmingOfficialTitle,
      placeholder: "Sign your affirmation memo first",
    },
    {
      label: "Affirming Official Email",
      value: affirmingOfficialEmail,
      placeholder: "Sign your affirmation memo first",
      monospace: true,
      note: "SPRS uses this to route 'Transfer to AO' if the AO isn't logged in.",
    },
    {
      label: "System Security Plan reference",
      value: sspReference,
      note: "Free-form text SPRS accepts as your SSP citation.",
    },
  ];

  return (
    <div className="border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            White-glove SPRS filing · FY{fiscalYear}
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Copy these into SPRS
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Every field the SPRS{" "}
            <code className="bg-slate-100 px-1 py-0.5 text-[12px]">
              Add New Level 1 CMMC Self-Assessment
            </code>{" "}
            form will ask for, in order. Click <strong>Copy</strong> on each
            row and paste into the matching field in SPRS.
          </p>
        </div>
        <Link
          href="/sprs-guide"
          className="text-sm font-semibold text-emerald-700 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-800"
        >
          Full SPRS walkthrough →
        </Link>
      </div>

      <ol className="divide-y divide-slate-100 border border-slate-200">
        {fields.map((f, idx) => {
          const hasValue = typeof f.value === "string" && f.value.length > 0;
          return (
            <li key={f.label} className="grid gap-3 p-4 sm:grid-cols-[160px_1fr_auto] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="mr-2 inline-block min-w-[1.25rem] text-slate-400">
                  {idx + 1}.
                </span>
                {f.label}
              </div>
              <div className="min-w-0">
                {hasValue ? (
                  f.multiline ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-900">
                      {f.value}
                    </pre>
                  ) : (
                    <div
                      className={`break-words border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 ${
                        f.monospace ? "font-mono" : ""
                      }`}
                    >
                      {f.value}
                    </div>
                  )
                ) : (
                  <div className="border border-amber-200 bg-amber-50 p-2.5 text-sm italic text-amber-900">
                    {f.placeholder ?? "Not yet captured"}
                  </div>
                )}
                {f.note ? (
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    {f.note}
                  </p>
                ) : null}
              </div>
              <div className="sm:pt-1">
                {hasValue ? (
                  <CopyButton code={f.value as string} label="Copy" />
                ) : (
                  <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    —
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <aside className="mt-4 border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <strong className="text-slate-800">One field SPRS asks for that
          isn&rsquo;t shown here:</strong>{" "}
        <em>POC Email</em> (use the same address you registered PIEE with).
        That stays between you and SPRS — Custodia doesn&rsquo;t need it to
        unlock your bid packet.
      </aside>
    </div>
  );
}
