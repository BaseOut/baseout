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

function fail(status: number, message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handoff failed — Baseout Admin</title></head>
<body style="font-family:ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b0f17;color:#e5e7eb">
<div style="text-align:center;max-width:32rem;padding:2rem"><h1>Sign-in handoff failed</h1>
<p style="color:#9ca3af">${message}</p>
<p><a href="/" style="color:#3b82f6">Try again</a></p></div></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const secret = (env as unknown as { ADMIN_HANDOFF_SECRET?: string }).ADMIN_HANDOFF_SECRET
  if (!secret) {
    return fail(500, 'The console is missing its handoff secret (ADMIN_HANDOFF_SECRET).')
  }

  const token = url.searchParams.get('token')
  if (!token) {
    return fail(400, 'Missing handoff token.')
  }

  const opened = await openHandoffToken(token, secret, url.origin, new Date())
  if (!opened.ok) {
    return fail(400, `The sign-in link is invalid or has expired (${opened.reason}). Handoff tokens last 60 seconds — start again from the console.`)
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
    return fail(403, `Your session did not validate (${decision.reason}).`)
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
