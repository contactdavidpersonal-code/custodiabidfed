"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EvidenceArtifactRow } from "@/lib/assessment";
import type {
  EvidenceDestination,
  EvidenceSlot,
  PracticeSpec,
} from "@/lib/cmmc/practice-spec";
import { inferSlotKey } from "@/lib/cmmc/practice-spec";
import type { ConnectorProvider } from "@/lib/connectors/types";
import type { ObjectiveVerdict } from "@/lib/cmmc/practice-chat";
import { lockPracticeAction } from "./practice-chat-actions";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;

type Props = {
  assessmentId: string;
  controlId: string;
  spec: PracticeSpec;
  initialVerdicts: Record<string, ObjectiveVerdict>;
  initiallyLocked: boolean;
  evidence: ClientEvidenceRow[];
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  prevId: string | null;
  nextId: string | null;
  currentIdx: number;
  total: number;
};

const STATUS_COLOR: Record<ObjectiveVerdict["status"], string> = {
  covered: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  partial: "text-amber-700 bg-amber-50 ring-amber-200",
  missing: "text-rose-700 bg-rose-50 ring-rose-200",
};

const STATUS_LABEL: Record<ObjectiveVerdict["status"], string> = {
  covered: "COVERED",
  partial: "PARTIAL",
  missing: "MISSING",
};

/**
 * Hybrid practice workspace. The middle pane on a /controls/:controlId page
 * for any practice that has a CMMC spec entry. The CHAT itself lives in the
 * Charlie rail (right side) — Charlie is grounded in this practice's NIST
 * 800-171A objectives via the system prompt. After every Charlie turn, the
 * rail POSTs to /sync and dispatches a 'practice-graded' window event with
 * the fresh objective verdicts; this component listens and re-renders.
 */
export function PracticeChat(props: Props) {
  const router = useRouter();
  const [verdicts, setVerdicts] = useState<Record<string, ObjectiveVerdict>>(
    props.initialVerdicts,
  );
  const [locked, setLocked] = useState(props.initiallyLocked);
  const [lockError, setLockError] = useState<string | null>(null);
  const [reverifying, setReverifying] = useState(false);
  const [, startTransition] = useTransition();

  // Listen for practice-graded events from the Charlie rail. The rail emits
  // one after every turn while the user is on this control's page.
  useEffect(() => {
    type Detail = {
      controlId: string;
      objectiveVerdicts: Record<string, ObjectiveVerdict>;
    };
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Detail>).detail;
      if (!detail || detail.controlId !== props.controlId) return;
      if (detail.objectiveVerdicts) setVerdicts(detail.objectiveVerdicts);
      // Charlie may have generated artifacts via tool calls during the
      // turn — refresh the server component so newly-created evidence
      // shows in the panel below.
      startTransition(() => router.refresh());
    };
    window.addEventListener("practice-graded", handler as EventListener);
    return () =>
      window.removeEventListener("practice-graded", handler as EventListener);
  }, [props.controlId, router]);

  const allCovered = props.spec.objectives.every(
    (o) => verdicts[o.letter]?.status === "covered",
  );

  const onReverify = async () => {
    if (reverifying) return;
    setReverifying(true);
    try {
      const res = await fetch(
        `/api/assessments/${props.assessmentId}/practice-chat/${encodeURIComponent(props.controlId)}/verify`,
        { method: "POST" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        objectiveVerdicts: Record<string, ObjectiveVerdict>;
      };
      setVerdicts(data.objectiveVerdicts ?? {});
    } finally {
      setReverifying(false);
    }
  };

  const onLock = async () => {
    setLockError(null);
    const result = await lockPracticeAction({
      assessmentId: props.assessmentId,
      controlId: props.controlId,
    });
    if (result.objectiveVerdicts) setVerdicts(result.objectiveVerdicts);
    if (!result.ok) {
      setLockError(result.reason ?? "Could not lock yet.");
      return;
    }
    setLocked(true);
    startTransition(() => router.refresh());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/assessments/${props.assessmentId}`}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            ← Back to overview
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            {props.spec.controlId} — {props.spec.shortName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            {props.spec.oneLiner}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">
            Practice {props.currentIdx + 1} of {props.total}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${
              locked
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : allCovered
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-stone-100 text-stone-700 ring-stone-200"
            }`}
          >
            {locked ? "MET" : allCovered ? "READY TO LOCK" : "IN PROGRESS"}
          </span>
        </div>
      </header>

      <CharliePrompt locked={locked} controlId={props.controlId} />

      <div className="mt-4 space-y-4">
        <ObjectivesPanel
          spec={props.spec}
          verdicts={verdicts}
          onReverify={onReverify}
          reverifying={reverifying}
        />
        <EvidencePanel
          spec={props.spec}
          evidence={props.evidence}
          assessmentId={props.assessmentId}
          controlId={props.controlId}
          connectedProviders={props.connectedProviders}
          uploadEvidenceAction={props.uploadEvidenceAction}
          reReviewEvidenceAction={props.reReviewEvidenceAction}
          disabled={locked}
        />
        <LockPanel
          allCovered={allCovered}
          locked={locked}
          lockError={lockError}
          onLock={onLock}
        />
      </div>

      <NavRow
        assessmentId={props.assessmentId}
        prevId={props.prevId}
        nextId={props.nextId}
      />
    </div>
  );
}

function CharliePrompt({ locked, controlId }: { locked: boolean; controlId: string }) {
  if (locked) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        This practice is locked as MET. The conversation transcript and
        evidence below are a frozen snapshot the assessor can read end-to-end.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3 text-sm text-[#10231d]">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#0e2a23] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]">
          vCO
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          Talk to Charlie on the right →
        </span>
      </div>
      <p className="text-stone-700">
        Charlie is loaded with the official CMMC requirement for{" "}
        <strong>{controlId}</strong>. As you chat, the assessment objectives
        below light up green. When all six are covered and your evidence is
        attached, the lock button unlocks.
      </p>
    </div>
  );
}

function ObjectivesPanel({
  spec,
  verdicts,
  onReverify,
  reverifying,
}: {
  spec: PracticeSpec;
  verdicts: Record<string, ObjectiveVerdict>;
  onReverify: () => void;
  reverifying: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">
          Assessment objectives — what an auditor checks
        </h2>
        <button
          type="button"
          onClick={onReverify}
          disabled={reverifying}
          className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline disabled:opacity-50"
        >
          {reverifying ? "Re-grading…" : "Re-grade"}
        </button>
      </div>
      <ul className="space-y-2">
        {spec.objectives.map((o) => {
          const v = verdicts[o.letter] ?? {
            status: "missing" as const,
            reason: "",
          };
          return (
            <li key={o.letter} className="text-xs">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${STATUS_COLOR[v.status]}`}
                >
                  [{o.letter}] {STATUS_LABEL[v.status]}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-stone-800">{o.text}</div>
                  {v.reason && (
                    <div className="mt-0.5 text-stone-500">{v.reason}</div>
                  )}
                  {v.status === "partial" && "missing" in v && v.missing && (
                    <div className="mt-0.5 italic text-amber-700">
                      Missing: {v.missing}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EvidencePanel({
  spec,
  evidence,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
  reReviewEvidenceAction,
  disabled,
}: {
  spec: PracticeSpec;
  evidence: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  // Bucket every artifact tagged to this practice into the slot it satisfies.
  // Anything we can't pin to a specific slot (legacy uploads from before the
  // hybrid flow) lands in `unmatched` and renders as a generic row.
  const bySlot: Record<string, ClientEvidenceRow[]> = {};
  const unmatched: ClientEvidenceRow[] = [];
  for (const ev of evidence) {
    const slotKey = inferSlotKey(ev.filename, spec);
    if (slotKey) {
      (bySlot[slotKey] ??= []).push(ev);
    } else {
      unmatched.push(ev);
    }
  }

  const filledCount = spec.evidenceSlots.filter((s) => {
    const items = bySlot[s.key] ?? [];
    return items.some((it) => it.ai_review_verdict === "sufficient");
  }).length;
  const totalRequired = spec.evidenceSlots.filter((s) => s.required).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Evidence — {filledCount} of {totalRequired} collected
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Each row is a separate artifact an assessor would ask for. Fill it
            with Charlie, a connector, or your own upload.
          </p>
        </div>
        <ProgressDots filled={filledCount} total={totalRequired} />
      </div>

      <ul className="space-y-3">
        {spec.evidenceSlots.map((slot, idx) => (
          <SlotRow
            key={slot.key}
            index={idx + 1}
            slot={slot}
            artifacts={bySlot[slot.key] ?? []}
            assessmentId={assessmentId}
            controlId={controlId}
            connectedProviders={connectedProviders}
            uploadEvidenceAction={uploadEvidenceAction}
            reReviewEvidenceAction={reReviewEvidenceAction}
            disabled={disabled}
          />
        ))}
      </ul>

      {unmatched.length > 0 && (
        <div className="mt-4 border-t border-stone-200 pt-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Other artifacts on this practice
          </h3>
          <div className="space-y-2">
            {unmatched.map((ev) => (
              <ArtifactCard
                key={ev.id}
                evidence={ev}
                reReviewEvidenceAction={reReviewEvidenceAction}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            i < filled ? "bg-emerald-500" : "bg-stone-200"
          }`}
        />
      ))}
    </div>
  );
}

function SlotRow({
  index,
  slot,
  artifacts,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
  reReviewEvidenceAction,
  disabled,
}: {
  index: number;
  slot: EvidenceSlot;
  artifacts: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  const sufficient = artifacts.find((a) => a.ai_review_verdict === "sufficient");
  const status: "filled" | "needs_review" | "empty" = sufficient
    ? "filled"
    : artifacts.length > 0
      ? "needs_review"
      : "empty";

  const statusBadge =
    status === "filled"
      ? { label: "FILLED", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
      : status === "needs_review"
        ? { label: "NEEDS REVIEW", tone: "bg-amber-50 text-amber-700 ring-amber-200" }
        : { label: "EMPTY", tone: "bg-stone-100 text-stone-600 ring-stone-200" };

  return (
    <li className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-stone-400">#{index}</span>
            <span className="font-semibold text-stone-900">{slot.label}</span>
            <span className="text-[10px] uppercase tracking-wide text-stone-500">
              {slot.required ? "required" : "optional"} · [{slot.satisfies.join(",")}]
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-600">{slot.hint}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadge.tone}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Filled artifacts for this slot */}
      {artifacts.length > 0 && (
        <div className="mt-3 space-y-2">
          {artifacts.map((ev) => (
            <ArtifactCard
              key={ev.id}
              evidence={ev}
              reReviewEvidenceAction={reReviewEvidenceAction}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Action rail (hidden once locked) */}
      {!disabled && status !== "filled" && (
        <SlotActions
          slot={slot}
          assessmentId={assessmentId}
          controlId={controlId}
          connectedProviders={connectedProviders}
          uploadEvidenceAction={uploadEvidenceAction}
        />
      )}

      {/* "Replace" rail when filled — same actions, different label */}
      {!disabled && status === "filled" && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-stone-500 hover:text-stone-800">
            Replace this artifact
          </summary>
          <div className="mt-2">
            <SlotActions
              slot={slot}
              assessmentId={assessmentId}
              controlId={controlId}
              connectedProviders={connectedProviders}
              uploadEvidenceAction={uploadEvidenceAction}
            />
          </div>
        </details>
      )}
    </li>
  );
}

function SlotActions({
  slot,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
}: {
  slot: EvidenceSlot;
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {slot.destinations.map((dest, i) => (
        <DestinationButton
          key={`${slot.key}-${dest.type}-${i}`}
          slot={slot}
          dest={dest}
          recommended={i === 0}
          assessmentId={assessmentId}
          controlId={controlId}
          connectedProviders={connectedProviders}
          uploadEvidenceAction={uploadEvidenceAction}
        />
      ))}
      {slot.templatePath && (
        <a
          href={slot.templatePath}
          download
          className="text-[11px] text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
        >
          Download template
        </a>
      )}
    </div>
  );
}

function DestinationButton({
  slot,
  dest,
  recommended,
  assessmentId,
  controlId,
  connectedProviders,
  uploadEvidenceAction,
}: {
  slot: EvidenceSlot;
  dest: EvidenceDestination;
  recommended: boolean;
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
}) {
  const baseClasses = recommended
    ? "rounded-lg bg-stone-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-stone-800"
    : "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50";

  if (dest.type === "generate") {
    return (
      <button
        type="button"
        title={dest.label}
        onClick={() => askCharlieToGenerate(slot, dest.filename, dest.format)}
        className={baseClasses}
      >
        🤖 {dest.label}
      </button>
    );
  }

  if (dest.type === "connect") {
    const liveProviders = dest.providers.filter((p) =>
      connectedProviders.includes(p),
    );
    const isConnected = liveProviders.length > 0;
    if (isConnected) {
      return (
        <span
          title={dest.describes}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700"
        >
          🔌 Connected · auto-collect coming online
        </span>
      );
    }
    return (
      <Link
        href="/dashboard"
        title={dest.describes}
        className={baseClasses}
      >
        🔌 {dest.label} →
      </Link>
    );
  }

  // dest.type === "upload"
  return (
    <SlotUploadButton
      slot={slot}
      assessmentId={assessmentId}
      controlId={controlId}
      uploadEvidenceAction={uploadEvidenceAction}
      label={dest.label}
      describes={dest.describes}
      accept={dest.accept}
      recommended={recommended}
    />
  );
}

function SlotUploadButton({
  slot,
  assessmentId,
  controlId,
  uploadEvidenceAction,
  label,
  describes,
  accept,
  recommended,
}: {
  slot: EvidenceSlot;
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  label: string;
  describes: string;
  accept?: string[];
  recommended: boolean;
}) {
  const baseClasses = recommended
    ? "inline-flex cursor-pointer items-center rounded-lg bg-stone-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-stone-800"
    : "inline-flex cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50";

  return (
    <form
      action={uploadEvidenceAction}
      title={describes}
      className="inline"
    >
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="controlId" value={controlId} />
      <input type="hidden" name="slotKey" value={slot.key} />
      <label className={baseClasses}>
        ⬆ {label}
        <input
          type="file"
          name="file"
          className="hidden"
          accept={accept?.join(",")}
          onChange={(e) => {
            if (e.currentTarget.files?.length) {
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </label>
    </form>
  );
}

/**
 * Asks Charlie (in the right rail) to generate the artifact for this slot.
 * Drops a focused user message into the rail's input and submits, so the
 * tool call happens via the normal /api/chat flow — same path as if the
 * user had typed the request themselves.
 */
function askCharlieToGenerate(
  slot: EvidenceSlot,
  filename: string,
  format: "csv" | "markdown" | "text",
) {
  const message =
    `Please generate the **${slot.label}** for me now using everything I've told you so far. ` +
    `Call \`generate_evidence_artifact\` with slot_key="${slot.key}", filename="${filename}", format="${format}". ` +
    `Use only facts I've actually confirmed in this conversation — don't invent names, emails, or systems.`;
  window.dispatchEvent(
    new CustomEvent("charlie-send-message", { detail: { message } }),
  );
}

function ArtifactCard({
  evidence,
  reReviewEvidenceAction,
  disabled,
}: {
  evidence: ClientEvidenceRow;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  const verdict = evidence.ai_review_verdict;
  const verdictTone =
    verdict === "sufficient"
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : verdict === "insufficient"
        ? "text-rose-700 bg-rose-50 ring-rose-200"
        : verdict === "not_relevant"
          ? "text-rose-700 bg-rose-50 ring-rose-200"
          : "text-stone-700 bg-stone-50 ring-stone-200";
  const generatedByCharlie = evidence.ai_review_model === "charlie-generated";
  // Strip the [slot:KEY]__ prefix from the displayed filename if present.
  const displayName = evidence.filename.replace(/^\[slot:[a-z0-9_]+\]__/i, "");
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/evidence/${evidence.id}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-stone-800 hover:underline"
        >
          {displayName}
        </a>
        <div className="flex shrink-0 items-center gap-1">
          {generatedByCharlie && (
            <span className="rounded-full bg-[#0e2a23] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#bdf2cf]">
              Charlie
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${verdictTone}`}
          >
            {verdict ?? "pending"}
          </span>
        </div>
      </div>
      {evidence.ai_review_summary && (
        <p className="mt-1 text-stone-600">{evidence.ai_review_summary}</p>
      )}
      {generatedByCharlie && (
        <p className="mt-1 text-[11px] italic text-stone-500">
          Charlie drafted this from your conversation. Open it, check the
          details are correct, and replace any time.
        </p>
      )}
      {!disabled && verdict && !generatedByCharlie && (
        <form action={reReviewEvidenceAction} className="mt-1">
          <input type="hidden" name="artifactId" value={evidence.id} />
          <button
            type="submit"
            className="text-[11px] text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
          >
            Re-review
          </button>
        </form>
      )}
    </div>
  );
}

function LockPanel({
  allCovered,
  locked,
  lockError,
  onLock,
}: {
  allCovered: boolean;
  locked: boolean;
  lockError: string | null;
  onLock: () => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="font-semibold">Practice locked as MET</div>
        <p className="mt-1 text-emerald-800">
          The chat transcript and evidence are a frozen snapshot. The assessor
          can read this end-to-end as proof of how each objective was satisfied.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onLock}
        disabled={!allCovered}
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {allCovered ? "Lock as MET" : "Locked until every objective is covered"}
      </button>
      {lockError && (
        <p className="mt-2 text-xs text-rose-600">{lockError}</p>
      )}
    </div>
  );
}

function NavRow({
  assessmentId,
  prevId,
  nextId,
}: {
  assessmentId: string;
  prevId: string | null;
  nextId: string | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
      {prevId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${prevId}`}
          className="hover:text-stone-800"
        >
          ← Previous practice
        </Link>
      ) : (
        <span />
      )}
      {nextId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${nextId}`}
          className="hover:text-stone-800"
        >
          Next practice →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
