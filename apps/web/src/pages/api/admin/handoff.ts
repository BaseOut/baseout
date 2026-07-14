/**
 * GET /api/admin/handoff — cross-origin session handoff for the staff console
 * (openspec/changes/shared-admin-dev-deploy).
 *
 * The deployed admin Worker (baseout-admin-dev.openside.workers.dev) can never
 * receive web's better-auth session cookie: it's host-only, and workers.dev is
 * on the Public Suffix List so no Domain= cookie can span the two Workers.
 * This route runs same-origin (the middleware has already validated the
 * session), checks the caller is staff, then mints a short-lived AES-256-GCM
 * token carrying the session-cookie value and 302s to admin's /auth/handoff,
 * which sets its own host-only cookie.
 *
 * The target is ALWAYS env.ADMIN_APP_URL — deliberately not a query param.
 * Carrying the origin as ?to=<encoded> broke the magic-link round-trip:
 * better-auth's verify endpoint decodeURIComponent()s the callbackURL an
 * extra time and its relative-path regex then rejects the revealed "https://"
 * (INVALID_CALLBACK_URL, 2026-07-13). A bare path survives any decode depth,
 * and there is exactly one admin origin per env anyway.
 *
 * Security properties: 60s TTL, audience-bound to the exact admin origin,
 * authenticated encryption (GCM), staff-role check at mint time, Cache-Control
 * no-store. The token transits once in a query string — accepted for this
 * interim staff gate; superseded by Google SSO in the `admin` umbrella change.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { extractSessionTokenCookie } from '../../../lib/session-cache'
import { encryptToken } from '../../../lib/crypto'

export const HANDOFF_TTL_MS = 60_000

export interface HandoffPayload {
  v: 1
  st: string // full session-cookie value (token.signature)
  aud: string // admin origin the token is bound to
  exp: number // epoch ms
}

export interface HandoffDeps {
  adminAppUrl: string | undefined
  secret: string | undefined
  sessionCookieValue: string | null
  fetchRole: () => Promise<string | null>
  now: Date
}

// Pure handler — the GET wrapper below adapts the Astro context.
export async function handleAdminHandoff(deps: HandoffDeps): Promise<Response> {
  const { adminAppUrl, secret, sessionCookieValue, fetchRole, now } = deps

  if (!secret) {
    return json(500, { error: 'Handoff is not configured (ADMIN_HANDOFF_SECRET missing)' })
  }

  // The one-and-only target: the env's configured staff-console origin.
  if (!adminAppUrl) {
    return json(500, { error: 'Handoff is not configured (ADMIN_APP_URL missing)' })
  }
  let aud: string
  try {
    aud = new URL(adminAppUrl).origin
  } catch {
    return json(500, { error: 'Handoff is not configured (ADMIN_APP_URL is not a URL)' })
  }

  if (!sessionCookieValue) {
    return json(401, { error: 'Not authenticated' })
  }

  const role = await fetchRole()
  if (role !== 'super') {
    return json(403, { error: 'Staff only' })
  }

  const payload: HandoffPayload = {
    v: 1,
    st: sessionCookieValue,
    aud,
    exp: now.getTime() + HANDOFF_TTL_MS,
  }
  const token = await encryptToken(JSON.stringify(payload), secret)

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${aud}/auth/handoff?token=${encodeURIComponent(token)}`,
      'Cache-Control': 'no-store',
    },
  })
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export const GET: APIRoute = async ({ request, locals }) => {
  const userId = locals.user?.id
  return handleAdminHandoff({
    adminAppUrl: (env as unknown as { ADMIN_APP_URL?: string }).ADMIN_APP_URL,
    secret: (env as unknown as { ADMIN_HANDOFF_SECRET?: string }).ADMIN_HANDOFF_SECRET,
    sessionCookieValue: extractSessionTokenCookie(request.headers.get('cookie') ?? ''),
    fetchRole: async () => {
      // locals.user doesn't carry role — one narrow read of users.role.
      if (!userId) return null
      const rows = await locals.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      return rows[0]?.role ?? null
    },
    now: new Date(),
  })
}
