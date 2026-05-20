/**
 * Google Drive OAuth + Drive v3 endpoints + scope configuration.
 *
 * The OAuth app is registered at https://console.cloud.google.com/apis/credentials
 * in the `baseout-dev` project and lives in Cloudflare Secrets
 * (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET). The boss-registered
 * redirect URI is `<origin>/oauth/callback/google` — match this exactly when
 * building the authorize URL or Google will reject the request.
 */

export const GOOGLE_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo'
export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'

export const GOOGLE_DRIVE_SCOPES = [
  // Standard OIDC trio: `openid` for an OIDC-compliant `sub`, `email` for
  // the user's email (needed for storage_destinations.oauth_account_email),
  // `profile` for display name + picture. Without `email`, the userinfo
  // endpoint returns 200 but omits the email field and the callback bails
  // with `userinfo:Google_userinfo_response_missing_sub_or_email`.
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
] as const

/**
 * Build the redirect URI Google will send the user back to.
 *
 * Under `wrangler dev --remote`, the Worker runs on Cloudflare's edge so
 * `request.url.origin` reflects the deployed dev hostname (e.g.
 * `https://baseout-dev.openside.workers.dev`) — NOT the localhost URL the
 * browser sees (`https://localhost:4331`). Without an override, Google
 * receives the workers.dev URL, rejects with `redirect_uri_mismatch`, and
 * if it didn't would land the browser on a different origin than the one
 * holding the handoff cookie — breaking the flow either way.
 *
 * `env.PUBLIC_AUTH_BASE_URL` already carries the canonical browser-visible
 * origin (used by Better Auth for magic-link URLs). Prefer it when set;
 * fall back to the request origin (the production env declares
 * PUBLIC_AUTH_BASE_URL too, so prod is always env-driven anyway — the
 * fallback covers tests + any future caller that hasn't plumbed env yet).
 */
export interface PublicOriginEnv {
  PUBLIC_AUTH_BASE_URL?: string
}

export function getRedirectUri(
  origin: string,
  env: PublicOriginEnv = {},
): string {
  const base = (env.PUBLIC_AUTH_BASE_URL ?? origin).replace(/\/$/, '')
  return `${base}/oauth/callback/google`
}

export interface GoogleOAuthEnv {
  GOOGLE_OAUTH_CLIENT_ID?: string
  GOOGLE_OAUTH_CLIENT_SECRET?: string
}

export interface GoogleClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(
  env: GoogleOAuthEnv,
): GoogleClientCredentials {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and ' +
        'GOOGLE_OAUTH_CLIENT_SECRET in Cloudflare Secrets (or .dev.vars locally).',
    )
  }
  return { clientId, clientSecret }
}
