import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  enforceStepOrder,
  getAssessmentForUser,
  listEvidenceForAssessment,
  listResponsesForAssessment,
  type ControlResponseRow,
} from "@/lib/assessment";
import { controlDomains, playbook } from "@/lib/playbook";
import { listObjectivesForAssessment } from "@/lib/cmmc/objectives";
import { PrintButton } from "../PrintButton";

const statusText: Record<ControlResponseRow["status"], string> = {
  unanswered: "Not answered",
  yes: "Met",
  partial: "Partially met",
  no: "Not met",
  not_applicable: "Not applicable",
};

const domainLabels: Record<(typeof controlDomains)[number], string> = {
  AC: "Access Control",
  IA: "Identification & Authentication",
  MP: "Media Protection",
  PE: "Physical Protection",
  SC: "System & Communications Protection",
  SI: "System & Information Integrity",
};

export default async function SystemSecurityPlanPage(
  props: PageProps<"/assessments/[id]/ssp">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "attested");

  const responses = await listResponsesForAssessment(id);
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const evidence = await listEvidenceForAssessment(id);
  const evidenceByControl = new Map<string, typeof evidence>();
  for (const e of evidence) {
    const list = evidenceByControl.get(e.control_id) ?? [];
    list.push(e);
    evidenceByControl.set(e.control_id, list);
  }

  // Per CMMC AG v2.13, Enduring Exceptions and Temporary Deficiencies must
  // be documented in the SSP. Pull the EE/TD declared on the objectives
  // table and surface the first non-null per control alongside the
  // implementation narrative.
  const objectives =
    ctx.assessment.framework === "cmmc_l1"
      ? await listObjectivesForAssessment(id)
      : [];
  const exceptionByControl = new Map<
    string,
    { type: "enduring" | "temporary"; notes: string }
  >();
  for (const o of objectives) {
    if (o.exception_type && !exceptionByControl.has(o.control_id)) {
      exceptionByControl.set(o.control_id, {
        type: o.exception_type,
        notes: o.exception_notes ?? "",
      });
    }
  }

  const org = ctx.organization;
  const a = ctx.assessment;
  const generatedDate = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
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
        {/* Branded header bar — mirrors the public Verified page and the
            zipped HTML deliverables so primes recognize the Custodia document
            chain at a glance. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#f59e0b] bg-[#0a1814] px-10 py-4 text-white print:px-0">
          <div className="font-serif text-lg font-bold tracking-tight">
            Custodia<span className="text-[#f59e0b]">.</span>
          </div>
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f59e0b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
            CMMC Level 1 · Verified
          </div>
        </div>
        <div className="p-10 print:p-0">
        <header className="mb-10 border-b border-[#cfe3d9] pb-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
            System Security Plan
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d]">
            {org.name}
          </h1>
          <p className="mt-2 text-sm text-[#5a7d70]">
            CMMC Level 1 Self-Assessment · FAR 52.204-21
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Field label="Cycle" value={a.cycle_label} />
            <Field label="Status" value={statusText[a.status as ControlResponseRow["status"]] ?? a.status} />
            <Field label="SAM UEI" value={org.sam_uei ?? "—"} />
            <Field label="CAGE code" value={org.cage_code ?? "—"} />
            <Field label="Entity type" value={org.entity_type ?? "—"} />
            <Field
              label="NAICS codes"
              value={org.naics_codes.length > 0 ? org.naics_codes.join(", ") : "—"}
            />
            <Field label="Generated" value={generatedDate} />
            <Field
              label="Affirmed"
              value={
                a.affirmed_at
                  ? new Date(a.affirmed_at).toLocaleDateString()
                  : "Not yet signed"
              }
            />
          </dl>
        </header>

        <section className="mb-10">
          <h2 className="border-l-4 border-[#10231d] pl-3 font-serif text-lg font-bold tracking-tight text-[#10231d]">
            1. System description and scope
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#10231d]">
            {org.scoped_systems ??
              "No scope description provided. Complete the business profile before finalizing."}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="border-l-4 border-[#10231d] pl-3 font-serif text-lg font-bold tracking-tight text-[#10231d]">
            2. Senior official affirmation
          </h2>
          {a.affirmed_at && a.affirmed_by_name ? (
            <div className="mt-3 border border-[#cfe3d9] border-l-4 border-l-[#2f8f6d] bg-[#f5f8f6] p-4 text-sm text-[#10231d]">
              <p>
                <strong>{a.affirmed_by_name}</strong>
                {a.affirmed_by_title ? `, ${a.affirmed_by_title}` : ""} affirmed
                on{" "}
                {new Date(a.affirmed_at).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                that the information in this plan is accurate and that{" "}
                {org.name} implements all 15 CMMC Level 1 basic safeguarding requirements (FAR 52.204-21(b)(1)(i)–(b)(1)(xv); 59 NIST SP 800-171A assessment objectives)
                as described.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm italic text-[#5a7d70]">
              This plan has not yet been signed by a senior official.
            </p>
          )}
        </section>

        <section>
          <h2 className="border-l-4 border-[#10231d] pl-3 font-serif text-lg font-bold tracking-tight text-[#10231d]">
            3. Implementation of the 15 safeguarding requirements
          </h2>
          <p className="mt-2 text-sm text-[#5a7d70]">
            For each requirement, the narrative below describes how{" "}
            {org.name} implements the practice, with supporting evidence on
            file.
          </p>

          <div className="mt-6 space-y-8">
            {controlDomains.map((domain) => {
              const practices = playbook.filter((p) => p.domain === domain);
              return (
                <div key={domain}>
                  <h3 className="font-serif text-base font-bold text-[#10231d]">
                    {domain} · {domainLabels[domain]}
                  </h3>
                  <div className="mt-3 space-y-5">
                    {practices.map((practice) => {
                      const r = responseByControl.get(practice.id);
                      const arts = evidenceByControl.get(practice.id) ?? [];
                      const exc = exceptionByControl.get(practice.id);
                      return (
                        <div
                          key={practice.id}
                          className="border border-[#cfe3d9] border-l-4 border-l-[#2f8f6d] bg-white p-4"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <div className="font-mono text-[11px] text-[#5a7d70]">
                                {practice.id} · {practice.farReference}
                              </div>
                              <div className="mt-1 font-serif text-base font-bold text-[#10231d]">
                                {practice.shortName}
                              </div>
                            </div>
                            <span className="border border-[#cfe3d9] bg-[#e8f1ec] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0e2a23]">
                              {statusText[r?.status ?? "unanswered"]}
                            </span>
                          </div>
                          <p className="mt-2 text-xs italic text-[#5a7d70]">
                            {practice.title}
                          </p>
                          <div className="mt-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                              Implementation
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#10231d]">
                              {r?.narrative ??
                                "No narrative provided for this practice."}
                            </p>
                          </div>
                          {arts.length > 0 && (
                            <div className="mt-3">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                                Evidence on file
                              </div>
                              <ul className="mt-1 list-disc pl-5 text-sm text-[#10231d]">
                                {arts.map((e) => (
                                  <li key={e.id}>
                                    {e.filename}{" "}
                                    <span className="text-xs text-[#5a7d70]">
                                      ({new Date(e.captured_at).toLocaleDateString()})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {exc && (
                            <div className="mt-3 border-l-4 border-[#f59e0b] bg-[#fff8eb] px-3 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a5a00]">
                                {exc.type === "enduring"
                                  ? "Enduring Exception"
                                  : "Temporary Deficiency"}
                                {" · scores MET per CMMC AG v2.13"}
                              </div>
                              {exc.notes && (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-[#10231d]">
                                  {exc.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-10 border-t border-[#cfe3d9] pt-6 text-xs text-[#5a7d70]">
          Generated by Custodia on {generatedDate}. This System Security Plan
          is based on the self-assessment conducted by {org.name} against the
          15 CMMC Level 1 safeguarding requirements defined in FAR 52.204-21(b)(1)(i)–(xv).
        </footer>
        </div>
      </article>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[#10231d]">{value}</dd>
    </div>
  );
}
