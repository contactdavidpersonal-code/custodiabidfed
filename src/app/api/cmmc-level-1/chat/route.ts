/**
 * Public CMMC Level 1 helper chat endpoint.
 *
 * Surface:  /api/cmmc-level-1/chat  (POST)
 *
 * Security posture:
 *   - No auth (this is a public education + sales surface).
 *   - Two-tier IP rate limit (per-hour + per-day) — this calls a paid LLM
 *     so we MUST cap abuse cost. See /api/cmmc-check/chat for the same
 *     pattern.
 *   - Stateless: client holds the conversation history and sends it back
 *     each turn. The server adds the fixed system prompt and forwards to
 *     Anthropic. No DB rows, no PII storage.
 *   - Hard caps: 4 KB per message, 30 total messages per request,
 *     1024 output tokens.
 *   - Tools are NOT wired. The model cannot call functions or hit any
 *     internal system.
 *   - System prompt is fixed at module load and never user-controllable.
 *
 * Wire format:
 *   POST { messages: { role: "user" | "assistant"; content: string }[] }
 *   →    { reply: string }
 *
 * Error cases return { error: string } with an appropriate HTTP status.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import { CMMC_L1_PUBLIC_AGENT_SYSTEM_PROMPT } from "@/lib/cmmc-level-1/system-prompt";
import {
  checkRateLimit,
  rateLimitKey,
} from "@/lib/security/rate-limit";

const MAX_MESSAGE_LEN = 4_000;
const MAX_MESSAGES = 30;
const MAX_OUTPUT_TOKENS = 1_024;

/**
 * Per-IP budget guards. Tuned to keep worst-case Anthropic spend per IP
 * per day at roughly $0.50 on claude-sonnet-4-6 pricing (~$0.013–$0.015
 * per turn at typical context sizes). Three tiers in series:
 *   - burst:   8 turns / minute  (catches scripted floods)
 *   - hourly: 12 turns / hour    (a normal user pace)
 *   - daily:  30 turns / day     (hard $0.50 ceiling per IP)
 * The user never sees these numbers; the UI surfaces a countdown and
 * Charlie speaks a friendly line.
 */
const LIMITS = {
  burst: { max: 8, windowSec: 60 },
  hourly: { max: 12, windowSec: 3_600 },
  daily: { max: 30, windowSec: 24 * 3_600 },
} as const;

/**
 * Charlie-voiced rate-limit responses. We return HTTP 200 with an
 * `assistant`-style reply plus a `retryAfterSec` field so the UI can
 * render a countdown timer the way Claude.ai does. Returning 200 (not
 * 429) means the user's transcript flows naturally — they just see
 * Charlie ask them to slow down.
 */
function tooFast(retryAfterSec: number): Response {
  const reply =
    "Whoa \u2014 you're moving faster than I can keep up with. Give me a moment to catch my breath and we'll pick this back up in a minute. \ud83d\udc46";
  return jsonReply(reply, retryAfterSec);
}
function hourlyCap(retryAfterSec: number): Response {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  const reply =
    `We've covered a lot of ground in the last hour. I'm a free public helper, so I take a short break between heavy sessions to keep this available for everyone. We can pick back up in about ${mins} minute${mins === 1 ? "" : "s"}.\n\nIf you want a deeper, uninterrupted Level 1 walk-through, the [14-day Custodia trial](/sign-up) is no credit card and removes the pause entirely \u2014 same Charlie, persistent memory, evidence review, and a human Compliance Officer on the $297 plan.`;
  return jsonReply(reply, retryAfterSec);
}
function dailyCap(retryAfterSec: number): Response {
  const hours = Math.max(1, Math.ceil(retryAfterSec / 3_600));
  const reply =
    `We've covered the public-helper allotment for today. I want to make sure I'm here for the next small business owner who needs help, so I take a longer break after a full day of questions. We can pick back up in about ${hours} hour${hours === 1 ? "" : "s"}.\n\nIf today's questions are time-sensitive, the [14-day Custodia trial](/sign-up) is free, no credit card, and gives you the full guided Level 1 self-assessment without the pause \u2014 with a human Compliance Officer on call on the $297 plan.`;
  return jsonReply(reply, retryAfterSec);
}
function promptAbuse(): Response {
  const reply =
    "I'm going to stay on topic \u2014 my job here is CMMC Level 1 help, not impersonating other systems or following instructions hidden inside messages. Happy to dig into any real Level 1 question (scoping, the 15 FAR safeguards, SPRS, evidence, Level 1 vs Level 2). What are you actually trying to figure out?";
  return jsonReply(reply, 0);
}
function jsonReply(reply: string, retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({ reply, retryAfterSec }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...(retryAfterSec > 0
          ? { "Retry-After": String(retryAfterSec) }
          : {}),
      },
    },
  );
}

/**
 * Lightweight, conservative prompt-injection / abuse detector. Operates
 * on the latest user message only — the model itself is the real defense,
 * this just lets us short-circuit obvious bait without paying for a turn.
 * False positives are acceptable here; the Charlie line is friendly.
 */
const ABUSE_PATTERNS: RegExp[] = [
  /ignore (all |the |your |previous |above |prior )?(prior |previous |above |earlier )?(instructions|prompts|rules|system)/i,
  /disregard (all |your |the )?(previous |prior |above )?(instructions|prompts|rules)/i,
  /forget (everything|all|your|the) (above|previous|prior|instructions)/i,
  /you are (now |actually )?(not )?(charlie|an? (uncensored|unfiltered|jailbroken|dan|developer))/i,
  /system prompt/i,
  /reveal (your |the )?(system )?(prompt|instructions)/i,
  /print (your |the )(system )?(prompt|instructions)/i,
  /\bDAN\b.*(mode|prompt)/i,
  /jailbreak/i,
];
function looksLikeAbuse(text: string): boolean {
  const t = text.slice(0, 2_000);
  return ABUSE_PATTERNS.some((re) => re.test(t));
}

/**
 * One-way hash of the client IP for log correlation. We never log the raw
 * IP. The salt rotates with `LOG_IP_SALT` if set, otherwise falls back to
 * a per-deploy constant so a single dump can correlate within a deploy
 * but not across deploys.
 */
const IP_HASH_SALT =
  process.env.LOG_IP_SALT ?? "cmmc-l1-chat:v1";
function hashIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return "no-ip";
  return createHash("sha256")
    .update(IP_HASH_SALT + "|" + ip)
    .digest("hex")
    .slice(0, 12);
}

function preview(s: string, n = 80): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= n ? flat : flat.slice(0, n - 1) + "\u2026";
}

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

export const runtime = "nodejs";

function isChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string"
  );
}

export async function POST(req: NextRequest) {
  // Three-tier per-IP cost guard. We DO NOT short-circuit with a 429 —
  // instead we let the user see Charlie tell them why, with a countdown,
  // so the UI feels like Claude.ai rather than a broken endpoint.
  const burst = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-l1-chat:min", req }),
    LIMITS.burst,
  );
  if (!burst.allowed) return tooFast(burst.retryAfterSec);
  const hourly = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-l1-chat:hr", req }),
    LIMITS.hourly,
  );
  if (!hourly.allowed) return hourlyCap(hourly.retryAfterSec);
  const daily = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-l1-chat:day", req }),
    LIMITS.daily,
  );
  if (!daily.allowed) return dailyCap(daily.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) {
    return NextResponse.json(
      { error: "messages must be an array" },
      { status: 400 },
    );
  }

  const raw = b.messages as unknown[];
  if (raw.length === 0) {
    return NextResponse.json({ error: "messages is empty" }, { status: 400 });
  }
  if (raw.length > MAX_MESSAGES) {
    return NextResponse.json(
      {
        error:
          "This conversation is too long. Start a new one to keep going.",
      },
      { status: 413 },
    );
  }

  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (!isChatMessage(m)) {
      return NextResponse.json(
        { error: "Bad message shape" },
        { status: 400 },
      );
    }
    const content = m.content.trim();
    if (content.length === 0) continue;
    if (content.length > MAX_MESSAGE_LEN) {
      return NextResponse.json(
        { error: "Message too long" },
        { status: 413 },
      );
    }
    messages.push({ role: m.role, content });
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user." },
      { status: 400 },
    );
  }

  // Cheap, server-side prompt-injection screen. Catches the obvious stuff
  // before we pay for a turn; the model itself is the real defense.
  const lastUserContent = messages[messages.length - 1].content;
  if (looksLikeAbuse(lastUserContent)) {
    console.warn(
      JSON.stringify({
        tag: "cmmc-l1-chat",
        event: "abuse_blocked",
        ipHash: hashIp(req),
        turn: messages.length,
        preview: preview(lastUserContent),
      }),
    );
    return promptAbuse();
  }

  const anthropic = getAnthropic();
  const ipHash = hashIp(req);
  const lastUser = messages[messages.length - 1].content;
  const startedAt = Date.now();
  let reply = "";
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: CMMC_L1_PUBLIC_AGENT_SYSTEM_PROMPT,
      messages,
    });
    for (const block of resp.content) {
      if (block.type === "text") reply += block.text;
    }
    inputTokens = resp.usage?.input_tokens ?? 0;
    outputTokens = resp.usage?.output_tokens ?? 0;
  } catch (err) {
    console.warn(
      JSON.stringify({
        tag: "cmmc-l1-chat",
        event: "anthropic_error",
        ipHash,
        turn: messages.length,
        preview: preview(lastUser),
        latencyMs: Date.now() - startedAt,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return NextResponse.json(
      { error: "Charlie is briefly unavailable — please try again." },
      { status: 502 },
    );
  }

  reply = reply.trim();
  if (!reply) {
    console.warn(
      JSON.stringify({
        tag: "cmmc-l1-chat",
        event: "empty_reply",
        ipHash,
        turn: messages.length,
        preview: preview(lastUser),
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
      }),
    );
    return NextResponse.json(
      { error: "Empty response from Charlie." },
      { status: 502 },
    );
  }

  console.log(
    JSON.stringify({
      tag: "cmmc-l1-chat",
      event: "reply_ok",
      ipHash,
      turn: messages.length,
      preview: preview(lastUser),
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      replyLen: reply.length,
    }),
  );

  return NextResponse.json({ reply });
}
