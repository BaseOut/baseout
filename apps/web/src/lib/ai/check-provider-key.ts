/**
 * Provider health-check for a BYOK key (shared-ai-byok task 6.1, design.md §
 * "Submit-time" validation). A cheap, per-provider validation call so a key is
 * only stored `active` after it authenticates against the provider.
 *
 *   anthropic  → GET /v1/models  (x-api-key + anthropic-version) — no token cost
 *   openai     → GET /v1/models  (Authorization: Bearer)
 *   cloudflare → treated as ok (no cheap validation endpoint; noted)
 *
 * SECURITY (design.md → Security review points #1/#2): the plaintext key is
 * sent ONLY in the request header — never in the URL, never logged. The
 * returned `error` is a status/short reason and NEVER carries key material.
 * Fails closed: any non-2xx or thrown request resolves to `{ ok: false }`.
 */

/** Minimal fetch shape — injectable so tests supply a fake at the boundary. */
export type FetchImpl = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

export interface CheckProviderKeyResult {
  ok: boolean
  /** Status-only reason on failure — never contains the key. */
  error?: string
}

const ANTHROPIC_VERSION = '2023-06-01'

export async function checkProviderKey(
  provider: string,
  plaintextKey: string,
  fetchImpl: FetchImpl = fetch,
): Promise<CheckProviderKeyResult> {
  // cloudflare has no cheap validation endpoint — accept it (design.md note).
  if (provider === 'cloudflare') return { ok: true }

  let url: string
  let headers: Record<string, string>
  let label: string
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/models'
    headers = { 'x-api-key': plaintextKey, 'anthropic-version': ANTHROPIC_VERSION }
    label = 'Anthropic'
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/models'
    headers = { Authorization: `Bearer ${plaintextKey}` }
    label = 'OpenAI'
  } else {
    return { ok: false, error: 'Unsupported provider' }
  }

  try {
    const res = await fetchImpl(url, { method: 'GET', headers })
    if (res.ok) return { ok: true }
    // Status only — the response body may echo the request and is not surfaced.
    return { ok: false, error: `${label} key validation failed (HTTP ${res.status})` }
  } catch {
    // Network/transport failure — fail closed without leaking the thrown detail.
    return { ok: false, error: `${label} key validation request failed` }
  }
}
