import { getSql, type ConversationKind, type MessageRole } from "@/lib/db";
import {
  encryptMessageContent,
  tryDecryptMessageContent,
} from "@/lib/ai/message-encryption";

export type AiConversationRow = {
  id: string;
  organization_id: string;
  kind: ConversationKind;
  title: string | null;
  archived: boolean;
  started_at: string;
  last_message_at: string;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: unknown; // Anthropic-format content blocks (array of blocks) or a plain string
  tool_use_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  model: string | null;
  stop_reason: string | null;
  created_at: string;
};

/**
 * One active "workspace" conversation per org — the left-rail chat that
 * persists across all pages in /assessments/*. New onboarding conversations
 * get their own kind='onboarding' record.
 */
export async function getOrCreateWorkspaceConversation(
  organizationId: string,
): Promise<AiConversationRow> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id, organization_id, kind, title, archived, started_at, last_message_at
    FROM ai_conversations
    WHERE organization_id = ${organizationId}
      AND kind = 'workspace'
      AND archived = FALSE
    ORDER BY last_message_at DESC
    LIMIT 1
  `) as AiConversationRow[];
  if (existing[0]) return existing[0];

  const inserted = (await sql`
    INSERT INTO ai_conversations (organization_id, kind, title)
    VALUES (${organizationId}::uuid, 'workspace', 'Compliance officer')
    RETURNING id, organization_id, kind, title, archived, started_at, last_message_at
  `) as AiConversationRow[];
  return inserted[0];
}

export async function getOrCreateOnboardingConversation(
  organizationId: string,
): Promise<AiConversationRow> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id, organization_id, kind, title, archived, started_at, last_message_at
    FROM ai_conversations
    WHERE organization_id = ${organizationId}
      AND kind = 'onboarding'
      AND archived = FALSE
    ORDER BY last_message_at DESC
    LIMIT 1
  `) as AiConversationRow[];
  if (existing[0]) return existing[0];

  const inserted = (await sql`
    INSERT INTO ai_conversations (organization_id, kind, title)
    VALUES (${organizationId}::uuid, 'onboarding', 'Getting started')
    RETURNING id, organization_id, kind, title, archived, started_at, last_message_at
  `) as AiConversationRow[];
  return inserted[0];
}

/**
 * Archive the user's current workspace conversation. The next call to
 * `getOrCreateWorkspaceConversation` will create a brand-new one. Used
 * by the `/reset` slash command so a user can escape a stuck Charlie
 * without losing all history (the old conversation is retained for
 * audit/replay, just hidden from the live chat).
 */
export async function archiveWorkspaceConversation(
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE ai_conversations
    SET archived = TRUE
    WHERE organization_id = ${organizationId}
      AND kind = 'workspace'
      AND archived = FALSE
  `;
}

/**
 * Deterministic opener for the onboarding conversation. Persists a single
 * assistant message the very first time so the user always sees the same
 * calibrated welcome + first question, and the model has stable context to
 * continue from. No-op if the conversation already has any messages.
 */
export const ONBOARDING_OPENER_TEXT = `Hi, I'm Charlie — I'll be your compliance officer here.

Before we start, have you ever bid on a federal contract before, or worked under a company that did? Totally fine either way — I just want to know what pace to use.`;

/**
 * MSP variant: the user is a managed-services provider and the active Clerk
 * org represents one of their client businesses. Frame the walk in third
 * person ("the client") rather than second person ("you").
 */
export function buildMspOnboardingOpener(orgName: string): string {
  const name = orgName && orgName.trim().length > 0 ? orgName.trim() : "this client";
  return `Hi, I'm Charlie — I'll be the compliance officer for ${name}.

You're walking ${name} through CMMC Level 1 as their MSP, so I'll ask about their setup, not yours. First question: has ${name} ever bid on a federal contract before, or worked under a company that did? Totally fine either way — I just want to know what pace to use.`;
}

export async function ensureOnboardingOpener(
  conversationId: string,
  opts?: { isMsp?: boolean; orgName?: string },
): Promise<void> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id FROM ai_messages
    WHERE conversation_id = ${conversationId}
    LIMIT 1
  `) as Array<{ id: string }>;
  if (existing.length > 0) return;

  const text = opts?.isMsp
    ? buildMspOnboardingOpener(opts.orgName ?? "this client")
    : ONBOARDING_OPENER_TEXT;

  await appendMessage({
    conversationId,
    role: "assistant",
    content: [{ type: "text", text }],
    model: "seed",
    stopReason: "seed",
  });
}

type AppendInput = {
  conversationId: string;
  /**
   * Optional. When the caller already has the org id (e.g. the stream
   * loop), pass it to skip the per-call SELECT used to bind the
   * encryption AAD. When omitted, we look it up via `conversation_id`.
   */
  organizationId?: string;
  role: MessageRole;
  content: unknown; // string or Anthropic content blocks
  toolUseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model?: string;
  stopReason?: string;
};

/**
 * Resolve the tenant org id for a conversation. Used as the AAD binding
 * for envelope encryption of `ai_messages.content` so a ciphertext from
 * one org can never be decrypted under another org's DEK.
 */
async function resolveOrgIdForConversation(
  conversationId: string,
): Promise<string> {
  const sql = getSql();
  const rows = (await sql`
    SELECT organization_id FROM ai_conversations WHERE id = ${conversationId} LIMIT 1
  `) as Array<{ organization_id: string }>;
  if (!rows[0]) {
    throw new Error(
      `appendMessage: conversation ${conversationId} not found — cannot bind encryption AAD`,
    );
  }
  return rows[0].organization_id;
}

export async function appendMessage(input: AppendInput): Promise<AiMessageRow> {
  const sql = getSql();
  const organizationId =
    input.organizationId ?? (await resolveOrgIdForConversation(input.conversationId));
  // Envelope-encrypt the content jsonb under the tenant DEK. AAD pins the
  // org id and field name so cross-tenant ciphertext swaps fail loudly.
  const envelope = await encryptMessageContent(input.content, organizationId);
  const contentJson = JSON.stringify(envelope);
  const inserted = (await sql`
    INSERT INTO ai_messages (
      conversation_id, role, content, tool_use_id,
      input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
      model, stop_reason
    )
    VALUES (
      ${input.conversationId}::uuid,
      ${input.role},
      ${contentJson}::jsonb,
      ${input.toolUseId ?? null},
      ${input.inputTokens ?? null},
      ${input.outputTokens ?? null},
      ${input.cacheReadTokens ?? null},
      ${input.cacheCreationTokens ?? null},
      ${input.model ?? null},
      ${input.stopReason ?? null}
    )
    RETURNING id, conversation_id, role, content, tool_use_id,
              input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
              model, stop_reason, created_at
  `) as AiMessageRow[];

  // Return the decrypted content so the caller sees the plain shape,
  // not the wire envelope.
  const row = inserted[0];
  row.content = input.content;

  await sql`
    UPDATE ai_conversations
    SET last_message_at = NOW()
    WHERE id = ${input.conversationId}
  `;
  return row;
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<AiMessageRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT m.id, m.conversation_id, m.role, m.content, m.tool_use_id,
           m.input_tokens, m.output_tokens, m.cache_read_tokens, m.cache_creation_tokens,
           m.model, m.stop_reason, m.created_at,
           c.organization_id
    FROM ai_messages m
    JOIN ai_conversations c ON c.id = m.conversation_id
    WHERE m.conversation_id = ${conversationId}
    ORDER BY m.created_at ASC
    LIMIT ${limit}
  `) as Array<AiMessageRow & { organization_id: string }>;
  // Decrypt in parallel. Legacy plaintext rows pass through untouched.
  const decrypted = await Promise.all(
    rows.map(async (r) => {
      const content = await tryDecryptMessageContent(r.content, r.organization_id);
      // Strip the organization_id helper column from the public shape.
      const rest: AiMessageRow = {
        id: r.id,
        conversation_id: r.conversation_id,
        role: r.role,
        content,
        tool_use_id: r.tool_use_id,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cache_read_tokens: r.cache_read_tokens,
        cache_creation_tokens: r.cache_creation_tokens,
        model: r.model,
        stop_reason: r.stop_reason,
        created_at: r.created_at,
      };
      return rest;
    }),
  );
  return decrypted;
}

/**
 * Shapes stored rows into the Anthropic Messages API format. System messages
 * are never persisted — the system prompt is provided fresh on every call.
 *
 * Also heals corrupt histories: Anthropic rejects any request where an
 * assistant `tool_use` block isn't immediately followed by a matching
 * `tool_result`. If a prior turn died mid-loop (DB error, deploy, tool
 * exception) the assistant row was persisted but the tool row wasn't. We
 * inject a synthetic error tool_result for every orphaned tool_use id so
 * the user can keep chatting instead of being stuck.
 */
export function toAnthropicMessages(
  rows: AiMessageRow[],
): Array<{ role: "user" | "assistant"; content: unknown }> {
  const shaped = rows
    .filter((r) => r.role === "user" || r.role === "assistant" || r.role === "tool")
    .map((r) => {
      if (r.role === "tool") {
        // Tool results are stored with role='tool' but must be sent as role=user
        // with a tool_result content block per Anthropic's API.
        return { role: "user" as const, content: r.content };
      }
      return { role: r.role as "user" | "assistant", content: r.content };
    });

  const result: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (let i = 0; i < shaped.length; i++) {
    const msg = shaped[i];
    result.push(msg);
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    const toolUseIds = (msg.content as Array<{ type: string; id?: string }>)
      .filter((b) => b.type === "tool_use" && typeof b.id === "string")
      .map((b) => b.id as string);
    if (toolUseIds.length === 0) continue;
    // Find every tool_result id present in the very next user message (if any).
    const next = shaped[i + 1];
    const nextResults = next && next.role === "user" && Array.isArray(next.content)
      ? new Set(
          (next.content as Array<{ type: string; tool_use_id?: string }>)
            .filter((b) => b.type === "tool_result" && typeof b.tool_use_id === "string")
            .map((b) => b.tool_use_id as string),
        )
      : new Set<string>();
    const orphans = toolUseIds.filter((id) => !nextResults.has(id));
    if (orphans.length === 0) continue;
    // Inject synthetic error tool_result(s) immediately after the assistant
    // turn so Anthropic's pairing rule is satisfied. Mark is_error so the
    // model can apologize and retry instead of acting as if the tool worked.
    const synthetic = {
      role: "user" as const,
      content: orphans.map((id) => ({
        type: "tool_result" as const,
        tool_use_id: id,
        content: JSON.stringify({
          ok: false,
          error: "tool_execution_interrupted",
          message:
            "Previous tool call did not finish (stream interrupted). Please retry the action.",
        }),
        is_error: true,
      })),
    };
    result.push(synthetic);
  }
  return result;
}
