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
import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import { CMMC_L1_PUBLIC_AGENT_SYSTEM_PROMPT } from "@/lib/cmmc-level-1/system-prompt";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const MAX_MESSAGE_LEN = 4_000;
const MAX_MESSAGES = 30;
const MAX_OUTPUT_TOKENS = 1_024;

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
  // Two-tier rate limit per IP. This is the only thing standing between
  // us and a runaway LLM bill if someone scripts the endpoint.
  const hourly = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-l1-chat:hr", req }),
    { max: 40, windowSec: 3_600 },
  );
  if (!hourly.allowed) return rateLimitResponse(hourly);
  const daily = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-l1-chat:day", req }),
    { max: 150, windowSec: 24 * 3_600 },
  );
  if (!daily.allowed) return rateLimitResponse(daily);

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

  const anthropic = getAnthropic();
  let reply = "";
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
  } catch (err) {
    console.warn("[cmmc-l1-chat] anthropic error:", err);
    return NextResponse.json(
      { error: "Charlie is briefly unavailable — please try again." },
      { status: 502 },
    );
  }

  reply = reply.trim();
  if (!reply) {
    return NextResponse.json(
      { error: "Empty response from Charlie." },
      { status: 502 },
    );
  }

  return NextResponse.json({ reply });
}
