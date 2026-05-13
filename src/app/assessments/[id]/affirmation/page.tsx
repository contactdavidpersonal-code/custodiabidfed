import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  enforceStepOrder,
  getAssessmentForUser,
  getBusinessProfile,
} from "@/lib/assessment";
import { resolveOrgBranding, displayUrl } from "@/lib/org-branding";
import { PrintButton } from "../PrintButton";

export default async function AffirmationMemoPage(
  props: PageProps<"/assessments/[id]/affirmation">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "attested");

  const org = ctx.organization;
  const a = ctx.assessment;
  const profile = await getBusinessProfile(org.id);
  const branding = resolveOrgBranding(
    org,
    (profile?.data ?? {}) as Record<string, unknown>,
  );
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
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/assessments/${id}`}
          className="text-sm font-medium text-[#5a7d70] transition-colors hover:text-[#10231d]"
        >
          &larr; Back to overview
        </Link>
        <PrintButton label="Print / save as PDF" />
      </div>

      <article className="print-document border border-[#cfe3d9] bg-white shadow-sm print:border-0 print:shadow-none">
        {/* Customer-branded header bar — their attestation, their letterhead. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-[#f59e0b] bg-[#0a1814] px-10 py-5 text-white print:px-0">
          <div className="flex min-w-0 items-center gap-4">
            {branding.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logoUrl}
                alt={`${org.name} logo`}
                className="h-12 w-auto bg-white p-1"
              />
            ) : null}
            <div className="min-w-0">
              <div className="font-serif text-lg font-bold leading-tight tracking-tight">
                {org.name}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#cfe3d9]">
                {[
                  branding.locationLine,
                  displayUrl(branding.website),
                  branding.phone,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
          <div className="inline-flex flex-col items-end gap-1 text-right">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f59e0b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
              CMMC Level 1 · Verified by Custodia
            </div>
            {a.custodia_verification_id ? (
              <div className="font-mono text-[10px] text-[#cfe3d9]">
                {a.custodia_verification_id}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-10 print:p-0">
        <header className="mb-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            Annual Affirmation of Compliance
          </div>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
            CMMC Level 1 — Self-Assessment
          </h1>
          <p className="mt-2 text-sm text-[#5a7d70]">
            Pursuant to 32 CFR § 170.22 and the terms of FAR 52.204-21
          </p>
        </header>

        <section className="space-y-5 text-sm leading-relaxed text-[#10231d]">
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
              the 15 safeguarding requirements set forth at FAR 52.204-21(b)(1)(i)–(xv)
              (the &ldquo;CMMC Level 1&rdquo; requirements), consistent with the
              methodology described in 32 CFR § 170.15.
            </li>
            <li>
              The scope of this self-assessment covers all information systems
              that process, store, or transmit Federal Contract Information
              (FCI), described in the accompanying System Security Plan as:
              <span className="mt-2 block whitespace-pre-wrap border border-[#cfe3d9] border-l-4 border-l-[#10231d] bg-[#f5f8f6] p-3 text-xs text-[#10231d]">
                {org.scoped_systems ?? "[Scope pending — complete the business profile.]"}
              </span>
            </li>
            <li>
              To the best of my knowledge, {org.name} implements each of the
              15 CMMC Level 1 safeguarding requirements, and the representations
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
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                SAM UEI
              </div>
              <div className="mt-1 font-bold text-[#10231d]">
                {org.sam_uei ?? "[UEI not provided]"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                CAGE code
              </div>
              <div className="mt-1 font-bold text-[#10231d]">
                {org.cage_code ?? "[CAGE not provided]"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                Assessment cycle
              </div>
              <div className="mt-1 font-bold text-[#10231d]">
                {a.cycle_label}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                Date of affirmation
              </div>
              <div className="mt-1 font-bold text-[#10231d]">
                {affirmDate ?? "[Not yet signed]"}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-[#cfe3d9] pt-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="mb-8 border-b-[1.5px] border-[#10231d]" />
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                  Signature
                </div>
                <div className="mt-1 text-sm font-bold text-[#10231d]">
                  {a.affirmed_by_name ?? "[Senior Official Name]"}
                </div>
                <div className="text-xs text-[#5a7d70]">
                  {a.affirmed_by_title ?? "[Title]"}
                </div>
              </div>
              <div>
                <div className="mb-8 border-b-[1.5px] border-[#10231d]" />
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                  Date
                </div>
                <div className="mt-1 text-sm font-bold text-[#10231d]">
                  {affirmDate ?? "[_________________]"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-[#cfe3d9] pt-6 text-xs text-[#5a7d70]">
          Generated by Custodia on {generatedDate}. File this affirmation in
          SPRS at piee.eb.mil (PIEE → SPRS → Cyber Reports → CMMC Assessments
          tab → &ldquo;Add New Level 1 CMMC Self-Assessment&rdquo;)
          alongside your System Security Plan, then return to Custodia and
          record the CMMC Status Date SPRS returns.
        </footer>
        </div>
      </article>
    </main>
  );
}
