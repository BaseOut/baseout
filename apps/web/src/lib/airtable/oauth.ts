/**
 * Airtable OAuth 2.0 + PKCE helpers.
 *
 * Airtable requires PKCE (S256) for all OAuth apps.
 * See https://airtable.com/developers/web/api/oauth-reference
 */

import { AIRTABLE_AUTHORIZE_URL, AIRTABLE_TOKEN_URL } from './config'

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
  scopes: readonly string[]
  state: string
  challenge: string
  /** Override for the authorize endpoint. Defaults to the real Airtable URL. */
  authorizeUrl?: string
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(params.authorizeUrl ?? AIRTABLE_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scopes.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
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

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const creds = `${clientId}:${clientSecret}`
  let bin = ''
  const bytes = new TextEncoder().encode(creds)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `Basic ${btoa(bin)}`
}

async function postToken(
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
  tokenUrl: string,
): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuthHeader(clientId, clientSecret),
    },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as RawTokenResponse
  if (!res.ok || !json.access_token) {
    const code = json.error ?? `http_${res.status}`
    const desc = json.error_description ?? ''
    throw new Error(`Airtable token exchange failed: ${code} ${desc}`.trim())
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
  /** Override for the token endpoint. Defaults to the real Airtable URL. */
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
  return postToken(
    body,
    params.clientId,
    params.clientSecret,
    params.tokenUrl ?? AIRTABLE_TOKEN_URL,
  )
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Override for the token endpoint. Defaults to the real Airtable URL. */
  tokenUrl?: string
}

export function refreshAccessToken(params: RefreshParams): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  return postToken(
    body,
    params.clientId,
    params.clientSecret,
    params.tokenUrl ?? AIRTABLE_TOKEN_URL,
  )
}
