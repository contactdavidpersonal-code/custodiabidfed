/**
 * Charlie tool-call audit log.
 *
 * Every tool invocation by the AI is recorded here with HASHED input and
 * output (SHA-256), the tool name, status, duration, and the trusted
 * tenant context. The *contents* of inputs/outputs live encrypted on
 * `ai_messages` (per-tenant DEK) — this table is the cross-reference
 * index and the tamper-evident replay log.
 *
 * Why hashes, not payloads:
 *   1. The payloads are already persisted (encrypted) on the matching
 *      ai_messages row. Storing them again here would double the leak
 *      surface for no benefit.
 *   2. Hashes make tamper-detection cheap — if anyone alters the
 *      encrypted ai_messages content, the hash here will no longer
 *      match a re-hash of the decrypted plaintext.
 *   3. Hashes can be queried/grouped without ever decrypting (e.g. "how
 *      many identical add_scope_item calls did Charlie attempt today").
 */

import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";

export type ToolAuditStatus = "ok" | "error" | "denied" | "rate_limited";

export type RecordToolAuditInput = {
  organizationId: string;
  userId: string | null;
  conversationId: string | null;
  messageId?: string | null;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ToolAuditStatus;
  durationMs: number;
};

function sha256Hex(value: unknown): string {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Fire-and-forget audit insert. Caller does NOT await the underlying
 * promise — we don't want a slow audit insert to delay the chat
 * response. We still surface unexpected failures to the console so
 * silent breakage is loud, but the chat path continues regardless.
 */
export function recordToolAudit(input: RecordToolAuditInput): void {
  const sql = getSql();
  const inputHash = sha256Hex(input.input);
  const outputHash = sha256Hex(input.output);
  void sql`
    INSERT INTO ai_tool_audit (
      organization_id, user_id, conversation_id, message_id,
      tool_name, input_sha256, output_sha256, status, duration_ms
    ) VALUES (
      ${input.organizationId}::uuid,
      ${input.userId},
      ${input.conversationId},
      ${input.messageId ?? null},
      ${input.toolName},
      ${inputHash},
      ${outputHash},
      ${input.status},
      ${input.durationMs}
    )
  `.catch((err: unknown) => {
    console.warn("[ai-audit] insert failed", err);
  });
}
