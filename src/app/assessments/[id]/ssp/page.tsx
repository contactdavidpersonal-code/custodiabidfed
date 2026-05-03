import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  listEvidenceForAssessment,
  listResponsesForAssessment,
  type ControlResponseRow,
} from "@/lib/assessment";
import { controlDomains, playbook } from "@/lib/playbook";
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

  const responses = await listResponsesForAssessment(id);
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const evidence = await listEvidenceForAssessment(id);
  const evidenceByControl = new Map<string, typeof evidence>();
  for (const e of evidence) {
    const list = evidenceByControl.get(e.control_id) ?? [];
    list.push(e);
    evidenceByControl.set(e.control_id, list);
  }

  const org = ctx.organization;
  const a = ctx.assessment;
  const generatedDate = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
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
        <header className="mb-10 border-b border-slate-200 pb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            System Security Plan
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {org.name}
          </h1>
          <p className="mt-2 text-sm text-slate-700">
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
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            1. System description and scope
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
            {org.scoped_systems ??
              "No scope description provided. Complete the business profile before finalizing."}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            2. Senior official affirmation
          </h2>
          {a.affirmed_at && a.affirmed_by_name ? (
            <div className="mt-3  border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
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
                {org.name} implements all 17 CMMC Level 1 security requirements
                as described.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm italic text-slate-600">
              This plan has not yet been signed by a senior official.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            3. Implementation of the 17 practices
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            For each requirement, the narrative below describes how{" "}
            {org.name} implements the practice, with supporting evidence on
            file.
          </p>

          <div className="mt-6 space-y-8">
            {controlDomains.map((domain) => {
              const practices = playbook.filter((p) => p.domain === domain);
              return (
                <div key={domain}>
                  <h3 className="text-base font-bold text-slate-900">
                    {domain} · {domainLabels[domain]}
                  </h3>
                  <div className="mt-3 space-y-5">
                    {practices.map((practice) => {
                      const r = responseByControl.get(practice.id);
                      const arts = evidenceByControl.get(practice.id) ?? [];
                      return (
                        <div
                          key={practice.id}
                          className=" border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <div className="font-mono text-xs text-slate-500">
                                {practice.id} · {practice.farReference}
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-900">
                                {practice.shortName}
                              </div>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                              {statusText[r?.status ?? "unanswered"]}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600 italic">
                            {practice.title}
                          </p>
                          <div className="mt-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Implementation
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                              {r?.narrative ??
                                "No narrative provided for this practice."}
                            </p>
                          </div>
                          {arts.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Evidence on file
                              </div>
                              <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
                                {arts.map((e) => (
                                  <li key={e.id}>
                                    {e.filename}{" "}
                                    <span className="text-xs text-slate-500">
                                      ({new Date(e.captured_at).toLocaleDateString()})
                                    </span>
                                  </li>
                                ))}
                              </ul>
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

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          Generated by Custodia on {generatedDate}. This System Security Plan
          is based on the self-assessment conducted by {org.name} against the
          17 CMMC Level 1 practices defined in FAR 52.204-21(b)(1).
        </footer>
      </article>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
