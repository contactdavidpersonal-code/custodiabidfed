import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  ensureOnboardingOpener,
  getOrCreateOnboardingConversation,
  listMessages,
} from "@/lib/ai/conversations";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import {
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
} from "@/lib/assessment";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const MAX_MESSAGE_LEN = 8_000;

export const runtime = "nodejs";

const CANONICAL_PROFILE_KEYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "experience_level", label: "Experience with federal contracting" },
  { key: "what_they_do", label: "What the company does" },
  { key: "customers", label: "Who they sell to" },
  { key: "team_size", label: "Team size" },
  { key: "physical_workspace", label: "Where work physically happens" },
  { key: "data_location", label: "Where contract information lives" },
  { key: "it_identity", label: "How the team logs in" },
  { key: "customer_facing_product", label: "Product vs services" },
  { key: "network", label: "Network shape" },
  { key: "contract_status", label: "Federal contracting status" },
];

function missingProfileKeys(data: Record<string, unknown> | undefined): string[] {
  if (!data) return CANONICAL_PROFILE_KEYS.map((k) => k.key);
  return CANONICAL_PROFILE_KEYS.filter((k) => {
    const v = data[k.key];
    if (v === undefined || v === null) return true;
    if (typeof v === "string" && v.trim().length === 0) return true;
    return false;
  }).map((k) => k.key);
}

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
  if (userMessage.length > MAX_MESSAGE_LEN) {
    return new Response("Message too long", { status: 413 });
  }

  const rl = await checkRateLimit(
    rateLimitKey({ scope: "onboard", userId }),
    { max: 60, windowSec: 60 * 60 },
  );
  if (!rl.allowed) return rateLimitResponse(rl);

  const org = await ensureOrgForUser(userId);
  const conv = await getOrCreateOnboardingConversation(org.id);
  await ensureOnboardingOpener(conv.id);

  await appendMessage({
    conversationId: conv.id,
    role: "user",
    content: [{ type: "text", text: userMessage }],
  });

  const profile = await getBusinessProfile(org.id);
  const missing = missingProfileKeys(
    profile?.data as Record<string, unknown> | undefined,
  );
  const stillNeed =
    missing.length === 0
      ? "All ten profile keys captured. Confirm legal name + scoped_systems if not yet set, then wrap up."
      : `STILL NEED TO ASK (these canonical keys are still missing — ask the next one if the user goes off-topic): ${missing.join(", ")}`;

  const contextBlock = [
    `## Current user state`,
    `- Current organization name (may be a placeholder): ${org.name}`,
    `- Scoped systems captured: ${org.scoped_systems ? "yes" : "no"}`,
    `- Federal ID number on file: ${org.sam_uei ? "yes" : "no"}`,
    `- Contractor location code on file: ${org.cage_code ? "yes" : "no"}`,
    `- Industry codes on file: ${(org.naics_codes?.length ?? 0) > 0 ? "yes" : "no"}`,
    profile && Object.keys(profile.data).length > 0
      ? `- Business profile so far (MERGE into this, never overwrite): ${JSON.stringify(profile.data)}`
      : `- Business profile: empty`,
    `- Current completeness_score: ${profile?.completeness_score ?? 0}`,
    ``,
    stillNeed,
    ``,
    `Reminder: plain English only. Never use the acronyms SAM, UEI, CAGE, NAICS, SPRS, FAR, NIST, CMMC, FCI, FedRAMP, M365, SSO, vCO in your reply text. One question per turn. Persist every fact via update_business_profile BEFORE you reply.`,
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
  await ensureOnboardingOpener(conv.id);
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
    profile_data: profile?.data ?? {},
    profile_keys: CANONICAL_PROFILE_KEYS,
  });
}
