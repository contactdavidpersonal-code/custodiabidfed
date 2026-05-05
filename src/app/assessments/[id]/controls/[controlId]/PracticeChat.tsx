"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EvidenceArtifactRow } from "@/lib/assessment";
import type { PracticeSpec } from "@/lib/cmmc/practice-spec";
import type {
  ChatMessage,
  ObjectiveVerdict,
} from "@/lib/cmmc/practice-chat";
import { EvidenceDropzone } from "./EvidenceDropzone";
import { lockPracticeAction } from "./practice-chat-actions";

type ClientEvidenceRow = Omit<EvidenceArtifactRow, "blob_url">;

type Props = {
  assessmentId: string;
  controlId: string;
  spec: PracticeSpec;
  initialMessages: ChatMessage[];
  initialVerdicts: Record<string, ObjectiveVerdict>;
  initiallyLocked: boolean;
  evidence: ClientEvidenceRow[];
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

export function PracticeChat(props: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [verdicts, setVerdicts] = useState<Record<string, ObjectiveVerdict>>(
    props.initialVerdicts,
  );
  const [locked, setLocked] = useState(props.initiallyLocked);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const allCovered = props.spec.objectives.every(
    (o) => verdicts[o.letter]?.status === "covered",
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending || locked) return;
    setSending(true);
    const optimistic: ChatMessage = {
      role: "user",
      text,
      at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    try {
      const res = await fetch(
        `/api/assessments/${props.assessmentId}/practice-chat/${encodeURIComponent(props.controlId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        assistantText: string;
        objectiveVerdicts: Record<string, ObjectiveVerdict>;
      };
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.assistantText,
          at: new Date().toISOString(),
        },
      ]);
      if (data.objectiveVerdicts) setVerdicts(data.objectiveVerdicts);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Sorry — I hit an error sending that. ${
            err instanceof Error ? err.message : "Try again in a moment."
          }`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onReverify = async () => {
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
    } catch {
      // silent — manual button, user can retry
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
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
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

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Chat pane */}
        <section className="flex h-[70vh] flex-col rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5"
          >
            <div className="space-y-4">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-stone-400" />
                  Charlie is typing…
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-stone-200 px-3 py-3 md:px-4">
            {locked ? (
              <p className="text-sm text-stone-500">
                This practice is locked. The transcript and evidence above are
                a frozen snapshot for the assessor.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  placeholder="Tell Charlie about your setup…"
                  rows={2}
                  className="min-h-[44px] flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
                  disabled={sending}
                />
                <button
                  type="button"
                  onClick={() => void onSend()}
                  disabled={!draft.trim() || sending}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Evidence + objectives pane */}
        <aside className="flex h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <ObjectivesPanel
            spec={props.spec}
            verdicts={verdicts}
            onReverify={onReverify}
          />
          <EvidencePanel
            spec={props.spec}
            evidence={props.evidence}
            assessmentId={props.assessmentId}
            controlId={props.controlId}
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
        </aside>
      </div>

      <NavRow
        assessmentId={props.assessmentId}
        prevId={props.prevId}
        nextId={props.nextId}
      />
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-stone-900 text-white"
            : "bg-stone-100 text-stone-900 ring-1 ring-stone-200"
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Charlie
          </div>
        )}
        <RenderMarkdownLite text={message.text} />
      </div>
    </div>
  );
}

/** Tiny markdown-ish renderer: paragraphs, **bold**, inline `code`. */
function RenderMarkdownLite({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? "" : "mt-2"}>
          {renderInline(p)}
        </p>
      ))}
    </>
  );
}

function renderInline(s: string): React.ReactNode {
  // Replace **bold** segments
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(s))) {
    if (m.index > lastIdx) parts.push(s.slice(lastIdx, m.index));
    if (m[1] != null) parts.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2] != null)
      parts.push(
        <code
          key={key++}
          className="rounded bg-stone-200/70 px-1 py-0.5 font-mono text-xs"
        >
          {m[2]}
        </code>,
      );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < s.length) parts.push(s.slice(lastIdx));
  return parts;
}

function ObjectivesPanel({
  spec,
  verdicts,
  onReverify,
}: {
  spec: PracticeSpec;
  verdicts: Record<string, ObjectiveVerdict>;
  onReverify: () => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">
          Assessment objectives
        </h2>
        <button
          type="button"
          onClick={onReverify}
          className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
        >
          Re-grade
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
  uploadEvidenceAction,
  reReviewEvidenceAction,
  disabled,
}: {
  spec: PracticeSpec;
  evidence: ClientEvidenceRow[];
  assessmentId: string;
  controlId: string;
  uploadEvidenceAction: (formData: FormData) => Promise<void> | void;
  reReviewEvidenceAction: (formData: FormData) => Promise<void> | void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Evidence</h2>
      <p className="mb-3 text-xs text-stone-500">
        Drop in the artifacts below. Charlie reviews each upload and re-grades
        the objectives on the right.
      </p>

      <div className="mb-3 space-y-2">
        {spec.evidenceSlots.map((slot) => (
          <div
            key={slot.key}
            className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-stone-800">{slot.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-stone-500">
                {slot.required ? "required" : "optional"} · [{slot.satisfies.join(",")}]
              </span>
            </div>
            <p className="mt-1 text-stone-600">{slot.hint}</p>
            {slot.templatePath && (
              <a
                href={slot.templatePath}
                className="mt-1 inline-block text-stone-700 underline-offset-2 hover:underline"
                download
              >
                Download template
              </a>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <EvidenceDropzone
          action={uploadEvidenceAction}
          assessmentId={assessmentId}
          controlId={controlId}
          compact
        />
      )}

      <div className="mt-3 space-y-2">
        {evidence.length === 0 ? (
          <p className="text-xs italic text-stone-500">
            No evidence attached yet.
          </p>
        ) : (
          evidence.map((e) => (
            <EvidenceRow
              key={e.id}
              evidence={e}
              reReviewEvidenceAction={reReviewEvidenceAction}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EvidenceRow({
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
  return (
    <div className="rounded-lg border border-stone-200 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/evidence/${evidence.id}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-stone-800 hover:underline"
        >
          {evidence.filename}
        </a>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${verdictTone}`}
        >
          {verdict ?? "pending"}
        </span>
      </div>
      {evidence.ai_review_summary && (
        <p className="mt-1 text-stone-600">{evidence.ai_review_summary}</p>
      )}
      {!disabled && verdict && (
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
          The chat transcript and evidence above are a frozen snapshot. The
          assessor can read this end-to-end as proof of how each objective
          was satisfied.
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
