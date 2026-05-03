import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import { PrintButton } from "../PrintButton";

export default async function AffirmationMemoPage(
  props: PageProps<"/assessments/[id]/affirmation">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const org = ctx.organization;
  const a = ctx.assessment;
  const generatedDate = new Date().toLocaleDateString(undefined, {
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/assessments/${id}`}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          &larr; Back to overview
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>

      <article className="print-document rounded-2xl border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="mb-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Annual Affirmation of Compliance
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            CMMC Level 1 — Self-Assessment
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pursuant to 32 CFR § 170.22 and the terms of FAR 52.204-21
          </p>
        </header>

        <section className="space-y-5 text-sm leading-relaxed text-slate-900">
          <p>
            I, <strong>{a.affirmed_by_name ?? "[Senior Official Name]"}</strong>
            {a.affirmed_by_title ? `, ${a.affirmed_by_title}` : ", [Title]"} of{" "}
            <strong>{org.name}</strong>
            {org.entity_type ? ` (${org.entity_type})` : ""}, a Senior Official
            with authority to affirm on behalf of the organization, hereby
            affirm the following:
          </p>

          <ol className="list-decimal space-y-3 pl-6">
            <li>
              {org.name} has conducted a self-assessment of its compliance with
              the 17 security requirements set forth at FAR 52.204-21(b)(1)
              (the &ldquo;CMMC Level 1&rdquo; requirements), consistent with the
              methodology described in 32 CFR § 170.15.
            </li>
            <li>
              The scope of this self-assessment covers all information systems
              that process, store, or transmit Federal Contract Information
              (FCI), described in the accompanying System Security Plan as:
              <span className="mt-2 block rounded-lg border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap text-xs text-slate-800">
                {org.scoped_systems ?? "[Scope pending — complete the business profile.]"}
              </span>
            </li>
            <li>
              To the best of my knowledge, {org.name} implements each of the
              17 CMMC Level 1 security requirements, and the representations
              made in the associated System Security Plan are accurate and
              complete as of the date of this affirmation.
            </li>
            <li>
              I understand that this affirmation is a material representation
              of fact upon which the Government relies. A false, fictitious,
              or fraudulent affirmation may be subject to criminal, civil, or
              administrative penalties, including those under the False
              Claims Act (31 U.S.C. §§ 3729–3733) and 18 U.S.C. § 1001.
            </li>
            <li>
              {org.name} will re-affirm compliance at least annually, and
              will update this affirmation in the DoD Supplier Performance
              Risk System (SPRS) in accordance with applicable regulations.
            </li>
          </ol>

          <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SAM UEI
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {org.sam_uei ?? "[UEI not provided]"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                CAGE code
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {org.cage_code ?? "[CAGE not provided]"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Assessment cycle
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {a.cycle_label}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Date of affirmation
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {affirmDate ?? "[Not yet signed]"}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-300 pt-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="mb-8 border-b border-slate-900" />
                <div className="text-xs font-semibold text-slate-700">
                  Signature
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {a.affirmed_by_name ?? "[Senior Official Name]"}
                </div>
                <div className="text-xs text-slate-600">
                  {a.affirmed_by_title ?? "[Title]"}
                </div>
              </div>
              <div>
                <div className="mb-8 border-b border-slate-900" />
                <div className="text-xs font-semibold text-slate-700">
                  Date
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {affirmDate ?? "[_________________]"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          Generated by Custodia on {generatedDate}. File this affirmation in
          SPRS at piee.eb.mil (PIEE → SPRS → Cyber Reports → CMMC
          Affirmations) alongside your System Security Plan, then return to
          Custodia and record your SPRS confirmation number.
        </footer>
      </article>
    </main>
  );
}
