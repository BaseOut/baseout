/**
 * Minimal Airtable Meta API client.
 *
 * This is the fetch-level wrapper used by the OAuth callback to populate
 * platform_config (via whoami) and at_bases (via listBases). It retries on
 * 429/5xx with exponential backoff; it does NOT coordinate rate limits across
 * a whole Connection — that's the Connection Durable Object in Phase 1B.
 */

import { AIRTABLE_API_BASE } from './config'

export class AirtableAuthError extends Error {
  constructor(message = 'Airtable access token is not valid') {
    super(message)
    this.name = 'AirtableAuthError'
  }
}

export class AirtableApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AirtableApiError'
  }
}

export interface AirtableWhoami {
  id: string
  scopes: string[]
  email?: string
}

export interface AirtableBaseSummary {
  id: string
  name: string
  permissionLevel: string
}

interface ListBasesResponse {
  bases: AirtableBaseSummary[]
  offset?: string
}

export interface AirtableClientOptions {
  accessToken: string
  /** Maximum retry attempts on 429/5xx. Default 3. */
  maxRetries?: number
  /** Injection point for tests. */
  fetchImpl?: typeof fetch
  /** Override for the Meta API base URL. Defaults to api.airtable.com. */
  apiBase?: string
}

export interface AirtableClient {
  whoami(): Promise<AirtableWhoami>
  listBases(): Promise<AirtableBaseSummary[]>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestWithRetry(
  url: string,
  accessToken: string,
  maxRetries: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let attempt = 0
  while (true) {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    })
    if (res.status === 401) {
      throw new AirtableAuthError()
    }
    if (res.ok) return res
    const retriable = res.status === 429 || res.status >= 500
    if (!retriable || attempt >= maxRetries) {
      const body = await res.text().catch(() => '')
      throw new AirtableApiError(
        res.status,
        `Airtable ${res.status}: ${body.slice(0, 200)}`,
      )
    }
    const backoffMs = Math.min(8_000, 500 * 2 ** attempt)
    await sleep(backoffMs)
    attempt++
  }
}

export function createAirtableClient(opts: AirtableClientOptions): AirtableClient {
  const maxRetries = opts.maxRetries ?? 3
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const apiBase = (opts.apiBase ?? AIRTABLE_API_BASE).replace(/\/$/, '')

  return {
    async whoami() {
      const res = await requestWithRetry(
        `${apiBase}/v0/meta/whoami`,
        opts.accessToken,
        maxRetries,
        fetchImpl,
      )
      const json = (await res.json()) as AirtableWhoami
      return json
    },

    async listBases() {
      const collected: AirtableBaseSummary[] = []
      let offset: string | undefined
      do {
        const url = new URL(`${apiBase}/v0/meta/bases`)
        if (offset) url.searchParams.set('offset', offset)
        const res = await requestWithRetry(
          url.toString(),
          opts.accessToken,
          maxRetries,
          fetchImpl,
        )
        const json = (await res.json()) as ListBasesResponse
        collected.push(...(json.bases ?? []))
        offset = json.offset
      } while (offset)
      return collected
    },
  }
}
