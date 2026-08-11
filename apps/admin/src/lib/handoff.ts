// Verifier for the login → admin handoff token
// (openspec/changes/shared-admin-dev-deploy).
//
// The deployed admin Worker can never receive web's better-auth session cookie
// (host-only + workers.dev is on the Public Suffix List), so web's
// /api/admin/handoff mints a short-lived AES-256-GCM token carrying the
// session-cookie value, audience-bound to this origin. This module opens and
// verifies it — pure, testable without the route or DB. The DB session lookup
// (existence + expiry + role='super') remains the real gate; this token only
// transports the cookie value across origins.

import { decryptToken } from './crypto'

export interface HandoffPayload {
  v: 1
  st: string // web session-cookie value (token.signature)
  aud: string // origin the token was minted for
  exp: number // epoch ms
}

export type HandoffResult =
  | { ok: true; sessionCookieValue: string }
  | { ok: false; reason: 'undecryptable' | 'malformed' | 'expired' | 'wrong-audience' }

export async function openHandoffToken(
  token: string,
  secret: string,
  expectedOrigin: string,
  now: Date,
): Promise<HandoffResult> {
  let plaintext: string
  try {
    plaintext = await decryptToken(token, secret)
  } catch {
    return { ok: false, reason: 'undecryptable' }
  }

  let payload: HandoffPayload
  try {
    payload = JSON.parse(plaintext)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (
    payload?.v !== 1 ||
    typeof payload.st !== 'string' ||
    payload.st.length === 0 ||
    typeof payload.aud !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' }
  }

  if (payload.exp <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (payload.aud !== expectedOrigin) {
    return { ok: false, reason: 'wrong-audience' }
  }

  return { ok: true, sessionCookieValue: payload.st }
}
