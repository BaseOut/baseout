/**
 * Dropbox OAuth 2.0 + PKCE helpers.
 *
 * Thin shim over lib/oauth/{pkce,exchange} (the provider-agnostic
 * implementations extracted per shared-byos-drive-dropbox design.md §C.3.0).
 * Binds the Dropbox endpoint URLs, request-body client-auth mode (same as
 * Drive), and `token_access_type=offline` so the consent screen issues a
 * refresh token. Call sites under
 * apps/web/src/pages/api/connections/storage/dropbox/ stay unchanged.
 *
 * Dropbox docs:
 *   - https://www.dropbox.com/developers/documentation/http/documentation#authorization
 *   - https://developers.dropbox.com/oauth-guide
 */

import { DROPBOX_AUTHORIZE_URL, DROPBOX_TOKEN_URL } from './config'
import {
  buildAuthorizeUrl as sharedBuildAuthorizeUrl,
  exchangeCodeForTokens as sharedExchangeCodeForTokens,
  refreshAccessToken as sharedRefreshAccessToken,
  type TokenResponse,
} from '../oauth/exchange'

export { generatePkcePair, generateState, type PkcePair } from '../oauth/pkce'
export type { TokenResponse }

const DROPBOX_AUTHORIZE_EXTRA_PARAMS: Record<string, string> = {
  // Without `token_access_type=offline` Dropbox returns a short-lived access
  // token only — refresh tokens require this opt-in (mirrors Google's
  // `access_type=offline`).
  token_access_type: 'offline',
}

export interface AuthorizeParams {
  clientId: string
  redirectUri: string
  scopes: readonly string[]
  state: string
  challenge: string
  /** Override for the authorize endpoint (testing). */
  authorizeUrl?: string
}

export function buildAuthorizeUrl(params: AuthorizeParams): string {
  return sharedBuildAuthorizeUrl({
    authorizeUrl: params.authorizeUrl ?? DROPBOX_AUTHORIZE_URL,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    state: params.state,
    challenge: params.challenge,
    extraParams: DROPBOX_AUTHORIZE_EXTRA_PARAMS,
  })
}

export interface ExchangeCodeParams {
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Override for the token endpoint (testing). */
  tokenUrl?: string
}

export function exchangeCodeForTokens(
  params: ExchangeCodeParams,
): Promise<TokenResponse> {
  return sharedExchangeCodeForTokens({
    tokenUrl: params.tokenUrl ?? DROPBOX_TOKEN_URL,
    authMode: 'request_body',
    code: params.code,
    verifier: params.verifier,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    redirectUri: params.redirectUri,
    providerLabel: 'Dropbox',
  })
}

export interface RefreshParams {
  refreshToken: string
  clientId: string
  clientSecret: string
  tokenUrl?: string
}

export function refreshAccessToken(
  params: RefreshParams,
): Promise<TokenResponse> {
  return sharedRefreshAccessToken({
    tokenUrl: params.tokenUrl ?? DROPBOX_TOKEN_URL,
    authMode: 'request_body',
    refreshToken: params.refreshToken,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    providerLabel: 'Dropbox',
  })
}
