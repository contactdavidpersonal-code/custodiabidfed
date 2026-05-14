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
  covered: "text-[#10231d] bg-[#e8f5ec] ring-[#2f8f6d]/40",
  partial: "text-amber-800 bg-amber-50 ring-amber-300",
  missing: "text-rose-800 bg-rose-50 ring-rose-300",
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

  // Listen for `evidence-changed` events fired *during* Charlie's stream
  // (immediately after a successful tool call) so the slot rows fill in
  // the moment Charlie generates an artifact — no need to wait for the
  // turn to finish or for /sync to grade objectives.
  useEffect(() => {
    const handler = () => {
      startTransition(() => router.refresh());
    };
    window.addEventListener("evidence-changed", handler);
    return () => window.removeEventListener("evidence-changed", handler);
  }, [router]);

  const allCovered = props.spec.objectives.every(
    (o) => verdicts[o.letter]?.status === "covered",
  );

  // Live, denormalized progress for this practice. Combines two signals:
  //   1. Objectives covered (Charlie's grading verdict per 800-171A letter)
  //   2. Required evidence slots filled (any artifact tagged to the slot
  //      with a 'sufficient' AI-review verdict)
  // Both are weighted 50/50 so the bar advances on conversation AND on
  // file collection — the user sees motion either way.
  const totalObjectives = props.spec.objectives.length;
  const coveredObjectives = props.spec.objectives.filter(
    (o) => verdicts[o.letter]?.status === "covered",
  ).length;
  const partialObjectives = props.spec.objectives.filter(
    (o) => verdicts[o.letter]?.status === "partial",
  ).length;
  const requiredSlots = props.spec.evidenceSlots.filter((s) => s.required);
  const filledSlots = requiredSlots.filter((s) => {
    const slotKey = s.key;
    return props.evidence.some((ev) => {
      if (ev.ai_review_verdict !== "sufficient") return false;
      return inferSlotKey(ev.filename, props.spec) === slotKey;
    });
  }).length;
  const objectiveScore =
    totalObjectives === 0
      ? 1
      : (coveredObjectives + 0.5 * partialObjectives) / totalObjectives;
  const evidenceScore =
    requiredSlots.length === 0 ? 1 : filledSlots / requiredSlots.length;
  const overallPercent = Math.round(
    (objectiveScore * 0.5 + evidenceScore * 0.5) * 100,
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
      {/* Sticky practice header: stays pinned just below the workspace nav
          as the user scrolls into the evidence section so they always know
          which practice they're working on. */}
      <header
        className="sticky z-20 -mx-4 mb-6 border-b border-[#cfe3d9] bg-white/95 px-4 pt-6 pb-6 shadow-[0_8px_24px_-18px_rgba(14,42,35,0.4)] backdrop-blur md:-mx-6 md:px-6 md:pt-7"
        style={{ top: "calc(var(--safe-top, 0px) + 72px)" }}
      >
        <Link
          href={`/assessments/${props.assessmentId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]"
        >
          ← Back to overview
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              Practice {props.currentIdx + 1} of {props.total} ·{" "}
              {locked ? "Met" : allCovered ? "Ready to lock" : "In progress"}
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
              {props.spec.controlId} — {props.spec.shortName}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#3a544a]">
              {props.spec.oneLiner}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${
              locked
                ? "bg-[#08201a] text-[#bdf2cf] ring-[#08201a]"
                : allCovered
                  ? "bg-[#f4faf6] text-[#2f8f6d] ring-[#2f8f6d]/40"
                  : "bg-[#fcfdfb] text-[#5a7d70] ring-[#cfe3d9]"
            }`}
          >
            {locked ? "MET" : allCovered ? "READY TO LOCK" : "IN PROGRESS"}
          </span>
        </div>
      </header>

      <PracticeProgressBar
        percent={locked ? 100 : overallPercent}
        coveredObjectives={coveredObjectives}
        totalObjectives={totalObjectives}
        filledSlots={filledSlots}
        totalSlots={requiredSlots.length}
        locked={locked}
      />

      <CharliePrompt locked={locked} controlId={props.controlId} />

      <div className="mt-8 space-y-10">
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
          // Evidence collection is a living document. Even after the practice
          // is signed/locked, users keep their packet current year-round:
          // new hires, retired devices, refreshed rosters. The signed
          // narrative + transcript stay frozen (audit trail); evidence keeps
          // evolving. So we never disable the panel.
          disabled={false}
          locked={locked}
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

function PracticeProgressBar({
  percent,
  coveredObjectives,
  totalObjectives,
  filledSlots,
  totalSlots,
  locked,
}: {
  percent: number;
  coveredObjectives: number;
  totalObjectives: number;
  filledSlots: number;
  totalSlots: number;
  locked: boolean;
}) {
  const tone = locked
    ? "bg-[#08201a]"
    : percent >= 80
      ? "bg-[#2f8f6d]"
      : percent >= 50
        ? "bg-amber-500"
        : "bg-[#a8cfc0]";
  return (
    <div className="mb-6 border border-[#cfe3d9] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
          This practice
        </div>
        <div className="font-serif text-2xl font-bold tabular-nums text-[#10231d]">
          {percent}%
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden bg-[#f4faf6]">
        <div
          className={`h-full ${tone} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#3a544a]">
        <span>
          <strong className="font-semibold text-[#10231d]">
            {coveredObjectives} of {totalObjectives}
          </strong>{" "}
          objectives covered
        </span>
        <span className="text-[#cfe3d9]" aria-hidden>·</span>
        <span>
          <strong className="font-semibold text-[#10231d]">
            {filledSlots} of {totalSlots}
          </strong>{" "}
          evidence collected
        </span>
        {!locked && percent === 100 && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Ready to lock as MET ↓
          </span>
        )}
      </div>
    </div>
  );
}

function CharliePrompt({ locked, controlId }: { locked: boolean; controlId: string }) {
  if (locked) {
    return (
      <div className="border-l-4 border-[#08201a] bg-[#f4faf6] px-6 py-5">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Practice locked · MET
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-[#10231d]">
          The conversation transcript and the signed narrative are a frozen
          snapshot the assessor can read end-to-end. Evidence below stays
          editable so your packet keeps up with the business year-round.
        </p>
      </div>
    );
  }
  return (
    <div className="border-l-4 border-[#2f8f6d] bg-[#f7fcf9] px-6 py-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#08201a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          vCO
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
          Talk to Charlie on the right →
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
        Charlie is loaded with the official CMMC requirement for{" "}
        <strong className="font-semibold">{controlId}</strong>. As you chat,
        the assessment objectives below light up green. When all six are
        covered and your evidence is attached, the lock button unlocks.
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
    <section>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            What an auditor checks
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
            Assessment objectives
          </h2>
        </div>
        <button
          type="button"
          onClick={onReverify}
          disabled={reverifying}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline disabled:opacity-50"
        >
          {reverifying ? "Re-grading…" : "Re-grade"}
        </button>
      </div>
      <ol className="space-y-3">
        {spec.objectives.map((o) => {
          const v = verdicts[o.letter] ?? {
            status: "missing" as const,
            reason: "",
          };
          return (
            <li
              key={o.letter}
              className="border border-[#cfe3d9] bg-white p-5 transition-colors hover:border-[#2f8f6d]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                  Objective {o.letter.toUpperCase()}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${STATUS_COLOR[v.status]}`}
                >
                  {STATUS_LABEL[v.status]}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-[#10231d]">
                {o.text}
              </p>
              {v.reason && (
                <p className="mt-2 text-[13px] leading-relaxed text-[#5a7d70]">
                  {v.reason}
                </p>
              )}
              {v.status === "partial" && "missing" in v && v.missing && (
                <p className="mt-2 text-[13px] italic leading-relaxed text-amber-700">
                  Missing: {v.missing}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
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
  locked = false,
}: {
  spec: PracticeSpec;
  evidence: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  connectedProviders: ConnectorProvider[];
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  /** When true, suppresses upload / replace / re-review affordances. Today
   * this is always false from the practice page; reserved for read-only
   * audit-share views in the future. */
  disabled: boolean;
  /** When true, the practice itself is locked as MET. Evidence stays
   * editable (living document), but we show a banner explaining that the
   * signed snapshot is preserved separately. */
  locked?: boolean;
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
    <section>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            {filledCount} of {totalRequired} collected
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
            Evidence required
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#5a7d70]">
            Each row is a separate artifact an assessor would ask for. Fill it
            with Charlie, a connector, or your own upload.
          </p>
        </div>
        <ProgressDots filled={filledCount} total={totalRequired} />
      </div>

      {locked && (
        <div className="mb-5 border-l-4 border-[#08201a] bg-[#f4faf6] px-6 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Keep your packet current
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
            This practice is signed and locked as MET — that snapshot is
            preserved for the assessor. Evidence here stays editable: as you
            hire, retire devices, or refresh accounts, upload a new version
            and we&apos;ll review it. Your current packet always reflects
            today.
          </p>
        </div>
      )}

      <ol className="space-y-4">
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
      </ol>

      {unmatched.length > 0 && (
        <div className="mt-8 border-t border-[#cfe3d9] pt-5">
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
            Other artifacts on this practice
          </div>
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
    </section>
  );
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            i < filled ? "bg-[#2f8f6d]" : "bg-[#cfe3d9]"
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
      ? { label: "Filled", tone: "bg-[#e8f5ec] text-[#10231d] ring-[#2f8f6d]/40" }
      : status === "needs_review"
        ? { label: "Needs review", tone: "bg-amber-50 text-amber-800 ring-amber-300" }
        : { label: "Empty", tone: "bg-[#fcfdfb] text-[#5a7d70] ring-[#cfe3d9]" };

  return (
    <li className="border border-[#cfe3d9] bg-white p-6 transition-colors hover:border-[#2f8f6d]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
            Slot {index} ·{" "}
            {slot.required ? "Required" : "Optional"} ·{" "}
            Objective{slot.satisfies.length > 1 ? "s" : ""}{" "}
            {slot.satisfies.map((s) => s.toUpperCase()).join(", ")}
          </div>
          <h3 className="mt-2 font-serif text-xl font-bold tracking-tight text-[#10231d]">
            {slot.label}
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-[#3a544a]">
            {slot.hint}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${statusBadge.tone}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Filled artifacts for this slot */}
      {artifacts.length > 0 && (
        <div className="mt-4 space-y-2">
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
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]">
            Replace this artifact
          </summary>
          <div className="mt-3">
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
    <div className="mt-4 flex flex-wrap items-center gap-2">
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
          className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline"
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
    ? "bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf] hover:bg-[#0c2a22]"
    : "border border-[#cfe3d9] bg-white px-4 py-2 text-[12px] font-semibold text-[#10231d] hover:border-[#2f8f6d]";

  if (dest.type === "generate") {
    return (
      <button
        type="button"
        title={dest.label}
        onClick={() => askCharlieToGenerate(slot, dest.filename, dest.format)}
        className={baseClasses}
      >
        {dest.label}
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
          className="border border-[#2f8f6d] bg-[#f4faf6] px-4 py-2 text-[12px] font-semibold text-[#2f8f6d]"
        >
          Connected — auto-collect coming online
        </span>
      );
    }
    return (
      <Link
        href="/dashboard"
        title={dest.describes}
        className={baseClasses}
      >
        {dest.label} →
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
    ? "inline-flex cursor-pointer items-center bg-[#08201a] px-4 py-2 text-[12px] font-semibold text-[#bdf2cf] hover:bg-[#0c2a22]"
    : "inline-flex cursor-pointer items-center border border-[#cfe3d9] bg-white px-4 py-2 text-[12px] font-semibold text-[#10231d] hover:border-[#2f8f6d]";

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
        {label}
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
      ? "text-[#10231d] bg-[#e8f5ec] ring-[#2f8f6d]/40"
      : verdict === "insufficient"
        ? "text-rose-800 bg-rose-50 ring-rose-300"
        : verdict === "not_relevant"
          ? "text-rose-800 bg-rose-50 ring-rose-300"
          : "text-[#5a7d70] bg-[#fcfdfb] ring-[#cfe3d9]";
  const generatedByCharlie = evidence.ai_review_model === "charlie-generated";
  // Strip the [slot:KEY]__ prefix from the displayed filename if present.
  const displayName = evidence.filename.replace(/^\[slot:[a-z0-9_]+\]__/i, "");
  return (
    <div className="border border-[#cfe3d9] bg-[#fcfdfb] px-4 py-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/evidence/${evidence.id}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-semibold text-[#10231d] underline-offset-4 hover:underline"
        >
          {displayName}
        </a>
        <div className="flex shrink-0 items-center gap-1.5">
          {generatedByCharlie && (
            <span className="rounded-full bg-[#08201a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
              Charlie
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ${verdictTone}`}
          >
            {verdict ?? "pending"}
          </span>
        </div>
      </div>
      {evidence.ai_review_summary && (
        <p className="mt-2 leading-relaxed text-[#3a544a]">
          {evidence.ai_review_summary}
        </p>
      )}
      {generatedByCharlie && (
        <p className="mt-2 text-[12px] italic leading-relaxed text-[#5a7d70]">
          Charlie drafted this from your conversation. Open it, check the
          details are correct, and replace any time.
        </p>
      )}
      {!disabled && verdict && !generatedByCharlie && (
        <form action={reReviewEvidenceAction} className="mt-2">
          <input type="hidden" name="artifactId" value={evidence.id} />
          <button
            type="submit"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] underline-offset-4 hover:text-[#10231d] hover:underline"
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
      <section className="border-2 border-[#08201a] bg-[#08201a] p-6 md:p-8">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          Practice locked · MET
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-[#a8cfc0]">
          The chat transcript and the signed narrative are a frozen snapshot
          — the assessor reads this end-to-end as proof of how each objective
          was satisfied. Evidence above stays a living document: refresh your
          rosters, devices, and accounts whenever the business changes, and
          your current packet stays accurate.
        </p>
      </section>
    );
  }
  return (
    <section
      className={`border-2 p-6 md:p-8 ${
        allCovered
          ? "border-[#2f8f6d] bg-[#f4faf6]"
          : "border-[#cfe3d9] bg-[#fcfdfb]"
      }`}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
        {allCovered ? "Ready to sign" : "Not ready yet"}
      </div>
      <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
        {allCovered
          ? "Lock this practice as MET"
          : "Locked until every objective is covered"}
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#3a544a]">
        {allCovered
          ? "Charlie has confirmed every assessment objective. Lock the snapshot so the transcript and narrative are preserved for your assessor."
          : "Keep chatting with Charlie on the right. The lock unlocks the moment every objective is covered and every required artifact is attached."}
      </p>
      <button
        type="button"
        onClick={onLock}
        disabled={!allCovered}
        className={`mt-5 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.22em] ${
          allCovered
            ? "bg-[#08201a] text-[#bdf2cf] hover:bg-[#0c2a22]"
            : "cursor-not-allowed bg-[#cfe3d9] text-white"
        }`}
      >
        {allCovered ? "Lock as MET" : "Locked"}
      </button>
      {lockError && (
        <p className="mt-3 text-[13px] text-rose-700">{lockError}</p>
      )}
    </section>
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
    <div className="mt-10 flex items-center justify-between border-t border-[#cfe3d9] pt-6">
      {prevId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${prevId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70] hover:text-[#10231d]"
        >
          ← Previous practice
        </Link>
      ) : (
        <span />
      )}
      {nextId ? (
        <Link
          href={`/assessments/${assessmentId}/controls/${nextId}`}
          className="font-serif text-lg font-bold tracking-tight text-[#10231d] underline-offset-4 hover:text-[#2f8f6d] hover:underline"
        >
          Next practice →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
