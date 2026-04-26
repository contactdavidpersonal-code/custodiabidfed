"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

type StoredContentBlock = { type: string; text?: string; name?: string; id?: string };

const TOOL_LABELS: Record<string, string> = {
  read_assessment_state: "Reading your assessment",
  describe_evidence: "Checking that evidence",
  suggest_narrative: "Drafting a narrative",
  check_readiness: "Auditing readiness to sign",
  propose_milestone: "Adding a milestone",
  update_organization_fields: "Updating your business profile",
  update_business_profile: "Updating your business profile",
  cite_regulation: "Looking up the regulation text",
  escalate_to_officer: "Flagging for a human officer",
};

const STORAGE_OPEN_KEY = "custodia.chat.open";
const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 400;
const STORAGE_WIDTH_KEY = "custodia.chat.width";

/**
 * Persistent left-rail compliance officer. Mounted in the /assessments
 * layout so it survives page navigation. State (open/closed, width) is
 * persisted to localStorage.
 */
export function ComplianceOfficerRail() {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Hydrate UI state from localStorage after mount. setState-in-effect is the
  // simplest pattern here: the server can't know the user's saved preferences,
  // and we accept one extra render in exchange for keeping this self-contained.
  useLayoutEffect(() => {
    const savedOpen = window.localStorage.getItem(STORAGE_OPEN_KEY);
    const savedWidth = window.localStorage.getItem(STORAGE_WIDTH_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedOpen === "0") setOpen(false);
    if (savedWidth) {
      const n = Number.parseInt(savedWidth, 10);
      if (!Number.isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) {
        setWidth(n);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat", { method: "GET" });
        if (!res.ok) throw new Error(`GET /api/chat -> ${res.status}`);
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: unknown }>;
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
      } catch (err) {
        if (cancelled) return;
        console.warn("Failed to load chat history", err);
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

  const toggle = useCallback(() => {
    setOpen((prev) => {
      window.localStorage.setItem(STORAGE_OPEN_KEY, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const onMove = (ev: MouseEvent) => {
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
        );
        setWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setWidth((w) => {
          window.localStorage.setItem(STORAGE_WIDTH_KEY, String(w));
          return w;
        });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setErrorMsg(null);
    setDraft("");
    setStreaming(true);
    const userId = `local-${Date.now()}`;
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          pageContext: extractPageContext(pathname),
        }),
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
          patchAssistant((m) => ({
            ...m,
            text: m.text || `I hit an error: ${msg}`,
          }));
        }
      });
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
    }
  }, [draft, streaming, pathname]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Open compliance officer"
        className="fixed left-0 top-1/2 z-30 flex -translate-y-1/2 -rotate-90 origin-bottom-left items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 shadow-md transition-colors hover:bg-amber-50 print:hidden"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Compliance officer
      </button>
    );
  }

  return (
    <aside
      className="sticky top-[65px] z-10 flex h-[calc(100vh-65px)] shrink-0 flex-col border-r border-slate-200 bg-white print:hidden"
      style={{ width }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-b from-amber-50/60 to-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center rounded-md bg-slate-900 px-1.5 py-1 text-[8px] font-black uppercase tracking-wide text-amber-400">
            Platform
          </span>
          <div className="leading-tight">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Compliance officer
            </div>
            <div className="text-[11px] text-slate-500">
              CMMC L1 · trained on FAR 52.204-21
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide compliance officer"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
          </svg>
        </button>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {!hydrated ? (
          <LoadingBubble />
        ) : messages.length === 0 ? (
          <WelcomeBubble />
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                text={m.text}
                tools={m.tools}
              />
            ))}
            {streaming &&
              messages[messages.length - 1]?.role === "assistant" &&
              messages[messages.length - 1]?.text === "" &&
              messages[messages.length - 1]?.tools.length === 0 && (
                <TypingIndicator />
              )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-slate-200 bg-slate-50/60 p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask the officer anything about CMMC L1…"
            disabled={streaming}
            className="min-h-[36px] max-h-40 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-amber-400 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
            aria-label="Send"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3.105 3.105a1 1 0 011.09-.217l13 5a1 1 0 010 1.864l-13 5a1 1 0 01-1.317-1.297L5.432 10 2.878 4.545a1 1 0 01.227-1.44z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] leading-tight text-slate-400">
          The officer cites FAR / NIST when it makes a claim. Evidence uploads
          are reviewed automatically before they count toward attestation.
        </p>
      </form>

      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-amber-300/30"
        aria-hidden
      />
    </aside>
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
        <div className="max-w-[90%] rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 text-sm leading-relaxed text-white shadow-sm">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-amber-100 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-amber-800">
        Platform
      </div>
      <div className="flex max-w-[92%] flex-col gap-1.5">
        {tools.length > 0 && (
          <div className="flex flex-col gap-1">
            {tools.map((t) => (
              <ToolChip key={t.id} tool={t} />
            ))}
          </div>
        )}
        {text && (
          <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-900">
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
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  const dot =
    tool.status === "error"
      ? "bg-rose-500"
      : tool.status === "done"
        ? "bg-emerald-500"
        : "bg-amber-500 animate-pulse";
  return (
    <div
      className={`inline-flex items-center gap-2 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
      {tool.status === "running" && "…"}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-amber-100 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-amber-800">
        Platform
      </div>
      <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2.5">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        </div>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      Loading conversation…
    </div>
  );
}

function WelcomeBubble() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-amber-100 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-amber-800">
          Platform
        </div>
        <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-900">
          <p>
            Hi — I&apos;m your Custodia compliance officer. I&apos;m here to
            walk you through every step of your CMMC Level 1 annual affirmation,
            and I&apos;ll review every piece of evidence you upload so nothing
            weak sneaks into your SPRS package.
          </p>
          <p className="mt-2">
            Tell me about your business and I&apos;ll tailor the rest of this
            workspace to you.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Try asking:</p>
        <ul className="mt-1.5 space-y-1">
          <li>&ldquo;Is a screenshot of my M365 admin center enough for AC.L1-3.1.1?&rdquo;</li>
          <li>&ldquo;I don&apos;t have SAM.gov yet — what do I do?&rdquo;</li>
          <li>&ldquo;A prime asked for my SSP — what do I send them?&rdquo;</li>
        </ul>
      </div>
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
      // Hydrated from history: the tool has already completed, so surface it
      // as a done pill rather than a spinner.
      status: "done" as const,
    }));
}

/**
 * Parse a text/event-stream body and dispatch each event to the caller.
 * The server sends `event: <name>\ndata: <json>\n\n` chunks.
 */
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
          // Ignore malformed JSON chunks rather than killing the stream.
        }
      }
      sep = buffer.indexOf("\n\n");
    }
  }
}

function extractPageContext(pathname: string | null): {
  route: string;
  assessmentId?: string;
  controlId?: string;
} {
  if (!pathname) return { route: "/" };
  const m = pathname.match(
    /^\/assessments\/([^/]+)(?:\/controls\/([^/]+))?/,
  );
  if (!m) return { route: pathname };
  return {
    route: pathname,
    assessmentId: m[1],
    controlId: m[2],
  };
}
