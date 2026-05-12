/**
 * Encrypted HttpOnly cookie carrying OAuth handoff state.
 *
 * Payload travels from POST /api/connections/airtable/start (generator)
 * through the Airtable consent redirect to GET /callback (consumer). We
 * encrypt the JSON payload with BASEOUT_ENCRYPTION_KEY (AES-256-GCM); the
 * GCM auth tag also doubles as tamper detection so there is no separate
 * HMAC step.
 */

import { decryptToken, encryptToken } from '../crypto'

export const AIRTABLE_OAUTH_COOKIE = 'bo_oauth_airtable'
export const AIRTABLE_OAUTH_COOKIE_PATH = '/api/connections/airtable'

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
    `${AIRTABLE_OAUTH_COOKIE}=${value}`,
    `Path=${AIRTABLE_OAUTH_COOKIE_PATH}`,
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
    .find((c) => c.startsWith(`${AIRTABLE_OAUTH_COOKIE}=`))
  if (!match) return null
  const value = match.slice(AIRTABLE_OAUTH_COOKIE.length + 1)
  return value.length > 0 ? value : null
}
