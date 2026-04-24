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

          const toolResults: ToolResultBlock[] = [];
          for (const block of toolUses) {
            send("tool_start", {
              id: block.id,
              name: block.name,
              input: block.input,
            });
            const toolInput = (block.input ?? {}) as Record<string, unknown>;
            const result = await executeOfficerTool(
              block.name,
              toolInput,
              input.toolContext,
            );
            send("tool_end", { id: block.id, ok: result.ok });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
              is_error: !result.ok,
            });
          }

          await appendMessage({
            conversationId: input.conversationId,
            role: "tool",
            content: toolResults,
          });
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
      max_tokens: 1024,
      tools: officerTools,
      system: [
        { type: "text", text: systemText },
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
