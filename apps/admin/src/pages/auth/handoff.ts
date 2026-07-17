/**
 * GET /auth/handoff?token=… — lands the cross-origin session handoff minted by
 * web's /api/admin/handoff (openspec/changes/shared-admin-dev-deploy).
 *
 * Opens the short-lived AES-256-GCM token (audience-bound to this origin),
 * validates the carried session READ-ONLY against the master DB (existence +
 * expiry + role='super' — the same gate the middleware applies on every
 * request), then sets admin's own host-only `baseout_admin_session` cookie and
 * redirects to the console. Admin still runs no better-auth and never mutates
 * sessions; web logout deletes the session row, which kills admin access on
 * the next request.
 *
 * The middleware exempts exactly this path from the gate (a visitor arriving
 * here by definition has no admin-readable cookie yet).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { eq, inArray } from 'drizzle-orm'
import { users, sessions } from '../../db/schema'
import { openHandoffToken } from '../../lib/handoff'
import { sessionTokenCandidates, decideAccess } from '../../lib/admin-session'

const COOKIE_NAME = 'baseout_admin_session'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30 // 30d cap; the per-request DB expiry check is the real gate

// Failures land on the on-brand sign-in page with a whitelisted error code
// (rendered by signInView — see lib/auth-pages.ts). The former per-failure
// HTTP statuses are traded for the redirect; nothing machine-consumes them,
// and the destination page communicates the failure.
function fail(code: 'misconfigured' | 'missing_token' | 'invalid_token' | 'session_invalid'): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `/auth/sign-in?error=${code}`, 'Cache-Control': 'no-store' },
  })
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const secret = (env as unknown as { ADMIN_HANDOFF_SECRET?: string }).ADMIN_HANDOFF_SECRET
  if (!secret) {
    return fail('misconfigured')
  }

  const token = url.searchParams.get('token')
  if (!token) {
    return fail('missing_token')
  }

  const opened = await openHandoffToken(token, secret, url.origin, new Date())
  if (!opened.ok) {
    return fail('invalid_token')
  }

  // Read-only session validation — identical checks to the middleware gate.
  const candidates = sessionTokenCandidates(opened.sessionCookieValue)
  const found = await locals.db
    .select({ role: users.role, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(inArray(sessions.token, candidates))
    .limit(1)
  const decision = decideAccess(found[0] ?? null, new Date())
  if (!decision.ok) {
    return fail('session_invalid')
  }

  // Secure only on https — the deployed path is always https; the (unused)
  // local-http path would otherwise silently drop the cookie.
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': `${COOKIE_NAME}=${opened.sessionCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_S}${secure}`,
      'Cache-Control': 'no-store',
    },
  })
}
