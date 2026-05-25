/**
 * Encrypted HttpOnly cookie carrying Google Drive OAuth handoff state.
 *
 * Mirror of [../airtable/cookie.ts]. The cookie travels from POST
 * /api/connections/storage/google-drive/authorize (generator) through
 * Google's consent redirect to GET /callback (consumer). The JSON payload
 * is encrypted with BASEOUT_ENCRYPTION_KEY (AES-256-GCM); the GCM auth tag
 * doubles as tamper detection so no separate HMAC is needed.
 */

import { decryptToken, encryptToken } from '../crypto'

export const GOOGLE_DRIVE_OAUTH_COOKIE = 'bo_oauth_google_drive'
export const GOOGLE_DRIVE_OAUTH_COOKIE_PATH =
  '/api/connections/storage/google-drive'

export interface OAuthHandoffPayload {
  verifier: string
  state: string
  spaceId: string
  userId: string
  redirectUri: string
  /** Same-origin path to redirect the browser to after OAuth succeeds. */
  returnTo?: string
}

export async function sealHandoffPayload(
  payload: OAuthHandoffPayload,
  keyB64: string,
): Promise<string> {
  return encryptToken(JSON.stringify(payload), keyB64)
}

export async function openHandoffPayload(
  ciphertext: string,
  keyB64: string,
): Promise<OAuthHandoffPayload> {
  const json = await decryptToken(ciphertext, keyB64)
  const parsed = JSON.parse(json) as Partial<OAuthHandoffPayload>
  if (
    typeof parsed.verifier !== 'string' ||
    typeof parsed.state !== 'string' ||
    typeof parsed.spaceId !== 'string' ||
    typeof parsed.userId !== 'string' ||
    typeof parsed.redirectUri !== 'string'
  ) {
    throw new Error('handoff payload is malformed')
  }
  return parsed as OAuthHandoffPayload
}

export interface CookieAttrs {
  secure: boolean
  maxAgeSeconds?: number
}

export function buildSetCookie(
  value: string,
  attrs: CookieAttrs = { secure: true, maxAgeSeconds: 600 },
): string {
  const parts = [
    `${GOOGLE_DRIVE_OAUTH_COOKIE}=${value}`,
    `Path=${GOOGLE_DRIVE_OAUTH_COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (attrs.secure) parts.push('Secure')
  if (attrs.maxAgeSeconds != null) parts.push(`Max-Age=${attrs.maxAgeSeconds}`)
  return parts.join('; ')
}

export function buildClearCookie(attrs: { secure: boolean }): string {
  return buildSetCookie('', { secure: attrs.secure, maxAgeSeconds: 0 })
}

export function readHandoffCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOOGLE_DRIVE_OAUTH_COOKIE}=`))
  if (!match) return null
  const value = match.slice(GOOGLE_DRIVE_OAUTH_COOKIE.length + 1)
  return value.length > 0 ? value : null
}
