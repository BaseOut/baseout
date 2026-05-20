/**
 * Airtable OAuth endpoints and scope configuration.
 *
 * The OAuth app (client_id, client_secret) is registered at
 * https://airtable.com/create/oauth and lives in Cloudflare Secrets
 * (AIRTABLE_OAUTH_CLIENT_ID, AIRTABLE_OAUTH_CLIENT_SECRET). See PRD §7.1 and
 * §20.2 for the broader integration + security contract.
 */

export const AIRTABLE_AUTHORIZE_URL = 'https://airtable.com/oauth2/v1/authorize'
export const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'
export const AIRTABLE_API_BASE = 'https://api.airtable.com'

export const AIRTABLE_SCOPES = [
  'data.records:read',
  'data.recordComments:read',
  'schema.bases:read',
  'webhook:manage',
] as const

/**
 * Build the redirect URI Airtable will send the user back to.
 *
 * Mirrors the rationale in google-drive/config.ts: under `wrangler dev
 * --remote` the Worker's `url.origin` is the deployed workers.dev hostname,
 * not the localhost URL the browser sees. Without an override, Airtable
 * either rejects the URI (if not in its allowlist) or — worse — accepts it
 * and lands the browser on a different origin than the one holding the
 * better-auth session cookie, returning 401 on the callback. `env.PUBLIC_
 * AUTH_BASE_URL` already carries the canonical browser-visible origin
 * (used by Better Auth for magic-link URLs). Prefer it when set; fall back
 * to the request origin for callers that haven't plumbed env yet + tests.
 */
export interface PublicOriginEnv {
  PUBLIC_AUTH_BASE_URL?: string
}

export function getRedirectUri(
  origin: string,
  env: PublicOriginEnv = {},
): string {
  const base = (env.PUBLIC_AUTH_BASE_URL ?? origin).replace(/\/$/, '')
  return `${base}/api/connections/airtable/callback`
}

export interface AirtableOAuthEnv {
  AIRTABLE_OAUTH_CLIENT_ID?: string
  AIRTABLE_OAUTH_CLIENT_SECRET?: string
}

export interface AirtableClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(
  env: AirtableOAuthEnv,
): AirtableClientCredentials {
  const clientId = env.AIRTABLE_OAUTH_CLIENT_ID
  const clientSecret = env.AIRTABLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Airtable OAuth is not configured. Set AIRTABLE_OAUTH_CLIENT_ID and ' +
        'AIRTABLE_OAUTH_CLIENT_SECRET in Cloudflare Secrets (or .dev.vars locally).',
    )
  }
  return { clientId, clientSecret }
}

/**
 * Resolve the three Airtable endpoints.
 *
 * When `AIRTABLE_STUBS_ENABLED === '1'` (set only in `.dev.vars` — never in
 * wrangler.jsonc or prod secrets), redirect every hop to the local stub routes
 * under `/api/_stub/airtable/*` on the current request origin. This lets the
 * real OAuth code paths (PKCE, cookie seal, token exchange, Meta API client)
 * run end-to-end against an impersonated Airtable before real OAuth creds land.
 *
 * TODO(oauth): when real `AIRTABLE_OAUTH_CLIENT_ID/SECRET` are provisioned,
 * remove `AIRTABLE_STUBS_ENABLED` from `.dev.vars` and delete
 * `src/pages/api/_stub/`. This resolver then always returns the real URLs.
 */
export interface AirtableStubsEnv {
  AIRTABLE_STUBS_ENABLED?: string
}

export interface AirtableUrls {
  authorizeUrl: string
  tokenUrl: string
  apiBase: string
}

export function resolveAirtableUrls(
  env: AirtableStubsEnv,
  origin: string,
): AirtableUrls {
  if (env.AIRTABLE_STUBS_ENABLED === '1') {
    const base = origin.replace(/\/$/, '')
    return {
      authorizeUrl: `${base}/api/_stub/airtable/authorize`,
      tokenUrl: `${base}/api/_stub/airtable/token`,
      apiBase: `${base}/api/_stub/airtable`,
    }
  }
  return {
    authorizeUrl: AIRTABLE_AUTHORIZE_URL,
    tokenUrl: AIRTABLE_TOKEN_URL,
    apiBase: AIRTABLE_API_BASE,
  }
}
