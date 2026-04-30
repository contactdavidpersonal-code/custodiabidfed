"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ToolEvent = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolEvent[];
};

type StoredContentBlock = {
  type: string;
  text?: string;
  name?: string;
  id?: string;
};

const TOOL_LABELS: Record<string, string> = {
  update_business_profile: "Saving your business context",
  update_organization_fields: "Updating your legal profile",
  escalate_to_officer: "Flagging for a human officer",
  propose_milestone: "Adding a milestone",
  read_assessment_state: "Checking your workspace",
  describe_evidence: "Reviewing an artifact",
  suggest_narrative: "Drafting a narrative",
  check_readiness: "Auditing readiness",
  cite_regulation: "Looking up the regulation text",
};

/**
 * Full-width conversational onboarding. Captures business context via the
 * officer's tools; once the server reports `onboarded: true`, surfaces a
 * "Head to your workspace" button.
 */
export function OnboardingChat({
  initialCompleteness,
}: {
  initialCompleteness: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [completeness, setCompleteness] = useState(initialCompleteness);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboard", { method: "GET" });
        if (!res.ok) throw new Error(`GET /api/onboard -> ${res.status}`);
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: unknown }>;
          onboarded: boolean;
          completeness_score: number;
        };
        if (cancelled) return;
        const hydrated: Message[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            text: extractText(m.content),
            tools: extractToolUses(m.content),
          }))
          .filter((m) => m.text.length > 0 || m.tools.length > 0);
        setMessages(hydrated);
        setOnboarded(data.onboarded);
        setCompleteness(data.completeness_score);
      } catch (err) {
        if (cancelled) return;
        console.warn("Failed to load onboarding history", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streaming]);

  // Keep the input focused so the user can keep typing without re-clicking.
  useEffect(() => {
    if (!hydrated) return;
    if (!streaming) inputRef.current?.focus();
  }, [hydrated, streaming, messages.length]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboard", { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        onboarded: boolean;
        completeness_score: number;
      };
      setOnboarded(data.onboarded);
      setCompleteness(data.completeness_score);
    } catch {
      // Non-fatal — the next turn will refresh.
    }
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setErrorMsg(null);
    setDraft("");
    setStreaming(true);
    const userId = `local-u-${Date.now()}`;
    const assistantId = `local-a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text, tools: [] },
      { id: assistantId, role: "assistant", text: "", tools: [] },
    ]);

    const patchAssistant = (patch: (m: Message) => Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? patch(m) : m)),
      );
    };

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      await parseSse(res.body, (event, data) => {
        if (event === "delta") {
          const t = typeof data.text === "string" ? data.text : "";
          if (!t) return;
          patchAssistant((m) => ({ ...m, text: m.text + t }));
        } else if (event === "tool_start") {
          const id = String(data.id ?? "");
          const name = String(data.name ?? "");
          patchAssistant((m) => ({
            ...m,
            tools: [...m.tools, { id, name, status: "running" }],
          }));
        } else if (event === "tool_end") {
          const id = String(data.id ?? "");
          const ok = data.ok !== false;
          patchAssistant((m) => ({
            ...m,
            tools: m.tools.map((t) =>
              t.id === id ? { ...t, status: ok ? "done" : "error" } : t,
            ),
          }));
        } else if (event === "error") {
          const msg = typeof data.message === "string" ? data.message : "unknown error";
          setErrorMsg(msg);
        }
      });

      await refreshStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      patchAssistant((m) =>
        m.text === ""
          ? { ...m, text: `I couldn't reach the officer: ${msg}` }
          : m,
      );
    } finally {
      setStreaming(false);
      // Re-focus immediately on the same tick so caret stays in the box.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [draft, streaming, refreshStatus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
      <div className="flex flex-none items-center justify-between border-b border-[#cfe3d9] bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center rounded-sm bg-[#0e2a23] px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]">
            vCO
          </span>
          <div className="leading-tight">
            <div className="font-serif text-sm font-bold text-[#10231d]">
              Charlie &middot; Your vCO
            </div>
            <div className="text-[11px] text-[#5a7d70]">
              Virtual Compliance Officer &middot; capturing your business profile
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CompletenessMeter value={completeness} />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
      >
        {!hydrated ? (
          <LoadingBubble />
        ) : messages.length === 0 ? (
          <StarterBubble />
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              text={m.text}
              tools={m.tools}
            />
          ))
        )}
        {streaming &&
          messages[messages.length - 1]?.role === "assistant" &&
          messages[messages.length - 1]?.text === "" &&
          messages[messages.length - 1]?.tools.length === 0 && (
            <TypingIndicator />
          )}
      </div>

      {onboarded && (
        <div className="border-t border-[#cfe3d9] bg-[#eaf3ee] px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#0e2a23]">
              Got what we need — your dashboard is ready.
            </p>
            <button
              type="button"
              onClick={() => router.push("/assessments")}
              className="rounded-sm bg-[#0e2a23] px-4 py-2 text-sm font-bold tracking-tight text-white transition-colors hover:bg-[#10231d]"
            >
              Open my dashboard &rarr;
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="border-t border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-[#cfe3d9] bg-[#f7fcf9] p-4"
      >
        <div className="flex items-end gap-2 rounded-sm border border-[#cfe3d9] bg-white p-2 focus-within:border-[#2f8f6d] focus-within:ring-2 focus-within:ring-[#2f8f6d]/20">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Tell the officer about your business…"
            autoFocus
            readOnly={streaming}
            className="min-h-[48px] max-h-48 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[#10231d] outline-none placeholder:text-[#9ab8ac] read-only:opacity-70"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#0e2a23] text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:bg-[#cfe3d9] disabled:text-white"
            aria-label="Send"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3.105 3.105a1 1 0 011.09-.217l13 5a1 1 0 010 1.864l-13 5a1 1 0 01-1.317-1.297L5.432 10 2.878 4.545a1 1 0 01.227-1.44z" />
          </svg>
          </button>
        </div>
        <p className="mt-2 px-1 text-[10px] uppercase tracking-[0.18em] text-[#7a9c90]">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
}

function CompletenessMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 60
      ? "bg-[#2f8f6d]"
      : pct >= 40
        ? "bg-[#a06b1a]"
        : "bg-[#7a9c90]";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
        Profile
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-[#e3eee8]">
        <div
          className={`h-full transition-all ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-[11px] font-bold text-[#0e2a23]">
        {pct}%
      </span>
    </div>
  );
}

function MessageBubble({
  role,
  text,
  tools,
}: {
  role: "user" | "assistant";
  text: string;
  tools: ToolEvent[];
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-sm border border-[#0e2a23] bg-[#0e2a23] px-4 py-2.5 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-sm bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
        Officer
      </div>
      <div className="flex max-w-[88%] flex-col gap-2">
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <ToolChip key={t.id} tool={t} />
            ))}
          </div>
        )}
        {text && (
          <div className="rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-2.5 text-sm leading-relaxed text-[#10231d]">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolEvent }) {
  const label = TOOL_LABELS[tool.name] ?? tool.name;
  const tone =
    tool.status === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tool.status === "done"
        ? "border-[#cfe3d9] bg-[#eaf3ee] text-[#0e2a23]"
        : "border-[#e8d4a1] bg-[#fff8e8] text-[#a06b1a]";
  const dot =
    tool.status === "error"
      ? "bg-rose-500"
      : tool.status === "done"
        ? "bg-[#2f8f6d]"
        : "bg-[#a06b1a] animate-pulse";
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
      {tool.status === "running" && "…"}
    </div>
  );
}

function StarterBubble() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5">
        <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-sm bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
          vCO
        </div>
        <div className="max-w-[88%] rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3 text-sm leading-relaxed text-[#10231d]">
          <p>
            Hi, I&apos;m Charlie &mdash; your personal virtual compliance
            officer (vCO) for your business. I&apos;m going to ask you a few
            questions so the rest of this platform fits how you actually
            operate. No forms — just a conversation.
          </p>
          <p className="mt-2">
            To start, tell me in a sentence or two: <strong>what does your
            company do, and who are your customers (or who do you want them to
            be)?</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-sm bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
        Officer
      </div>
      <div className="rounded-sm border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a7d70] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a7d70] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a7d70]" />
        </div>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex items-center gap-2 text-xs text-[#7a9c90]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-[#2f8f6d]" />
      Loading…
    </div>
  );
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as StoredContentBlock[])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n\n");
  }
  return "";
}

function extractToolUses(content: unknown): ToolEvent[] {
  if (!Array.isArray(content)) return [];
  return (content as StoredContentBlock[])
    .filter((b) => b.type === "tool_use" && typeof b.id === "string")
    .map((b) => ({
      id: b.id as string,
      name: (b.name as string) ?? "tool",
      status: "done" as const,
    }));
}

async function parseSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let dataLine = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine += line.slice(5).trim();
        }
      }
      if (dataLine) {
        try {
          onEvent(event, JSON.parse(dataLine) as Record<string, unknown>);
        } catch {
          // ignore malformed chunks
        }
      }
      sep = buffer.indexOf("\n\n");
    }
  }
}
