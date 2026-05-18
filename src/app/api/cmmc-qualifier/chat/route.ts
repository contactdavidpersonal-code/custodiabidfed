/**
 * Public CMMC Level 1 QUALIFIER chat endpoint (landing page).
 *
 * Surface:  /api/cmmc-qualifier/chat  (POST)
 *
 * Why this exists separate from /api/cmmc-level-1/chat:
 *   - Different job: the qualifier on `/` runs a short Q&A to decide
 *     whether the visitor needs CMMC L1, then pushes the 14-day trial.
 *     The /cmmc-level-1 helper is the deeper educator. Same brand
 *     (Charlie), different surface, different budget.
 *   - Different model: claude-haiku-4-5 (~10x cheaper than Sonnet) is
 *     plenty for a short, scripted qualification flow. The /cmmc-level-1
 *     surface stays on Sonnet because it does deeper substantive work.
 *   - Isolated rate-limit scopes so heavy usage on one widget can't
 *     starve the other. Different cost ceiling per IP per day.
 *
 * Security posture:
 *   - No auth. Public marketing surface.
 *   - Three-tier per-IP rate limit (min / hr / day). Tight by design.
 *   - Stateless: client holds the transcript; server adds the fixed
 *     system prompt and forwards to Anthropic. No DB, no PII storage.
 *   - Hard caps: 4 KB per message, 20 total messages per request,
 *     512 output tokens (qualifier replies should be short).
 *   - No tools. Model cannot call functions or hit internal systems.
 *   - System prompt is fixed at module load and never user-controllable.
 *   - Cheap server-side prompt-injection screen on the latest user msg.
 *
 * Wire format (matches /api/cmmc-level-1/chat for widget reuse):
 *   POST { messages: { role: "user" | "assistant"; content: string }[] }
 *   →    { reply: string, retryAfterSec?: number }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getAnthropic } from "@/lib/anthropic";
import { CMMC_QUALIFIER_SYSTEM_PROMPT } from "@/lib/cmmc-qualifier/system-prompt";
import {
  checkRateLimit,
  rateLimitKey,
} from "@/lib/security/rate-limit";

// Haiku 4.5 — short, scripted qualification flow. Roughly 1/5 of Sonnet
// per-token cost. Worst-case per IP per day budget at the limits below:
//   20 turns/day × ~3K input + 512 output ≈ ~$0.10/day per IP.
const QUALIFIER_MODEL = "claude-haiku-4-5";

const MAX_MESSAGE_LEN = 4_000;
const MAX_MESSAGES = 20;
const MAX_OUTPUT_TOKENS = 512;

/**
 * Per-IP budget. Tighter than /cmmc-level-1 because:
 *   - Haiku turns are cheaper, so more headroom per dollar, BUT
 *   - The qualifier should close or hand off in ~6 turns; anyone
 *     burning 20 turns is either a real high-intent lead (great) or
 *     abuse (cap it).
 * Three windows in series — burst, hourly, daily.
 */
const LIMITS = {
  burst: { max: 6, windowSec: 60 },
  hourly: { max: 10, windowSec: 3_600 },
  daily: { max: 20, windowSec: 24 * 3_600 },
} as const;

function tooFast(retryAfterSec: number): Response {
  const reply =
    "Whoa \u2014 you're moving faster than I can keep up with. Give me a moment and we'll pick this back up in a minute.";
  return jsonReply(reply, retryAfterSec);
}
function hourlyCap(retryAfterSec: number): Response {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  const reply =
    `We've covered a lot in the last hour. I'm the free public qualifier, so I take a short break between heavy sessions. We can pick back up in about ${mins} minute${mins === 1 ? "" : "s"}.\n\nIf you want to keep moving without the pause, the [14-day free trial](/sign-up) is no credit card and unlocks the full guided Level 1 walk-through.`;
  return jsonReply(reply, retryAfterSec);
}
function dailyCap(retryAfterSec: number): Response {
  const hours = Math.max(1, Math.ceil(retryAfterSec / 3_600));
  const reply =
    `We've covered the public qualifier's daily allotment. I want to be here for the next small business owner, so I take a longer break after a busy day. Back in about ${hours} hour${hours === 1 ? "" : "s"}.\n\nIf today's questions are time-sensitive, the [14-day free trial](/sign-up) is free, no credit card, and gives you the full guided Level 1 build without the pause.`;
  return jsonReply(reply, retryAfterSec);
}
function promptAbuse(): Response {
  const reply =
    "I'm going to stay on task \u2014 my job is to figure out if you need CMMC Level 1 and point you to the right next step. Happy to do that. What's going on with your business?";
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
 * Conservative prompt-injection / abuse detector on the latest user
 * message. False positives are acceptable; Charlie's refusal is friendly.
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

const IP_HASH_SALT =
  process.env.LOG_IP_SALT ?? "cmmc-qualifier:v1";
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
  // Three-tier per-IP cost guard. Friendly 200 responses with a
  // countdown rather than 429, so the UX matches Claude.ai.
  const burst = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-qualifier:min", req }),
    LIMITS.burst,
  );
  if (!burst.allowed) return tooFast(burst.retryAfterSec);
  const hourly = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-qualifier:hr", req }),
    LIMITS.hourly,
  );
  if (!hourly.allowed) return hourlyCap(hourly.retryAfterSec);
  const daily = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-qualifier:day", req }),
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

  const lastUserContent = messages[messages.length - 1].content;
  if (looksLikeAbuse(lastUserContent)) {
    console.warn(
      JSON.stringify({
        tag: "cmmc-qualifier",
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
      model: QUALIFIER_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: CMMC_QUALIFIER_SYSTEM_PROMPT,
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
        tag: "cmmc-qualifier",
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
        tag: "cmmc-qualifier",
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
      tag: "cmmc-qualifier",
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
