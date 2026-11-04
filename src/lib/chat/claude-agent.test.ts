import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { describe, expect, it, vi } from "vitest";

import { createPortfolio } from "@/lib/portfolio";
import { createFakeMarket } from "@/test/fake-market";
import { runClaudeChat, toApiMessages, type ClaudeClient } from "./claude-agent";
import { handleChat } from "./handle-chat";
import { createToolbox } from "./tools";

/**
 * These tests never call the real Anthropic API. A scripted fake client
 * returns canned responses so we can check the agent loop end to end:
 * tool calls are executed with real (fake-market) data and fed back.
 */

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

function message(content: Block[], stop_reason: string): BetaMessage {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  } as unknown as BetaMessage;
}

function scriptedClient(responses: BetaMessage[]) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const create = vi.fn(async (params: MessageCreateParamsNonStreaming) => {
    // Snapshot: the loop mutates its messages array after each call.
    calls.push(structuredClone(params));
    const next = responses.shift();
    if (!next) throw new Error("No more scripted responses");
    return next;
  });
  const client: ClaudeClient = { beta: { messages: { create } } };
  return { client, calls, create };
}

const market = createFakeMarket({ TSLA: 250, NVDA: 100 });

describe("runClaudeChat", () => {
  it("runs the tool loop: quote → buy → final answer", async () => {
    const { client, calls } = scriptedClient([
      message([{ type: "tool_use", id: "t1", name: "get_quote", input: { symbol: "TSLA" } }], "tool_use"),
      message([{ type: "tool_use", id: "t2", name: "buy", input: { symbol: "TSLA", shares: 10 } }], "tool_use"),
      message([{ type: "text", text: "Bought 10 TSLA at $250.00." }], "end_turn"),
    ]);
    const toolbox = createToolbox(market, createPortfolio());

    const result = await runClaudeChat({
      client,
      model: "claude-opus-5-5",
      history: [{ role: "user", content: "buy 10 shares of TSLA" }],
      toolbox,
    });

    expect(result.reply).toBe("Bought 10 TSLA at $250.00.");
    expect(toolbox.trades).toHaveLength(1);
    expect(toolbox.trades[0]).toMatchObject({ symbol: "TSLA", shares: 10, price: 250, source: "chat" });

    // First request: model, tools (strict), system prompt, opus-only options.
    expect(calls[0].model).toBe("claude-opus-5-5");
    expect(calls[0].tools?.map((t) => ("name" in t ? t.name : ""))).toEqual([
      "get_quote",
      "get_history",
      "compare",
      "buy",
      "sell",
      "get_portfolio",
    ]);
    expect(calls[0].tools?.every((t) => "strict" in t && t.strict === true)).toBe(true);
    expect(calls[0].fallbacks).toBe("default");
    expect(calls[0].output_config?.effort).toBe("medium");

    // Second request carries the real tool result (price from the market layer, not the model).
    const toolResultTurn = calls[1].messages[calls[1].messages.length - 1];
    expect(toolResultTurn.role).toBe("user");
    const block = (toolResultTurn.content as { type: string; tool_use_id: string; content: string }[])[0];
    expect(block).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
    expect(JSON.parse(block.content)).toMatchObject({ symbol: "TSLA", price: 250 });
  });

  it("sends tool errors back as is_error results", async () => {
    const { client, calls } = scriptedClient([
      message([{ type: "tool_use", id: "t1", name: "sell", input: { symbol: "NVDA", shares: 5 } }], "tool_use"),
      message([{ type: "text", text: "You don't own any NVDA." }], "end_turn"),
    ]);
    const toolbox = createToolbox(market, createPortfolio());
    await runClaudeChat({ client, model: "claude-opus-5-5", history: [{ role: "user", content: "sell 5 NVDA" }], toolbox });
    const last = calls[1].messages[calls[1].messages.length - 1];
    expect((last.content as { is_error?: boolean }[])[0].is_error).toBe(true);
    expect(toolbox.trades).toHaveLength(0);
  });

  it("returns all parallel tool results in a single user message", async () => {
    const { client, calls } = scriptedClient([
      message(
        [
          { type: "tool_use", id: "a", name: "get_quote", input: { symbol: "TSLA" } },
          { type: "tool_use", id: "b", name: "get_quote", input: { symbol: "NVDA" } },
        ],
        "tool_use",
      ),
      message([{ type: "text", text: "Both fetched." }], "end_turn"),
    ]);
    await runClaudeChat({ client, model: "claude-opus-5-5", history: [{ role: "user", content: "TSLA and NVDA?" }], toolbox: createToolbox(market, createPortfolio()) });
    const last = calls[1].messages[calls[1].messages.length - 1];
    expect((last.content as unknown[]).length).toBe(2);
  });

  it("handles refusals without running tools", async () => {
    const { client } = scriptedClient([message([], "refusal")]);
    const toolbox = createToolbox(market, createPortfolio());
    const r = await runClaudeChat({ client, model: "claude-opus-5-5", history: [{ role: "user", content: "x" }], toolbox });
    expect(r.stopReason).toBe("refusal");
    expect(toolbox.trades).toHaveLength(0);
  });

  it("stops after a bounded number of tool rounds", async () => {
    const loop = Array.from({ length: 20 }, (_, i) =>
      message([{ type: "tool_use", id: `t${i}`, name: "get_quote", input: { symbol: "TSLA" } }], "tool_use"),
    );
    const { client, create } = scriptedClient(loop);
    const r = await runClaudeChat({ client, model: "claude-opus-5-5", history: [{ role: "user", content: "loop" }], toolbox: createToolbox(market, createPortfolio()) });
    expect(r.stopReason).toBe("max_rounds");
    expect(create).toHaveBeenCalledTimes(8);
  });

  it("omits Opus-only options for a custom model", async () => {
    const { client, calls } = scriptedClient([message([{ type: "text", text: "hi" }], "end_turn")]);
    await runClaudeChat({ client, model: "claude-haiku-4-5", history: [{ role: "user", content: "hi" }], toolbox: createToolbox(market, createPortfolio()) });
    expect(calls[0].fallbacks).toBeUndefined();
    expect(calls[0].output_config).toBeUndefined();
  });
});

describe("toApiMessages", () => {
  it("drops leading assistant turns (the API requires a user turn first)", () => {
    expect(
      toApiMessages([
        { role: "assistant", content: "Hi, I'm Jarvis" },
        { role: "user", content: "price of TSLA" },
      ]),
    ).toEqual([{ role: "user", content: "price of TSLA" }]);
  });
});

describe("handleChat", () => {
  it("uses basic mode when no key is configured", async () => {
    const r = await handleChat([{ role: "user", content: "price of TSLA" }], createPortfolio(), { provider: market, claude: null });
    expect(r.mode).toBe("basic");
    expect(r.reply).toContain("$250.00");
  });

  it("uses Claude when configured", async () => {
    const { client } = scriptedClient([message([{ type: "text", text: "Hello from Claude" }], "end_turn")]);
    const r = await handleChat([{ role: "user", content: "hi" }], createPortfolio(), {
      provider: market,
      claude: { client, model: "claude-opus-5-5" },
    });
    expect(r).toMatchObject({ mode: "ai", reply: "Hello from Claude" });
  });

  it("falls back to basic mode with a notice if the Claude call fails", async () => {
    const client: ClaudeClient = {
      beta: {
        messages: {
          create: async () => {
            throw new Anthropic.APIConnectionError({ message: "offline" });
          },
        },
      },
    };
    const r = await handleChat([{ role: "user", content: "price of NVDA" }], createPortfolio(), {
      provider: market,
      claude: { client, model: "claude-opus-5-5" },
    });
    expect(r.mode).toBe("basic");
    expect(r.notice).toMatch(/Couldn't reach the AI service/);
    expect(r.reply).toContain("$100.00");
  });
});
