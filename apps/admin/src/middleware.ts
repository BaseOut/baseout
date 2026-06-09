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

// SSR runs in a workerd runner under `astro dev` (and in the deployed Worker),
// so the master DB is always reached through the Hyperdrive binding — never a
// direct postgres-js TCP connection, which workerd can't make to a remote host.
// In dev, miniflare proxies the binding to the `localConnectionString` rendered
// from .env (scripts/dev.mjs); deployed, it uses the Hyperdrive `id`.
function resolveDbUrl(): string {
  return env.HYPERDRIVE.connectionString
}

// Base URL of the customer app (apps/web), where login lives. Admin has no
// login of its own — it reuses web's better-auth session — so the
// un-authenticated case routes here. Override via WEB_APP_URL; defaults to the
// canonical local dev origin.
function webAppUrl(): string {
  const fromEnv = import.meta.env.DEV
    ? process.env.WEB_APP_URL
    : (env as unknown as { WEB_APP_URL?: string }).WEB_APP_URL
  return (fromEnv ?? 'https://baseout.local:4331').replace(/\/$/, '')
}

const PAGE_HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b0f17;color:#e5e7eb}
.card{text-align:center;max-width:32rem;padding:2rem}h1{font-size:3rem;margin:0 0 .5rem}p{color:#9ca3af;margin:.4rem 0}
.btn{display:inline-block;margin-top:1.25rem;padding:.6rem 1.4rem;border-radius:.5rem;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600}
.btn:hover{background:#2563eb}.muted{font-size:.8rem;opacity:.6}</style>`

// Un-authenticated (no/expired session): offer a route into web's login,
// carrying a returnTo back to this admin origin so the magic link round-trips
// staff straight back here after authenticating.
function renderSignIn(reason: string, selfOrigin: string): Response {
  const login = `${webAppUrl()}/login?returnTo=${encodeURIComponent(selfOrigin)}`
  const html = `<!doctype html><html lang="en" data-theme="dark"><head>${PAGE_HEAD}
<title>Sign in — Baseout Admin</title></head><body><div class="card">
<h1>Sign in</h1>
<p>This is the Baseout staff console. Sign in with your staff account to continue.</p>
<a class="btn" href="${login}">Sign in to Baseout</a>
<p class="muted">After signing in, return to this tab and refresh. (${reason})</p>
</div></body></html>`
  return new Response(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Authenticated but not staff: don't tell them to "sign in" (they already are).
function renderNotStaff(): Response {
  const html = `<!doctype html><html lang="en" data-theme="dark"><head>${PAGE_HEAD}
<title>403 — Staff only</title></head><body><div class="card">
<h1>403</h1>
<p>You're signed in, but this console is restricted to Baseout staff.</p>
<a class="btn" href="${webAppUrl()}">Back to Baseout</a>
</div></body></html>`
  return new Response(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { db, sql } = createDb(resolveDbUrl())
  context.locals.db = db

  try {
    const cookieHeader = context.request.headers.get('cookie') ?? ''
    const cookieValue = extractSessionTokenCookie(cookieHeader)

    let row: { role: string; expiresAt: Date } | null = null
    if (cookieValue) {
      const candidates = sessionTokenCandidates(cookieValue)
      const found = await db
        .select({ role: users.role, expiresAt: sessions.expiresAt, userId: users.id, email: users.email })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(inArray(sessions.token, candidates))
        .limit(1)
      if (found[0]) {
        row = { role: found[0].role, expiresAt: found[0].expiresAt }
        context.locals.user = {
          id: found[0].userId,
          email: found[0].email,
          role: found[0].role,
        }
      }
    }

    const decision = decideAccess(row, new Date())
    if (!decision.ok) {
      // 'not-super' means they ARE signed in (just not staff) — don't bounce
      // them to login. 'no-session' / 'expired' route into web's login.
      if (decision.reason === 'not-super') {
        return renderNotStaff()
      }
      context.locals.user = null
      return renderSignIn(decision.reason, new URL(context.request.url).origin)
    }

    return await next()
  } finally {
    // Release the socket without blocking the response. Low-traffic staff
    // console — a per-request connection is acceptable for this slice.
    void sql.end({ timeout: 5 })
  }
})
