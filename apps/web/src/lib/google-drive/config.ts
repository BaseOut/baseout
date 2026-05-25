/**
 * Google Drive OAuth endpoints and scope.
 *
 * The OAuth app (client_id, client_secret) is registered at
 * https://console.cloud.google.com — see openspec/changes/shared-byos-drive
 * preconditions. Secrets live in Cloudflare Secrets
 * (GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET).
 *
 * Both apps/web (initial code exchange) and apps/server (refresh on backup
 * start) hold the secret. Workflows MUST NOT — it asks the engine for fresh
 * tokens via the INTERNAL_TOKEN-gated route.
 */

export const GOOGLE_DRIVE_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com'

/**
 * `drive.file` lets the app see and modify only files it creates. Sufficient
 * for write (today). A future Drive-restore flow may need broader access; that
 * scope expansion is out of scope here.
 */
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const

export function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/connections/storage/google-drive/callback`
}

export interface GoogleDriveOAuthEnv {
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string
}

export interface GoogleDriveClientCredentials {
  clientId: string
  clientSecret: string
}

export function getClientCredentials(
  env: GoogleDriveOAuthEnv,
): GoogleDriveClientCredentials {
  const clientId = env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Drive OAuth is not configured. Set GOOGLE_DRIVE_OAUTH_CLIENT_ID ' +
        'and GOOGLE_DRIVE_OAUTH_CLIENT_SECRET in Cloudflare Secrets (or .dev.vars locally).',
    )
  }
  return { clientId, clientSecret }
}
