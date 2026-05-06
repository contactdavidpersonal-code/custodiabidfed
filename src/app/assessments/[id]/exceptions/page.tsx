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
  addMilestoneAction,
  clearExceptionAction,
  declareExceptionAction,
  deleteMilestoneAction,
} from "./actions";

/**
 * Enduring Exceptions & Temporary Deficiencies registry.
 *
 * CMMC Assessment Guide L1 v2.13 §"Assessment Findings": a NOT MET objective
 * can still roll up to MET when documented as either an Enduring Exception
 * (architectural/operational reality, captured in the system security plan)
 * or a Temporary Deficiency (planned remediation, tracked in an operational
 * plan of action with milestones). This page is the source of truth for both.
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
          Exceptions &amp; deficiencies · CMMC AG v2.13
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Document why a requirement still scores MET
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#5a7d70]">
          A NOT-MET objective can still roll up to MET when you document one
          of two findings:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-[#5a7d70]">
          <li>
            <strong className="text-[#10231d]">Enduring Exception (EE):</strong>
            {" "}an architectural or operational reality that won&apos;t change
            (e.g.&nbsp;a manufacturing OT cell that physically can&apos;t
            authenticate). Documented in your System Security Plan.
          </li>
          <li>
            <strong className="text-[#10231d]">
              Temporary Deficiency (TD):
            </strong>
            {" "}a known gap with a plan to fix it. Requires an operational
            plan of action with at least one milestone.
          </li>
        </ul>
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
                      <div className="mt-3 border border-[#bde0cc] bg-[#eaf3ee] p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#0e2a23]">
                            {summary?.exceptionType === "enduring"
                              ? "Enduring Exception"
                              : "Temporary Deficiency"}
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

                        {summary?.exceptionType === "temporary" && (
                          <div className="mt-4 border-t border-[#bde0cc] pt-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#0e2a23]">
                              Operational plan of action
                            </p>
                            {ms.length > 0 ? (
                              <ul className="mt-2 space-y-1">
                                {ms.map((m) => (
                                  <li
                                    key={m.id}
                                    className="flex items-baseline justify-between gap-3 text-sm"
                                  >
                                    <span>
                                      <span className="font-mono text-xs text-[#5a7d70]">
                                        {m.target_date.slice(0, 10)}
                                      </span>{" "}
                                      <span className="text-[#10231d]">
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
                                        className="text-xs text-[#b03a2e] underline"
                                      >
                                        Remove
                                      </button>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-xs text-[#a06b1a]">
                                A Temporary Deficiency requires at least one
                                milestone before it can score MET.
                              </p>
                            )}

                            <form
                              action={addMilestoneAction}
                              className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_auto]"
                            >
                              <input type="hidden" name="assessmentId" value={id} />
                              <input
                                type="hidden"
                                name="controlId"
                                value={controlId}
                              />
                              <input
                                type="text"
                                name="label"
                                required
                                placeholder="Milestone label"
                                maxLength={200}
                                className="border border-[#cfe3d9] bg-white px-3 py-2 text-sm"
                              />
                              <input
                                type="date"
                                name="targetDate"
                                required
                                className="border border-[#cfe3d9] bg-white px-3 py-2 text-sm"
                              />
                              <button
                                type="submit"
                                className="border border-[#0e2a23] bg-[#0e2a23] px-3 py-2 text-xs font-bold text-white hover:bg-[#10231d]"
                              >
                                Add milestone
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      <details className="mt-3 border border-[#e6efe9] bg-[#fafbfa] p-4 text-sm">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#5a7d70]">
                          Declare an EE or TD for this practice
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
                          <fieldset className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="exceptionType"
                                value="enduring"
                                required
                              />
                              <span>Enduring Exception (SSP narrative)</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="exceptionType"
                                value="temporary"
                              />
                              <span>Temporary Deficiency (with plan)</span>
                            </label>
                          </fieldset>
                          <label className="block text-sm">
                            <span className="mb-1.5 block font-semibold text-[#10231d]">
                              Documentation
                            </span>
                            <textarea
                              name="notes"
                              required
                              rows={4}
                              maxLength={4000}
                              placeholder="Describe the architectural reality (EE) or the gap and plan (TD). This text appears in your SSP."
                              className="w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <div>
                            <button
                              type="submit"
                              className="border border-[#0e2a23] bg-[#0e2a23] px-4 py-2 text-sm font-bold text-white hover:bg-[#10231d]"
                            >
                              Save exception
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
