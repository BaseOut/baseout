/**
 * Provider-agnostic OAuth 2.0 + PKCE token exchange.
 *
 * Handles both client-auth styles seen across providers:
 *  - `basic_header` — Airtable: `Authorization: Basic base64(client_id:secret)`
 *  - `request_body` — Google Drive: client_id + client_secret in the POST body
 *
 * Provider-specific authorize URL extras (e.g. Google's `access_type=offline`
 * for refresh tokens) flow through `extraAuthorizeParams`. Per-provider shims
 * bind these knobs and re-export thin wrappers so consumers don't change.
 *
 * Extracted from lib/airtable/oauth.ts + lib/google-drive/oauth.ts per
 * shared-byos-drive-dropbox design.md §C.3.0.
 */

export type ClientAuthMode = 'basic_header' | 'request_body'

export interface TokenResponse {
  accessToken: string
  refreshToken: string | null
  expiresIn: number | null
  scope: string | null
}

interface RawTokenResponse {
  access_token?: string
  refresh_token?: string | null
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const creds = `${clientId}:${clientSecret}`
  let bin = ''
  const bytes = new TextEncoder().encode(creds)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `Basic ${btoa(bin)}`
}

export interface AuthorizeParams {
  /** Full provider authorize endpoint URL. */
  authorizeUrl: string
  clientId: string
  redirectUri: string
  scopes: readonly string[]
  state: string
  challenge: string
  /** Provider-specific extras appended verbatim to the query string. */
  extraParams?: Record<string, string>
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(params.authorizeUrl)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scopes.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (params.extraParams) {
    for (const [key, value] of Object.entries(params.extraParams)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

interface PostTokenOptions {
  tokenUrl: string
  authMode: ClientAuthMode
  clientId: string
  clientSecret: string
  providerLabel: string
  body: URLSearchParams
}

async function postToken(opts: PostTokenOptions): Promise<TokenResponse> {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (opts.authMode === 'basic_header') {
    headers.authorization = basicAuthHeader(opts.clientId, opts.clientSecret)
  } else {
    opts.body.set('client_id', opts.clientId)
    opts.body.set('client_secret', opts.clientSecret)
  }
  const res = await fetch(opts.tokenUrl, {
    method: 'POST',
    headers,
    body: opts.body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as RawTokenResponse
  if (!res.ok || !json.access_token) {
    const code = json.error ?? `http_${res.status}`
    const desc = json.error_description ?? ''
    throw new Error(`${opts.providerLabel} token exchange failed: ${code} ${desc}`.trim())
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
    scope: json.scope ?? null,
  }
}

export interface ExchangeCodeParams {
  tokenUrl: string
  authMode: ClientAuthMode
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Provider name for error messages, e.g. "Airtable" or "Google". */
  providerLabel: string
}

export function exchangeCodeForTokens(
  params: ExchangeCodeParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', params.code)
  body.set('code_verifier', params.verifier)
  body.set('redirect_uri', params.redirectUri)
  return postToken({
    tokenUrl: params.tokenUrl,
    authMode: params.authMode,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    providerLabel: params.providerLabel,
    body,
  })
}

export interface RefreshParams {
  tokenUrl: string
  authMode: ClientAuthMode
  refreshToken: string
  clientId: string
  clientSecret: string
  providerLabel: string
}

export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  return postToken({
    tokenUrl: params.tokenUrl,
    authMode: params.authMode,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    providerLabel: params.providerLabel,
    body,
  })
}
