/**
 * Minimal fetch-based provider clients for BYOK text generation
 * (shared-ai-byok task 4.2). No SDK dependency — one text-completion call per
 * provider, returning the plain text so the existing Workers-AI parsing
 * contract (parseModelJson / parseScoreResponse) is preserved downstream.
 *
 * `cloudflare` is intentionally NOT callable here: there is no customer
 * Cloudflare-AI binding for the engine to call, so a BYOK key for `cloudflare`
 * falls back to the pool `env.AI` path rather than routing out.
 *
 * SECURITY (design review point #2): `apiKey` is used ONLY to construct the
 * outbound Authorization / x-api-key header in-scope. It is NEVER logged,
 * returned in a response, or placed on any payload — including in the thrown
 * error messages below (status code only).
 */

/** Anthropic Messages API version pin (see shared/live-sources.md). */
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Per-provider fallback model when the org's stored key has no
 * `model_default`. Anthropic tracks the repo's canonical Claude model
 * (CLAUDE.md); OpenAI uses a cheap general default. These only apply when
 * `model` is null — a configured `model_default` always wins.
 */
export function defaultByokModel(provider: string): string {
  if (provider === "anthropic") return "claude-opus-4-8";
  if (provider === "openai") return "gpt-4o-mini";
  return "";
}

/** True only for providers this module can dispatch to (not `cloudflare`). */
export function isCallableByokProvider(provider: string): boolean {
  return provider === "anthropic" || provider === "openai";
}

export interface ByokCallArgs {
  provider: string;
  /** The org's `model_default`, or null → per-provider default is used. */
  model: string | null;
  apiKey: string;
  prompt: string;
  /** Output-token cap; mirrors the Workers-AI adapters' `max_tokens`. */
  maxTokens?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** Single text-generation call to the customer's provider; returns the text. */
export async function callByokModel(args: ByokCallArgs): Promise<string> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const model = args.model ?? defaultByokModel(args.provider);
  const maxTokens = args.maxTokens ?? 1024;
  if (args.provider === "anthropic") {
    return callAnthropic(args.apiKey, model, args.prompt, maxTokens, fetchImpl);
  }
  if (args.provider === "openai") {
    return callOpenAi(args.apiKey, model, args.prompt, maxTokens, fetchImpl);
  }
  // Unreachable via the adapters (they gate on isCallableByokProvider first).
  throw new Error(`unsupported BYOK provider: ${args.provider}`);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  fetchImpl: typeof fetch,
): Promise<string> {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic request failed: ${res.status}`);
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  // The Messages API returns content as a list of blocks; concatenate the text
  // blocks (the model's JSON output arrives as text).
  return (data.content ?? [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

async function callOpenAi(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  fetchImpl: typeof fetch,
): Promise<string> {
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openai request failed: ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}
