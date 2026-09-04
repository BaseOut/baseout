// Master-DB migration runner — `drizzle-kit migrate` behind a Postgres
// advisory lock, optionally through a Cloudflare Access TCP tunnel
// (root CLAUDE.md §3.9; openspec/changes/system-db-migrations design §D2/§D3).
//
// Two modes:
//
//   pnpm db:migrate           direct connection, DATABASE_URL from the env or
//                             from db/.dev.vars / apps/web/.dev.vars.
//   pnpm db:migrate:tunnel    opens `cloudflared access tcp` first and points
//                             the migration at the loopback port. Used by
//                             staging + production, whose master DB has no
//                             public ingress.
//
// Why a wrapper rather than calling drizzle-kit directly: apps/web's Cloudflare
// Workers Builds build command is `pnpm db:migrate:tunnel && <astro build>`, and
// a single push triggers seven app pipelines with no ordering between them. Add
// a manual run or a re-run of a stuck build and two migrators can overlap.
// `drizzle.__drizzle_migrations` is a LEDGER of what has been applied, not a
// mutex — two runners can both read "39 applied" and both try to apply 0040.
// The lock makes concurrent runs serialise instead of colliding mid-DDL.
//
// pg_advisory_lock is session-scoped, so the lock releases automatically when
// the connection drops: a cancelled or OOM-killed build cannot leave it held.
// That is why it beats LOCK TABLE, which would also need one transaction
// wrapping the whole run (drizzle-kit manages its own per-migration
// transactions, so it cannot be wrapped).

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'
import postgres from 'postgres'

// Paths resolve from this file, so the script works from any CWD. drizzle-kit
// itself must run with CWD=db/ — drizzle.config.ts paths are CWD-relative.
const ROOT = resolve(import.meta.dirname, '..')
const DRIZZLE_KIT = resolve(ROOT, 'node_modules/.bin/drizzle-kit')

// Arbitrary but STABLE key. Every runner must pass the same number or the lock
// is a no-op — never change this value.
const MIGRATION_LOCK_ID = 4_017_269_001

// Bounded wait so a stuck holder fails the build with a clear message instead
// of hanging the pipeline until Cloudflare's build timeout kills it.
const LOCK_TIMEOUT_MS = 5 * 60 * 1000
const LOCK_POLL_MS = 2000

const TUNNEL = process.env.TUNNEL === '1'
// 5433 keeps the proxy clear of a local Postgres on 5432.
const TUNNEL_PORT = Number(process.env.DB_TUNNEL_LOCAL_PORT || 5433)
const TUNNEL_READY_TIMEOUT_MS = 30_000

function fail(message) {
  process.stderr.write(`\n  ✘ ${message}\n\n`)
  process.exit(1)
}

/** Wait for cloudflared's loopback listener to accept connections. */
function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolvePromise, reject) => {
    const attempt = () => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      const retry = () => {
        socket.destroy()
        if (Date.now() > deadline) {
          reject(new Error(`cloudflared did not open 127.0.0.1:${port} within ${timeoutMs / 1000}s`))
        } else {
          setTimeout(attempt, 500)
        }
      }
      socket.once('connect', () => {
        socket.destroy()
        resolvePromise()
      })
      socket.once('timeout', retry)
      socket.once('error', retry)
      socket.connect(port, '127.0.0.1')
    }
    attempt()
  })
}

/**
 * Open `cloudflared access tcp` and return the child process. The service
 * token authenticates to the Access application in front of the database, so
 * no interactive browser login is possible or needed in CI.
 */
/** True if something is already serving the loopback port. */
function probePort(port, timeoutMs = 600) {
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
    s.connect(port, '127.0.0.1')
  })
}

async function openTunnel() {
  // Reuse a tunnel that `pnpm db:up` already opened on this port rather than
  // racing a second cloudflared against it. Local dev keeps one long-lived
  // tunnel up; CI has none, so it falls through and spawns its own.
  if (await probePort(TUNNEL_PORT)) {
    process.stdout.write(`  reusing the tunnel already on 127.0.0.1:${TUNNEL_PORT} (pnpm db:up)\n`)
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      fail(
        `a tunnel is already up on ${TUNNEL_PORT}, but DB_USER / DB_PASSWORD / DB_NAME\n` +
          '    are not set, so no connection string can be built. Either export them, or\n' +
          '    drop TUNNEL=1 and let DATABASE_URL point at 127.0.0.1 directly.',
      )
    }
    const u = encodeURIComponent(process.env.DB_USER)
    const p = encodeURIComponent(process.env.DB_PASSWORD)
    const n = encodeURIComponent(process.env.DB_NAME)
    process.env.DATABASE_URL = `postgres://${u}:${p}@127.0.0.1:${TUNNEL_PORT}/${n}?sslmode=require`
    return null // nothing of ours to tear down
  }

  const required = [
    'DB_TUNNEL_HOSTNAME',
    'CF_CLIENT_ID',
    'CF_CLIENT_SECRET',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    fail(
      `TUNNEL=1 but these build variables are not set: ${missing.join(', ')}.\n` +
        `    Set them on the Workers Builds project (or export them locally).`,
    )
  }

  const { bin } = await import('cloudflared')
  if (!existsSync(bin)) {
    fail(
      'the cloudflared binary is missing. It is fetched by the package\'s\n' +
        "    postinstall, which pnpm only runs for packages listed under\n" +
        '    `allowBuilds` in pnpm-workspace.yaml. Re-run `pnpm install`.',
    )
  }

  process.stdout.write(`  opening tunnel to ${process.env.DB_TUNNEL_HOSTNAME} ...\n`)
  const child = spawn(
    bin,
    [
      'access',
      'tcp',
      '--hostname',
      process.env.DB_TUNNEL_HOSTNAME,
      '--url',
      `127.0.0.1:${TUNNEL_PORT}`,
      '--service-token-id',
      process.env.CF_CLIENT_ID,
      '--service-token-secret',
      process.env.CF_CLIENT_SECRET,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  // cloudflared logs everything to stderr including routine progress; surface
  // only real errors so a successful build log stays readable.
  let stderrTail = ''
  child.stderr.on('data', (buf) => {
    const text = buf.toString()
    stderrTail = (stderrTail + text).slice(-2000)
    for (const line of text.split('\n')) {
      if (/\b(ERR|error|failed|denied|unauthorized)\b/i.test(line) && line.trim()) {
        process.stderr.write(`  [cloudflared] ${line.trim()}\n`)
      }
    }
  })

  let exited = false
  child.on('exit', (code) => {
    exited = true
    if (code !== 0 && code !== null) {
      process.stderr.write(`  [cloudflared] exited with code ${code}\n`)
    }
  })

  try {
    await waitForPort(TUNNEL_PORT, TUNNEL_READY_TIMEOUT_MS)
  } catch (err) {
    child.kill()
    // A bad service token shows up here as "did not open port", so include the
    // tail of cloudflared's own output — otherwise the cause is invisible.
    fail(
      `${err.message}\n\n    cloudflared output:\n` +
        stderrTail
          .split('\n')
          .filter(Boolean)
          .slice(-8)
          .map((l) => `      ${l}`)
          .join('\n'),
    )
  }
  if (exited) fail('cloudflared exited before the migration could start.')

  process.stdout.write(`  tunnel ready on 127.0.0.1:${TUNNEL_PORT}\n`)

  // Password must be encoded — managed-cluster passwords routinely contain
  // characters that are structural in a URL.
  const user = encodeURIComponent(process.env.DB_USER)
  const pass = encodeURIComponent(process.env.DB_PASSWORD)
  const name = encodeURIComponent(process.env.DB_NAME)
  process.env.DATABASE_URL = `postgres://${user}:${pass}@127.0.0.1:${TUNNEL_PORT}/${name}?sslmode=require`

  return child
}

function resolveDirectUrl() {
  // An explicit DATABASE_URL (Workers Builds / GHA build env) always wins; the
  // .dev.vars probe is the local-dev convenience. Same candidate order as
  // drizzle.config.ts — db/ first so CI can hold a migration-only credential,
  // apps/web/ as fallback so a working web setup needs no extra file.
  if (!process.env.DATABASE_URL) {
    for (const candidate of ['./.dev.vars', '../apps/web/.dev.vars']) {
      const envPath = resolve(ROOT, candidate)
      if (existsSync(envPath)) {
        process.loadEnvFile(envPath)
        break
      }
    }
  }
  if (!process.env.DATABASE_URL) {
    fail(
      'DATABASE_URL is not set.\n' +
        '    Local: add it to db/.dev.vars or apps/web/.dev.vars.\n' +
        '    CI:    set it as a build variable, or use `pnpm db:migrate:tunnel`.',
    )
  }
}

/** Poll pg_try_advisory_lock until acquired or LOCK_TIMEOUT_MS elapses. */
async function acquireLock(sql) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  let waited = false
  for (;;) {
    const [{ locked }] = await sql`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_ID}) AS locked`
    if (locked) {
      if (waited) process.stdout.write('  lock acquired.\n')
      return
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `another migration run has held the advisory lock for over ` +
          `${LOCK_TIMEOUT_MS / 1000}s. Check for a stuck build; the lock frees ` +
          `itself when that connection closes.`,
      )
    }
    if (!waited) {
      process.stdout.write('  waiting for another migration run to finish...\n')
      waited = true
    }
    await new Promise((r) => setTimeout(r, LOCK_POLL_MS))
  }
}

function runDrizzleKit() {
  return new Promise((resolvePromise, reject) => {
    // DATABASE_URL is inherited: drizzle.config.ts reads process.env, and its
    // .dev.vars probe cannot clobber it (process.loadEnvFile does not override
    // variables already present in the environment).
    const child = spawn(DRIZZLE_KIT, ['migrate'], { cwd: ROOT, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise()
      // drizzle-kit has a history of exiting non-zero with no output (the
      // 2026-07-27 silent failure). Name the exit status so the cause is at
      // least visible in the build log.
      else reject(new Error(`drizzle-kit migrate exited ${signal ? `on ${signal}` : `with code ${code}`}`))
    })
  })
}

let tunnel = null
let sql = null
let exitCode = 0
try {
  if (TUNNEL) tunnel = await openTunnel()
  else resolveDirectUrl()

  // postgres-js takes the URL as-is and treats sslmode=require as "encrypt, do
  // not verify the chain", which is what the DO managed cluster needs — and
  // what the tunnel needs too, since the loopback hostname will never match
  // the origin certificate. (The SELF_SIGNED_CERT_IN_CHAIN trap that forced
  // drizzle.config.ts to decompose the URL is specific to `pg` + drizzle-kit's
  // dbCredentials union type.)
  sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 0, // hold the session open for the lock's whole lifetime
    onnotice: () => {},
  })

  await acquireLock(sql)
  await runDrizzleKit()
} catch (err) {
  process.stderr.write(`\n  ✘ Migration failed: ${err instanceof Error ? err.message : String(err)}\n\n`)
  exitCode = 1
} finally {
  if (sql) {
    // Advisory locks are session-scoped, so ending the connection releases the
    // lock. Unlock explicitly anyway so the intent is legible in the code.
    try {
      await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`
    } catch {
      // Nothing to unlock (never acquired, or the session already died).
    }
    await sql.end({ timeout: 5 })
  }
  if (tunnel) tunnel.kill()
}
process.exit(exitCode)
