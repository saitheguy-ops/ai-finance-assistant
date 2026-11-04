import Anthropic from "@anthropic-ai/sdk";

import type { MarketDataProvider } from "@/lib/market/provider";
import type { Portfolio } from "@/lib/portfolio";
import { runBasicChat } from "./basic-agent";
import { runClaudeChat, type ClaudeClient } from "./claude-agent";
import { createToolbox } from "./tools";
import type { ChatResponseBody, ChatTurn } from "./types";

export interface ChatDeps {
  provider: MarketDataProvider;
  /** null when no API key is configured → basic mode. */
  claude: { client: ClaudeClient; model: string } | null;
}

/**
 * Chooses the chat mode and runs it. If Claude is configured but the call
 * fails (bad key, rate limit, outage), we answer with the built-in parser
 * instead and say so, so the chat never just breaks.
 */
export async function handleChat(history: ChatTurn[], portfolio: Portfolio, deps: ChatDeps): Promise<ChatResponseBody> {
  const latest = history[history.length - 1]?.content ?? "";

  if (deps.claude) {
    const toolbox = createToolbox(deps.provider, portfolio);
    try {
      const { reply } = await runClaudeChat({ ...deps.claude, history, toolbox });
      return { mode: "ai", reply, widgets: toolbox.widgets, trades: toolbox.trades };
    } catch (err) {
      const notice = describeClaudeError(err);
      console.error("[chat] Claude request failed, falling back to basic mode:", err);
      // Trades made before the failure were real (paper) actions the user asked
      // for, so keep them; start a fresh toolbox from the updated portfolio.
      const fallback = createToolbox(deps.provider, toolbox.portfolio);
      const reply = await runBasicChat(latest, fallback);
      return {
        mode: "basic",
        reply,
        widgets: [...toolbox.widgets, ...fallback.widgets],
        trades: [...toolbox.trades, ...fallback.trades],
        notice,
      };
    }
  }

  const toolbox = createToolbox(deps.provider, portfolio);
  const reply = await runBasicChat(latest, toolbox);
  return { mode: "basic", reply, widgets: toolbox.widgets, trades: toolbox.trades };
}

function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return "AI mode couldn't authenticate (check ANTHROPIC_API_KEY). Answered with built-in commands.";
  }
  if (err instanceof Anthropic.RateLimitError) return "AI mode is rate-limited right now. Answered with built-in commands.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Answered with built-in commands.";
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status ?? "unknown"}). Answered with built-in commands.`;
  return "AI mode hit an unexpected error. Answered with built-in commands.";
}
