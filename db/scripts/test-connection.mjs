// Connectivity check for the master database, via DATABASE_URL in db/.dev.vars.
//
// The point is not "can I reach a database" — it is "am I reaching it THROUGH
// the tunnel". Those differ, and the difference is easy to miss: while
// DATABASE_URL still names the DigitalOcean cluster host, this script connects
// happily and proves nothing about `pnpm db:up`. So it classifies the target
// first and says plainly which path it took.
//
// Usage:  pnpm db:test

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import net from 'node:net'
import postgres from 'postgres'

const ROOT = resolve(import.meta.dirname, '..')
const TUNNEL_PORT = Number(process.env.DB_TUNNEL_LOCAL_PORT || 5433)

// Same candidate order as drizzle.config.ts and migrate.mjs: an explicit
// DATABASE_URL wins, then db/.dev.vars, then apps/web/.dev.vars.
if (!process.env.DATABASE_URL) {
  for (const candidate of ['./.dev.vars', '../apps/web/.dev.vars']) {
    const p = resolve(ROOT, candidate)
    if (existsSync(p)) {
      process.loadEnvFile(p)
      break
    }
  }
}

const raw = process.env.DATABASE_URL
if (!raw) {
  process.stderr.write(
    '\n  ✘ DATABASE_URL is not set.\n' +
      '    Add it to db/.dev.vars (see db/tunnel/README.md for the loopback form).\n\n',
  )
  process.exit(1)
}

/** Never print the password — this output gets pasted into issues and chats. */
const redact = (u) => u.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]*@/, '$1<redacted>@')

let url
try {
  url = new URL(raw)
} catch {
  process.stderr.write(`\n  ✘ DATABASE_URL is not a valid URL: ${redact(raw)}\n\n`)
  process.exit(1)
}

const host = url.hostname
const port = Number(url.port || 5432)
const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
const user = decodeURIComponent(url.username)
const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1'
const viaTunnel = isLoopback && port === TUNNEL_PORT

function probe(p, timeoutMs = 1500) {
  return new Promise((res) => {
    const s = new net.Socket()
    const done = (v) => {
      s.destroy()
      res(v)
    }
    s.setTimeout(timeoutMs)
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
    s.connect(p, '127.0.0.1')
  })
}

const label = viaTunnel
  ? 'loopback — through the db:up tunnel'
  : isLoopback
    ? `loopback, but port ${port} is not the tunnel port (${TUNNEL_PORT})`
    : 'PUBLIC host — this BYPASSES the tunnel'

process.stdout.write(`\n  target      ${host}:${port}/${database}\n`)
process.stdout.write(`  path        ${label}\n`)
process.stdout.write(`  tunnel      ${(await probe(TUNNEL_PORT)) ? `listening on 127.0.0.1:${TUNNEL_PORT}` : `nothing on 127.0.0.1:${TUNNEL_PORT}`}\n`)

if (!viaTunnel) {
  process.stdout.write(
    `\n  ⚠ Not testing the tunnel. DATABASE_URL names ${isLoopback ? 'the wrong port' : 'a public host'}, so a\n` +
      `    success below says nothing about whether ${'`pnpm db:up`'} works. To exercise it,\n` +
      `    point DATABASE_URL at 127.0.0.1:${TUNNEL_PORT} (db/tunnel/README.md).\n`,
  )
}

// postgres-js takes the URL as-is and treats sslmode=require as "encrypt, do not
// verify the chain" — right for the DO managed cluster, and required for the
// tunnel, whose loopback host can never match the origin certificate.
const sql = postgres(raw, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 2,
  onnotice: () => {},
})

const t0 = Date.now()
let code = 0
try {
  const [{ version }] = await sql`SELECT version()`
  const [{ db, usr }] = await sql`SELECT current_database() AS db, current_user AS usr`
  const elapsed = Date.now() - t0

  process.stdout.write(`\n  ✓ connected in ${elapsed}ms\n`)
  process.stdout.write(`  server      ${version.split(' ').slice(0, 2).join(' ')}\n`)
  process.stdout.write(`  identity    user=${usr} database=${db}\n`)

  const tables = await sql`
    SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'baseout'
  `
  process.stdout.write(`  schema      baseout — ${tables[0].n} tables\n`)

  // Cheap drift signal: the same comparison `pnpm db:check` gates dev startup on.
  const tracked = await sql`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `
  if (tracked[0].n === 0) {
    process.stdout.write(`  migrations  tracker absent — nothing applied yet\n`)
  } else {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`
    const journalPath = resolve(ROOT, 'migrations/meta/_journal.json')
    let expected = null
    if (existsSync(journalPath)) {
      const { readFileSync } = await import('node:fs')
      expected = (JSON.parse(readFileSync(journalPath, 'utf8')).entries ?? []).length
    }
    const verdict =
      expected === null ? '' : n >= expected ? '  ✓ in sync' : `  ✗ BEHIND by ${expected - n}`
    process.stdout.write(
      `  migrations  ${n} applied${expected === null ? '' : ` of ${expected} in the journal`}${verdict}\n`,
    )
  }
  process.stdout.write('\n')
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`\n  ✘ could not connect: ${msg}\n`)

  // Map the failure to the thing that actually needs doing.
  if (viaTunnel && !(await probe(TUNNEL_PORT))) {
    process.stderr.write('\n    The tunnel is not running.  Fix: pnpm db:up\n')
  } else if (viaTunnel && /ECONNRESET|ECONNABORTED|socket hang up|timeout|ETIMEDOUT/i.test(msg)) {
    // cloudflared opens the loopback listener before it authenticates, so it
    // accepts the TCP connection and then drops it. ECONNRESET here means the
    // local proxy is running but the far end never came up — not a DB problem.
    process.stderr.write(
      '\n    cloudflared is listening but the connection was dropped, so nothing is\n' +
        '    reaching Postgres. It opens the port BEFORE authenticating, which is why\n' +
        '    the port looks healthy. Two usual causes:\n' +
        '      1. Not authenticated — Access uses an email policy and needs a browser\n' +
        '         login:  pnpm db:down && pnpm db:up --foreground\n' +
        '      2. The hostname has no ingress rule on the tunnel, so requests hit the\n' +
        '         catch-all 404 ("websocket: bad handshake" in db/tunnel/.tunnel.log).\n' +
        '    Check the log:  tail db/tunnel/.tunnel.log\n',
    )
  } else if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    process.stderr.write(
      `\n    ${host} does not resolve. If this is the DigitalOcean cluster host, it has no\n` +
        '    public ingress any more — switch DATABASE_URL to the loopback form and use the\n' +
        '    tunnel (db/tunnel/README.md).\n',
    )
  } else if (/ECONNREFUSED/i.test(msg)) {
    process.stderr.write(`\n    Nothing is listening on ${host}:${port}.\n`)
  } else if (/password|authentication|role/i.test(msg)) {
    process.stderr.write('\n    Reached the server, but the credentials were rejected.\n')
  }
  process.stderr.write(`\n    DATABASE_URL = ${redact(raw)}\n\n`)
  code = 1
} finally {
  await sql.end({ timeout: 5 })
}
process.exit(code)
