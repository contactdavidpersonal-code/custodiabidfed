import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { COMPLIANCE_OFFICER_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  getOrCreateWorkspaceConversation,
  listMessages,
} from "@/lib/ai/conversations";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import { ensureOrgForUser, getBusinessProfile } from "@/lib/assessment";

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

  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateWorkspaceConversation(org.id);

  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: userMessage }],
  });

  const profile = await getBusinessProfile(org.id);
  const contextBlock = buildWorkspaceContextBlock({
    orgName: org.name,
    profile: profile?.data,
    pageContext: body.pageContext,
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

  if (input.pageContext?.route) {
    parts.push(`- Current page: ${input.pageContext.route}`);
  }
  if (input.pageContext?.controlId) {
    parts.push(
      `- Currently viewing practice: ${input.pageContext.controlId} (anchor answers to this control when relevant)`,
    );
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

  return Response.json({ conversationId: conv.id, messages });
}
