import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  getOrCreateOnboardingConversation,
  listMessages,
} from "@/lib/ai/conversations";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import {
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
} from "@/lib/assessment";

export const runtime = "nodejs";

type OnboardRequestBody = {
  message?: string;
};

/**
 * Dedicated onboarding chat endpoint. Same streaming protocol as /api/chat but
 * runs on the onboarding conversation (kind='onboarding') with a different
 * system prompt focused on capturing the business profile + legal identity
 * fields. The agent writes via update_business_profile + update_organization_fields
 * tools as it learns.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as OnboardRequestBody;
  const userMessage = (body.message ?? "").trim();
  if (!userMessage) {
    return new Response("Empty message", { status: 400 });
  }

  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateOnboardingConversation(org.id);

  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: userMessage }],
  });

  const profile = await getBusinessProfile(org.id);
  const contextBlock = [
    `## Current user state`,
    `- Current organization name (may be a placeholder): ${org.name}`,
    `- Scoped systems captured: ${org.scoped_systems ? "yes" : "no"}`,
    `- SAM UEI captured: ${org.sam_uei ? "yes" : "no"}`,
    `- CAGE code captured: ${org.cage_code ? "yes" : "no"}`,
    `- NAICS codes captured: ${(org.naics_codes?.length ?? 0) > 0 ? "yes" : "no"}`,
    profile && Object.keys(profile.data).length > 0
      ? `- Business profile so far (MERGE into this, don't overwrite): ${JSON.stringify(profile.data)}`
      : `- Business profile: empty`,
    `- Current completeness_score: ${profile?.completeness_score ?? 0}`,
    ``,
    `Keep the conversation moving. Ask one question per turn, call the tools as the user shares facts. When onboarding is complete (score ≥ 40, legal name set, scoped_systems set), say so explicitly and tell them they can head to the workspace.`,
  ].join("\n");

  const stream = runOfficerAgentStream({
    conversationId: conv.id,
    systemPrompt: ONBOARDING_SYSTEM_PROMPT,
    contextBlock,
    toolContext: {
      organizationId: org.id,
      userId,
      conversationId: conv.id,
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Hydrate: returns message history + an 'onboarded' boolean so the client can
 * redirect into the workspace once the agent has captured enough.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateOnboardingConversation(org.id);
  const rows = await listMessages(conv.id, 100);
  const profile = await getBusinessProfile(org.id);

  return Response.json({
    conversationId: conv.id,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
    })),
    onboarded: isOnboardingComplete(org, profile),
    completeness_score: profile?.completeness_score ?? 0,
  });
}
