"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

// Distinct from the /cmmc-level-1 widget's storage key so the two
// surfaces never cross-pollute transcripts.
const STORAGE_KEY = "custodia.cmmcQualifier.v1";

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi — I'm **Charlie**, Custodia's CMMC Level 1 qualifier. Most people are confused about CMMC L1 because it's new. I'll cut through it.\n\nIn ~6 questions, I'll tell you straight whether you actually need it. **What's going on — are you bidding on (or already working) DoD contracts?**",
};

/**
 * Floating CMMC Level 1 qualifier widget for the landing page.
 *
 * Separate from <PublicCharlieWidget /> by design:
 *   - Different endpoint: /api/cmmc-qualifier/chat (Haiku, cheap, tight
 *     per-IP limits) vs. /api/cmmc-level-1/chat (Sonnet, deeper helper).
 *   - Different mission: short qualification flow → push qualified leads
 *     to /sign-up. Not a deep CMMC tutor.
 *   - Different storage key + launcher copy so users on /cmmc-level-1
 *     don't see this version and vice versa.
 *
 * Visual treatment matches the landing page palette (#08201a / #bdf2cf
 * accent). Mounted on `/` only.
 */
export function LandingQualifierWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore prior session — visitor doesn't lose context on navigation.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: Msg[]; cooldownUntil?: number };
      if (parsed.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      }
      if (parsed.cooldownUntil) {
        const secs = Math.max(0, Math.ceil((parsed.cooldownUntil - Date.now()) / 1000));
        if (secs > 0) setCooldownSec(secs);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    try {
      const cooldownUntil = cooldownSec > 0 ? Date.now() + cooldownSec * 1000 : 0;
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, cooldownUntil }),
      );
    } catch {
      // storage might be disabled — fine
    }
  }, [messages, cooldownSec]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  async function send() {
    const text = input.trim();
    if (!text || sending || cooldownSec > 0) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      // Greeting bubble is UI-only; never send it to the model.
      const wire = next
        .filter(
          (m, i) =>
            !(i === 0 && m.role === "assistant" && m.content === GREETING.content),
        )
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/cmmc-qualifier/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wire }),
      });
      const data = (await res.json()) as {
        reply?: string;
        retryAfterSec?: number;
        error?: string;
      };
      const reply =
        data.reply ||
        "Sorry — something went wrong on my end. Try again in a moment.";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) {
        setCooldownSec(data.retryAfterSec);
      }
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "I couldn't reach my brain just now. Try again in a minute? If you want to keep moving, the [CMMC Level 1 guide](/cmmc-level-1) covers the basics.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher — sits above the mobile sticky CTA bar (which is sm:hidden
          and ~62px tall when signed-out), so we shift up on mobile. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Charlie if you need CMMC Level 1"
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-[#08201a] px-4 py-3 text-xs font-bold text-[#bdf2cf] shadow-2xl ring-1 ring-[#2f8f6d]/40 transition-all hover:bg-[#0c2a22] hover:shadow-[#2f8f6d]/30 sm:bottom-5 sm:right-5 sm:px-5 sm:text-sm"
        >
          <span
            aria-hidden
            className="relative inline-flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8dd2b1] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8dd2b1]" />
          </span>
          Do I need CMMC Level 1?
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(640px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#2f8f6d]/40 bg-white shadow-2xl sm:bottom-5 sm:right-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#cfe3d9] bg-[#08201a] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[#8dd2b1]"
              />
              <div>
                <div className="font-serif text-base font-bold leading-tight">
                  Charlie
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#8dd2b1]">
                  CMMC L1 Qualifier · Free
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Charlie"
              className="rounded p-1 text-[#cce5da] transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[#f4faf6] px-4 py-4 text-sm leading-relaxed"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-1.5 px-1 text-[#5a7d70]">
                <Dot delay={0} />
                <Dot delay={150} />
                <Dot delay={300} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[#cfe3d9] bg-white px-3 py-3">
            {cooldownSec > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded border border-[#cfe3d9] bg-[#f4faf6] px-3 py-2.5 text-xs text-[#5a7d70]">
                <span>Charlie will be back in a moment.</span>
                <span className="font-mono text-sm font-bold text-[#10231d]">
                  {formatTime(cooldownSec)}
                </span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  maxLength={1500}
                  disabled={sending}
                  placeholder="Tell Charlie what you do…"
                  className="flex-1 resize-none rounded border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] placeholder:text-[#9bb5a8] focus:border-[#2f8f6d] focus:outline-none focus:ring-1 focus:ring-[#2f8f6d]/30"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="shrink-0 rounded bg-[#08201a] px-3 py-2 text-xs font-bold text-[#bdf2cf] transition-colors hover:bg-[#0c2a22] disabled:cursor-not-allowed disabled:bg-[#9bb5a8]"
                >
                  Send
                </button>
              </form>
            )}
            <div className="mt-2 px-1 text-[10px] text-[#9bb5a8]">
              Free public qualifier. Charlie can be wrong — verify against the{" "}
              <Link
                href="/regulations"
                className="underline hover:text-[#2f8f6d]"
              >
                official DoD docs
              </Link>
              .
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f8f6d]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#08201a] px-3.5 py-2 text-white">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-[#10231d] ring-1 ring-[#cfe3d9]">
        <div
          className="prose prose-sm prose-slate max-w-none [&_a]:font-bold [&_a]:text-[#2f8f6d] [&_a]:underline [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_li]:my-0.5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </div>
    </div>
  );
}

/**
 * Tiny, safe Markdown renderer (mirrors PublicCharlieWidget). Escapes HTML
 * first, then re-introduces a small whitelist: **bold**, *italic*, `code`,
 * links, lists, paragraphs. URLs limited to http(s) / same-origin paths
 * starting with "/" / mailto:. No raw HTML, no images, no script.
 */
function renderMarkdown(src: string): string {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Links [text](url)
  let out = escaped.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, url: string) => {
      const trimmed = url.trim();
      const safe =
        trimmed.startsWith("/") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("mailto:");
      if (!safe) return text;
      const external = trimmed.startsWith("http");
      const attrs = external
        ? ' target="_blank" rel="noopener nofollow"'
        : "";
      return `<a href="${trimmed}"${attrs}>${text}</a>`;
    },
  );

  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  const lines = out.split(/\n/);
  const result: string[] = [];
  let inList = false;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      result.push(`<p>${paragraph.join(" ")}</p>`);
      paragraph = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = /^[-*]\s+/.test(trimmed);
    if (isBullet) {
      flushParagraph();
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${trimmed.replace(/^[-*]\s+/, "")}</li>`);
    } else if (trimmed === "") {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      flushParagraph();
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      paragraph.push(trimmed);
    }
  }
  if (inList) result.push("</ul>");
  flushParagraph();
  return result.join("");
}
