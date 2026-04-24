import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getResponse,
  listEvidenceForControl,
  listResponsesForAssessment,
  type ControlResponseRow,
  type EvidenceArtifactRow,
} from "@/lib/assessment";
import { playbook, playbookById, type EvidenceProvider } from "@/lib/playbook";
import type { EvidenceVerdict } from "@/lib/db";
import {
  deleteEvidenceAction,
  reReviewEvidenceAction,
  saveControlResponseAction,
  uploadEvidenceAction,
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
            {practice.providerGuidance.map((guidance) => (
              <details
                key={guidance.provider}
                className="group rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-900">
                  <span className="flex items-center gap-3">
                    <span>{guidance.label}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {providerLabel[guidance.provider]}
                    </span>
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
            ))}
          </div>
        </section>
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
              PDF, images, CSV, Word/Excel. 25 MB max per file.
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
