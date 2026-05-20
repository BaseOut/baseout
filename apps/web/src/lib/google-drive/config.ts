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
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
] as const

export function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/oauth/callback/google`
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
