/**
 * Dropbox OAuth + API endpoints + scope configuration.
 *
 * The OAuth app is registered in the Dropbox App Console
 * (https://www.dropbox.com/developers/apps) and lives in Cloudflare Secrets
 * (DROPBOX_OAUTH_CLIENT_ID, DROPBOX_OAUTH_CLIENT_SECRET). The redirect URI
 * registered with Dropbox is `<origin>/api/connections/storage/dropbox/
 * callback` — match this exactly when building the authorize URL or Dropbox
 * will reject the request with `redirect_uri_mismatch`.
 *
 * Per shared-byos-drive-dropbox tasks.md C.3.1: the Dropbox app must be a
 * "Full Dropbox" type (not "App Folder") because Baseout writes to
 * `/Apps/Baseout/<spaceId>/` paths literally rather than letting Dropbox
 * rewrite them into an app-folder root.
 */

export const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
export const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
export const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2'
export const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2'

/**
 * Dropbox OAuth scopes per tasks.md C.3.1.
 *
 *  - `files.content.write` — required to upload backup CSVs.
 *  - `files.content.read` — needed by the future restore engine; included
 *    now so we don't have to force re-consent later.
 *  - `files.metadata.read` — needed to swallow 409 path/conflict/folder on
 *    `create_folder_v2` (the response carries the metadata we'd otherwise
 *    re-fetch).
 *  - `account_info.read` — needed to populate `oauth_account_email` for
 *    display via `users/get_current_account`.
 */
export const DROPBOX_SCOPES = [
  'files.content.write',
  'files.content.read',
  'files.metadata.read',
  'account_info.read',
] as const

/**
 * Build the redirect URI Dropbox will send the user back to.
 *
 * Same rationale as Google Drive / Airtable: under `wrangler dev --remote`
 * the Worker's `url.origin` is the deployed workers.dev hostname, not the
 * localhost URL the browser sees. `env.PUBLIC_AUTH_BASE_URL` already
 * carries the canonical browser-visible origin. Prefer it when set; fall
 * back to the request origin for tests and any caller that hasn't plumbed
 * env yet.
 */
export interface PublicOriginEnv {
  PUBLIC_AUTH_BASE_URL?: string
}

export function getRedirectUri(
  origin: string,
  env: PublicOriginEnv = {},
): string {
  const base = (env.PUBLIC_AUTH_BASE_URL ?? origin).replace(/\/$/, '')
  return `${base}/api/connections/storage/dropbox/callback`
}

export interface DropboxOAuthEnv {
  DROPBOX_OAUTH_CLIENT_ID?: string
  DROPBOX_OAUTH_CLIENT_SECRET?: string
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

/**
 * Provider folder layout for Dropbox per tasks.md C.3.1.
 * Returns the literal path that goes in `provider_folder_id` and is used as
 * the parent for every CSV write.
 */
export function buildBaseoutFolderPath(spaceId: string): string {
  return `/Apps/Baseout/${spaceId}`
}
