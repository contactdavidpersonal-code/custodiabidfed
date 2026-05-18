import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  enforceStepOrder,
  getAssessmentForUser,
  getBusinessProfile,
  listEvidenceForAssessment,
  listResponsesForAssessment,
  type ControlResponseRow,
} from "@/lib/assessment";
import { controlDomains, playbook, practiceObjectives } from "@/lib/playbook";
import {
  effectiveObjectiveStatus,
  listObjectivesForAssessment,
  type ObjectiveResponseRow,
} from "@/lib/cmmc/objectives";
import { resolveOrgBranding, displayUrl } from "@/lib/org-branding";
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

  // Per CMMC Assessment Guide L1 v2.13 §§5–7 and NIST SP 800-171A, the
  // SSP must document each of the 59 individual assessment objectives
  // [a]–[f] under the 15 practices — not just a single per-practice
  // verdict. A 3PAO / DCMA reviewer reads the per-objective findings to
  // confirm the basis of attestation. We surface every objective row
  // here with its status, narrative or N/A justification, assessment
  // method, and any Enduring Exception coverage.
  const objectives =
    ctx.assessment.framework === "cmmc_l1"
      ? await listObjectivesForAssessment(id)
      : [];
  const objectivesByControl = new Map<string, ObjectiveResponseRow[]>();
  for (const o of objectives) {
    const list = objectivesByControl.get(o.control_id) ?? [];
    list.push(o);
    objectivesByControl.set(o.control_id, list);
  }
  for (const list of objectivesByControl.values()) {
    list.sort((a, b) => a.objective_letter.localeCompare(b.objective_letter));
  }

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
        {/* Customer-branded header bar — their letterhead, their attestation.
            Custodia attribution lives in the small footer note + the
            verifier pill on the right. */}
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
                      const practiceObjs =
                        objectivesByControl.get(practice.id) ?? [];
                      const objCatalog = practiceObjectives[practice.id] ?? [];
                      // For backward-compatibility with legacy data the
                      // exception summary here only fires for ENDURING
                      // rows. Temporary rows are surfaced as blocking on
                      // the Exceptions page and via the affirmation gate.
                      const enduringObj = practiceObjs.find(
                        (o) => o.exception_type === "enduring",
                      );
                      const legacyTempObj = practiceObjs.find(
                        (o) => o.exception_type === "temporary",
                      );
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
                          {/* Per-objective findings — required by CMMC AG
                              L1 v2.13 §§5–7 and NIST SP 800-171A. */}
                          {practiceObjs.length > 0 && (
                            <div className="mt-4 border-t border-[#e6efe9] pt-3">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                                Assessment objectives · NIST SP 800-171A
                              </div>
                              <div className="mt-2 grid gap-2">
                                {practiceObjs.map((obj) => {
                                  const eff = effectiveObjectiveStatus(obj);
                                  const ask =
                                    objCatalog.find(
                                      (c) => c.letter === obj.objective_letter,
                                    )?.ask ?? "";
                                  const badge =
                                    eff === "met"
                                      ? {
                                          label:
                                            obj.status === "not_applicable"
                                              ? "N/A"
                                              : "MET",
                                          bg: "#e8f1ec",
                                          fg: "#0e2a23",
                                          bd: "#bde0cc",
                                        }
                                      : eff === "not_met"
                                      ? {
                                          label: "NOT MET",
                                          bg: "#fdecea",
                                          fg: "#7a2e1c",
                                          bd: "#f5c6cb",
                                        }
                                      : {
                                          label: "UNANSWERED",
                                          bg: "#fff8eb",
                                          fg: "#a06b1a",
                                          bd: "#f5e0b3",
                                        };
                                  const detail =
                                    obj.status === "not_applicable"
                                      ? obj.na_justification
                                      : obj.narrative;
                                  return (
                                    <div
                                      key={obj.id}
                                      className="border border-[#e6efe9] bg-[#fafbfa] p-2.5"
                                    >
                                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <div className="font-mono text-[11px] text-[#5a7d70]">
                                          [{obj.objective_letter}]{" "}
                                          <span className="text-[#10231d]">
                                            {ask}
                                          </span>
                                        </div>
                                        <span
                                          className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                                          style={{
                                            background: badge.bg,
                                            color: badge.fg,
                                            borderColor: badge.bd,
                                          }}
                                        >
                                          {badge.label}
                                        </span>
                                      </div>
                                      {detail && (
                                        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[#10231d]">
                                          {detail}
                                        </p>
                                      )}
                                      {obj.method && (
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5a7d70]">
                                          Method:{" "}
                                          <span className="text-[#10231d]">
                                            {obj.method}
                                          </span>
                                        </p>
                                      )}
                                      {obj.exception_type === "enduring" &&
                                        obj.exception_notes && (
                                          <div className="mt-1.5 border-l-2 border-[#f59e0b] bg-[#fff8eb] px-2 py-1">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a5a00]">
                                              Enduring Exception
                                            </span>
                                            <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-[#10231d]">
                                              {obj.exception_notes}
                                            </p>
                                          </div>
                                        )}
                                      {obj.exception_type === "temporary" && (
                                        <div className="mt-1.5 border-l-2 border-[#7a2e1c] bg-[#fdecea] px-2 py-1">
                                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7a2e1c]">
                                            Temporary Deficiency — not permitted at L1
                                          </span>
                                          {obj.exception_notes && (
                                            <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-[#5a1f10]">
                                              {obj.exception_notes}
                                            </p>
                                          )}
                                          <p className="mt-0.5 text-[10px] text-[#5a1f10]">
                                            32 CFR § 170.15(b) forbids POA&amp;Ms
                                            at L1. Convert to an Enduring
                                            Exception or remediate to MET
                                            before signing.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {enduringObj?.exception_notes && (
                            <div className="mt-3 border-l-4 border-[#f59e0b] bg-[#fff8eb] px-3 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a5a00]">
                                Enduring Exception · scores MET per CMMC AG v2.13
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[#10231d]">
                                {enduringObj.exception_notes}
                              </p>
                            </div>
                          )}
                          {legacyTempObj && !enduringObj && (
                            <div className="mt-3 border-l-4 border-[#7a2e1c] bg-[#fdecea] px-3 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a2e1c]">
                                Legacy Temporary Deficiency — must be cleared
                              </div>
                              <p className="mt-1 text-xs text-[#5a1f10]">
                                CMMC L1 does not permit POA&amp;Ms under 32 CFR
                                &sect; 170.15(b). This practice cannot be
                                affirmed until the row is converted to an
                                Enduring Exception or remediated to MET.
                              </p>
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
