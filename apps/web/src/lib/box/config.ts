/**
 * Box OAuth + REST endpoints and client-credential resolver.
 *
 * The OAuth app (client_id, client_secret) is registered at
 * https://app.box.com/developers/console — see shared/internal/oauth-setup.md
 * §3.3 for the registered redirect URIs per env. Secrets live in Cloudflare
 * Secrets (BOX_OAUTH_CLIENT_ID, BOX_OAUTH_CLIENT_SECRET), sourced from
 * apps/{web,server}/.dev.vars in dev.
 *
 * Both apps/web (initial code exchange + Baseout-folder creation) and
 * apps/server (refresh on backup start) hold the secret. Workflows MUST NOT —
 * it asks the engine for fresh tokens via the INTERNAL_TOKEN-gated route.
 *
 * Box-vs-Drive nuance worth knowing:
 *   - Box rotates the refresh token on every refresh; the new value must
 *     be persisted in storage_destinations.oauth_refresh_token_enc or the
 *     next refresh will fail with `invalid_grant`. Handled in
 *     apps/server/src/lib/storage/refresh-box.ts (commit 3/3).
 *   - Box honors the App's configured Application Scopes (set in the
 *     Developer Console) — we do NOT pass `scope` on the authorize URL.
 *     The returned `scope` string in the token response reflects what was
 *     granted.
 */

export const BOX_AUTHORIZE_URL = 'https://account.box.com/api/oauth2/authorize'
export const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token'
export const BOX_API_BASE = 'https://api.box.com/2.0'

/**
 * Box's "root folder" ID. The root is reachable as the string '0' in any
 * `/folders/:id/...` endpoint. Used by `ensureBaseoutFolder` as the parent
 * when creating the per-Space `Baseout-<spaceId>` folder.
 */
export const BOX_ROOT_FOLDER_ID = '0'

export function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/connections/storage/box/callback`
}

export interface BoxOAuthEnv {
  BOX_OAUTH_CLIENT_ID?: string
  BOX_OAUTH_CLIENT_SECRET?: string
}

export interface BoxClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(env: BoxOAuthEnv): BoxClientCredentials {
  const clientId = env.BOX_OAUTH_CLIENT_ID
  const clientSecret = env.BOX_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Box OAuth is not configured. Set BOX_OAUTH_CLIENT_ID and ' +
        'BOX_OAUTH_CLIENT_SECRET in Cloudflare Secrets (or .dev.vars locally).',
    )
  }
  return { clientId, clientSecret }
}
