import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import {
  listMilestonesForAssessment,
  listObjectivesForAssessment,
} from "@/lib/cmmc/objectives";
import {
  cmmcL1Requirements,
  type CmmcL1RequirementId,
  playbookById,
  requirementMeta,
  requirementToLegacy,
} from "@/lib/playbook";
import {
  clearExceptionAction,
  declareExceptionAction,
  deleteMilestoneAction,
} from "./actions";

/**
 * Enduring Exceptions registry.
 *
 * CMMC Level 1 is binary (32 CFR § 170.15(b)): every requirement must be MET
 * to file the annual Senior Official affirmation. Plans of Action /
 * Temporary Deficiencies are NOT permitted at L1. The only NOT MET pathway
 * that still scores MET is an Enduring Exception — an architectural reality
 * documented in the System Security Plan that cannot be remediated.
 *
 * (Historical Temporary Deficiency rows are surfaced here so they can be
 * converted to Enduring Exceptions or remediated before re-affirmation.)
 */
export default async function ExceptionsPage(
  props: PageProps<"/assessments/[id]/exceptions">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "practices");

  const [objectives, milestones] = await Promise.all([
    listObjectivesForAssessment(id),
    listMilestonesForAssessment(id),
  ]);

  // Group objectives by legacy control_id so we can summarize EE/TD per
  // control. Per Assessment Guide v2.13, a control's EE/TD applies to all
  // objectives — we mirror that by writing the same exception across them
  // and reading the first row's value back for display.
  const byControl = new Map<
    string,
    {
      controlId: string;
      requirementId: CmmcL1RequirementId;
      exceptionType: "enduring" | "temporary" | null;
      notes: string | null;
      anyNotMet: boolean;
    }
  >();
  for (const o of objectives) {
    const cur = byControl.get(o.control_id);
    if (cur) {
      cur.anyNotMet ||= o.status === "not_met";
    } else {
      byControl.set(o.control_id, {
        controlId: o.control_id,
        requirementId: o.requirement_id,
        exceptionType: o.exception_type,
        notes: o.exception_notes,
        anyNotMet: o.status === "not_met",
      });
    }
  }

  const milestonesByControl = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = milestonesByControl.get(m.control_id) ?? [];
    list.push(m);
    milestonesByControl.set(m.control_id, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Enduring Exceptions · 32 CFR § 170.15(b)
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Document an architectural reality that scores MET
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#5a7d70]">
          CMMC Level 1 is binary. Under 32 CFR &sect; 170.15(b) and the
          Assessment Guide v2.13, every safeguarding requirement must be MET
          (or N/A) at the moment your Senior Official signs the annual
          affirmation. Plans of Action &amp; Milestones / Temporary
          Deficiencies are <strong className="text-[#7a2e1c]">not permitted at L1</strong>.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#5a7d70]">
          The one NOT-MET pathway that still scores MET is an{" "}
          <strong className="text-[#10231d]">Enduring Exception (EE)</strong>:
          an architectural or operational reality that won&rsquo;t change
          (e.g.&nbsp;a manufacturing OT cell that physically can&rsquo;t
          authenticate). The justification lives in your System Security
          Plan and is exported in your bid package.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#5a7d70]">
          If a gap doesn&rsquo;t qualify as enduring, you must remediate it
          to MET before signing &mdash; or accept that you cannot truthfully
          affirm this cycle.
        </p>
      </header>

      {cmmcL1Requirements.map((reqId) => {
        const meta = requirementMeta[reqId];
        const legacyIds = requirementToLegacy[reqId] ?? [];
        return (
          <section
            key={reqId}
            className="mb-8 border border-[#cfe3d9] bg-white"
          >
            <header className="border-b border-[#e6efe9] bg-[#f6faf8] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
                {reqId} · {meta.farClause}
              </p>
              <h2 className="mt-1 font-serif text-lg font-bold text-[#10231d]">
                {meta.shortName}
              </h2>
              <p className="mt-1 text-sm text-[#5a7d70]">{meta.statement}</p>
            </header>

            <div className="divide-y divide-[#e6efe9]">
              {legacyIds.map((controlId) => {
                const summary = byControl.get(controlId);
                const practice = playbookById[controlId];
                const ms = milestonesByControl.get(controlId) ?? [];
                const hasException = summary?.exceptionType != null;
                return (
                  <div key={controlId} className="px-6 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <p className="text-xs font-mono text-[#5a7d70]">
                          {controlId}
                        </p>
                        <p className="text-sm font-semibold text-[#10231d]">
                          {practice?.shortName ?? controlId}
                        </p>
                      </div>
                      <Link
                        href={`/assessments/${id}/controls/${controlId}`}
                        className="text-xs font-semibold text-[#0e2a23] underline hover:text-[#10231d]"
                      >
                        Open practice
                      </Link>
                    </div>

                    {hasException ? (
                      summary?.exceptionType === "temporary" ? (
                        // Legacy Temporary Deficiency row. CMMC L1 no longer
                        // accepts these — surface a hard alert so the user
                        // converts or remediates before re-affirmation.
                        <div className="mt-3 border-l-4 border-[#7a2e1c] bg-[#fdecea] p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#7a2e1c]">
                              Temporary Deficiency — not permitted at CMMC L1
                            </p>
                            <form action={clearExceptionAction}>
                              <input type="hidden" name="assessmentId" value={id} />
                              <input
                                type="hidden"
                                name="controlId"
                                value={controlId}
                              />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-[#7a2e1c] underline hover:text-[#5a1f10]"
                              >
                                Clear &amp; re-declare
                              </button>
                            </form>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#5a1f10]">
                            Under 32 CFR &sect; 170.15(b) Level 1 is binary
                            &mdash; POA&amp;Ms are forbidden. Either
                            remediate this practice to MET, mark N/A with
                            justification, or convert this finding to an
                            Enduring Exception (clear it and re-declare
                            below). You cannot sign the annual affirmation
                            while this row remains.
                          </p>
                          {summary?.notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#5a1f10]">
                              <span className="font-semibold">Prior notes:</span>{" "}
                              {summary.notes}
                            </p>
                          )}
                          {ms.length > 0 && (
                            <div className="mt-3 border-t border-[#f5c6cb] pt-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-[#7a2e1c]">
                                Legacy milestones (no longer counted)
                              </p>
                              <ul className="mt-1 space-y-1">
                                {ms.map((m) => (
                                  <li
                                    key={m.id}
                                    className="flex items-baseline justify-between gap-3 text-sm"
                                  >
                                    <span>
                                      <span className="font-mono text-xs text-[#7a2e1c]">
                                        {m.target_date.slice(0, 10)}
                                      </span>{" "}
                                      <span className="text-[#5a1f10]">
                                        {m.label}
                                      </span>
                                    </span>
                                    <form action={deleteMilestoneAction}>
                                      <input
                                        type="hidden"
                                        name="assessmentId"
                                        value={id}
                                      />
                                      <input
                                        type="hidden"
                                        name="milestoneId"
                                        value={m.id}
                                      />
                                      <button
                                        type="submit"
                                        className="text-xs text-[#7a2e1c] underline"
                                      >
                                        Remove
                                      </button>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Enduring Exception — the only L1-permissible cover.
                        <div className="mt-3 border border-[#bde0cc] bg-[#eaf3ee] p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#0e2a23]">
                              Enduring Exception
                            </p>
                            <form action={clearExceptionAction}>
                              <input type="hidden" name="assessmentId" value={id} />
                              <input
                                type="hidden"
                                name="controlId"
                                value={controlId}
                              />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-[#b03a2e] underline hover:text-[#7d281f]"
                              >
                                Clear exception
                              </button>
                            </form>
                          </div>
                          {summary?.notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#0e2a23]">
                              {summary.notes}
                            </p>
                          )}
                        </div>
                      )
                    ) : (
                      <details className="mt-3 border border-[#e6efe9] bg-[#fafbfa] p-4 text-sm">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
                          Declare an Enduring Exception for this practice
                          {summary?.anyNotMet && (
                            <span className="ml-2 text-[#b03a2e]">
                              · this practice is currently NOT MET
                            </span>
                          )}
                        </summary>
                        <form
                          action={declareExceptionAction}
                          className="mt-3 grid gap-3"
                        >
                          <input type="hidden" name="assessmentId" value={id} />
                          <input
                            type="hidden"
                            name="controlId"
                            value={controlId}
                          />
                          <input
                            type="hidden"
                            name="exceptionType"
                            value="enduring"
                          />
                          <label className="block text-sm">
                            <span className="mb-1.5 block font-semibold text-[#10231d]">
                              SSP narrative
                            </span>
                            <textarea
                              name="notes"
                              required
                              rows={4}
                              maxLength={4000}
                              placeholder="Describe the architectural / operational reality that prevents this practice from being MET in the conventional sense. This text is exported into your System Security Plan verbatim."
                              className="w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <p className="text-xs text-[#5a7d70]">
                            Enduring Exceptions roll up to MET under CMMC
                            AG v2.13. Be specific &mdash; a 3PAO or DCMA
                            reviewer will read this verbatim.
                          </p>
                          <div>
                            <button
                              type="submit"
                              className="border border-[#0e2a23] bg-[#0e2a23] px-4 py-2 text-sm font-bold text-white hover:bg-[#10231d]"
                            >
                              Save Enduring Exception
                            </button>
                          </div>
                        </form>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
