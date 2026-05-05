import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { COMPLIANCE_OFFICER_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  getOrCreateWorkspaceConversation,
  listMessages,
} from "@/lib/ai/conversations";
import {
  ensureMemoryForOrg,
  memoryToContextBlock,
} from "@/lib/ai/memory";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import { ensureOrgForUser, getBusinessProfile } from "@/lib/assessment";
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

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

  // Cap LLM cost per user. 60 msgs/hour ≈ several dollars worst case at
  // current Anthropic prices — well above legitimate use, well below an
  // abuser draining credits with a single account.
  const rl = await checkRateLimit(
    rateLimitKey({ scope: "chat", userId }),
    { max: 60, windowSec: 60 * 60 },
  );
  if (!rl.allowed) return rateLimitResponse(rl);

  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateWorkspaceConversation(org.id);

  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: userMessage }],
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

  const stream = runOfficerAgentStream({
    conversationId: conv.id,
    systemPrompt: COMPLIANCE_OFFICER_SYSTEM_PROMPT,
    contextBlock,
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

function buildWorkspaceContextBlock(input: {
  orgName: string;
  profile: Record<string, unknown> | undefined;
  pageContext: ChatRequestBody["pageContext"];
  memoryBlock: string;
}): string {
  const parts: string[] = [];
  parts.push(`## Current user context\n- Organization: ${input.orgName}`);

  if (input.profile && Object.keys(input.profile).length > 0) {
    parts.push(`- Business profile so far: ${JSON.stringify(input.profile)}`);
  } else {
    parts.push(
      `- Business profile: not yet captured — if the user asks for compliance advice without context, politely ask one or two questions about what they do before answering generically.`,
    );
  }

  if (input.memoryBlock) {
    parts.push("");
    parts.push(input.memoryBlock);
  }

  if (input.pageContext?.route) {
    parts.push(`- Current page: ${input.pageContext.route}`);
  }
  if (input.pageContext?.controlId) {
    parts.push(
      `- Currently viewing practice: ${input.pageContext.controlId} (anchor answers to this control when relevant)`,
    );
    // Hybrid practice mode: when the user is on a practice with a published
    // CMMC L1 spec, embed the verbatim control statement, NIST 800-171A
    // objectives, and required evidence slots so Charlie acts as a CMMC
    // consultant for THIS practice — one shaped question at a time, mapping
    // the user's plain-English answers onto each objective letter.
    const spec = getPracticeSpec(input.pageContext.controlId);
    if (spec) {
      parts.push("");
      parts.push(`## ACTIVE PRACTICE — guided walkthrough mode`);
      parts.push(`The user is working **${spec.controlId} — ${spec.shortName}** right now. The middle pane shows live objective coverage as the conversation progresses; you are the chat. Stay focused on filling each objective letter [a]/[b]/[c]/...`);
      parts.push("");
      parts.push(`### Verbatim control statement (FAR 52.204-21 / NIST 800-171 §3.1.1)`);
      parts.push(`"${spec.statement}"`);
      parts.push("");
      parts.push(`### NIST 800-171A objectives the assessor will check:`);
      for (const o of spec.objectives) {
        parts.push(`  [${o.letter}] ${o.text}`);
      }
      parts.push("");
      parts.push(`### Evidence slots an assessor accepts:`);
      for (const s of spec.evidenceSlots) {
        parts.push(
          `  - ${s.label} (${s.required ? "required" : "optional"}; satisfies [${s.satisfies.join(", ")}]): ${s.hint}`,
        );
      }
      parts.push("");
      parts.push(
        `### Behaviour for this practice:
- ONE question at a time. Plain English. No jargon without defining it.
- The user is not a security expert. Assume zero prior knowledge.
- Convert their plain description of their business into a clean mapping of each objective letter onto reality.
- When you have enough for an objective, briefly note "Got what I need for [letter]" and move on.
- If the user is missing a required artifact, tell them concretely what to upload AND offer to draft it for them.
- NEVER mark the practice MET on your own — the platform handles that. You just gather facts.
- Keep replies short — 2-5 sentences usually. The middle pane is doing the visual tracking; you don't need to summarize what's covered.`,
      );
    }
  }
  if (input.pageContext?.assessmentId) {
    parts.push(`- Active assessment: ${input.pageContext.assessmentId}`);
  }
  parts.push(
    `\n## Tools\nYou have read-mostly tools to inspect the user's actual state (read_assessment_state, describe_evidence, check_readiness), a draft-generator (suggest_narrative), a regulatory-citation lookup (cite_regulation), and mutators (propose_milestone, update_organization_fields, update_business_profile, escalate_to_officer). PREFER calling a tool over guessing — if the user asks "where am I", "what's left", or references specific evidence, call the relevant tool before answering. ALWAYS call cite_regulation before quoting FAR / NIST / 32 CFR text.`,
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
