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
  "Mention if you just won an award, are bidding, or already hold one — Charlie will take it from there",
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-white/10 bg-[#0a2620] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
      {/* Charlie header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#082018] px-5 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c4f0b8] font-serif text-lg font-bold text-[#0a2620]">
          C
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-semibold leading-tight">Charlie</div>
          <div className="text-[10px] uppercase tracking-[0.18em] leading-tight text-[#c4f0b8]/70">
            Custodia · Compliance Officer · Isolated session
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#0d2e25] px-5 py-5 sm:px-8"
      >
        {!opened && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 font-serif text-2xl text-white">
              Ready when you are.
            </div>
            <p className="mb-6 max-w-md text-sm text-white/70">
              Charlie will ask six to eight short questions. Most folks
              finish in under five minutes. Your report is yours to keep.
            </p>
            <button
              onClick={start}
              className="bg-[#c4f0b8] px-7 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#0a2620] transition-all hover:bg-white hover:tracking-[0.22em]"
            >
              Start the check
            </button>
            <div className="mt-6 max-w-sm text-[11px] uppercase tracking-[0.2em] text-white/40">
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
              <div className="border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
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
          className="flex shrink-0 items-end gap-3 border-t border-white/10 bg-[#082018] px-5 py-3 sm:px-8"
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
            className="block w-full resize-none border border-white/10 bg-[#0d2e25] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#c4f0b8]"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="bg-[#c4f0b8] px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#0a2620] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="max-w-[85%] bg-[#c4f0b8] px-4 py-2.5 text-sm leading-relaxed text-[#0a2620]">
          {clean}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#c4f0b8] font-serif text-xs font-bold text-[#0a2620]">
        C
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap border border-white/10 bg-[#0a2620] px-4 py-2.5 text-sm leading-relaxed text-white/90">
        {clean}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#c4f0b8] font-serif text-xs font-bold text-[#0a2620]">
        C
      </div>
      <div className="border border-white/10 bg-[#0a2620] px-4 py-3">
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
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#c4f0b8]/60"
      style={{ animationDelay: delay }}
    />
  );
}
