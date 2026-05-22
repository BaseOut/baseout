/**
 * Encrypted HttpOnly cookie carrying OAuth handoff state.
 *
 * Provider-agnostic. The payload travels from the authorize handler
 * (generator) through the provider consent redirect to the callback handler
 * (consumer). Payload is encrypted with BASEOUT_ENCRYPTION_KEY (AES-256-GCM);
 * the GCM auth tag also doubles as tamper detection so there is no separate
 * HMAC step.
 *
 * Per-provider shims under lib/<provider>/cookie.ts bind the cookie name +
 * path and re-export wrapped versions of buildSetCookie / buildClearCookie /
 * readHandoffCookie. Extracted from lib/airtable/cookie.ts +
 * lib/google-drive/cookie.ts per shared-byos-drive-dropbox design.md §C.3.0.
 */

import { decryptToken, encryptToken } from '../crypto'

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

/** Provider-specific cookie name + path. */
export interface CookieConfig {
  name: string
  path: string
}

export function buildSetCookie(
  config: CookieConfig,
  value: string,
  attrs: CookieAttrs = { secure: true, maxAgeSeconds: 600 },
): string {
  const parts = [
    `${config.name}=${value}`,
    `Path=${config.path}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (attrs.secure) parts.push('Secure')
  if (attrs.maxAgeSeconds != null) parts.push(`Max-Age=${attrs.maxAgeSeconds}`)
  return parts.join('; ')
}

export function buildClearCookie(
  config: CookieConfig,
  attrs: { secure: boolean },
): string {
  return buildSetCookie(config, '', { secure: attrs.secure, maxAgeSeconds: 0 })
}

export function readHandoffCookie(
  config: CookieConfig,
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${config.name}=`))
  if (!match) return null
  const value = match.slice(config.name.length + 1)
  return value.length > 0 ? value : null
}
