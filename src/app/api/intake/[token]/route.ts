/**
 * Public intake portal — no Clerk auth. The magic-link token IS the auth.
 *
 * GET  /api/intake/<token>  → hydrate (messages, profile, completeness)
 * POST /api/intake/<token>  → SSE stream of Charlie's reply for one turn
 */

import type { NextRequest } from "next/server";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/anthropic";
import {
  appendMessage,
  ensureOnboardingOpener,
  getOrCreateOnboardingConversation,
  listMessages,
} from "@/lib/ai/conversations";
import { runOfficerAgentStream, SSE_HEADERS } from "@/lib/ai/stream";
import { getBusinessProfile } from "@/lib/assessment";
import { getSql } from "@/lib/db";
import {
  getIntakeInvitationByToken,
  touchIntakeInvitation,
} from "@/lib/intake-invitations";
import { enforceCharlieBudget } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LEN = 8_000;

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

async function getOrgRow(organizationId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, scoped_systems, sam_uei, cage_code, naics_codes
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `) as Array<{
    id: string;
    name: string;
    scoped_systems: string | null;
    sam_uei: string | null;
    cage_code: string | null;
    naics_codes: string[] | null;
  }>;
  return rows[0] ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getIntakeInvitationByToken(token);
  if (!invite) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }
  await touchIntakeInvitation(token);

  const org = await getOrgRow(invite.organization_id);
  if (!org) {
    return Response.json({ error: "organization_not_found" }, { status: 404 });
  }

  const conv = await getOrCreateOnboardingConversation(org.id);
  await ensureOnboardingOpener(conv.id, { isMsp: false, orgName: org.name });
  const rows = await listMessages(conv.id, 100);
  const profile = await getBusinessProfile(org.id);

  return Response.json({
    invitation: {
      id: invite.id,
      client_email: invite.client_email,
      client_name: invite.client_name,
      sections: invite.sections,
      completed_sections: invite.completed_sections,
      expires_at: invite.expires_at,
    },
    organization: {
      id: org.id,
      name: org.name,
    },
    conversationId: conv.id,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
    })),
    completeness_score: profile?.completeness_score ?? 0,
    profile_data: profile?.data ?? {},
    profile_keys: CANONICAL_PROFILE_KEYS,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getIntakeInvitationByToken(token);
  if (!invite) {
    return new Response("Invalid or expired link", { status: 404 });
  }

  const body = (await req.json()) as { message?: string };
  const userMessage = (body.message ?? "").trim();
  if (!userMessage) return new Response("Empty message", { status: 400 });
  if (userMessage.length > MAX_MESSAGE_LEN)
    return new Response("Message too long", { status: 413 });

  // Rate-limit on the synthetic intake user id so a runaway client portal
  // can't drain the org's Charlie budget.
  const intakeUserId = `intake:${invite.id}`;
  const blocked = await enforceCharlieBudget({
    scope: "onboard",
    userId: intakeUserId,
  });
  if (blocked) return blocked;

  const org = await getOrgRow(invite.organization_id);
  if (!org) return new Response("Organization not found", { status: 404 });

  const conv = await getOrCreateOnboardingConversation(org.id);
  await ensureOnboardingOpener(conv.id, { isMsp: false, orgName: org.name });
  await touchIntakeInvitation(token);

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
    `- Caller is the business owner answering for their own company through a CLIENT INTAKE PORTAL their MSP sent them. There is no MSP joining this conversation — the client is alone with you.`,
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
    `Reminder: plain English only. Never use the acronyms SAM, UEI, CAGE, NAICS, SPRS, FAR, NIST, CMMC, FCI, FedRAMP, M365, SSO, vCO in your reply text. One question per turn. Persist every fact via update_business_profile BEFORE you reply. When the ten keys are full, tell the user "you can close this tab — your MSP will take it from here."`,
  ].join("\n");

  const stream = runOfficerAgentStream({
    conversationId: conv.id,
    systemPrompt: ONBOARDING_SYSTEM_PROMPT,
    contextBlock,
    toolContext: {
      organizationId: org.id,
      userId: intakeUserId,
      conversationId: conv.id,
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
