import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import {
  appendMessage,
  listMessages,
  toAnthropicMessages,
} from "@/lib/ai/conversations";
import {
  executeOfficerTool,
  officerTools,
  type ToolContext,
} from "@/lib/ai/tools";

const MAX_TOOL_ITERATIONS = 5;

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
        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          const priorRows = await listMessages(input.conversationId, 50);
          const priorMessages = toAnthropicMessages(priorRows);

          const turn = await runOneTurn({
            priorMessages,
            systemText: input.systemPrompt,
            contextText: input.contextBlock,
            send,
          });

          if (turn.assistantBlocks.length > 0) {
            await appendMessage({
              conversationId: input.conversationId,
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

          // Execute each tool defensively. A throw from any single tool must
          // NOT leave the conversation poisoned — Anthropic requires every
          // assistant tool_use to be paired with a tool_result in the very
          // next message. We build a result block for every tool_use up front
          // (synthetic error if anything throws) and ALWAYS persist the
          // tool-role message in a finally so even an outer crash leaves the
          // history valid.
          const toolResults: ToolResultBlock[] = [];
          let toolLoopError: unknown = null;
          try {
            for (const block of toolUses) {
              send("tool_start", {
                id: block.id,
                name: block.name,
                input: block.input,
              });
              const toolInput = (block.input ?? {}) as Record<string, unknown>;
              let result: { ok: boolean; [k: string]: unknown };
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
              send("tool_end", { id: block.id, ok: result.ok });
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
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
    const { priorMessages, systemText, contextText, send } = args;

    const anthropicStream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 700,
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
