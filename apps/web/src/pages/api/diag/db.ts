// Dev-only DB connection diagnostic.
//
// GET /api/diag/db — reports how the app resolves its database connection and
// runs a live `SELECT` through the real app path (the HYPERDRIVE binding), so
// you can see what it's trying to reach and whether it actually connects.
//
// SAFETY: returns 404 on any non-local host, so it exposes nothing from a
// deployed Worker. Passwords are masked; error text is scrubbed of credentials.
// Made public (no session) in middleware.ts so it's reachable while debugging
// auth/DB wiring; the host gate below is the real guard.
import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createDb } from '../../../db'
import { isLocalDevHost } from '../../../lib/oauth/local-dev-secure'

export const prerender = false

const HYPERDRIVE_LOCAL_ENV = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE'

function maskUser(u: string): string {
  return u.length <= 3 ? '***' : `${u.slice(0, 2)}***`
}

// Strip any `scheme://user:pass@` credentials from a string (errors, etc.).
function scrub(s: string): string {
  return s.replace(/\/\/[^@\s/]*@/g, '//***:***@')
}

function describeConn(connStr: string | undefined | null) {
  if (!connStr) return null
  try {
    const u = new URL(connStr)
    return {
      protocol: u.protocol.replace(/:$/, ''),
      host: u.hostname,
      port: u.port || '(default)',
      database: u.pathname.replace(/^\//, '') || '(none)',
      user: u.username ? maskUser(u.username) : '(none)',
      hasPassword: Boolean(u.password),
      sslmode: u.searchParams.get('sslmode') ?? '(unset)',
    }
  } catch {
    return { parseError: true as const }
  }
}

export const GET: APIRoute = async ({ request }) => {
  const host = new URL(request.url).hostname
  const devHost =
    import.meta.env.DEV ||
    isLocalDevHost(host) ||
    host === 'localhost' ||
    host === '127.0.0.1'
  if (!devHost) return new Response('Not found', { status: 404 })

  const e = env as unknown as Record<string, unknown>
  const hyperdrive = e.HYPERDRIVE as { connectionString?: string } | undefined
  const hyperdriveConn = hyperdrive?.connectionString
  const cloudflareOverride = e[HYPERDRIVE_LOCAL_ENV] as string | undefined

  const resolution = {
    // false under `pnpm dev` (astro build + wrangler dev) — see middleware notes.
    importMetaEnvDev: import.meta.env.DEV,
    // The astro-dev path reads this; unused under wrangler dev.
    processEnvDatabaseUrlSet:
      typeof process !== 'undefined' && Boolean(process.env?.DATABASE_URL),
    hyperdriveBindingPresent: Boolean(e.HYPERDRIVE),
    // The CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE value, as seen
    // in the *worker* env (i.e. present in .dev.vars). NOTE: this only reflects
    // intent — wrangler's Hyperdrive proxy reads the same var from its own
    // process env (lifted by scripts/dev.mjs). The test query below is ground truth.
    cloudflareHyperdriveLocalEnvSet: Boolean(cloudflareOverride),
    // What postgres-js actually dials. In local dev this is a *.hyperdrive.local
    // proxy that miniflare forwards to the configured target.
    connectsVia: describeConn(hyperdriveConn),
  }

  // The real target the Hyperdrive proxy is configured to reach (the actual DB).
  const configuredTarget = describeConn(cloudflareOverride)

  let test:
    | { ran: false; error: string }
    | { ran: true; ok: boolean; ms: number; row?: unknown; error?: string }

  if (!hyperdriveConn) {
    test = { ran: false, error: 'HYPERDRIVE binding has no connectionString in this runtime.' }
  } else {
    const started = Date.now()
    const { sql } = createDb(hyperdriveConn)
    try {
      const rows = await sql<
        { ok: number; db: string; user: string; version: string }[]
      >`select 1 as ok, current_database() as db, current_user as "user", version() as version`
      test = {
        ran: true,
        ok: true,
        ms: Date.now() - started,
        row: {
          ...rows[0],
          // version() is a long banner; keep the leading "PostgreSQL x.y …".
          version: String(rows[0]?.version ?? '').split(' on ')[0],
        },
      }
    } catch (err) {
      test = {
        ran: true,
        ok: false,
        ms: Date.now() - started,
        error: scrub(err instanceof Error ? err.message : String(err)),
      }
    } finally {
      try {
        await sql.end({ timeout: 5 })
      } catch {
        /* ignore teardown errors */
      }
    }
  }

  const body = {
    ok: 'ok' in test && test.ok === true,
    test,
    resolution,
    configuredTarget,
    notes: [
      'Under `pnpm dev` the app connects through the HYPERDRIVE binding (resolution.connectsVia — a *.hyperdrive.local proxy). The real DB is the proxy target = configuredTarget, set via CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE (kept in .dev.vars, lifted into wrangler\'s process env by scripts/dev.mjs).',
      'If test.ok is true, DB access works. If configuredTarget is host "localhost"/db "placeholder", the override was not applied — restart `pnpm dev`.',
      'Dev-only: 404 on non-local hosts. Hit it without being logged in so the middleware does not attempt a session DB lookup.',
    ],
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: body.ok ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
