// Start a local `cloudflared access tcp` tunnel to the master database.
//
// Why this exists: the DigitalOcean cluster has no public ingress (systems-overview
// §9), so local dev can no longer point a connection string at the cluster host.
// This opens a loopback port that carries Postgres traffic through the same
// Cloudflare Tunnel the deployed Workers use, letting us drop the IP-allowlist
// approach entirely.
//
// Auth differs from CI on purpose. `db:migrate:tunnel` authenticates with an
// Access SERVICE TOKEN (CF_CLIENT_ID / CF_CLIENT_SECRET) because a build container
// cannot open a browser. Local dev goes through the EMAIL policy instead: the
// first run opens a browser, and cloudflared caches the token under
// ~/.cloudflared/ so subsequent runs are silent.
//
// Detached by design: the tunnel outlives the terminal that started it, because
// `pnpm dev`, `pnpm db:migrate`, and a psql session all want it up at once.
// `pnpm db:down` stops it.
//
// Usage:  pnpm db:up  [--foreground]

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import net from 'node:net'

const HERE = import.meta.dirname
const PID_FILE = resolve(HERE, '.tunnel.pid')
const LOG_FILE = resolve(HERE, '.tunnel.log')

const HOSTNAME = process.env.DB_TUNNEL_HOSTNAME || 'db.baseout.dev'
// 5433 matches db/scripts/migrate.mjs, so one running tunnel serves BOTH local
// dev and `pnpm db:migrate` — the migration runner reuses this port rather than
// racing a second cloudflared against it.
const PORT = Number(process.env.DB_TUNNEL_LOCAL_PORT || 5433)
const READY_TIMEOUT_MS = 60_000 // generous: the first run waits on a human
const FOREGROUND = process.argv.includes('--foreground')

function fail(message) {
  process.stderr.write(`\n  ✘ ${message}\n\n`)
  process.exit(1)
}

function portOpen(port, timeoutMs = 600) {
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

/**
 * Readiness, properly.
 *
 * `cloudflared access tcp` opens the loopback listener IMMEDIATELY and only then
 * blocks on Access auth, so "the port is open" says nothing about whether traffic
 * can traverse the tunnel — an unauthenticated tunnel accepts the connection and
 * then hangs. Checking the port alone reports a ready tunnel that times out on
 * first use.
 *
 * So speak Postgres at it: send an SSLRequest (the 8-byte startup packet every
 * server answers before auth) and require a single-byte 'S'/'N' reply. Only a
 * real server on the far end produces that.
 */
function pgReachable(port, timeoutMs = 4000) {
  return new Promise((res) => {
    const s = new net.Socket()
    let settled = false
    const done = (v) => {
      if (settled) return
      settled = true
      s.destroy()
      res(v)
    }
    s.setTimeout(timeoutMs)
    s.once('connect', () => {
      // int32 length = 8, int32 code = 80877103 (1234 << 16 | 5679)
      const pkt = Buffer.alloc(8)
      pkt.writeInt32BE(8, 0)
      pkt.writeInt32BE(80877103, 4)
      s.write(pkt)
    })
    s.once('data', (b) => done(b.length > 0 && (b[0] === 0x53 || b[0] === 0x4e))) // 'S' | 'N'
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
    s.once('close', () => done(false))
    s.connect(port, '127.0.0.1')
  })
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid() {
  if (!existsSync(PID_FILE)) return null
  const pid = Number(readFileSync(PID_FILE, 'utf8').trim())
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

async function main() {
  // Idempotent: running `db:up` twice is a no-op rather than a second tunnel
  // fighting for the port.
  if (await pgReachable(PORT)) {
    const pid = readPid()
    const who = pid && pidAlive(pid) ? `pid ${pid}` : 'not started by db:up'
    process.stdout.write(`  tunnel already up on 127.0.0.1:${PORT} (${who})\n`)
    return 0
  }
  if (await portOpen(PORT)) {
    fail(
      `127.0.0.1:${PORT} is in use but does not answer as Postgres.\n` +
        '    Either a stale cloudflared is still waiting on Access auth (pnpm db:down,\n' +
        '    then pnpm db:up --foreground), or another service holds the port.',
    )
  }

  const stale = readPid()
  if (stale && !pidAlive(stale)) unlinkSync(PID_FILE)

  const { bin } = await import('cloudflared')
  if (!existsSync(bin)) {
    process.stderr.write(
      '\n  ✘ cloudflared binary missing.\n' +
        "    It is fetched by the package's postinstall, which pnpm only runs for\n" +
        '    packages listed under `allowBuilds` in pnpm-workspace.yaml.\n' +
        '    Fix: pnpm install\n\n',
    )
    return 1
  }

  mkdirSync(HERE, { recursive: true })
  const args = ['access', 'tcp', '--hostname', HOSTNAME, '--url', `127.0.0.1:${PORT}`]

  if (FOREGROUND) {
    process.stdout.write(`  cloudflared access tcp → ${HOSTNAME} → 127.0.0.1:${PORT}  (foreground)\n`)
    const child = spawn(bin, args, { stdio: 'inherit' })
    return await new Promise((res) => child.on('exit', (c) => res(c ?? 0)))
  }

  const log = openSync(LOG_FILE, 'w')
  const child = spawn(bin, args, { detached: true, stdio: ['ignore', log, log] })
  child.unref()
  writeFileSync(PID_FILE, String(child.pid))

  process.stdout.write(`  starting tunnel → ${HOSTNAME} → 127.0.0.1:${PORT} (pid ${child.pid})\n`)

  // Watch the log while we wait. On a first run the Access EMAIL policy makes
  // cloudflared print a browser URL — invisible with detached stdio, so surface
  // it or the user just sees a hang.
  const deadline = Date.now() + READY_TIMEOUT_MS
  let announcedLogin = false
  for (;;) {
    if (await pgReachable(PORT)) {
      process.stdout.write(`  ✓ ready — Postgres answered through the tunnel on 127.0.0.1:${PORT}\n`)
      process.stdout.write(`    stop with: pnpm db:down\n`)
      return 0
    }
    if (!pidAlive(child.pid)) break

    const out = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : ''
    // Access prints the login URL on the APPLICATION's hostname
    // (…/cdn-cgi/access/cli?…), not on cloudflareaccess.com.
    const url = out.match(/https:\/\/\S*\/cdn-cgi\/access\/(?:cli|login)\S*/)?.[0]
    if (url && !announcedLogin) {
      announcedLogin = true
      process.stdout.write(
        `\n  ⚠ Access needs a browser login (email policy) before traffic can flow.\n` +
          `    Open:\n      ${url}\n\n  waiting for you to finish…\n`,
      )
    }
    if (Date.now() > deadline) break
    await new Promise((r) => setTimeout(r, 500))
  }

  const tail = (existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : '')
    .split('\n')
    .filter(Boolean)
    .slice(-12)
    .map((l) => `      ${l}`)
    .join('\n')

  process.stderr.write(
    `\n  ✘ tunnel did not open 127.0.0.1:${PORT}.\n\n` +
      `    Most likely, in order:\n` +
      `      1. ${HOSTNAME} has no ingress rule on the tunnel (DNS alone is not enough —\n` +
      `         requests fall through to the catch-all 404).\n` +
      `      2. No Access application covers ${HOSTNAME}, or your email is not in its policy.\n` +
      `      3. Browser login not completed — re-run with: pnpm db:up --foreground\n\n` +
      `    cloudflared said:\n${tail}\n\n`,
  )
  try {
    process.kill(child.pid)
  } catch {
    /* already gone */
  }
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
  return 1
}

process.exit(await main())
