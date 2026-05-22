/**
 * Airtable OAuth 2.0 + PKCE helpers.
 *
 * Thin shim over lib/oauth/{pkce,exchange} (the provider-agnostic
 * implementations extracted per shared-byos-drive-dropbox design.md §C.3.0).
 * Binds the Airtable endpoint URLs + Basic-header client-auth mode and
 * re-exports identical-shape helpers so call sites in
 * apps/web/src/pages/api/connections/airtable/ stay unchanged.
 *
 * Airtable requires PKCE (S256) for all OAuth apps.
 * See https://airtable.com/developers/web/api/oauth-reference
 */

import { AIRTABLE_AUTHORIZE_URL, AIRTABLE_TOKEN_URL } from './config'
import {
  buildAuthorizeUrl as sharedBuildAuthorizeUrl,
  exchangeCodeForTokens as sharedExchangeCodeForTokens,
  refreshAccessToken as sharedRefreshAccessToken,
  type TokenResponse,
} from '../oauth/exchange'

export { generatePkcePair, generateState, type PkcePair } from '../oauth/pkce'
export type { TokenResponse }

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
  return sharedBuildAuthorizeUrl({
    authorizeUrl: params.authorizeUrl ?? AIRTABLE_AUTHORIZE_URL,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    state: params.state,
    challenge: params.challenge,
  })
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
  return sharedExchangeCodeForTokens({
    tokenUrl: params.tokenUrl ?? AIRTABLE_TOKEN_URL,
    authMode: 'basic_header',
    code: params.code,
    verifier: params.verifier,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    redirectUri: params.redirectUri,
    providerLabel: 'Airtable',
  })
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Override for the token endpoint. Defaults to the real Airtable URL. */
  tokenUrl?: string
}

export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  return sharedRefreshAccessToken({
    tokenUrl: params.tokenUrl ?? AIRTABLE_TOKEN_URL,
    authMode: 'basic_header',
    refreshToken: params.refreshToken,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    providerLabel: 'Airtable',
  })
}
