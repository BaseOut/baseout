/**
 * Microsoft OneDrive OAuth 2.0 + PKCE helpers (public client — no secret).
 *
 * Mirrors the shape of [../dropbox/oauth.ts] with three Microsoft-specific
 * divergences:
 *   - **`exchangeCodeForTokens` and `refreshAccessToken` post NO `client_secret`.**
 *     The Azure App is registered as a public client (`allowPublicClient: true`)
 *     and Microsoft enforces PKCE on the token endpoint as the proof-of-
 *     possession. The `code_verifier` replaces the secret in the initial code
 *     exchange. Per Microsoft Entra docs: "For SPAs and native clients on the
 *     Microsoft identity platform, the authorization code flow requires the use
 *     of a PKCE code challenge … Client secrets should not be used."
 *   - **Refresh tokens rotate on every refresh.** Microsoft's `/token`
 *     response carries a NEW `refresh_token` on BOTH the initial code
 *     exchange AND on subsequent refresh calls. `TokenResponse.refreshToken`
 *     is therefore non-null in BOTH directions, and the engine refresh
 *     handler MUST overwrite the stored ciphertext on every success.
 *   - **`scope` is on the authorize URL AND on the token-exchange body.**
 *     Microsoft validates the scope on both legs of the flow.
 *
 * Token endpoint URL uses the `/common` tenant slot regardless of the
 * Azure App's "Supported account types" setting — `/common` works for
 * multi-tenant + personal MSA. See ../onedrive/config.ts.
 */

import {
  MICROSOFT_AUTHORIZE_URL,
  MICROSOFT_TOKEN_URL,
  ONEDRIVE_SCOPES,
} from './config'

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
  scopes?: readonly string[]
  state: string
  challenge: string
  /** Override for the authorize endpoint. Defaults to the real Microsoft URL. */
  authorizeUrl?: string
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(params.authorizeUrl ?? MICROSOFT_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set(
    'scope',
    (params.scopes ?? ONEDRIVE_SCOPES).join(' '),
  )
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export interface TokenResponse {
  accessToken: string
  /**
   * On `exchangeCodeForTokens`: present (Microsoft returns the refresh_token
   * on code exchange when `offline_access` is in scope).
   *
   * On `refreshAccessToken`: ALSO present (Microsoft rotates refresh tokens
   * on every refresh). The engine refresh handler MUST persist the new
   * value, or the next refresh will fail with `invalid_grant` /
   * `AADSTS50173`.
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
    throw new Error(`OneDrive token exchange failed: ${code} ${desc}`.trim())
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
  redirectUri: string
  scopes?: readonly string[]
  /** Override for the token endpoint. Defaults to the real Microsoft URL. */
  tokenUrl?: string
}

/**
 * Exchange an authorization code for tokens. Public-client PKCE only — NO
 * client_secret is sent. The `code_verifier` is the proof-of-possession.
 */
export function exchangeCodeForTokens(
  params: ExchangeCodeParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', params.code)
  body.set('code_verifier', params.verifier)
  body.set('redirect_uri', params.redirectUri)
  body.set('client_id', params.clientId)
  body.set('scope', (params.scopes ?? ONEDRIVE_SCOPES).join(' '))
  return postToken(body, params.tokenUrl ?? MICROSOFT_TOKEN_URL)
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  scopes?: readonly string[]
  /** Override for the token endpoint. Defaults to the real Microsoft URL. */
  tokenUrl?: string
}

/**
 * Refresh a OneDrive access token. Public-client PKCE only — NO
 * client_secret is sent. Microsoft ROTATES refresh tokens, so the response
 * `refresh_token` differs from the input and must be persisted.
 */
export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  body.set('client_id', params.clientId)
  body.set('scope', (params.scopes ?? ONEDRIVE_SCOPES).join(' '))
  return postToken(body, params.tokenUrl ?? MICROSOFT_TOKEN_URL)
}
