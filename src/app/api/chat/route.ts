import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { COMPLIANCE_OFFICER_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  archiveWorkspaceConversation,
  getOrCreateWorkspaceConversation,
  listMessages,
} from "@/lib/ai/conversations";
import {
  ensureMemoryForOrg,
  memoryToContextBlock,
} from "@/lib/ai/memory";
import { buildPageContextBlock } from "@/lib/ai/page-context";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import { ensureOrgForUser, getBusinessProfile } from "@/lib/assessment";
import {
  formatSavedStateBlock,
  getControlSavedState,
} from "@/lib/cmmc/narrative-copilot";
import {
  enforceCharlieBudget,
} from "@/lib/security/rate-limit";
import {
  detectHighRiskIngress,
  wrapUserField,
  wrapJsonFields,
} from "@/lib/security/charlie-redaction";

const MAX_MESSAGE_LEN = 8_000;

export const runtime = "nodejs";

type ChatRequestBody = {
  message?: string;
  pageContext?: {
    route?: string;
    assessmentId?: string;
    controlId?: string;
  };
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const userMessage = (body.message ?? "").trim();
  if (!userMessage) {
    return new Response("Empty message", { status: 400 });
  }
  if (userMessage.length > MAX_MESSAGE_LEN) {
    return new Response("Message too long", { status: 413 });
  }

  // Cap LLM cost per user. Two windows: hourly catches accidental loops or
  // pasted-prompt floods; daily caps runaway spend at a ceiling no legit
  // compliance workflow ever hits. Tunable via CHARLIE_DAILY_CAP_CHAT.
  const blocked = await enforceCharlieBudget({ scope: "chat", userId });
  if (blocked) return blocked;

  const org = await ensureOrgForUser(userId);

  // High-risk identifier ingress block. We do NOT want SSN/CC/EIN values
  // landing in `ai_messages.content` (even encrypted) or being shipped to
  // Anthropic. Reject with a friendly synthetic reply and persist nothing.
  const ingressFindings = detectHighRiskIngress(userMessage);
  if (ingressFindings.length > 0) {
    const labels = ingressFindings.map((f) => f.label).join(", ");
    const refusal = `I can't accept that — your message looks like it contains a sensitive identifier (${labels}). Please remove it and resend. Charlie does not need SSNs, full credit-card numbers, EINs, or similar identifiers to walk you through CMMC Level 1.`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: delta\ndata: ${JSON.stringify({ text: refusal })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // `/reset` escape hatch — archives the current workspace conversation
  // and starts fresh on the next request. The user types this when Charlie
  // gets stuck in a tool-call loop or otherwise wedged. We deliberately
  // do NOT call the model here — we just stream back a synthetic assistant
  // reply confirming the reset so the UI updates instantly.
  const lower = userMessage.toLowerCase();
  if (lower === "/reset" || lower === "reset charlie" || lower === "reset chat") {
    await archiveWorkspaceConversation(org.id);
    const fresh = await getOrCreateWorkspaceConversation(org.id);
    const greeting =
      "Conversation reset. Fresh start — what would you like to work on? I can help with scope inventory, walking a practice, generating evidence, or just answering questions.";
    await appendMessage({
      conversationId: fresh.id,
      role: "user",
      content: [{ type: "text", text: userMessage }],
    });
    await appendMessage({
      conversationId: fresh.id,
      role: "assistant",
      content: [{ type: "text", text: greeting }],
      model: "reset",
      stopReason: "reset",
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: delta\ndata: ${JSON.stringify({ text: greeting })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  const conv = await getOrCreateWorkspaceConversation(org.id);

  // Lightweight intent classification on the user's message. Short
  // messages, anything ending in '?', and anything containing explicit
  // stop-words are conversational turns — Charlie must NOT call mutating
  // tools on these. We prepend a hidden hint so the model has a clear
  // signal in addition to the page pack's general rules. This is the
  // cheapest fix for the "user says 'what's next?' and gets 5 add_scope_item
  // calls" failure mode.
  const intentHint = classifyUserIntent(userMessage);
  const userMessageForModel = intentHint
    ? `${intentHint}\n\n${userMessage}`
    : userMessage;

  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: userMessageForModel }],
  });

  const profile = await getBusinessProfile(org.id);
  // Cheap-RAG: build/refresh long-term memory of all prior officer chats
  // (onboarding + workspace) before answering. Don't let a memory glitch
  // block the user — fall back to no memory if the build fails.
  let memoryBlock = "";
  try {
    const memory = await ensureMemoryForOrg(org.id);
    memoryBlock = memoryToContextBlock(memory);
  } catch (err) {
    console.warn("ensureMemoryForOrg failed, continuing without memory", err);
  }
  const contextBlock = buildWorkspaceContextBlock({
    orgName: org.name,
    profile: profile?.data,
    pageContext: body.pageContext,
    memoryBlock,
  });

  // Dynamic saved-state block: when the user is on a specific control
  // page, surface the persisted interview / narrative / evidence /
  // objective state so Charlie's first reply after a refresh
  // ACKNOWLEDGES prior work instead of saying "hasn't been started".
  // Best-effort — a DB hiccup here must never block the chat.
  let savedStateBlock = "";
  if (body.pageContext?.assessmentId && body.pageContext?.controlId) {
    try {
      const saved = await getControlSavedState({
        organizationId: org.id,
        assessmentId: body.pageContext.assessmentId,
        controlId: body.pageContext.controlId,
        userId,
      });
      savedStateBlock = formatSavedStateBlock(saved);
    } catch (err) {
      console.warn("getControlSavedState failed (non-fatal)", err);
    }
  }
  const fullContextBlock = savedStateBlock
    ? `${contextBlock}\n\n${savedStateBlock}`
    : contextBlock;

  const stream = runOfficerAgentStream({
    conversationId: conv.id,
    systemPrompt: COMPLIANCE_OFFICER_SYSTEM_PROMPT,
    contextBlock: fullContextBlock,
    toolContext: {
      organizationId: org.id,
      userId,
      conversationId: conv.id,
      activeAssessmentId: body.pageContext?.assessmentId,
      activeControlId: body.pageContext?.controlId,
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Lightweight intent classifier. Returns a one-line prefix to inject above
 * the user's message when the message is clearly conversational — meaning
 * Charlie should respond with text and NOT call mutating tools.
 *
 * Rule-based and cheap (no LLM call). It exists because Anthropic's model
 * sometimes pattern-matches on page context and emits add_scope_item even
 * when the user just asked "what's next?". The prefix is stored in DB so
 * past intent hints stay visible to the model — that's intentional.
 */
function classifyUserIntent(message: string): string | null {
  const m = message.trim();
  if (!m) return null;
  const lower = m.toLowerCase();

  const stopWords = [
    "stop", "wait", "halt", "pause", "hold on", "hold up",
    "don't add", "dont add", "no don't", "stop adding", "quit adding",
    "back up", "go back", "undo",
  ];
  if (stopWords.some((w) => lower.includes(w))) {
    return "[Charlie hint: the user just told you to STOP / PAUSE / UNDO. Respond with TEXT ONLY this turn. Do NOT call add_scope_item, add_esp, add_specialized_asset, or any other mutation tool. Acknowledge what they said and ask what they want instead.]";
  }

  if (lower.endsWith("?")) {
    return "[Charlie hint: the user is asking a question. Answer with text. Do NOT call mutation tools (add_scope_item / add_esp / add_specialized_asset / update_*) unless the user's question explicitly names something to add.]";
  }

  const shortNav = new Set([
    "ok", "okay", "k", "yes", "y", "no", "n", "next",
    "what next", "whats next", "what's next",
    "continue", "go", "go on", "and",
    "hmm", "huh", "sure", "right", "got it", "cool",
  ]);
  if (shortNav.has(lower) || (m.length < 25 && lower.startsWith("what"))) {
    return "[Charlie hint: this is a short conversational ack/nav message. Respond with text describing the next step or asking a focused question. Do NOT call mutation tools — the user has not named anything new to add.]";
  }

  return null;
}

function buildWorkspaceContextBlock(input: {
  orgName: string;
  profile: Record<string, unknown> | undefined;
  pageContext: ChatRequestBody["pageContext"];
  memoryBlock: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `## Current user context\n- Organization: ${wrapUserField(input.orgName, "organization.name")}`,
  );

  if (input.profile && Object.keys(input.profile).length > 0) {
    // Wrap every free-text leaf inside the profile object so a malicious
    // profile field (e.g. a "company description" containing "ignore
    // previous instructions") cannot hijack the model.
    const wrapped = wrapJsonFields(input.profile, "business_profile");
    parts.push(`- Business profile so far: ${JSON.stringify(wrapped)}`);
  } else {
    parts.push(
      `- Business profile: not yet captured — if the user asks for compliance advice without context, politely ask one or two questions about what they do before answering generically.`,
    );
  }

  if (input.memoryBlock) {
    parts.push("");
    parts.push(input.memoryBlock);
  }

  if (input.pageContext?.assessmentId) {
    parts.push(`- Active assessment: ${input.pageContext.assessmentId}`);
  }

  // Per-page context pack — single source of truth for "where am I, what's
  // expected on this page, which tools belong here." See src/lib/ai/page-context.ts.
  const pageBlock = buildPageContextBlock({
    route: input.pageContext?.route,
    assessmentId: input.pageContext?.assessmentId,
    controlId: input.pageContext?.controlId,
  });
  if (pageBlock) {
    parts.push("");
    parts.push(pageBlock);
  }

  parts.push(
    `\n## Tools\nYou have read-mostly tools to inspect the user's actual state (read_assessment_state, describe_evidence, check_readiness), the per-control narrative copilot (interview_for_control_narrative, draft_control_narrative, save_control_narrative, critique_control_narrative, bulk_draft_remaining_narratives — conversational interview is the default on /controls/[id]), a regulatory-citation lookup (cite_regulation), and mutators (propose_milestone, update_organization_fields, update_business_profile, escalate_to_officer). PREFER calling a tool over guessing — if the user asks "where am I", "what's left", or references specific evidence, call the relevant tool before answering. ALWAYS call cite_regulation before quoting FAR / NIST / 32 CFR text. When citing a primary source, also point the user at the matching /regulations page so they can read the official PDF in-browser (/regulations, /regulations/scoping-guide-level-1, /regulations/assessment-guide-level-1, /regulations/model-overview).`,
  );
  return parts.join("\n");
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateWorkspaceConversation(org.id);
  const rows = await listMessages(conv.id, 100);

  const messages = rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    created_at: r.created_at,
  }));

  // Surface the long-term memory recap so the rail can render a personalized
  // "here's where we left off" bubble before the user has typed anything in
  // this workspace conversation.
  let recap: string | null = null;
  try {
    const memory = await ensureMemoryForOrg(org.id);
    if (memory && memory.summary) {
      recap = memory.summary;
    }
  } catch (err) {
    console.warn("ensureMemoryForOrg (GET) failed", err);
  }

  return Response.json({ conversationId: conv.id, messages, recap });
}
