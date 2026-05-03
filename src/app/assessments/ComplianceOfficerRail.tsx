"use client";

import Link from "next/link";
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

type Props = {
  /** When true, render as a flush full-height panel for use inside a mobile Sheet. Skips sticky chrome, resize handle, and the closed-state collapsed tab. */
  mobile?: boolean;
};

/**
 * Persistent left-rail compliance officer. Mounted in the /assessments
 * layout so it survives page navigation. State (open/closed, width) is
 * persisted to localStorage.
 */
export function ComplianceOfficerRail({ mobile = false }: Props = {}) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recap, setRecap] = useState<string | null>(null);
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
          recap?: string | null;
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
        setRecap(data.recap ?? null);
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

  // Refetch chat history (used when an external event — like an evidence
  // review finishing — appends messages on the server). Keeps the rail's
  // local state in sync without reloading the page.
  const refetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: Array<{ id: string; role: string; content: unknown }>;
        recap?: string | null;
      };
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
      setRecap(data.recap ?? null);
    } catch (err) {
      console.warn("refetchMessages failed", err);
    }
  }, []);

  // Listen for evidence-review events fired from PracticeWizard. When a
  // review starts we open the rail (if closed) and append optimistic
  // user/assistant placeholders so the user sees the action land in chat.
  // When the review finishes we refetch from the server, which replaces
  // the optimistic pair with the persisted (authoritative) messages.
  useEffect(() => {
    type StartDetail = { artifactId: string; filename: string; controlId: string };
    type FinishDetail = { artifactId: string };
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent<StartDetail>).detail;
      if (!detail) return;
      setOpen(true);
      window.localStorage.setItem(STORAGE_OPEN_KEY, "1");
      const userId = `local-rev-u-${detail.artifactId}-${Date.now()}`;
      const assistantId = `local-rev-a-${detail.artifactId}-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: "user",
          text: `Charlie, can you review **${detail.filename}** for ${detail.controlId}?`,
          tools: [],
        },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          tools: [
            {
              id: `local-rev-tool-${detail.artifactId}`,
              name: "describe_evidence",
              status: "running",
            },
          ],
        },
      ]);
      setStreaming(true);
    };
    const onFinish = () => {
      setStreaming(false);
      void refetchMessages();
    };
    window.addEventListener("custodia:review-started", onStart);
    window.addEventListener("custodia:review-finished", onFinish);
    return () => {
      window.removeEventListener("custodia:review-started", onStart);
      window.removeEventListener("custodia:review-finished", onFinish);
    };
  }, [refetchMessages]);

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
          Math.max(MIN_WIDTH, startWidth - (ev.clientX - startX)),
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

  if (!open && !mobile) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Open Charlie, your vCO"
        className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 rotate-90 origin-bottom-right items-center gap-2  border border-b-0 border-[#cfe3d9] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#0e2a23] shadow-md transition-colors hover:bg-[#eaf3ee] print:hidden"
      >
        <span className="h-1.5 w-1.5  bg-[#2f8f6d]" />
        Charlie · vCO
      </button>
    );
  }

  const Container = mobile ? "div" : "aside";
  return (
    <Container
      className={
        mobile
          ? "flex h-full w-full flex-col bg-white"
          : "sticky top-[57px] z-10 flex h-[calc(100vh-57px)] shrink-0 flex-col border-l border-[#cfe3d9] bg-white print:hidden"
      }
      style={mobile ? undefined : { width }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center  bg-[#0e2a23] px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]">
            vCO
          </span>
          <div className="leading-tight">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Charlie &middot; vCO
            </div>
            <div className="text-[11px] text-[#5a7d70]">
              Your virtual compliance officer &middot; CMMC L1
            </div>
          </div>
        </div>
        {mobile ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Hide Charlie"
            className=" p-1 text-[#7a9c90] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
            </svg>
          </button>
        )}
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {!hydrated ? (
          <LoadingBubble />
        ) : messages.length === 0 ? (
          <WelcomeBubble recap={recap} />
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
        className="border-t border-[#cfe3d9] bg-[#f7fcf9] p-3"
      >
        <div className="flex items-end gap-2  border border-[#cfe3d9] bg-white p-2 focus-within:border-[#2f8f6d] focus-within:ring-2 focus-within:ring-[#2f8f6d]/20">
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
            className="min-h-[36px] max-h-40 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-[#10231d] outline-none placeholder:text-[#9ab8ac] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center  bg-[#0e2a23] text-[#bdf2cf] transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:bg-[#cfe3d9] disabled:text-white"
            aria-label="Send"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3.105 3.105a1 1 0 011.09-.217l13 5a1 1 0 010 1.864l-13 5a1 1 0 01-1.317-1.297L5.432 10 2.878 4.545a1 1 0 01.227-1.44z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] leading-tight text-[#7a9c90]">
          The officer cites FAR / NIST when it makes a claim. Evidence uploads
          are reviewed automatically before they count toward attestation.
        </p>
        <Link
          href="/assessments/tickets/new"
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5  border border-[#cfe3d9] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Talk to a human officer
        </Link>
      </form>

      {mobile ? null : (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[#2f8f6d]/30"
          aria-hidden
        />
      )}
    </Container>
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
        <div className="max-w-[90%]  border border-[#0e2a23] bg-[#0e2a23] px-3 py-2 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="flex max-w-[92%] flex-col gap-1.5">
        {tools.length > 0 && (
          <div className="flex flex-col gap-1">
            {tools.map((t) => (
              <ToolChip key={t.id} tool={t} />
            ))}
          </div>
        )}
        {text && (
          <div className=" border border-[#cfe3d9] bg-[#f7fcf9] px-3 py-2 text-sm leading-relaxed text-[#10231d]">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
        )}
      </div>
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center  bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
        Officer
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
        ? "border-[#bde0cc] bg-[#e6f4ec] text-[#1f6648]"
        : "border-[#f1d9a5] bg-[#fff4e0] text-[#a06b1a]";
  const dot =
    tool.status === "error"
      ? "bg-rose-500"
      : tool.status === "done"
        ? "bg-[#2f8f6d]"
        : "bg-[#a06b1a] animate-pulse";
  return (
    <div
      className={`inline-flex items-center gap-2 self-start  border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}
    >
      <span className={`h-1.5 w-1.5  ${dot}`} />
      {label}
      {tool.status === "running" && "…"}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className=" border border-[#cfe3d9] bg-[#f7fcf9] px-3 py-2.5">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce  bg-[#7a9c90] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce  bg-[#7a9c90] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce  bg-[#7a9c90]" />
        </div>
      </div>
      <div className="mt-0.5 inline-flex shrink-0 items-center justify-center  bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
        Officer
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex items-center gap-2 text-xs text-[#7a9c90]">
      <span className="h-1.5 w-1.5 animate-pulse  bg-[#2f8f6d]" />
      Loading conversation…
    </div>
  );
}

function WelcomeBubble({ recap }: { recap: string | null }) {
  const recapText = recap?.trim();
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="max-w-[92%]  border border-[#cfe3d9] bg-[#f7fcf9] px-3 py-2 text-sm leading-relaxed text-[#10231d]">
          {recapText ? (
            <>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#2f8f6d]">
                Where we left off
              </p>
              <p className="whitespace-pre-wrap">{recapText}</p>
              <p className="mt-2 text-[#2f8f6d]">
                Ready to keep going? Pick a practice on the right or ask me anything.
              </p>
            </>
          ) : (
            <>
              <p>
                Hi — I&apos;m Charlie, your personal virtual compliance
                officer (vCO) for your business. I&apos;ll walk you through
                every step of your CMMC Level 1 annual affirmation and review
                every piece of evidence you upload so nothing weak sneaks into
                your SPRS package.
              </p>
              <p className="mt-2">
                Ask me anything, or jump into your first practice from the
                cycle on the right.
              </p>
            </>
          )}
        </div>
        <div className="mt-0.5 inline-flex shrink-0 items-center justify-center  bg-[#0e2a23] px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#bdf2cf]">
          Officer
        </div>
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
