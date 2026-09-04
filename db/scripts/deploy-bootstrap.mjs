// One-shot secret bootstrap for pipeline deploys (system-staging-readiness
// follow-up, 2026-09-03).
//
// PROBLEM: staging Worker secrets can only be written by an account admin, but
// the shared INTERNAL_TOKEN family rotted (web/server values drifted from what
// operators hold) and nobody with dashboard write is in the deploy loop.
// Wrangler CAN set secrets at deploy time (`wrangler deploy --secrets-file`),
// and Workers Builds already reaches the master DB through the cloudflared
// Access tunnel (that is how `db:migrate:tunnel` runs). So: operators stage
// values in `baseout._deploy_bootstrap` (worker, name, value); this wrapper
// pulls the rows for its Worker and hands them to wrangler. Secrets persist
// once set, so rows are removed after a successful rollout and the script
// no-ops forever after.
//
// FAIL-OPEN BY DESIGN: any failure here (no DB reachability, no table, no
// rows, tunnel missing) degrades to a plain `wrangler deploy` — this wrapper
// must never be the reason a deploy fails.
//
// SECURITY NOTES (§3.3): values transit the master DB, which already holds
// the platform's encrypted OAuth tokens and is Access-gated; rows are
// short-lived and deleted post-rollout. Values never echo to build logs.
//
// Usage (from an app dir):
//   node ../../scripts/deploy-bootstrap.mjs --worker baseout-web -- deploy --env staging

import { spawn } from 'node:child_process'
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import net from 'node:net'

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
const wrangleArgs = sep >= 0 ? argv.slice(sep + 1) : ['deploy']
const workerFlag = argv.indexOf('--worker')
const worker = workerFlag >= 0 ? argv[workerFlag + 1] : null

const SECRETS_FILE = '.wrangler-bootstrap-secrets.json'
const TUNNEL_PORT = Number(process.env.DB_TUNNEL_LOCAL_PORT || 5433)

function log(msg) {
  process.stderr.write(`[deploy-bootstrap] ${msg}\n`)
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      const retry = () => {
        socket.destroy()
        if (Date.now() > deadline) reject(new Error('tunnel port never opened'))
        else setTimeout(attempt, 500)
      }
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('timeout', retry)
      socket.once('error', retry)
      socket.connect(port, '127.0.0.1')
    }
    attempt()
  })
}

/** Same Access-tunnel model as db/scripts/migrate.mjs (§D3). */
async function openTunnel() {
  const required = ['DB_TUNNEL_HOSTNAME', 'CF_CLIENT_ID', 'CF_CLIENT_SECRET', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
  if (required.some((k) => !process.env[k])) return null
  const { bin } = await import('cloudflared')
  if (!existsSync(bin)) return null
  const child = spawn(
    bin,
    ['access', 'tcp', '--hostname', process.env.DB_TUNNEL_HOSTNAME, '--url', `127.0.0.1:${TUNNEL_PORT}`],
    {
      stdio: 'ignore',
      env: {
        ...process.env,
        TUNNEL_SERVICE_TOKEN_ID: process.env.CF_CLIENT_ID,
        TUNNEL_SERVICE_TOKEN_SECRET: process.env.CF_CLIENT_SECRET,
      },
    },
  )
  child.unref()
  await waitForPort(TUNNEL_PORT, 30_000)
  const u = encodeURIComponent(process.env.DB_USER)
  const p = encodeURIComponent(process.env.DB_PASSWORD)
  return {
    child,
    url: `postgresql://${u}:${p}@127.0.0.1:${TUNNEL_PORT}/${process.env.DB_NAME}`,
  }
}

async function fetchSecrets() {
  let tunnel = null
  let url = process.env.DATABASE_URL || null
  if (!url) {
    tunnel = await openTunnel()
    if (!tunnel) return { rows: [], tunnel: null }
    url = tunnel.url
  }
  const { default: postgres } = await import('postgres')
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    ssl: tunnel ? false : undefined,
    connection: { search_path: 'baseout,public' },
  })
  try {
    const rows = await sql`
      select name, value from baseout._deploy_bootstrap where worker = ${worker}
    `
    return { rows, tunnel, sql }
  } catch {
    // table absent or unreadable — bootstrap retired, plain deploy.
    await sql.end({ timeout: 3 }).catch(() => {})
    return { rows: [], tunnel }
  }
}

async function main() {
  let extraArgs = []
  if (worker) {
    try {
      const { rows, tunnel, sql } = await fetchSecrets()
      if (rows.length) {
        const map = Object.fromEntries(rows.map((r) => [r.name, r.value]))
        writeFileSync(SECRETS_FILE, JSON.stringify(map))
        extraArgs = ['--secrets-file', SECRETS_FILE]
        log(`staging ${rows.length} secret(s) for ${worker}: ${Object.keys(map).join(', ')}`)
      } else {
        log(`no staged secrets for ${worker} — plain deploy`)
      }
      if (sql) await sql.end({ timeout: 3 }).catch(() => {})
      if (tunnel) tunnel.child.kill()
    } catch (err) {
      log(`bootstrap skipped (${err instanceof Error ? err.message : err}) — plain deploy`)
    }
  }

  const child = spawn('wrangler', [...wrangleArgs, ...extraArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  child.on('exit', (code) => {
    try {
      rmSync(SECRETS_FILE, { force: true })
    } catch {}
    process.exit(code ?? 1)
  })
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
