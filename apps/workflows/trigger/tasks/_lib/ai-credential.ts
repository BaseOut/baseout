// AI credential fetch + chat-client routing (shared-ai-byok task 4.1).
//
// The chat-respond task runs on the Trigger.dev Node runner and CANNOT decrypt
// the stored `ai_provider_keys.key_enc` ciphertext itself — the master key never
// leaves the engine Worker. So at run start it fetches the org's routing
// decision + (for byok) the DECRYPTED plaintext key from the engine credential
// endpoint (task 3.3, /api/internal/orgs/:orgId/ai-credential), then builds the
// Anthropic client from that key + model.
//
// SECURITY:
//   - The plaintext apiKey lives ONLY in the fetched response + the in-process
//     client config handed to the Anthropic SDK. It is NEVER placed on the
//     Trigger.dev payload (which carries only organizationId) and NEVER logged.
//   - `fetchAiCredential` falls back to `{ mode: 'pool' }` on ANY error
//     (non-OK response, network failure, malformed body) so a BYOK hiccup can
//     never break chat — it degrades to the pool key instead.

/** The wire shape returned by the engine credential endpoint (task 3.3). */
export type AiCredential =
  | { mode: "pool" }
  | { mode: "byok"; provider: string; model: string | null; apiKey: string };

/** The resolved client inputs for one chat turn. */
export interface ChatClientConfig {
  apiKey: string;
  model: string;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Fetch the org's AI routing decision + (for byok) the decrypted key from the
 * engine over the INTERNAL_TOKEN-gated credential endpoint. Never throws:
 * anything other than a well-formed byok body resolves to `{ mode: 'pool' }`.
 */
export async function fetchAiCredential(
  fetchFn: typeof fetch,
  engineUrl: string,
  internalToken: string,
  organizationId: string,
): Promise<AiCredential> {
  const url = `${trimSlash(engineUrl)}/api/internal/orgs/${encodeURIComponent(
    organizationId,
  )}/ai-credential`;
  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: { "x-internal-token": internalToken },
    });
    if (!res.ok) return { mode: "pool" };
    const body = (await res.json()) as Partial<AiCredential> & {
      apiKey?: unknown;
      provider?: unknown;
      model?: unknown;
    };
    if (
      body &&
      body.mode === "byok" &&
      typeof body.apiKey === "string" &&
      body.apiKey.length > 0 &&
      typeof body.provider === "string"
    ) {
      return {
        mode: "byok",
        provider: body.provider,
        model: typeof body.model === "string" ? body.model : null,
        apiKey: body.apiKey,
      };
    }
    return { mode: "pool" };
  } catch {
    return { mode: "pool" };
  }
}

/**
 * Pure: pick the `{ apiKey, model }` for the chat client. The pool path is
 * identical to today (the env ANTHROPIC_API_KEY + CHAT_MODEL, supplied via
 * `pool`); byok uses the fetched key + its `model_default`, falling back to the
 * pool model when the org set no default.
 */
export function resolveChatClientConfig(
  credential: AiCredential,
  pool: ChatClientConfig,
): ChatClientConfig {
  if (credential.mode === "byok") {
    return { apiKey: credential.apiKey, model: credential.model ?? pool.model };
  }
  return { apiKey: pool.apiKey, model: pool.model };
}
