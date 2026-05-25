/**
 * Google Drive OAuth 2.0 + PKCE helpers.
 *
 * Mirrors the shape of [../airtable/oauth.ts] with three Google-specific
 * additions on the authorize URL — `access_type=offline`, `prompt=consent`,
 * and a single space-delimited scope. Without `access_type=offline`, Google
 * does not return a refresh token. Without `prompt=consent`, Google silently
 * skips refresh-token issuance on re-authorization (e.g., re-connect in dev).
 *
 * Token exchange uses form-encoded body with client_id + client_secret in
 * the body (Google accepts both basic-auth and body; body is the standard
 * shape per https://developers.google.com/identity/protocols/oauth2/web-server).
 */

import {
  GOOGLE_DRIVE_AUTHORIZE_URL,
  GOOGLE_DRIVE_SCOPES,
  GOOGLE_DRIVE_TOKEN_URL,
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
  /** Override for the authorize endpoint. Defaults to the real Google URL. */
  authorizeUrl?: string
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(params.authorizeUrl ?? GOOGLE_DRIVE_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set(
    'scope',
    (params.scopes ?? GOOGLE_DRIVE_SCOPES).join(' '),
  )
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // Required for Google to issue a refresh token.
  url.searchParams.set('access_type', 'offline')
  // Forces the consent screen so re-connecting still issues a refresh token.
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

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
    throw new Error(`Google Drive token exchange failed: ${code} ${desc}`.trim())
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
  /** Override for the token endpoint. Defaults to the real Google URL. */
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
  return postToken(body, params.tokenUrl ?? GOOGLE_DRIVE_TOKEN_URL)
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Override for the token endpoint. Defaults to the real Google URL. */
  tokenUrl?: string
}

export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  body.set('client_id', params.clientId)
  body.set('client_secret', params.clientSecret)
  return postToken(body, params.tokenUrl ?? GOOGLE_DRIVE_TOKEN_URL)
}
