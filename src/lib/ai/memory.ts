/**
 * Cheap-RAG long-term memory for the compliance officer.
 *
 * We deliberately do NOT run a vector store. The relevant signal from a
 * support-style conversation is small (a handful of facts about the user's
 * business + a few decisions they've made), so we collapse the transcript
 * into a rolling text summary plus a JSON facts blob, refreshed by a small
 * LLM call when stale. This costs ~one Haiku call per refresh and keeps
 * the workspace officer's prompt under control no matter how long the
 * user has been with us.
 *
 * Storage: one row per organization in `ai_memory`.
 *
 * Refresh policy:
 *  - Lazy: built on first workspace chat hit if absent.
 *  - When the rolling onboarding + workspace transcript has more than
 *    `REFRESH_AFTER_NEW_MESSAGES` messages beyond the last build, rebuild.
 *
 * Inject the result into the workspace officer's system context so it
 * "remembers" everything from onboarding plus older workspace turns
 * without paying token cost on the raw transcript.
 */

import { getSql } from "@/lib/db";
import { getAnthropic } from "@/lib/anthropic";
import { listMessages, type AiMessageRow } from "@/lib/ai/conversations";

const MEMORY_BUILD_MODEL = "claude-haiku-4-5";
const REFRESH_AFTER_NEW_MESSAGES = 20;
const RECENT_MESSAGE_FLOOR = 12; // never summarize the freshest turns; let them flow into the prompt raw

export type AiMemoryRow = {
  organization_id: string;
  summary: string;
  key_facts: Record<string, unknown>;
  messages_summarized: number;
  last_built_at: string | null;
  last_built_model: string | null;
};

export async function getMemory(
  organizationId: string,
): Promise<AiMemoryRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT organization_id, summary, key_facts, messages_summarized,
           last_built_at, last_built_model
    FROM ai_memory
    WHERE organization_id = ${organizationId}
    LIMIT 1
  `) as AiMemoryRow[];
  return rows[0] ?? null;
}

async function upsertMemory(
  organizationId: string,
  summary: string,
  keyFacts: Record<string, unknown>,
  messagesSummarized: number,
  model: string,
): Promise<void> {
  const sql = getSql();
  const factsJson = JSON.stringify(keyFacts);
  await sql`
    INSERT INTO ai_memory (
      organization_id, summary, key_facts, messages_summarized,
      last_built_at, last_built_model
    ) VALUES (
      ${organizationId}::uuid,
      ${summary},
      ${factsJson}::jsonb,
      ${messagesSummarized},
      NOW(),
      ${model}
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      key_facts = EXCLUDED.key_facts,
      messages_summarized = EXCLUDED.messages_summarized,
      last_built_at = NOW(),
      last_built_model = EXCLUDED.last_built_model
  `;
}

/**
 * Pull the union of messages across an org's onboarding + workspace
 * conversations, ordered by time. We summarize everything except the
 * freshest tail.
 */
async function loadOrgTranscript(
  organizationId: string,
): Promise<AiMessageRow[]> {
  const sql = getSql();
  const conversationIds = (await sql`
    SELECT id
    FROM ai_conversations
    WHERE organization_id = ${organizationId}
      AND archived = FALSE
      AND kind IN ('onboarding','workspace')
    ORDER BY started_at ASC
  `) as Array<{ id: string }>;

  const all: AiMessageRow[] = [];
  for (const c of conversationIds) {
    const rows = await listMessages(c.id, 500);
    all.push(...rows);
  }
  all.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return all;
}

function transcriptToPlainText(rows: AiMessageRow[]): string {
  const lines: string[] = [];
  for (const r of rows) {
    if (r.role !== "user" && r.role !== "assistant") continue;
    const text = extractText(r.content);
    if (!text) continue;
    const speaker = r.role === "user" ? "USER" : "OFFICER";
    lines.push(`${speaker}: ${text}`);
  }
  return lines.join("\n\n");
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const blocks = content as Array<{ type?: string; text?: string }>;
    return blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
  }
  return "";
}

const MEMORY_BUILDER_PROMPT = `You compress a compliance officer's conversation transcript into long-term memory for the next session.

Return STRICT JSON of shape:
{
  "summary": "<2-3 paragraph plain-English recap of who this user is, what their business does, where they are in the CMMC L1 journey, what they've already decided, and what's still open>",
  "key_facts": {
    "experience_level": "first_timer|exploring|subcontractor|experienced|unknown",
    "what_they_do": "<one sentence>",
    "primary_customers": "<one sentence>",
    "team_size": "<number or range or unknown>",
    "physical_workspace": "<one sentence>",
    "it_identity": "<microsoft 365 / google workspace / okta / none / mixed>",
    "data_location": "<where FCI lives>",
    "customer_facing_product": "<saas / hardware / services-only / none>",
    "network": "<remote / single office / mixed>",
    "contract_status": "<not_in_sam | sam_no_wins | active_subcontractor | active_prime | unknown>",
    "sam_uei": "<UEI string or null>",
    "cage_code": "<CAGE string or null>",
    "naics_codes": "<comma-separated or null>",
    "open_questions": ["<unanswered things the officer should pick up>"],
    "user_concerns": ["<things the user worried about>"],
    "decisions_made": ["<concrete decisions the user has confirmed>"]
  }
}

Rules:
- Only include facts the transcript actually supports. Use "unknown" or null when not stated.
- Be specific. "Sells custom drone parts to Air Force primes" beats "is in defense".
- Keep the summary tight — it goes into a system prompt on every chat turn.
- Output ONLY the JSON. No prose, no fences.`;

/**
 * Builds (or rebuilds) the memory row for an org from the full transcript,
 * minus the freshest tail. Returns the freshly written memory.
 */
export async function buildMemoryForOrg(
  organizationId: string,
): Promise<AiMemoryRow | null> {
  const transcript = await loadOrgTranscript(organizationId);
  if (transcript.length === 0) return null;

  const tail = Math.min(RECENT_MESSAGE_FLOOR, transcript.length);
  const olderSlice = transcript.slice(0, transcript.length - tail);
  if (olderSlice.length === 0) return null;

  const plain = transcriptToPlainText(olderSlice);
  if (!plain.trim()) return null;

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MEMORY_BUILD_MODEL,
    max_tokens: 1500,
    system: MEMORY_BUILDER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Transcript:\n\n${plain}\n\nReturn the JSON now.`,
      },
    ],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  const raw = textBlock.text.trim();
  const json = stripJsonFence(raw);

  let parsed: { summary?: string; key_facts?: Record<string, unknown> };
  try {
    parsed = JSON.parse(json);
  } catch {
    // Fail open: don't block the chat on a memory-build glitch.
    return null;
  }

  const summary = (parsed.summary ?? "").toString();
  const facts = parsed.key_facts ?? {};
  await upsertMemory(
    organizationId,
    summary,
    facts as Record<string, unknown>,
    olderSlice.length,
    MEMORY_BUILD_MODEL,
  );
  return await getMemory(organizationId);
}

function stripJsonFence(s: string): string {
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : s;
}

/**
 * Returns the org's memory, building it lazily if missing, and triggering a
 * rebuild when the transcript has grown by REFRESH_AFTER_NEW_MESSAGES since
 * the last build. Safe to call on every workspace chat hit.
 */
export async function ensureMemoryForOrg(
  organizationId: string,
): Promise<AiMemoryRow | null> {
  const existing = await getMemory(organizationId);
  if (!existing) {
    return await buildMemoryForOrg(organizationId);
  }
  const transcript = await loadOrgTranscript(organizationId);
  const summarizable = Math.max(
    0,
    transcript.length - RECENT_MESSAGE_FLOOR,
  );
  if (summarizable - existing.messages_summarized >= REFRESH_AFTER_NEW_MESSAGES) {
    return await buildMemoryForOrg(organizationId);
  }
  return existing;
}

export function memoryToContextBlock(memory: AiMemoryRow | null): string {
  if (!memory || (!memory.summary && !memory.key_facts)) return "";
  const facts = memory.key_facts ?? {};
  const factsLine =
    Object.keys(facts).length > 0
      ? `\n- Key facts (JSON): ${JSON.stringify(facts)}`
      : "";
  const builtAt = memory.last_built_at
    ? new Date(memory.last_built_at).toISOString()
    : "never";
  return [
    "## Long-term memory of this user",
    "(Compressed recap of prior onboarding + workspace conversations. Treat as authoritative context, but defer to anything the user says fresh in this turn.)",
    `- Built: ${builtAt} from ${memory.messages_summarized} prior message(s).`,
    `- Summary: ${memory.summary || "(empty)"}`,
    factsLine,
  ]
    .filter(Boolean)
    .join("\n");
}
