/**
 * Dropbox OAuth 2.0 + PKCE helpers.
 *
 * Mirrors the shape of [../box/oauth.ts]. Three Dropbox-specific divergences
 * to encode:
 *   - **`token_access_type=offline`** on the authorize URL. Without this,
 *     Dropbox does NOT return a refresh_token. There is no equivalent param
 *     in Box / Drive APIs.
 *   - **No `scope` param** on the authorize URL. Dropbox honors the App
 *     Console Permissions-tab scope set (same idea as Box's Application
 *     Scopes config).
 *   - **`refreshAccessToken` returns `refreshToken: null`** on success.
 *     Dropbox's refresh response omits `refresh_token` because refresh
 *     tokens are stable and reusable (like Drive, unlike Box). Callers
 *     preserve the existing stored value rather than re-encrypting.
 *
 * Token exchange uses form-encoded body with client_id + client_secret in
 * the body (per Dropbox docs at
 * https://www.dropbox.com/developers/documentation/http/documentation).
 */

import { DROPBOX_AUTHORIZE_URL, DROPBOX_TOKEN_URL } from './config'

const VERIFIER_BYTES = 64

function toUrlSafeBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export interface PkcePair {
  verifier: string
  challenge: string
}

export async function generatePkcePair(): Promise<PkcePair> {
  const raw = crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))
  const verifier = toUrlSafeBase64(raw)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  const challenge = toUrlSafeBase64(new Uint8Array(digest))
  return { verifier, challenge }
}

export function generateState(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  return toUrlSafeBase64(raw)
}

export interface AuthorizeParams {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
  /** Override for the authorize endpoint. Defaults to the real Dropbox URL. */
  authorizeUrl?: string
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(params.authorizeUrl ?? DROPBOX_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // Required for Dropbox to issue a refresh token. Without this the
  // response contains only a short-lived (4h) access_token.
  url.searchParams.set('token_access_type', 'offline')
  return url.toString()
}

export interface TokenResponse {
  accessToken: string
  /**
   * On `exchangeCodeForTokens` (initial grant): present (Dropbox returns
   * the refresh_token on code exchange).
   *
   * On `refreshAccessToken`: ALWAYS `null` — Dropbox omits `refresh_token`
   * in refresh responses because refresh tokens are long-lived and
   * reusable. The caller must preserve the previously stored value.
   */
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

async function postToken(
  body: URLSearchParams,
  tokenUrl: string,
): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as RawTokenResponse
  if (!res.ok || !json.access_token) {
    const code = json.error ?? `http_${res.status}`
    const desc = json.error_description ?? ''
    throw new Error(`Dropbox token exchange failed: ${code} ${desc}`.trim())
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
    scope: json.scope ?? null,
  }
}

export interface ExchangeCodeParams {
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Override for the token endpoint. Defaults to the real Dropbox URL. */
  tokenUrl?: string
}

export function exchangeCodeForTokens(
  params: ExchangeCodeParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', params.code)
  body.set('code_verifier', params.verifier)
  body.set('redirect_uri', params.redirectUri)
  body.set('client_id', params.clientId)
  body.set('client_secret', params.clientSecret)
  return postToken(body, params.tokenUrl ?? DROPBOX_TOKEN_URL)
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Override for the token endpoint. Defaults to the real Dropbox URL. */
  tokenUrl?: string
}

/**
 * Refresh a Dropbox access token. Dropbox refresh tokens are stable — the
 * response carries a new `access_token` only, NOT a new refresh_token. The
 * returned `TokenResponse.refreshToken` is therefore always `null` for
 * refresh calls; callers preserve the stored value.
 */
export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  body.set('client_id', params.clientId)
  body.set('client_secret', params.clientSecret)
  return postToken(body, params.tokenUrl ?? DROPBOX_TOKEN_URL)
}
