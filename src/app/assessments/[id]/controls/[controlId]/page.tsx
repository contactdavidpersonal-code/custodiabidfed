import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getRemediationPlan,
  getResponse,
  listEvidenceForControl,
  listResponsesForAssessment,
  type ControlResponseRow,
  type EvidenceArtifactRow,
  type RemediationPlanRow,
} from "@/lib/assessment";
import { playbook, playbookById, type EvidenceProvider } from "@/lib/playbook";
import type { EvidenceVerdict, RemediationStatus } from "@/lib/db";
import {
  decideCarryForwardArtifactAction,
  decideCarryForwardResponseAction,
  deleteEvidenceAction,
  deleteRemediationPlanAction,
  reReviewEvidenceAction,
  saveControlResponseAction,
  uploadEvidenceAction,
  upsertRemediationPlanAction,
  useSuggestedNarrativeAction,
} from "../../../actions";

const statusOptions: Array<{
  value: ControlResponseRow["status"];
  label: string;
  description: string;
  ring: string;
  dot: string;
}> = [
  {
    value: "yes",
    label: "Met",
    description: "We do this, and we can produce evidence.",
    ring: "has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50",
    dot: "bg-emerald-500",
  },
  {
    value: "partial",
    label: "Partial",
    description: "We do this in some places, not everywhere.",
    ring: "has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50",
    dot: "bg-amber-500",
  },
  {
    value: "no",
    label: "Not met",
    description: "We don't do this yet — we need to fix it before affirming.",
    ring: "has-[:checked]:border-rose-400 has-[:checked]:bg-rose-50",
    dot: "bg-rose-500",
  },
  {
    value: "not_applicable",
    label: "N/A",
    description: "This practice genuinely does not apply to our scope.",
    ring: "has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50",
    dot: "bg-sky-500",
  },
];

const providerLabel: Record<EvidenceProvider, string> = {
  m365: "Microsoft 365",
  google_workspace: "Google Workspace",
  okta: "Okta",
  on_prem_ad: "On-prem Active Directory",
  aws: "AWS",
  manual: "Manual / any business",
};

/**
 * Infers which file formats a piece of guidance is asking for from its
 * capture text. Only Screenshot and PDF formats can be auto-reviewed by the
 * Custodia AI; everything else (CSV, Excel) needs an officer to clear it
 * before the user can sign. Chips are rendered next to each provider so the
 * user knows what to capture before they capture it.
 */
type EvidenceFormat = {
  key: "screenshot" | "pdf" | "csv" | "signed";
  label: string;
  autoReviewable: boolean;
};

const EVIDENCE_FORMAT_DEFS: Record<EvidenceFormat["key"], EvidenceFormat> = {
  screenshot: { key: "screenshot", label: "Screenshot", autoReviewable: true },
  pdf: { key: "pdf", label: "PDF", autoReviewable: true },
  csv: { key: "csv", label: "CSV export", autoReviewable: false },
  signed: { key: "signed", label: "Signed paper", autoReviewable: true },
};

function inferEvidenceFormats(capture: string): EvidenceFormat[] {
  const lower = capture.toLowerCase();
  const out: EvidenceFormat[] = [];
  if (/screenshot|screen capture|screen-cap/.test(lower)) {
    out.push(EVIDENCE_FORMAT_DEFS.screenshot);
  }
  if (/\bpdf\b|signed pdf|scanned pdf/.test(lower)) {
    out.push(EVIDENCE_FORMAT_DEFS.pdf);
  }
  if (/\bcsv\b|exported csv|export.*csv/.test(lower)) {
    out.push(EVIDENCE_FORMAT_DEFS.csv);
  }
  if (/signed (page|matrix|roster|policy|list)|photo of signed|scanned/.test(lower)) {
    if (!out.some((f) => f.key === "signed")) {
      out.push(EVIDENCE_FORMAT_DEFS.signed);
    }
  }
  // Default: if nothing matched, assume screenshot is the safe bet.
  if (out.length === 0) out.push(EVIDENCE_FORMAT_DEFS.screenshot);
  return out;
}

function FormatChip({ format }: { format: EvidenceFormat }) {
  const tone = format.autoReviewable
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-800 ring-amber-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${tone}`}
      title={
        format.autoReviewable
          ? "AI auto-reviewable"
          : "Officer review needed before signing"
      }
    >
      {format.autoReviewable ? "✓" : "⚠"} {format.label}
    </span>
  );
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type VerdictKey = EvidenceVerdict | "pending";

const verdictStyles: Record<
  VerdictKey,
  { label: string; pill: string; box: string }
> = {
  sufficient: {
    label: "Sufficient",
    pill: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  insufficient: {
    label: "Insufficient",
    pill: "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200",
    box: "border-rose-200 bg-rose-50 text-rose-900",
  },
  unclear: {
    label: "Unclear",
    pill: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
    box: "border-amber-200 bg-amber-50 text-amber-900",
  },
  not_relevant: {
    label: "Not relevant",
    pill: "bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300",
    box: "border-slate-200 bg-slate-50 text-slate-700",
  },
  pending: {
    label: "Pending",
    pill: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
    box: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

function VerdictBadge({
  verdict,
}: {
  verdict: EvidenceVerdict | null;
}) {
  const key: VerdictKey = verdict ?? "pending";
  const style = verdictStyles[key];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.pill}`}
    >
      {style.label}
    </span>
  );
}

export default async function ControlDetailPage(
  props: PageProps<"/assessments/[id]/controls/[controlId]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id, controlId } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const practice = playbookById[controlId];
  if (!practice) notFound();

  const response = await getResponse(id, controlId);
  if (!response) notFound();

  const evidence = await listEvidenceForControl(id, controlId);
  const allResponses = await listResponsesForAssessment(id);
  const remediationPlan = await getRemediationPlan(id, controlId);
  const orderedIds = playbook.map((p) => p.id);
  const currentIdx = orderedIds.indexOf(controlId);
  const prevId = currentIdx > 0 ? orderedIds[currentIdx - 1] : null;
  const nextId =
    currentIdx >= 0 && currentIdx < orderedIds.length - 1
      ? orderedIds[currentIdx + 1]
      : null;
  const answeredCount = allResponses.filter((r) => r.status !== "unanswered")
    .length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4 text-sm">
        <Link
          href={`/assessments/${id}`}
          className="font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          &larr; Back to overview
        </Link>
        <span className="font-medium text-slate-500">
          Practice {currentIdx + 1} of {orderedIds.length} · {answeredCount}{" "}
          answered
        </span>
      </div>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold tracking-wider text-amber-400">
            {practice.domain}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-500">
            {practice.id}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs font-medium text-slate-500">
            {practice.farReference}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          {practice.shortName}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-700">
          {practice.plainEnglish}
        </p>
        <p className="mt-3 text-sm italic text-slate-500">
          Official text: {practice.title}
        </p>
      </header>

      {practice.whyItMatters && (
        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Why this matters
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-950">
            {practice.whyItMatters}
          </p>
        </section>
      )}

      {practice.providerGuidance.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">
            How to capture evidence
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Pick the setup that matches your business. Follow the steps,
            upload what you capture below.
          </p>
          <div className="space-y-2">
            {practice.providerGuidance.map((guidance) => {
              const formats = inferEvidenceFormats(guidance.capture);
              return (
                <details
                  key={guidance.provider}
                  className="group rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-900">
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{guidance.label}</span>
                      <span className="text-xs font-medium text-slate-500">
                        {providerLabel[guidance.provider]}
                      </span>
                      {formats.map((f) => (
                        <FormatChip key={f.key} format={f} />
                      ))}
                    </span>
                    <span className="text-slate-400 transition-transform group-open:rotate-90">
                      &rsaquo;
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                      {guidance.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                    <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      <span className="font-semibold text-slate-900">
                        Capture:{" "}
                      </span>
                      {guidance.capture}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {response.carry_forward_status === "pending_review" && (
        <CarryForwardResponseBanner
          assessmentId={id}
          controlId={controlId}
          response={response}
        />
      )}

      <EvidenceSection
        assessmentId={id}
        controlId={controlId}
        artifacts={evidence}
      />

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Your answer
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Mark how you meet this practice and write a short narrative. This
            narrative appears verbatim in your generated SSP.
          </p>
        </div>

        <form
          action={saveControlResponseAction}
          className="space-y-6"
          id="save-response-form"
        >
          <input type="hidden" name="assessmentId" value={id} />
          <input type="hidden" name="controlId" value={controlId} />

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-slate-900">
              Status
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 ${option.ring}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    defaultChecked={response.status === option.value}
                    className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
                  />
                  <span className="block">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${option.dot}`}
                      />
                      <span className="text-sm font-bold text-slate-900">
                        {option.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Narrative
              </span>
              <span className="text-xs text-slate-500">
                Plain English — how you actually do this
              </span>
            </span>
            <textarea
              name="narrative"
              rows={7}
              defaultValue={response.narrative ?? ""}
              placeholder="Describe what you do, where, and how often. Reference the evidence you captured."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Save answer
            </button>
            <button
              type="submit"
              form="suggest-narrative-form"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              Fill with suggested narrative
            </button>
          </div>
        </form>

        <form
          id="suggest-narrative-form"
          action={useSuggestedNarrativeAction}
          className="hidden"
        >
          <input type="hidden" name="assessmentId" value={id} />
          <input type="hidden" name="controlId" value={controlId} />
        </form>
      </section>

      {(response.status === "no" ||
        response.status === "partial" ||
        remediationPlan) && (
        <RemediationSection
          assessmentId={id}
          controlId={controlId}
          plan={remediationPlan}
          responseStatus={response.status}
        />
      )}

      {practice.commonGotchas.length > 0 && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Common gotchas
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {practice.commonGotchas.map((g, idx) => (
              <li key={idx}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
        {prevId ? (
          <Link
            href={`/assessments/${id}/controls/${prevId}`}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            &larr; Previous
          </Link>
        ) : (
          <span />
        )}
        {nextId ? (
          <Link
            href={`/assessments/${id}/controls/${nextId}`}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            Next practice &rarr;
          </Link>
        ) : (
          <Link
            href={`/assessments/${id}`}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            Back to overview &rarr;
          </Link>
        )}
      </nav>
    </main>
  );
}

function CarryForwardResponseBanner({
  assessmentId,
  controlId,
  response,
}: {
  assessmentId: string;
  controlId: string;
  response: ControlResponseRow;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-sky-300 bg-sky-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-sky-800">
        Imported from last cycle — review needed
      </div>
      <h2 className="mt-1 text-base font-bold text-slate-900">
        We carried over your prior answer ({response.status === "yes" ? "Met" : "N/A"}).
        Is it still accurate for this fiscal year?
      </h2>
      {response.narrative && (
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700">
          {response.narrative}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={decideCarryForwardResponseAction}>
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="controlId" value={controlId} />
          <input type="hidden" name="decision" value="kept" />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            Still accurate — keep
          </button>
        </form>
        <form action={decideCarryForwardResponseAction}>
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="controlId" value={controlId} />
          <input type="hidden" name="decision" value="needs_replacement" />
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-400"
          >
            Re-answer this practice
          </button>
        </form>
      </div>
    </section>
  );
}

function CarryForwardArtifactButton({
  assessmentId,
  artifactId,
  decision,
  label,
  tone,
}: {
  assessmentId: string;
  artifactId: string;
  decision: "kept" | "needs_replacement" | "removed";
  label: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald:
      "bg-emerald-600 text-white hover:bg-emerald-500",
    amber: "bg-amber-500 text-white hover:bg-amber-400",
    rose: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <form action={decideCarryForwardArtifactAction}>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="artifactId" value={artifactId} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${toneClass[tone]}`}
      >
        {label}
      </button>
    </form>
  );
}

const remediationStatusOptions: Array<{
  value: RemediationStatus;
  label: string;
}> = [
  { value: "open", label: "Open — not started" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
  { value: "abandoned", label: "Abandoned" },
];

function RemediationSection({
  assessmentId,
  controlId,
  plan,
  responseStatus,
}: {
  assessmentId: string;
  controlId: string;
  plan: RemediationPlanRow | null;
  responseStatus: ControlResponseRow["status"];
}) {
  const today = new Date();
  const defaultTarget = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const note =
    responseStatus === "no"
      ? "This practice is Not met. CMMC L1 affirmation is binary — every practice must be Met or N/A before signing. Document a remediation plan with a target close date so primes can see your roadmap."
      : responseStatus === "partial"
        ? "This practice is Partial. CMMC L1 has no half-credit — you must close the gap to Met before signing. Use this plan to track your closure work."
        : "Plan retained for the record. You can mark it closed once the practice is fully Met.";

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Remediation plan
          </h2>
          <p className="mt-1 text-sm text-amber-900">{note}</p>
        </div>
        {plan && (
          <form action={deleteRemediationPlanAction}>
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="controlId" value={controlId} />
            <button
              type="submit"
              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
            >
              Discard plan
            </button>
          </form>
        )}
      </div>

      <form action={upsertRemediationPlanAction} className="space-y-4">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="controlId" value={controlId} />

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-900">
            Gap summary
          </span>
          <textarea
            name="gapSummary"
            rows={2}
            required
            defaultValue={plan?.gap_summary ?? ""}
            placeholder="What's missing today? E.g. MFA is enabled for admins but not all general users."
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-900">
            Planned actions
          </span>
          <textarea
            name="plannedActions"
            rows={3}
            required
            defaultValue={plan?.planned_actions ?? ""}
            placeholder="Concrete steps. E.g. Enable Conditional Access policy 'Require MFA for all users' on 2026-05-15. Send 2-week notice to staff."
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-900">
              Target close date
            </span>
            <input
              type="date"
              name="targetCloseDate"
              required
              defaultValue={plan?.target_close_date ?? defaultTarget}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-900">
              Status
            </span>
            <select
              name="status"
              defaultValue={plan?.status ?? "open"}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            >
              {remediationStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            {plan ? "Update plan" : "Save plan"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EvidenceSection({
  assessmentId,
  controlId,
  artifacts,
}: {
  assessmentId: string;
  controlId: string;
  artifacts: EvidenceArtifactRow[];
}) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Evidence
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload screenshots, exports, signed rosters — anything that proves
            you do what you say. Stored privately, linked from your SSP.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {artifacts.length} file{artifacts.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base leading-none">★</span>
          <div>
            <div className="font-bold">
              Preferred for AI auto-review: PNG/JPG screenshots or PDF.
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              The Custodia AI reviews images and PDFs end-to-end. CSV, Excel,
              Word, and plain text uploads are accepted but cannot be
              auto-reviewed — they will need a Custodia officer to clear them
              before you can sign. When in doubt, take a screenshot of the
              data on screen.
            </p>
          </div>
        </div>
      </div>

      <form
        action={uploadEvidenceAction}
        encType="multipart/form-data"
        className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5"
      >
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="controlId" value={controlId} />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-1 min-w-[220px] flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-900">
              Choose a file
            </span>
            <input
              type="file"
              name="file"
              required
              accept="image/*,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
            />
            <span className="text-xs text-slate-500">
              PNG/JPG/PDF auto-review. CSV/Excel/Word need officer clearance.
              25 MB max.
            </span>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Upload
          </button>
        </div>
      </form>

      {artifacts.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {artifacts.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-base">
                    {a.mime_type?.startsWith("image/")
                      ? "IMG"
                      : a.mime_type?.includes("pdf")
                        ? "PDF"
                        : "DOC"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={a.blob_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-semibold text-slate-900 hover:text-amber-600"
                      >
                        {a.filename}
                      </a>
                      <VerdictBadge verdict={a.ai_review_verdict} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>
                        {new Date(a.captured_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {a.size_bytes && (
                        <>
                          <span>·</span>
                          <span>{formatBytes(a.size_bytes)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <form action={reReviewEvidenceAction}>
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={assessmentId}
                    />
                    <input type="hidden" name="controlId" value={controlId} />
                    <input type="hidden" name="artifactId" value={a.id} />
                    <button
                      type="submit"
                      title="Re-run AI review"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
                    >
                      Re-review
                    </button>
                  </form>
                  <form action={deleteEvidenceAction}>
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={assessmentId}
                    />
                    <input type="hidden" name="controlId" value={controlId} />
                    <input type="hidden" name="artifactId" value={a.id} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
              {a.carry_forward_status === "pending_review" && (
                <div className="mt-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Carried over from last cycle.</strong> Confirm
                      this is still valid for the current fiscal year.
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <CarryForwardArtifactButton
                        assessmentId={assessmentId}
                        artifactId={a.id}
                        decision="kept"
                        label="Still valid"
                        tone="emerald"
                      />
                      <CarryForwardArtifactButton
                        assessmentId={assessmentId}
                        artifactId={a.id}
                        decision="needs_replacement"
                        label="Needs replacement"
                        tone="amber"
                      />
                      <CarryForwardArtifactButton
                        assessmentId={assessmentId}
                        artifactId={a.id}
                        decision="removed"
                        label="Remove"
                        tone="rose"
                      />
                    </span>
                  </div>
                </div>
              )}
              {a.ai_review_summary && (
                <div
                  className={`mt-2.5 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    verdictStyles[a.ai_review_verdict ?? "pending"].box
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <span>AI review</span>
                    {a.ai_reviewed_at && (
                      <span className="font-normal tracking-normal text-slate-500">
                        ·{" "}
                        {new Date(a.ai_reviewed_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <p>{a.ai_review_summary}</p>
                  {a.ai_review_mapped_controls.length > 0 &&
                    !a.ai_review_mapped_controls.includes(controlId) && (
                      <p className="mt-1.5 text-[11px] text-slate-600">
                        Better fit:{" "}
                        {a.ai_review_mapped_controls.join(", ")}
                      </p>
                    )}
                </div>
              )}
              {!a.ai_reviewed_at && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  AI review pending. Click Re-review if this is stuck.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
