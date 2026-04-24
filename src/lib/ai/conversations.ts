import { getSql, type ConversationKind, type MessageRole } from "@/lib/db";

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

type AppendInput = {
  conversationId: string;
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

export async function appendMessage(input: AppendInput): Promise<AiMessageRow> {
  const sql = getSql();
  const contentJson = JSON.stringify(input.content);
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

  await sql`
    UPDATE ai_conversations
    SET last_message_at = NOW()
    WHERE id = ${input.conversationId}
  `;
  return inserted[0];
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<AiMessageRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, conversation_id, role, content, tool_use_id,
           input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
           model, stop_reason, created_at
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `) as AiMessageRow[];
}

/**
 * Shapes stored rows into the Anthropic Messages API format. System messages
 * are never persisted — the system prompt is provided fresh on every call.
 */
export function toAnthropicMessages(
  rows: AiMessageRow[],
): Array<{ role: "user" | "assistant"; content: unknown }> {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant" || r.role === "tool")
    .map((r) => {
      if (r.role === "tool") {
        // Tool results are stored with role='tool' but must be sent as role=user
        // with a tool_result content block per Anthropic's API.
        return { role: "user" as const, content: r.content };
      }
      return { role: r.role as "user" | "assistant", content: r.content };
    });
}
