/**
 * Microsoft OneDrive OAuth + Graph REST endpoints and client-id resolver.
 *
 * The Azure App registration (client_id only — NO client secret) lives at
 * https://portal.azure.com → Microsoft Entra ID → App registrations. The app
 * is registered as a public client (`allowPublicClient: true` in the
 * manifest), so the OAuth flow uses PKCE for proof-of-possession instead of a
 * client secret. See shared/internal/oauth-setup.md §3.5 for the registered
 * redirect URIs per env, and §4.5 for the gap checklist.
 *
 * OneDrive-vs-Drive-vs-Dropbox-vs-Box nuances worth knowing:
 *   - **Public client + PKCE only — no client_secret anywhere.** The token
 *     exchange call posts only `client_id` and `code_verifier`; the refresh
 *     call posts only `client_id` and `refresh_token`. There is no
 *     MICROSOFT_OAUTH_CLIENT_SECRET env var.
 *   - **Refresh tokens rotate on every refresh.** Microsoft returns a NEW
 *     `refresh_token` on every token-endpoint response (initial code
 *     exchange AND refresh). Like Box, unlike Drive/Dropbox. The engine
 *     refresh route (apps/server/src/lib/storage/refresh-onedrive.ts)
 *     re-encrypts and overwrites `oauth_refresh_token_enc` on every
 *     successful refresh.
 *   - **`/common` tenant slot in URLs.** Even though the Azure App is
 *     registered against a specific Directory (tenant), we send `/common`
 *     in the authorize and token URLs so the consent screen accepts both
 *     work/school accounts AND personal Microsoft accounts (outlook.com,
 *     hotmail, gmail-linked Live, Xbox, Skype) per Features §4.4. This
 *     requires the app's "Supported account types" to be set to "any
 *     organizational directory + personal Microsoft accounts" — boss-side
 *     toggle on the App registration.
 *   - **Scope `Files.ReadWrite.AppFolder` (narrow).** Microsoft sandboxes
 *     Baseout to a per-user `/Apps/<DisplayName>/` folder; we cannot see or
 *     write outside it. Matches Dropbox's App-folder pattern and follows
 *     CLAUDE.md §3.3 principle of least privilege. Same call shapes as
 *     `Files.ReadWrite` — just the API root differs (`/me/drive/special/approot`
 *     instead of `/me/drive/root`).
 *   - **DriveItem IDs (opaque) for providerFolderId.** Unlike Dropbox's path
 *     strings; matches Drive's id model.
 *   - **Upload-session protocol for files >4 MB.** The workflows writer
 *     (commit 3/3) uses createUploadSession unconditionally for uniform
 *     handling. The session URL is pre-authorized — no Authorization header
 *     on the PUT chunks.
 */

export const MICROSOFT_AUTHORIZE_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
export const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token'
export const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Delegated scopes requested on the authorize URL. Microsoft Graph honors
 * `Files.ReadWrite.AppFolder` for both personal and work/school accounts.
 * `offline_access` is required to receive a refresh_token. `User.Read` is
 * used by /me to populate oauth_account_email / provider_account_id for
 * audit on initial Connect.
 */
export const ONEDRIVE_SCOPES = [
  'Files.ReadWrite.AppFolder',
  'offline_access',
  'User.Read',
] as const

/**
 * Resolves the OAuth redirect URI for this request.
 *
 * Precedence (mirrors Dropbox + Box patterns):
 *   1. `env.MICROSOFT_REDIRECT_URI` — explicit override. Required when
 *      running `wrangler dev --remote` because the worker code sees its
 *      hostname as `baseout-dev.openside.workers.dev` (the preview-worker
 *      URL) even though the browser address bar is `baseout.local:4331`.
 *      Pinning the redirect URI to one of the Microsoft-registered
 *      hostnames keeps the OAuth flow consistent — the SAME string must
 *      appear on the authorize URL AND on the token-exchange call.
 *   2. Derived from `origin` — the deployed path. Each deployed env's
 *      hostname must be registered in the Azure App Console.
 */
export function getRedirectUri(
  origin: string,
  env?: { MICROSOFT_REDIRECT_URI?: string },
): string {
  if (env?.MICROSOFT_REDIRECT_URI) return env.MICROSOFT_REDIRECT_URI
  return `${origin.replace(/\/$/, '')}/api/connections/storage/onedrive/callback`
}

export interface OneDriveOAuthEnv {
  MICROSOFT_OAUTH_CLIENT_ID?: string
  /**
   * Optional explicit redirect-URI override. See `getRedirectUri` above.
   * Recommended in local dev when using `wrangler dev --remote`.
   */
  MICROSOFT_REDIRECT_URI?: string
}

export interface OneDriveClientId {
  clientId: string
}

/**
 * Resolve the OAuth client id. Public-client app — no secret to return.
 */
export function getClientId(env: OneDriveOAuthEnv): OneDriveClientId {
  const clientId = env.MICROSOFT_OAUTH_CLIENT_ID
  if (!clientId) {
    throw new Error(
      'OneDrive OAuth is not configured. Set MICROSOFT_OAUTH_CLIENT_ID in ' +
        'Cloudflare Secrets (or .dev.vars locally). No client secret is ' +
        'required — the Azure App is a public client and authorizes via PKCE.',
    )
  }
  return { clientId }
}
