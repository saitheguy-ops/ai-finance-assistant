import { z } from "zod";

import { createClaudeClient } from "@/lib/chat/claude-agent";
import { handleChat } from "@/lib/chat/handle-chat";
import { yahooProvider } from "@/lib/market/yahoo";
import { parsePortfolio } from "@/lib/portfolio";
import { getAnthropicApiKey, getAnthropicModel } from "@/lib/server/ai-config";
import { errorResponse } from "@/lib/server/http";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

// Claude may make several tool calls per question; give it time (Vercel Hobby allows up to 60s).
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(40),
  portfolio: z.unknown(),
});

/**
 * POST /api/chat
 * Body: { messages: [{role, content}], portfolio }
 * The portfolio comes from the browser's localStorage. The server simulates
 * any trades on a copy and returns them; the browser then applies them.
 */
export async function POST(request: Request) {
  const apiKey = getAnthropicApiKey();
  const limit = apiKey ? rateLimit(`ai:${clientIp(request)}`, 20, 10 * 60_000) : rateLimit(`basic:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) {
    const res = errorResponse("RATE_LIMITED", `Too many messages. Try again in ${limit.retryAfterSec}s.`, 429);
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("BAD_REQUEST", "Invalid chat request.", 400);
  const { messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return errorResponse("BAD_REQUEST", "The last message must be from the user.", 400);
  const portfolio = parsePortfolio(parsed.data.portfolio);
  if (!portfolio) return errorResponse("BAD_REQUEST", "Portfolio data is invalid.", 400);

  try {
    const result = await handleChat(messages.slice(-20), portfolio, {
      provider: yahooProvider,
      claude: apiKey ? { client: createClaudeClient(apiKey), model: getAnthropicModel() } : null,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[chat] unexpected error:", err);
    return errorResponse("INTERNAL", "Jarvis hit an unexpected error. Please try again.", 500);
  }
}
