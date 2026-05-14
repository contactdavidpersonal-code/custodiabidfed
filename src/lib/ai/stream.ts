import { CHAT_MODEL, getAnthropic, metadataForOrg } from "@/lib/anthropic";
import {
  appendMessage,
  listMessages,
  toAnthropicMessages,
} from "@/lib/ai/conversations";
import { recordToolAudit } from "@/lib/ai/audit";
import { scrubHighRiskEgress } from "@/lib/security/charlie-redaction";
import {
  executeOfficerTool,
  officerTools,
  type ToolContext,
} from "@/lib/ai/tools";

// 10 iterations gives legitimate multi-step workflows (e.g. "generate
// the first four evidence artifacts now") enough headroom while still
// capping runaway loops. The earlier value of 5 was right at the edge
// for 4 serial generate_evidence_artifact calls + a closing summary
// and caused the chat to silently stall when the user said "yes" to a
// batched generate.
const MAX_TOOL_ITERATIONS = 10;

// Tools that represent real per-call progress (each invocation produces
// a distinct artifact, response, or save) and therefore should NOT be
// counted as "tool-only loop" turns even when emitted back-to-back with
// no text reply. The circuit breaker still fires on actual loops — it
// just no longer punishes legitimate bulk work like generating four
// evidence files for one practice in a row.
const BULK_PROGRESS_TOOLS = new Set([
  "generate_evidence_artifact",
  "set_objective_response",
  "save_control_narrative",
]);

// Pre-announce stall detector. Failure mode: user says "yes, generate them",
// Claude replies with a short text like "Generating all three now." with NO
// tool_use blocks, stop_reason="end_turn" — the agent loop exits and the
// user's request is silently dropped. Prompt-engineering this away in the
// tool description ("NO PRE-ANNOUNCING…") helps but does not eliminate it:
// the model still defects occasionally. The architecturally-correct rail
// per Anthropic's tool_use docs is `tool_choice: {type: "any"}` on retry —
// the API then prefills the assistant turn so Claude MUST emit tool_use
// blocks and cannot emit a leading text explanation. We detect the stall,
// drop the stalled assistant message (do not persist — it would create an
// invalid two-assistant-in-a-row history), and re-run the SAME turn once
// with forced tool_choice. One retry per user message.
//
// Heuristic: text-only completion (no tool_use), short body (≤ 60 words),
// containing at least one action-promise verb. Conservative on purpose —
// we'd rather miss a stall than retry-loop on a legitimate informational
// reply.
const PREANNOUNCE_VERB_RX =
  /\b(?:generat\w*|draft\w*|creat\w*|build\w*|produc\w*|prepar\w*|writ\w*|render\w*|attach\w*|sav\w*|fetch\w*|pull\w*|kick\w*\s*off|spin\w*\s*up|put\s+together|whip\s+up|on\s+it|i'?ll|let\s+me|going\s+to|hang\s+on|one\s+moment|will\s+do|here\s+goes|coming\s+up|hold\s+on|stand\s+by)\b/i;

function looksLikePreAnnounceStall(blocks: AssistantBlock[]): boolean {
  const toolUses = blocks.filter((b) => b.type === "tool_use");
  if (toolUses.length > 0) return false;
  const text = blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  if (!text) return false;
  // No word-count ceiling: "Hang tight while I assemble all four — starting
  // with the user roster, then devices, then service accounts…" is still a
  // pre-announce, even at 80 words. The signal is verb + zero tool_use.
  return PREANNOUNCE_VERB_RX.test(text);
}

// Confirmation patterns the user types to authorize an offered action.
// Kept tight on purpose — we only want to force tool_use when the user is
// CLEARLY saying "do it". A bare "yes" or "go ahead" mid-conversation can
// also legitimately just be confirming something informational, so we also
// require the previous assistant turn to contain an explicit offer.
const CONFIRMATION_RX =
  /^(?:yes|yeah|yep|yup|y|sure|ok|okay|please|please\s+do|do\s+it|do\s+them|do\s+all|do\s+all\s+of\s+them|go|go\s+ahead|go\s+for\s+it|let'?s\s+go|let'?s\s+do\s+it|sounds\s+good|sounds?\s+great|generate|generate\s+them|generate\s+all|draft\s+them|create\s+them|build\s+them|make\s+them|run\s+it|fire\s+away|all\s+four|all\s+three|all\s+five|all\s+of\s+them)\W*$/i;

const OFFER_RX =
  /\b(?:want\s+me\s+to|should\s+i|shall\s+i|ready\s+for\s+me\s+to|ok(?:ay)?\s+(?:for\s+me\s+)?to|can\s+i\s+(?:go\s+ahead|generate|draft|create|build)|i\s+can\s+(?:generate|draft|create|build)|generate\s+(?:all|the)\s+\w+\s+now|right\s+now\?|now\?)/i;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text?: string } =>
        typeof b === "object" && b !== null && (b as { type?: unknown }).type === "text",
      )
      .map((b) => b.text ?? "")
      .join(" ");
  }
  return "";
}

/**
 * Pre-flight decision: should we force tool_choice on the FIRST turn,
 * before the model has a chance to defect into pre-announce text?
 *
 * Triggers when the user's latest message is a short confirmation AND the
 * previous assistant message contained an offer to perform an action. This
 * catches the canonical broken flow:
 *   Charlie: "Want me to generate all four now?"
 *   User:    "yes"
 *   Charlie: "Generating all four now."   ← stall, no tools fired
 * Without depending on a post-hoc retry, this saves the model round-trip
 * and the user's tokens.
 */
function shouldForceToolUseOnFirstTurn(
  priorMessages: Array<{ role: "user" | "assistant"; content: unknown }>,
): boolean {
  if (priorMessages.length < 2) return false;
  const last = priorMessages[priorMessages.length - 1];
  if (last.role !== "user") return false;
  const lastText = extractText(last.content).trim();
  if (!lastText || lastText.length > 60) return false;
  if (!CONFIRMATION_RX.test(lastText)) return false;
  // Walk back to the most recent assistant text and look for an offer.
  for (let i = priorMessages.length - 2; i >= 0; i--) {
    const m = priorMessages[i];
    if (m.role !== "assistant") continue;
    const text = extractText(m.content);
    if (!text.trim()) continue;
    return OFFER_RX.test(text);
  }
  return false;
}

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type AssistantBlock = TextBlock | ToolUseBlock;

export type StreamAgentInput = {
  conversationId: string;
  systemPrompt: string;
  contextBlock: string;
  toolContext: ToolContext;
};

/**
 * Returns a ReadableStream of Server-Sent Events for the agentic officer
 * loop. Shared by /api/chat (workspace officer) and /api/onboard (onboarding
 * officer). Both differ only by systemPrompt, contextBlock, and which
 * conversation_id they use; the mechanics are identical.
 *
 * Event protocol:
 *   event: delta           { text }
 *   event: tool_start      { id, name, input }
 *   event: tool_end        { id, ok }
 *   event: done            {}
 *   event: error           { message }
 */
export function runOfficerAgentStream(
  input: StreamAgentInput,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const client = getAnthropic();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // Per-USER-MESSAGE state that accumulates across all agent
        // iterations within one runOfficerAgentStream invocation.
        //
        // ADD_HARD_CAP_PER_MESSAGE — abuse ceiling, not a workflow rail.
        //   A legit user who pastes "add my laptop, my phone, my printer,
        //   our office printer, our NAS, the receptionist's iPad" deserves
        //   to have all of those added in one turn. We only block runaway
        //   model loops. 8 is well above any realistic single-message ask.
        //
        // CONSECUTIVE_TOOL_ONLY_TURNS — circuit breaker. If the model
        //   keeps emitting tool_use blocks WITHOUT any text reply across
        //   N iterations in a row, force-break with a synthetic error
        //   telling it to respond to the user. This is what stops the
        //   "5 cards from one 'what's next?'" failure mode without
        //   forbidding legit multi-add turns.
        const ADD_TOOLS = new Set([
          "add_scope_item",
          "add_esp",
          "add_specialized_asset",
        ]);
        const ADD_HARD_CAP_PER_MESSAGE = 8;
        const MAX_CONSECUTIVE_TOOL_ONLY_TURNS = 2;
        let addCallsThisMessage = 0;
        let consecutiveToolOnlyTurns = 0;
        const seenAddKeysThisMessage = new Set<string>();
        // One forced-tool retry per user message: if Claude pre-announces
        // ("Generating now…") with no tool_use, we re-run the SAME turn
        // with tool_choice="any" so the API prefills assistant content to
        // tool_use blocks. After one retry we stop trying — if the model
        // still won't use a tool, persist the text and let the user nudge.
        let preAnnounceRetried = false;
        let forceToolChoice:
          | { type: "any" }
          | { type: "tool"; name: string }
          | undefined = undefined;

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          const priorRows = await listMessages(input.conversationId, 50);
          const priorMessages = toAnthropicMessages(priorRows);

          // Pre-flight: on the FIRST iteration only, force tool_choice when
          // the user is clearly confirming a recent offer. Saves one round
          // trip vs. waiting for the post-hoc detector to catch a stall.
          if (
            i === 0 &&
            !preAnnounceRetried &&
            shouldForceToolUseOnFirstTurn(priorMessages)
          ) {
            preAnnounceRetried = true;
            forceToolChoice = { type: "any" };
            console.warn(
              "[charlie] pre-flight forcing tool_choice=any on confirmation",
              { conversationId: input.conversationId },
            );
          }

          const turn = await runOneTurn({
            priorMessages,
            systemText: input.systemPrompt,
            contextText: input.contextBlock,
            send,
            toolChoice: forceToolChoice,
          });
          // tool_choice is per-turn; reset before persistence so it can't
          // leak into the next iteration.
          forceToolChoice = undefined;

          // Pre-announce stall: text-only completion that promises an
          // action. Drop the stalled message (do NOT persist — Anthropic
          // rejects two assistant rows in a row) and re-enter the loop
          // with tool_choice="any" forcing the model into tool_use.
          if (
            !preAnnounceRetried &&
            turn.stopReason !== "tool_use" &&
            looksLikePreAnnounceStall(turn.assistantBlocks)
          ) {
            preAnnounceRetried = true;
            forceToolChoice = { type: "any" };
            console.warn(
              "[charlie] post-hoc pre-announce stall detected, retrying with tool_choice=any",
              {
                conversationId: input.conversationId,
                stopReason: turn.stopReason,
                textSample: turn.assistantBlocks
                  .filter((b): b is TextBlock => b.type === "text")
                  .map((b) => b.text)
                  .join(" ")
                  .slice(0, 200),
              },
            );
            continue;
          }

          if (turn.assistantBlocks.length > 0) {
            await appendMessage({
              conversationId: input.conversationId,
              organizationId: input.toolContext.organizationId,
              role: "assistant",
              content: turn.assistantBlocks,
              inputTokens: turn.usage.inputTokens,
              outputTokens: turn.usage.outputTokens,
              cacheReadTokens: turn.usage.cacheReadTokens,
              cacheCreationTokens: turn.usage.cacheCreationTokens,
              model: CHAT_MODEL,
              stopReason: turn.stopReason ?? undefined,
            });
          }

          const toolUses = turn.assistantBlocks.filter(
            (b): b is ToolUseBlock => b.type === "tool_use",
          );
          if (turn.stopReason !== "tool_use" || toolUses.length === 0) {
            break;
          }

          // Circuit breaker: track turns where the model only emitted tool
          // calls (no text reply to the user). 2+ in a row = the model is
          // looping. Force-break by injecting a synthetic instruction as
          // the tool results and letting the next iteration produce text.
          //
          // Exception: a turn made up entirely of BULK_PROGRESS_TOOLS
          // (e.g. generating evidence artifacts one after another) does
          // NOT increment the counter, because each call produces real
          // distinct progress and is not a loop. This is what fixes the
          // "chat got stuck on a loop when I wanted to make the evidence
          // artifacts with Charlie" failure mode.
          const emittedText = turn.assistantBlocks.some(
            (b) => b.type === "text" && b.text.trim().length > 0,
          );
          const allBulkProgress =
            toolUses.length > 0 &&
            toolUses.every((b) => BULK_PROGRESS_TOOLS.has(b.name));
          if (!emittedText && !allBulkProgress) {
            consecutiveToolOnlyTurns++;
          } else {
            consecutiveToolOnlyTurns = 0;
          }
          if (consecutiveToolOnlyTurns >= MAX_CONSECUTIVE_TOOL_ONLY_TURNS) {
            // Build error tool_results for every pending tool_use so the
            // pairing invariant holds, then persist the row and break.
            const forcedResults: ToolResultBlock[] = toolUses.map((b) => ({
              type: "tool_result",
              tool_use_id: b.id,
              content: JSON.stringify({
                ok: false,
                error: "tool_only_loop_break",
                message:
                  "You have emitted multiple consecutive turns of tool calls without any text reply to the user. This is a loop. Do NOT call any more tools. Reply to the user with text now — summarize what you've done, what state the workspace is in, and ask a focused next question.",
              }),
              is_error: true,
            }));
            // Emit synthetic tool_end events so the UI removes spinners.
            for (const b of toolUses) {
              send("tool_end", { id: b.id, ok: false });
            }
            await appendMessage({
              conversationId: input.conversationId,
              organizationId: input.toolContext.organizationId,
              role: "tool",
              content: forcedResults,
            });
            // Let the next iteration produce a text reply, then it will
            // hit the no-tool-use branch and break naturally.
            continue;
          }

          // Execute each tool defensively. A throw from any single tool must
          // NOT leave the conversation poisoned — Anthropic requires every
          // assistant tool_use to be paired with a tool_result in the very
          // next message. We build a result block for every tool_use up front
          // (synthetic error if anything throws) and ALWAYS persist the
          // tool-role message in a finally so even an outer crash leaves the
          // history valid.
          const toolResults: ToolResultBlock[] = [];
          let toolLoopError: unknown = null;
          // Hard invariant: scope inventory is an attested compliance
          // artifact. Charlie must read state + confirm with the user
          // before each add. Cap at ONE add per USER MESSAGE (across all
          // agent iterations) — anything beyond is short-circuited with a
          // synthetic error so the model is forced to respond to the user
          // before adding another row. Server-side dedup keeps the DB
          // clean even if this rail ever leaks.
          try {
            for (const block of toolUses) {
              const toolInput = (block.input ?? {}) as Record<string, unknown>;
              const isAdd = ADD_TOOLS.has(block.name);
              // Dedupe identical add calls within this message (same
              // kind+label / name / asset_type+label). Even before the
              // 1-per-message cap fires, collapse exact duplicates.
              let addKey: string | null = null;
              if (isAdd) {
                if (block.name === "add_scope_item") {
                  const k = String(toolInput.kind ?? "").toLowerCase();
                  const l = String(toolInput.label ?? "").trim().toLowerCase();
                  addKey = `scope:${k}:${l}`;
                } else if (block.name === "add_esp") {
                  const n = String(toolInput.name ?? "").trim().toLowerCase();
                  addKey = `esp:${n}`;
                } else if (block.name === "add_specialized_asset") {
                  const t = String(toolInput.asset_type ?? "").toLowerCase();
                  const l = String(toolInput.label ?? "").trim().toLowerCase();
                  addKey = `asset:${t}:${l}`;
                }
              }

              if (isAdd && addKey && seenAddKeysThisMessage.has(addKey)) {
                // Don't even emit tool_start — keeps the UI clean.
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({
                    ok: false,
                    error: "duplicate_add_in_turn",
                    message:
                      "You already emitted an identical add call earlier in this same response. The duplicate was rejected. Do not retry — wait for the user's next message before adding anything else.",
                  }),
                  is_error: true,
                });
                continue;
              }
              if (isAdd && addCallsThisMessage >= ADD_HARD_CAP_PER_MESSAGE) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({
                    ok: false,
                    error: "add_hard_cap_per_message",
                    message: `You have already made ${ADD_HARD_CAP_PER_MESSAGE} add-style calls in your response to this single user message — that is the hard abuse ceiling. Stop calling tools now. Reply to the user with a summary of what was added and ask if they have more items to add.`,
                  }),
                  is_error: true,
                });
                continue;
              }

              send("tool_start", {
                id: block.id,
                name: block.name,
                input: block.input,
              });
              let result: { ok: boolean; [k: string]: unknown };
              const toolStartedAt = Date.now();
              try {
                result = await executeOfficerTool(
                  block.name,
                  toolInput,
                  input.toolContext,
                );
              } catch (toolErr) {
                const msg =
                  toolErr instanceof Error ? toolErr.message : String(toolErr);
                result = { ok: false, error: "tool_threw", message: msg };
              }
              // Tamper-evident audit row — hashes only; payloads live
              // encrypted on the matching ai_messages row.
              recordToolAudit({
                organizationId: input.toolContext.organizationId,
                userId: input.toolContext.userId,
                conversationId: input.toolContext.conversationId,
                toolName: block.name,
                input: toolInput,
                output: result,
                status: result.ok ? "ok" : "error",
                durationMs: Date.now() - toolStartedAt,
              });
              if (isAdd) {
                addCallsThisMessage++;
                if (addKey) seenAddKeysThisMessage.add(addKey);
              }
              send("tool_end", { id: block.id, ok: result.ok });
              // Tier 1.5: navigate_user_to (and any other tool) may include a
              // `navigate` field in its data payload — surface it as a
              // dedicated SSE event so the client can router.push() in
              // response. Server-side allow-list already enforced inside
              // the handler; we still validate it starts with '/' here as
              // a defense-in-depth check.
              if (result.ok && result.data && typeof result.data === "object") {
                const nav = (result.data as { navigate?: unknown }).navigate;
                if (typeof nav === "string" && nav.startsWith("/") && !nav.includes("://")) {
                  send("navigate", { path: nav });
                }
              }
              // Scrub high-risk identifiers from the tool result before
              // it is sent BACK to Anthropic in the next iteration. The
              // real (unscrubbed) value is still persisted encrypted on
              // ai_messages — only the wire payload to the model is
              // redacted, so Charlie cannot accidentally echo an SSN/CC/EIN.
              const resultJson = scrubHighRiskEgress(JSON.stringify(result));
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: resultJson,
                is_error: !result.ok,
              });
            }
          } catch (loopErr) {
            // Anything thrown outside an individual tool — fill remaining
            // tool_uses with synthetic errors so pairing stays intact.
            toolLoopError = loopErr;
            const covered = new Set(toolResults.map((r) => r.tool_use_id));
            for (const block of toolUses) {
              if (covered.has(block.id)) continue;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  ok: false,
                  error: "tool_loop_aborted",
                  message: "Tool execution was interrupted before completing.",
                }),
                is_error: true,
              });
            }
          } finally {
            if (toolResults.length > 0) {
              try {
                await appendMessage({
                  conversationId: input.conversationId,
                  organizationId: input.toolContext.organizationId,
                  role: "tool",
                  content: toolResults,
                });
              } catch (persistErr) {
                // Surface but don't swallow — if we can't persist, the
                // next turn will at least be healed by toAnthropicMessages.
                send("error", {
                  message:
                    persistErr instanceof Error
                      ? persistErr.message
                      : String(persistErr),
                });
              }
            }
          }
          if (toolLoopError) throw toolLoopError;
        }

        send("done", {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  async function runOneTurn(args: {
    priorMessages: Array<{ role: "user" | "assistant"; content: unknown }>;
    systemText: string;
    contextText: string;
    send: (event: string, data: unknown) => void;
    toolChoice?:
      | { type: "auto" }
      | { type: "any" }
      | { type: "tool"; name: string };
  }): Promise<{
    assistantBlocks: AssistantBlock[];
    stopReason: string | null;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
    };
  }> {
    const { priorMessages, systemText, contextText, send, toolChoice } = args;

    const anthropicStream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 700,
      // Opaque per-tenant user id for Anthropic abuse signals. SHA-256
      // hex of (org, user, salt) — never leaks our tenant graph.
      metadata: metadataForOrg(
        input.toolContext.organizationId,
        input.toolContext.userId,
      ),
      // Tools and system prompt are stable across every turn for an org.
      // Marking the LAST tool with `cache_control: ephemeral` tells Anthropic
      // to cache the full tools array (~2K tokens). Marking the system
      // prompt block with `cache_control: ephemeral` caches the ~3K-token
      // officer persona. Cache reads cost ~10% of normal input — measured in
      // `usage.cache_read_input_tokens` and persisted via appendMessage so
      // we can track hit rate. Anthropic 5-min ephemeral TTL is enough to
      // span a typical chat session.
      tools: officerTools.map((t, i) =>
        i === officerTools.length - 1
          ? { ...t, cache_control: { type: "ephemeral" as const } }
          : t,
      ),
      // tool_choice is per-turn. Default ("auto") is implied when omitted;
      // we only pass it explicitly on a pre-announce retry. Note: changing
      // tool_choice between turns invalidates the message-block cache but
      // leaves the tools/system cache intact — acceptable for the rare
      // retry path.
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" as const },
        },
        // contextText is per-request (page route, profile snapshot, memory) —
        // do NOT cache it; it would just churn cache slots.
        { type: "text", text: contextText },
      ],
      messages: priorMessages as Parameters<typeof client.messages.stream>[0]["messages"],
    });

    let stopReason: string | null = null;
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };

    for await (const event of anthropicStream) {
      if (event.type === "message_start") {
        const u = event.message.usage;
        usage.inputTokens = u?.input_tokens ?? 0;
        usage.cacheReadTokens = u?.cache_read_input_tokens ?? 0;
        usage.cacheCreationTokens = u?.cache_creation_input_tokens ?? 0;
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        send("delta", { text: event.delta.text });
      } else if (event.type === "message_delta") {
        if (event.usage) {
          usage.outputTokens = event.usage.output_tokens ?? usage.outputTokens;
        }
        if (event.delta.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
      }
    }

    const finalMessage = await anthropicStream.finalMessage();
    const assistantBlocks: AssistantBlock[] = [];
    for (const b of finalMessage.content) {
      if (b.type === "text") {
        assistantBlocks.push({ type: "text", text: b.text });
      } else if (b.type === "tool_use") {
        assistantBlocks.push({
          type: "tool_use",
          id: b.id,
          name: b.name,
          input: b.input,
        });
      }
    }

    return {
      assistantBlocks,
      stopReason: stopReason ?? finalMessage.stop_reason ?? null,
      usage,
    };
  }
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
};
