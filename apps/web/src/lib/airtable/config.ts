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
  // Workspace identity for grouping + auto-enroll (Features §17 Q20, resolved
  // 2026-07-28). The scope must ALSO be checked on the integration at
  // airtable.com/create/oauth BEFORE this deploys, or every new Connect fails
  // at the authorize step (oauth-setup.md §3.1). Existing Connections degrade
  // to the flat picker until reconnected — never blocking (web-workspace-bases
  // Decision 5).
  'workspacesAndBases:read',
] as const

export function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/connections/airtable/callback`
}

export interface AirtableOAuthEnv {
  AIRTABLE_OAUTH_CLIENT_ID?: string
  AIRTABLE_OAUTH_CLIENT_SECRET?: string
  // One-app-per-env mode (oauth-setup.md §3.1): when '1', Connect uses the
  // SSO login pair below, so envs whose single Airtable app serves both login
  // and Connect need only one secret pair provisioned. Committed as a wrangler
  // var per env — same code everywhere, config decides.
  AIRTABLE_CONNECT_USE_LOGIN_APP?: string
  AIRTABLE_LOGIN_OAUTH_CLIENT_ID?: string
  AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET?: string
}

export interface AirtableClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(
  env: AirtableOAuthEnv,
): AirtableClientCredentials {
  const useLoginApp = env.AIRTABLE_CONNECT_USE_LOGIN_APP === '1'
  const clientId = useLoginApp
    ? env.AIRTABLE_LOGIN_OAUTH_CLIENT_ID
    : env.AIRTABLE_OAUTH_CLIENT_ID
  const clientSecret = useLoginApp
    ? env.AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET
    : env.AIRTABLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      useLoginApp
        ? 'Airtable OAuth is not configured. AIRTABLE_CONNECT_USE_LOGIN_APP=1 ' +
          'requires AIRTABLE_LOGIN_OAUTH_CLIENT_ID and _SECRET.'
        : 'Airtable OAuth is not configured. Set AIRTABLE_OAUTH_CLIENT_ID and ' +
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
 * under `/api/stub/airtable/*` on the current request origin. This lets the
 * real OAuth code paths (PKCE, cookie seal, token exchange, Meta API client)
 * run end-to-end against an impersonated Airtable before real OAuth creds land.
 *
 * TODO(oauth): when real `AIRTABLE_OAUTH_CLIENT_ID/SECRET` are provisioned,
 * remove `AIRTABLE_STUBS_ENABLED` from `.dev.vars` and delete
 * `src/pages/api/stub/`. This resolver then always returns the real URLs.
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
      authorizeUrl: `${base}/api/stub/airtable/authorize`,
      tokenUrl: `${base}/api/stub/airtable/token`,
      apiBase: `${base}/api/stub/airtable`,
    }
  }
  return {
    authorizeUrl: AIRTABLE_AUTHORIZE_URL,
    tokenUrl: AIRTABLE_TOKEN_URL,
    apiBase: AIRTABLE_API_BASE,
  }
}
