import type { AccountContext } from './account'

// Per-isolate session cache. Keyed by the raw session_token cookie value, so
// changing cookie (login/logout) naturally invalidates. Writes that change
// user state exposed through the cache (e.g. completing onboarding) MUST call
// invalidateSessionCache(token) so the next request re-reads from the DB.
export type CachedAuth = {
  user: App.Locals['user']
  session: App.Locals['session']
  account: AccountContext | null
  expiresAt: number
}

export const SESSION_CACHE = new Map<string, CachedAuth>()
export const SESSION_TTL_MS = 30_000

// Parses the raw Cookie header and returns the better-auth session token, or
// null if absent. Accepts both the dev cookie name (`better-auth.session_token`)
// and the prod `__Secure-` prefixed variant. The regex anchors the name on a
// `;` boundary or the start of the header so a cookie like
// `x-better-auth.session_token=...` cannot match.
export function extractSessionTokenCookie(cookieHeader: string): string | null {
  const m = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  )
  return m ? m[1] : null
}

// Removes a cached session entry so the next middleware pass re-reads user
// state from the DB. Safe to call with null/empty tokens (no-op) and with
// tokens that aren't in the cache (no-op).
export function invalidateSessionCache(token: string | null | undefined): void {
  if (!token) return
  SESSION_CACHE.delete(token)
  void deleteSessionCacheL2(token)
}

export const SESSION_CACHE_CONTROL = `private, max-age=${Math.floor(SESSION_TTL_MS / 1000)}`

// better-auth's cookieCache (auth-factory.ts session.cookieCache) snapshots the
// user into a signed `session_data` cookie and getSession serves it VERBATIM
// for its 5-minute Max-Age — a second stale layer on top of SESSION_CACHE. A
// route that mutates a field the middleware gates on (termsAcceptedAt) must
// expire this cookie on its response alongside invalidateSessionCache, or the
// next navigation is decided by the stale snapshot and bounces the user back
// to /welcome (the blank-welcome trap, 2026-08-26). Both name variants are
// returned because the cookie is `__Secure-` prefixed on deployed https
// origins and plain under local dev (resolveUseSecureCookies).
export function expiredSessionDataCookies(): string[] {
  return [
    'better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    '__Secure-better-auth.session_data=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=None',
  ]
}

type SessionCachePayload = Pick<CachedAuth, 'user' | 'session' | 'account'>

export async function sessionCacheRequest(token: string): Promise<Request> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  const hex = [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return new Request(`https://session-cache.baseout.internal/${hex}`)
}

export function parseCachedAuthPayload(raw: string): SessionCachePayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('user' in parsed)) return null
    const body = parsed as SessionCachePayload
    return { user: body.user, session: body.session, account: body.account ?? null }
  } catch {
    return null
  }
}

export async function readSessionCacheL2(
  token: string,
): Promise<SessionCachePayload | null> {
  if (typeof caches === 'undefined') return null
  try {
    const hit = await caches.default.match(await sessionCacheRequest(token))
    if (!hit) return null
    return parseCachedAuthPayload(await hit.text())
  } catch {
    return null
  }
}

export async function writeSessionCacheL2(
  token: string,
  value: SessionCachePayload,
): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const req = await sessionCacheRequest(token)
    const res = new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': SESSION_CACHE_CONTROL,
      },
    })
    await caches.default.put(req, res)
  } catch {
    // Isolate / Cache API unavailable — L1 Map still covers this Worker.
  }
}

export async function deleteSessionCacheL2(token: string): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    await caches.default.delete(await sessionCacheRequest(token))
  } catch {
    // Best-effort; L1 is already cleared.
  }
}
