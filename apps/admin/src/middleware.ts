import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from './db'
import { users, sessions } from './db/schema'
import {
  extractSessionTokenCookie,
  sessionTokenCandidates,
  decideAccess,
} from './lib/admin-session'
import { gateOutcome } from './lib/gate'
import { json } from './lib/actions/http'

// SSR runs in a workerd runner under `astro dev` (and in the deployed Worker),
// so the master DB is always reached through the Hyperdrive binding — never a
// direct postgres-js TCP connection, which workerd can't make to a remote host.
// In dev, miniflare proxies the binding to the `localConnectionString` rendered
// from .env (scripts/dev.mjs); deployed, it uses the Hyperdrive `id`.
function resolveDbUrl(): string {
  return env.HYPERDRIVE.connectionString
}

// Gate policy: the session lookup happens here; the decision → response
// mapping is the pure gateOutcome (lib/gate.ts). Failures land on the
// on-brand /auth/sign-in + /auth/forbidden pages (302) or JSON 401/403 for
// /api/* paths — the old inline hardcoded-HTML 403s are gone.
export const onRequest = defineMiddleware(async (context, next) => {
  const { db, sql } = createDb(resolveDbUrl())
  context.locals.db = db

  try {
    // The handoff landing route is the one path a visitor reaches WITHOUT an
    // admin-readable cookie (it's what sets one). It re-runs the same session
    // + role checks itself, read-only, before setting the cookie.
    if (context.url.pathname === '/auth/handoff') {
      context.locals.user = null
      return await next()
    }

    const cookieHeader = context.request.headers.get('cookie') ?? ''
    const cookieValue = extractSessionTokenCookie(cookieHeader)

    let row: { role: string; email?: string | null; expiresAt: Date } | null = null
    context.locals.user = null
    if (cookieValue) {
      const candidates = sessionTokenCandidates(cookieValue)
      const found = await db
        .select({ role: users.role, expiresAt: sessions.expiresAt, userId: users.id, email: users.email })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(inArray(sessions.token, candidates))
        .limit(1)
      if (found[0]) {
        row = { role: found[0].role, email: found[0].email, expiresAt: found[0].expiresAt }
        context.locals.user = {
          id: found[0].userId,
          email: found[0].email,
          role: found[0].role,
        }
      }
    }

    const decision = decideAccess(row, new Date())
    const outcome = gateOutcome(decision, context.url.pathname)

    if (outcome.kind === 'redirect') {
      if (!decision.ok) context.locals.user = null
      return context.redirect(outcome.location, 302)
    }
    if (outcome.kind === 'json') {
      context.locals.user = null
      return json(outcome.status, { error: outcome.error })
    }
    if (!decision.ok) context.locals.user = null
    return await next()
  } finally {
    // Release the socket without blocking the response. Low-traffic staff
    // console — a per-request connection is acceptable for this slice.
    void sql.end({ timeout: 5 })
  }
})
