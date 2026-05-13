"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Do I need CMMC Level 1 if I'm just a sub on a DoD contract?",
  "What counts as good evidence for AC.L1-b.1.iii (external connections)?",
  "Level 1 vs Level 2 — how do I tell which one applies?",
  "I'm an SBIR Phase I winner — what do I actually have to do?",
];

const INTRO: Msg = {
  role: "assistant",
  content: `Hi — I'm **Charlie**, Custodia's CMMC Level 1 helper.

I'm grounded in the three official DoD CMMC Level 1 documents (you can [download them here](/regulations)) — the Model Overview, the Scoping Guide, and the Assessment Guide, all v2.13. Ask me anything about Level 1: the 15 FAR 52.204-21 requirements, scoping, evidence, SPRS, the difference from Level 2, whether you even need it.

One thing to keep in mind as we talk: **the point of CMMC Level 1 isn't compliance theater — it's qualifying your business to sell what you already make to the largest buyer in the world.** DoD obligates $400B+ a year. Level 1 is the entry gate.

What would you like to figure out?`,
};

export default function PublicCmmcL1Agent() {
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setDraft("");
    try {
      // Strip the intro greeting before sending — it's UI-only, not a model turn.
      const wire = next
        .filter((m, i) => !(i === 0 && m.role === "assistant" && m.content === INTRO.content))
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/cmmc-level-1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wire }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        throw new Error(json.error || "Charlie is briefly unavailable.");
      }
      setMessages((m) => [...m, { role: "assistant", content: json.reply! }]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Roll back the user bubble so they can edit + retry.
      setMessages((m) =>
        m.length > 0 && m[m.length - 1].role === "user" ? m.slice(0, -1) : m,
      );
      setDraft(clean);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <div className="flex flex-col border-2 border-[#2f8f6d] bg-white shadow-[0_8px_28px_rgba(14,48,37,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#cfe3d9] bg-[#08201a] px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#bdf2cf] font-serif text-base font-bold text-[#08201a]"
          >
            C
          </span>
          <div>
            <div className="font-serif text-sm font-bold leading-tight">
              Charlie · CMMC Level 1 helper
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7aab98]">
              Free · public · grounded in DoD docs
            </div>
          </div>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#7aab98] sm:inline">
          Beta
        </span>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="max-h-[480px] min-h-[320px] overflow-y-auto bg-[#f7fcf9] px-5 py-5"
      >
        <ul className="space-y-4">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] bg-[#08201a] px-4 py-3 text-sm leading-relaxed text-white"
                    : "max-w-[90%] border border-[#cfe3d9] bg-white px-4 py-3 text-[15px] leading-relaxed text-[#10231d]"
                }
              >
                <SafeMarkdown text={m.content} />
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <div className="border border-[#cfe3d9] bg-white px-4 py-3 text-sm italic text-[#5a7d70]">
                Charlie is thinking&hellip;
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* Suggestions (only when conversation hasn't really started) */}
      {messages.length <= 1 && (
        <div className="border-t border-[#cfe3d9] bg-white px-5 py-3">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Try asking
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void send(s)}
                className="border border-[#cfe3d9] bg-white px-3 py-1.5 text-left text-xs text-[#1d3a30] transition-colors hover:border-[#2f8f6d] hover:bg-[#f4faf6] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t border-[#e7c2c2] bg-[#fcf3f3] px-5 py-2 text-xs text-[#8b2c2c]">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-[#cfe3d9] bg-white px-4 py-3"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
          rows={2}
          maxLength={4000}
          placeholder="Ask Charlie a CMMC Level 1 question…"
          className="flex-1 resize-none border border-[#cfe3d9] bg-white px-3 py-2 text-sm leading-relaxed text-[#10231d] placeholder:text-[#7a9c90] focus:border-[#2f8f6d] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="shrink-0 bg-[#08201a] px-4 py-2 text-sm font-bold text-[#bdf2cf] transition-colors hover:bg-[#0c2a22] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>

      {/* Footer notice */}
      <div className="border-t border-[#cfe3d9] bg-[#f4faf6] px-5 py-3 text-[11px] leading-relaxed text-[#5a7d70]">
        Charlie answers <strong>CMMC Level 1 questions only</strong> and is
        not legal advice. For a guided, end-to-end Level 1 self-assessment
        with a real human Compliance Officer on call, start a{" "}
        <a
          href="/sign-up"
          className="font-bold text-[#2f8f6d] underline hover:text-[#0e2a23]"
        >
          14-day Custodia trial
        </a>{" "}
        (no credit card).
      </div>
    </div>
  );
}

/**
 * Minimal, safe-by-construction Markdown renderer for assistant replies.
 * Supports: paragraphs, **bold**, *italic*, `inline code`, bulleted lists,
 * and links rendered with rel="noopener noreferrer". No HTML passthrough,
 * no script execution — we never use dangerouslySetInnerHTML here.
 */
function SafeMarkdown({ text }: { text: string }) {
  // Split into paragraph blocks on blank lines.
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        // Bulleted list block — lines starting with - or *
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList && lines.length > 0) {
          return (
            <ul key={i} className="ml-4 list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        // Numbered list block — lines starting with 1. 2. ...
        const isOl = lines.every((l) => /^\s*\d+\.\s+/.test(l));
        if (isOl && lines.length > 0) {
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Tokenize for [link](url), **bold**, *italic*, `code` — applied in that order.
  // We build a node array by repeatedly matching against the highest-priority
  // pattern that appears earliest in the remaining string.
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  // Combined regex: link | bold | italic | code
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/;
  while (rest.length > 0) {
    const m = rest.match(pattern);
    if (!m || m.index === undefined) {
      nodes.push(rest);
      break;
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      const isExternal = /^https?:\/\//.test(href);
      nodes.push(
        <a
          key={`l${key++}`}
          href={href}
          className="font-bold text-[#2f8f6d] underline hover:text-[#0e2a23]"
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      nodes.push(<strong key={`b${key++}`}>{m[3]}</strong>);
    } else if (m[4]) {
      nodes.push(<em key={`i${key++}`}>{m[4]}</em>);
    } else if (m[5]) {
      nodes.push(
        <code
          key={`c${key++}`}
          className="rounded bg-[#f0f5f2] px-1 py-0.5 font-mono text-[12.5px] text-[#1d3a30]"
        >
          {m[5]}
        </code>,
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}
