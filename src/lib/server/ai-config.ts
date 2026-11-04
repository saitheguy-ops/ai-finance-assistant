import "server-only";

/**
 * The ONLY place the Anthropic key is read. Because this module imports
 * "server-only", the build fails if any client component ever imports it,
 * so the key can't leak into the browser bundle.
 */
export const DEFAULT_MODEL = "claude-opus-5-5";

export function getAnthropicApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? key : null;
}

export function isAiEnabled(): boolean {
  return getAnthropicApiKey() !== null;
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}
