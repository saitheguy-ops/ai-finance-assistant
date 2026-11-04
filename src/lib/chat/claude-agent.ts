import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { TOOL_DEFINITIONS, type Toolbox } from "./tools";
import type { ChatTurn } from "./types";

/**
 * AI chat mode: Claude decides which tools to call, we run them, and we loop
 * until Claude writes a final answer. This is the standard "agentic loop":
 *
 *   user message → Claude → tool_use? → run tools → tool_result → Claude → … → text
 *
 * Claude never sees a price unless it came back from one of our tools, which
 * is how the assistant avoids inventing numbers.
 */

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

export const SYSTEM_PROMPT = `You are Jarvis, the assistant inside "AI Finance Assistant", a student's educational stock-research and paper-trading app.

How to answer:
- Every price, percentage, market cap or other number you state must come from a tool result in this conversation. Never use numbers from memory. If a tool fails, say so plainly instead of estimating.
- Use get_quote for current prices, get_history for performance over a period, compare for side-by-side questions, get_portfolio for anything about the user's holdings.
- The app renders charts and cards from your tool calls automatically, so keep your text short: 1-4 sentences or a few bullets. Use **bold** for tickers and key numbers sparingly.
- Mention the time range and that market data can be delayed when it matters.

Paper trading:
- buy and sell trade FAKE money in a paper portfolio. No real orders are ever placed.
- Only call buy or sell when the user explicitly asks to trade a specific quantity. If they give a dollar amount, call get_quote first and buy the whole number of shares that fits. If the quantity or ticker is unclear, ask instead of guessing.
- After a trade, confirm what was filled, at what price, and the remaining cash.

Boundaries:
- This is an educational tool, not financial advice. Don't tell the user what they should buy or sell or predict prices; you can explain what the data shows. Add a brief "not financial advice" note when someone asks for a recommendation.
- If a question has nothing to do with markets or the portfolio, briefly say what you can help with.`;

/** The subset of the Anthropic client this module uses; tests pass a fake. */
export interface ClaudeClient {
  beta: {
    messages: {
      create(params: MessageCreateParamsNonStreaming): PromiseLike<BetaMessage>;
    };
  };
}

export function createClaudeClient(apiKey: string): ClaudeClient {
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
}

/** Turns the browser's plain-text history into API messages (must start with a user turn). */
export function toApiMessages(history: ChatTurn[]): BetaMessageParam[] {
  const firstUser = history.findIndex((m) => m.role === "user");
  if (firstUser === -1) return [];
  return history.slice(firstUser).map((m) => ({ role: m.role, content: m.content }));
}

export interface ClaudeChatResult {
  reply: string;
  stopReason: string | null;
}

export async function runClaudeChat(options: {
  client: ClaudeClient;
  model: string;
  history: ChatTurn[];
  toolbox: Toolbox;
}): Promise<ClaudeChatResult> {
  const { client, model, toolbox } = options;
  const messages = toApiMessages(options.history);
  if (messages.length === 0) return { reply: "Ask me about a stock to get started.", stopReason: null };

  // Opus-specific request options. If someone points ANTHROPIC_MODEL at an
  // older model that doesn't support them, we leave them out.
  const isDefaultModel = model === DEFAULT_CLAUDE_MODEL;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // strict: true guarantees tool inputs match the JSON schema.
      tools: TOOL_DEFINITIONS.map((t) => ({ ...t, strict: true })),
      messages,
      ...(isDefaultModel
        ? {
            output_config: { effort: "medium" as const },
            // If a safety classifier declines, retry on a fallback model server-side.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }
        : {}),
    });

    if (response.stop_reason === "refusal") {
      return { reply: "I can't help with that one. Try asking about a stock price, performance, or your paper portfolio.", stopReason: "refusal" };
    }

    const toolUses = response.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
      if (response.stop_reason === "max_tokens" && toolUses.length > 0) {
        // A tool call cut off mid-way is unsafe to run.
        return { reply: text || "My answer got cut off. Could you ask that a bit more specifically?", stopReason: "max_tokens" };
      }
      return { reply: text || "Done.", stopReason: response.stop_reason };
    }

    // Keep the full assistant turn (including any thinking blocks) unchanged.
    messages.push({ role: "assistant", content: response.content });

    // Run every requested tool and send all results back in ONE user message.
    const results: BetaToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const outcome = await toolbox.run(call.name, call.input);
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(outcome.ok ? outcome.data : { error: outcome.error }),
        ...(outcome.ok ? {} : { is_error: true }),
      });
    }
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "That took more steps than I allow per question. Could you break it into smaller questions?",
    stopReason: "max_rounds",
  };
}
