/**
 * Encrypted HttpOnly cookie carrying the Google Drive OAuth handoff payload.
 *
 * Travels from POST /api/connections/storage/google-drive/authorize (the
 * generator) through Google's consent redirect to GET /oauth/callback/google
 * (the consumer). AES-256-GCM via `BASEOUT_ENCRYPTION_KEY`; the GCM auth tag
 * doubles as tamper detection so there is no separate HMAC step.
 *
 * Mirror of the Airtable cookie shape — when Dropbox lands (third call site),
 * the shared extraction into lib/oauth/cookie.ts ships per
 * shared-byos-drive-dropbox design.md C.3.0.
 */

import { decryptToken, encryptToken } from '../crypto'

export const GOOGLE_OAUTH_COOKIE = 'bo_oauth_google'
/**
 * Scope cookie to `/oauth/callback/google` (the registered redirect URI) so
 * the browser only sends it back to the callback route. The authorize POST
 * lives at /api/connections/storage/google-drive/authorize — it doesn't read
 * the cookie, only writes it.
 */
export const GOOGLE_OAUTH_COOKIE_PATH = '/'

export interface OAuthHandoffPayload {
  verifier: string
  state: string
  organizationId: string
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
    typeof parsed.organizationId !== 'string' ||
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
    `${GOOGLE_OAUTH_COOKIE}=${value}`,
    `Path=${GOOGLE_OAUTH_COOKIE_PATH}`,
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
    .find((c) => c.startsWith(`${GOOGLE_OAUTH_COOKIE}=`))
  if (!match) return null
  const value = match.slice(GOOGLE_OAUTH_COOKIE.length + 1)
  return value.length > 0 ? value : null
}
