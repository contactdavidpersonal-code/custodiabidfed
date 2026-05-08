"use client";

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

type ProfileKey = { key: string; label: string };

const TOOL_LABELS: Record<string, string> = {
  update_business_profile: "Saving what you told me",
  update_organization_fields: "Saving your company name",
  read_assessment_state: "Checking your workspace",
  cite_regulation: "Looking up the rule text",
  read_boundary_state: "Reading your FCI boundary",
  set_affirming_official: "Recording your affirming official",
  add_fci_flow: "Documenting an FCI data flow",
  add_out_of_scope_item: "Declaring an out-of-scope item",
};

export function IntakeChat({ token }: { token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState(0);
  const [profileData, setProfileData] = useState<Record<string, unknown>>({});
  const [profileKeys, setProfileKeys] = useState<ProfileKey[]>([]);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [allSections, setAllSections] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const apiBase = `/api/intake/${encodeURIComponent(token)}`;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { method: "GET" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        completeness_score?: number;
        profile_data?: Record<string, unknown>;
        profile_keys?: ProfileKey[];
        invitation?: {
          completed_sections?: string[];
          sections?: string[];
        };
      };
      if (typeof data.completeness_score === "number") {
        setCompleteness(data.completeness_score);
      }
      if (data.profile_data) setProfileData(data.profile_data);
      if (data.profile_keys && data.profile_keys.length > 0) {
        setProfileKeys(data.profile_keys);
      }
      if (data.invitation?.completed_sections) {
        setCompletedSections(data.invitation.completed_sections);
      }
      if (data.invitation?.sections) {
        setAllSections(data.invitation.sections);
      }
    } catch {
      // non-fatal
    }
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiBase, { method: "GET" });
        if (!res.ok) throw new Error(`GET intake -> ${res.status}`);
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: unknown }>;
          completeness_score: number;
          profile_data?: Record<string, unknown>;
          profile_keys?: ProfileKey[];
          invitation?: {
            completed_sections?: string[];
            sections?: string[];
          };
        };
        if (cancelled) return;
        const hydratedMessages: Message[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            text: extractText(m.content),
            tools: extractToolUses(m.content),
          }));
        setMessages(hydratedMessages);
        setCompleteness(data.completeness_score);
        if (data.profile_data) setProfileData(data.profile_data);
        if (data.profile_keys && data.profile_keys.length > 0) {
          setProfileKeys(data.profile_keys);
        }
        if (data.invitation?.completed_sections) {
          setCompletedSections(data.invitation.completed_sections);
        }
        if (data.invitation?.sections) {
          setAllSections(data.invitation.sections);
        }
        setHydrated(true);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!hydrated) return;
    if (!streaming) inputRef.current?.focus();
  }, [hydrated, streaming, messages.length]);

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
      const res = await fetch(apiBase, {
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
          const msg =
            typeof data.message === "string" ? data.message : "unknown error";
          setErrorMsg(msg);
        }
      });
      await refreshStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      patchAssistant((m) =>
        m.text === ""
          ? { ...m, text: `I couldn't reach Charlie: ${msg}` }
          : m,
      );
    } finally {
      setStreaming(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [draft, streaming, refreshStatus, apiBase]);

  const markSectionComplete = useCallback(
    async (section: string) => {
      try {
        const res = await fetch(`${apiBase}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { completed_sections: string[] };
        setCompletedSections(data.completed_sections);
      } catch {
        // non-fatal
      }
    },
    [apiBase],
  );

  const profileSectionDone = completedSections.includes("profile");
  const profileReady = completeness >= 60;

  return (
    <div className="flex min-h-[640px] flex-1 flex-col overflow-hidden border border-[#cfe3d9] bg-white shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
      <div className="flex flex-none items-center justify-between border-b border-[#cfe3d9] bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center bg-[#0e2a23] px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]">
            CO
          </span>
          <div className="leading-tight">
            <div className="font-serif text-sm font-bold text-[#10231d]">
              Charlie · Your compliance officer
            </div>
            <div className="text-[11px] text-[#5a7d70]">
              Capturing your business profile
            </div>
          </div>
        </div>
        <div className="text-xs font-bold text-[#0e2a23]">
          {completeness}% captured
        </div>
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
      >
        {!hydrated ? (
          <div className="text-sm text-[#5a7d70]">Loading the conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-[#3a5a4f]">
            Start by saying hello. Charlie will ask the first question.
          </div>
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
      </div>

      {profileReady && !profileSectionDone && allSections.includes("profile") && (
        <div className="border-t border-[#cfe3d9] bg-[#eaf3ee] px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#0e2a23]">
              Looks like Charlie has what they need. Ready to mark this
              section done?
            </p>
            <button
              type="button"
              onClick={() => markSectionComplete("profile")}
              className="bg-[#0e2a23] px-4 py-2 text-sm font-bold tracking-tight text-white transition-colors hover:bg-[#10231d]"
            >
              I&apos;m done with this section →
            </button>
          </div>
        </div>
      )}

      {profileSectionDone && (
        <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          Saved. Your MSP has been notified. You can close this tab — they&apos;ll
          take it from here.
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
          send();
        }}
        className="flex flex-none items-end gap-2 border-t border-[#cfe3d9] bg-white px-4 py-3"
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type your answer…"
          className="min-h-[60px] flex-1 resize-none border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] outline-none focus:border-[#0e2a23]"
          disabled={!hydrated || streaming}
        />
        <button
          type="submit"
          disabled={!hydrated || streaming || !draft.trim()}
          className="self-stretch bg-[#0e2a23] px-4 py-2 text-sm font-bold tracking-tight text-white transition-colors hover:bg-[#10231d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {profileKeys.length > 0 && (
        <div className="border-t border-[#cfe3d9] bg-[#f9f7f1] px-5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5a7d70]">
            What Charlie has so far
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-[#10231d] sm:grid-cols-2">
            {profileKeys.map((k) => {
              const v = profileData[k.key];
              const filled =
                v !== undefined &&
                v !== null &&
                !(typeof v === "string" && v.trim().length === 0);
              return (
                <li
                  key={k.key}
                  className={`flex items-center gap-2 ${filled ? "text-[#0e2a23]" : "text-[#9aaea4]"}`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${filled ? "bg-emerald-500" : "bg-[#cfe3d9]"}`}
                  />
                  {k.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function MessageBubble({
  role,
  text,
  tools,
}: {
  role: "user" | "assistant";
  text: string;
  tools: ToolEvent[];
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words border px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "border-[#0e2a23] bg-[#0e2a23] text-white"
            : "border-[#cfe3d9] bg-white text-[#10231d]"
        }`}
      >
        {text}
        {tools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${
                  t.status === "error"
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : t.status === "done"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {TOOL_LABELS[t.name] ?? t.name}
                {t.status === "running" ? "…" : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is StoredContentBlock =>
        typeof b === "object" && b !== null && "type" in (b as object),
    )
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

function extractToolUses(content: unknown): ToolEvent[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter(
      (b): b is StoredContentBlock =>
        typeof b === "object" && b !== null && "type" in (b as object),
    )
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? "",
      name: b.name ?? "",
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
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length > 0) {
        try {
          const parsed = JSON.parse(dataLines.join("\n")) as Record<
            string,
            unknown
          >;
          onEvent(event, parsed);
        } catch {
          // ignore
        }
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}
