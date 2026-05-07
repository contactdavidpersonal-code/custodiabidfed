/**
 * Public, isolated CMMC L1 diagnostic chat endpoint.
 *
 * Security posture:
 *   - No auth required (this is a public sales surface) → IP-based rate limit
 *   - No tools wired (model cannot call any function or hit any DB)
 *   - System prompt is fixed and never user-controllable
 *   - Hard caps: 4 KB per message, 30 turns per session
 *   - User messages are stored verbatim but rendered ONLY in a public report
 *     that the model itself does not control (server templates the HTML)
 *   - The "FINAL_REPORT_READY" token + JSON tail is parsed defensively;
 *     malformed payloads leave the session unfinalized rather than crash
 *
 * Wire format:
 *   POST { token?: string, message: string }
 *   → { token, reply: string, finalized?: boolean, result?: CmmcCheckResult }
 *
 * If `token` is absent, a new session is created. The first request can
 * pass an empty `message` to receive Charlie's opening turn.
 */

import { NextResponse, type NextRequest } from "next/server";
import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import {
  parseCmmcCheckResult,
  SALES_CHARLIE_SYSTEM_PROMPT,
} from "@/lib/cmmc/applicability";
import {
  appendTurns,
  createSession,
  getSession,
  isValidToken,
  MAX_TURNS,
  finalizeSession,
  type ChatTurn,
} from "@/lib/cmmc-check/store";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const MAX_MESSAGE_LEN = 4_000;
const MAX_OUTPUT_TOKENS = 1_024;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Two-tier rate limit: per-IP per-hour AND per-IP per-day. Sales Charlie
  // is unauthenticated and exposes a paid LLM, so this is the only thing
  // standing between us and a $$$ bill if someone scripts it.
  const ipKey = rateLimitKey({ scope: "cmmc-check-msg", req });
  const hourly = await checkRateLimit(ipKey, { max: 60, windowSec: 3_600 });
  if (!hourly.allowed) return rateLimitResponse(hourly);
  const daily = await checkRateLimit(
    rateLimitKey({ scope: "cmmc-check-msg:day", req }),
    { max: 200, windowSec: 24 * 3_600 },
  );
  if (!daily.allowed) return rateLimitResponse(daily);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "Message too long" }, { status: 413 });
  }

  // Resolve or create the session.
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const ua = req.headers.get("user-agent");

  let token: string;
  let priorTurns: ChatTurn[] = [];
  let priorTurnCount = 0;
  let finalized = false;

  if (typeof b.token === "string" && b.token.length > 0) {
    if (!isValidToken(b.token)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    const existing = await getSession(b.token);
    if (!existing) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }
    token = existing.token;
    priorTurns = existing.transcript;
    priorTurnCount = existing.turnCount;
    finalized = !!existing.finalizedAt;
  } else {
    // Per-IP session creation cap — independent of message cap.
    const sessRl = await checkRateLimit(
      rateLimitKey({ scope: "cmmc-check-new", req }),
      { max: 8, windowSec: 3_600 },
    );
    if (!sessRl.allowed) return rateLimitResponse(sessRl);
    token = await createSession({ ip, userAgent: ua });
  }

  if (finalized) {
    return NextResponse.json(
      { error: "This conversation is already complete." },
      { status: 409 },
    );
  }

  if (priorTurnCount >= MAX_TURNS) {
    return NextResponse.json(
      {
        error:
          "We've hit the conversation length limit. Please start a new check or open the report from the link Charlie shared.",
      },
      { status: 429 },
    );
  }

  // Build the message history to send to Anthropic. Only roles user/assistant.
  const history = priorTurns.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  if (message.length > 0) {
    history.push({ role: "user", content: message });
  } else if (priorTurns.length === 0) {
    // Opening turn: kick the model with a neutral starter so it greets first.
    history.push({
      role: "user",
      content: "(Begin the diagnostic by introducing yourself and asking step 1.)",
    });
  } else {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const anthropic = getAnthropic();
  let assistantText = "";
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SALES_CHARLIE_SYSTEM_PROMPT,
      messages: history,
    });
    for (const block of resp.content) {
      if (block.type === "text") assistantText += block.text;
    }
  } catch (err) {
    console.warn("[cmmc-check] anthropic error:", err);
    return NextResponse.json(
      { error: "Charlie is briefly unavailable — please try again." },
      { status: 502 },
    );
  }

  assistantText = assistantText.trim();
  if (!assistantText) {
    return NextResponse.json(
      { error: "Empty response from Charlie." },
      { status: 502 },
    );
  }

  // Persist the turn pair (user + assistant) to the session transcript.
  // For the synthetic opening kick we don't store the kick itself.
  const turnsToAppend: ChatTurn[] = [];
  if (message.length > 0) {
    turnsToAppend.push({ role: "user", content: message });
  }
  turnsToAppend.push({ role: "assistant", content: assistantText });
  try {
    await appendTurns(token, turnsToAppend);
  } catch (err) {
    console.warn("[cmmc-check] persist turn failed:", err);
  }

  // Detect the wrap-up signal. Charlie is instructed to emit
  //   FINAL_REPORT_READY\n{ ... json ... }
  // at the end of the conversation. If we see it, parse + finalize the
  // session and tell the client to redirect to the report.
  const finalMatch = assistantText.match(/FINAL_REPORT_READY\s*([\s\S]*)$/);
  let finalizedNow = false;
  let resultPublic: ReturnType<typeof parseCmmcCheckResult> | null = null;
  let displayReply = assistantText;

  if (finalMatch) {
    const tail = finalMatch[1].trim();
    // Strip optional code fences just in case the model wrapped the JSON.
    const jsonText = tail
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    try {
      const raw = JSON.parse(jsonText);
      const parsed = parseCmmcCheckResult(raw);
      await finalizeSession(token, parsed);
      finalizedNow = true;
      resultPublic = parsed;
      // The reply we surface to the user replaces the JSON with a clean
      // confirmation line — they don't need to see raw payload.
      displayReply =
        "Your CMMC Level 1 check is ready. Opening your one-page report now.";
    } catch (err) {
      console.warn("[cmmc-check] final parse failed:", err);
      displayReply =
        "Almost there — let me re-summarize that. (One quick follow-up coming.)";
    }
  }

  return NextResponse.json({
    token,
    reply: displayReply,
    finalized: finalizedNow,
    result: resultPublic,
    turnCount: priorTurnCount + turnsToAppend.length,
    maxTurns: MAX_TURNS,
  });
}
