"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

type ApiOk = {
  token: string;
  reply: string;
  finalized?: boolean;
  turnCount: number;
  maxTurns: number;
};
type ApiErr = { error: string; retryAfterSec?: number };
type ApiResp = ApiOk | ApiErr;

const STARTERS = [
  "Tell Charlie about your company in one sentence",
];

export default function CmmcCheckClient() {
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(payloadMessage: string, isOpener: boolean) {
    setBusy(true);
    setError(null);
    if (!isOpener) {
      setMessages((m) => [...m, { role: "user", content: payloadMessage }]);
      setDraft("");
    }
    try {
      const res = await fetch("/api/cmmc-check/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: payloadMessage }),
      });
      const json = (await res.json()) as ApiResp;
      if (!res.ok || "error" in json) {
        throw new Error(("error" in json && json.error) || "Something went wrong.");
      }
      setToken(json.token);
      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
      if (json.finalized) {
        // Brief pause so they see the confirmation, then redirect.
        setTimeout(() => {
          router.push(`/cmmc-check/report/${json.token}`);
        }, 1_400);
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Roll back the optimistic user bubble on hard errors so they can retry.
      if (!isOpener) {
        setMessages((m) =>
          m.length > 0 && m[m.length - 1].role === "user" ? m.slice(0, -1) : m,
        );
        setDraft(payloadMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (opened) return;
    setOpened(true);
    void send("", true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    void send(text, false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(16,35,29,0.18)]">
      {/* Charlie header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-[#10231d] px-5 py-4 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-300 font-serif text-lg font-bold text-[#10231d]">
          C
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-semibold leading-tight">Charlie</div>
          <div className="text-[11px] leading-tight text-emerald-200/80">
            Custodia · CMMC Level 1 Diagnostic · Isolated session
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="h-[440px] overflow-y-auto bg-[#fafaf7] px-5 py-6 sm:px-8"
      >
        {!opened && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 font-serif text-2xl text-[#10231d]">
              Ready when you are.
            </div>
            <p className="mb-6 max-w-md text-sm text-slate-600">
              Charlie will ask 6–8 short questions. Most prospects finish in
              under 5 minutes. The report is yours at the end.
            </p>
            <button
              onClick={start}
              className="rounded-full bg-[#10231d] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#0a1813]"
            >
              Start the check
            </button>
            <div className="mt-6 text-[11px] uppercase tracking-widest text-slate-400">
              {STARTERS[0]}
            </div>
          </div>
        )}

        {opened && (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {busy && <Typing />}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      {opened && (
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-8"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Type your answer…"
            rows={1}
            maxLength={4_000}
            disabled={busy}
            className="block w-full resize-none rounded-xl border border-slate-200 bg-[#fafaf7] px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#10231d] focus:bg-white"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="rounded-xl bg-[#10231d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0a1813] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  // Hide the FINAL_REPORT_READY+JSON tail from the UI even if a stale message
  // ever rendered with it. The server already strips it, this is belt+braces.
  const clean = content.replace(/FINAL_REPORT_READY[\s\S]*$/, "").trim() || content;
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#10231d] px-4 py-2.5 text-sm leading-relaxed text-white">
          {clean}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 font-serif text-xs font-bold text-[#10231d]">
        C
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
        {clean}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 font-serif text-xs font-bold text-[#10231d]">
        C
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}
