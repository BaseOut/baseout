/**
 * "Continue with Airtable" SSO provider (web-auth-airtable-sso).
 *
 * A DEDICATED minimal-scope login OAuth app — NOT the Connect integration
 * (design Decision 1): its own credentials
 * (AIRTABLE_LOGIN_OAUTH_CLIENT_ID/SECRET), only `user.email:read` +
 * `schema.bases:read`, PKCE, endpoints shared with airtable/config.ts.
 *
 * The login token is whoami-only: identity resolution calls
 * GET /v0/meta/whoami once; NO Connection row is created, no schema call is
 * made (the schema scope is granted but dormant — design Decision 5).
 *
 * The provider is registered ONLY when both env vars are present (the login
 * app registration is pending — tasks 0.1/0.2): absent vars ⇒ SSO hidden,
 * zero behavior change.
 */

import type { GenericOAuthConfig } from 'better-auth/plugins'
import {
  AIRTABLE_API_BASE,
  AIRTABLE_AUTHORIZE_URL,
  AIRTABLE_TOKEN_URL,
  type AirtableUrls,
} from './config'

/** Minimal consent: identity + dormant schema preview scope. Never data scopes. */
export const AIRTABLE_LOGIN_SCOPES = [
  'user.email:read',
  'schema.bases:read',
] as const

export interface AirtableLoginEnv {
  AIRTABLE_LOGIN_OAUTH_CLIENT_ID?: string
  AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET?: string
}

export function isAirtableSsoConfigured(env: AirtableLoginEnv): boolean {
  return Boolean(
    env.AIRTABLE_LOGIN_OAUTH_CLIENT_ID &&
      env.AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET,
  )
}

/** Airtable GET /v0/meta/whoami response (login-scope subset). */
export interface AirtableWhoami {
  id?: string
  email?: string
  scopes?: string[]
}

export interface SsoUserInfo {
  id: string
  email: string
  /** Airtable verifies account emails — same trust bar as "Sign in with
   * Google" (design Decision 2). */
  emailVerified: true
  name: string
}

/**
 * Map whoami → better-auth user info. Missing id/email ⇒ null, which the
 * genericOAuth callback turns into a login-page error with no partial
 * account state (spec: failure paths).
 */
export function mapWhoamiToUserInfo(
  whoami: AirtableWhoami | null | undefined,
): SsoUserInfo | null {
  if (!whoami?.id || !whoami.email) return null
  const email = whoami.email.trim().toLowerCase()
  if (!email.includes('@')) return null
  return {
    id: whoami.id,
    email,
    emailVerified: true,
    // Airtable whoami carries no display name at these scopes; the local
    // part seeds `users.name` until onboarding writes the real one.
    name: email.split('@')[0] || email,
  }
}

export interface AirtableSsoCredentials {
  clientId: string
  clientSecret: string
}

export function buildAirtableSsoProvider(
  creds: AirtableSsoCredentials,
  fetchImpl: typeof fetch = fetch,
  // Stub mode (AIRTABLE_STUBS_ENABLED): pass resolveAirtableUrls(...) so the
  // whole login flow runs against /api/stub/airtable/* — same pattern as the
  // Connect flow. Defaults to the real Airtable endpoints.
  urls: AirtableUrls = {
    authorizeUrl: AIRTABLE_AUTHORIZE_URL,
    tokenUrl: AIRTABLE_TOKEN_URL,
    apiBase: AIRTABLE_API_BASE,
  },
): GenericOAuthConfig {
  return {
    providerId: 'airtable',
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    authorizationUrl: urls.authorizeUrl,
    tokenUrl: urls.tokenUrl,
    scopes: [...AIRTABLE_LOGIN_SCOPES],
    pkce: true,
    // Airtable's token endpoint accepts client_secret_basic only.
    authentication: 'basic',
    getUserInfo: async (tokens) => {
      const accessToken = tokens.accessToken
      if (!accessToken) return null
      let res: Response
      try {
        res = await fetchImpl(`${urls.apiBase}/v0/meta/whoami`, {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
          },
        })
      } catch {
        return null // whoami error → login-page error, no partial state
      }
      if (!res.ok) return null
      let whoami: AirtableWhoami
      try {
        whoami = (await res.json()) as AirtableWhoami
      } catch {
        return null
      }
      return mapWhoamiToUserInfo(whoami)
    },
  }
}
