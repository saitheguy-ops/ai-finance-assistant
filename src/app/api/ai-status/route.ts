import { isAiEnabled } from "@/lib/server/ai-config";

/** Reports whether Claude mode is on. Returns a boolean only, never the key. */
export async function GET() {
  return Response.json({ enabled: isAiEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
