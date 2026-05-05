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
}
