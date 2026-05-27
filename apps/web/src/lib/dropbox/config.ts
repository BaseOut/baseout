/**
 * Dropbox OAuth + REST endpoints and client-credential resolver.
 *
 * The OAuth app (App key, App secret) is registered at
 * https://www.dropbox.com/developers/apps — see shared/internal/oauth-setup.md
 * §3.4 for the registered redirect URIs per env. Secrets live in Cloudflare
 * Secrets (DROPBOX_OAUTH_CLIENT_ID, DROPBOX_OAUTH_CLIENT_SECRET), sourced
 * from apps/{web,server}/.dev.vars in dev.
 *
 * Both apps/web (initial code exchange + Baseout-folder creation) and
 * apps/server (refresh on backup start) hold the secret. Workflows MUST NOT —
 * it asks the engine for fresh tokens via the INTERNAL_TOKEN-gated route.
 *
 * Dropbox-vs-Box-vs-Drive nuance worth knowing:
 *   - Dropbox refresh tokens are STABLE (no rotation, no expiry by default).
 *     Like Drive, unlike Box. The engine route preserves the stored
 *     `oauth_refresh_token_enc` on refresh.
 *   - `token_access_type=offline` MUST be on the authorize URL — Dropbox
 *     does NOT return a refresh_token without it.
 *   - Scope set is configured on the Dropbox App Console Permissions tab —
 *     we do NOT pass `scope` on the authorize URL.
 *   - Path-based folder model. `providerFolderId` is the absolute Dropbox
 *     path (e.g. `/Baseout-<spaceId>`), not a numeric ID.
 *   - Content endpoints live on `content.dropboxapi.com` (different
 *     subdomain than metadata calls on `api.dropboxapi.com`); upload is a
 *     workflows-side concern.
 */

export const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
export const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
export const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2'

/**
 * Resolves the OAuth redirect URI for this request.
 *
 * Precedence:
 *   1. `env.DROPBOX_REDIRECT_URI` — explicit override. Required when running
 *      `wrangler dev --remote` because the worker code sees its hostname
 *      as `baseout-dev.openside.workers.dev` (the preview-worker URL) even
 *      though the browser address bar is `localhost:4331`. Pinning the
 *      redirect URI to one of the Dropbox-registered hostnames keeps the
 *      OAuth flow consistent — the SAME string must appear on the
 *      authorize URL AND on the token-exchange call.
 *   2. Derived from `origin` — the deployed path. Each deployed env's
 *      hostname is registered in the Dropbox App Console, so `url.origin`
 *      resolves to a valid registered URI in staging + prod.
 */
export function getRedirectUri(
  origin: string,
  env?: { DROPBOX_REDIRECT_URI?: string },
): string {
  if (env?.DROPBOX_REDIRECT_URI) return env.DROPBOX_REDIRECT_URI
  return `${origin.replace(/\/$/, '')}/api/connections/storage/dropbox/callback`
}

export interface DropboxOAuthEnv {
  DROPBOX_OAUTH_CLIENT_ID?: string
  DROPBOX_OAUTH_CLIENT_SECRET?: string
  /**
   * Optional explicit redirect-URI override. See `getRedirectUri` above.
   * Recommended in local dev when using `wrangler dev --remote`.
   */
  DROPBOX_REDIRECT_URI?: string
}

export interface DropboxClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(
  env: DropboxOAuthEnv,
): DropboxClientCredentials {
  const clientId = env.DROPBOX_OAUTH_CLIENT_ID
  const clientSecret = env.DROPBOX_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Dropbox OAuth is not configured. Set DROPBOX_OAUTH_CLIENT_ID and ' +
        'DROPBOX_OAUTH_CLIENT_SECRET in Cloudflare Secrets (or .dev.vars locally).',
    )
  }
  return { clientId, clientSecret }
}
