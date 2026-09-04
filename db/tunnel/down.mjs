// Stop the local cloudflared tunnel started by `pnpm db:up`.
//
// Also usable as a status probe: `pnpm db:status` runs this with --status, which
// reports without killing anything.

import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import net from 'node:net'

const HERE = import.meta.dirname
const PID_FILE = resolve(HERE, '.tunnel.pid')
const PORT = Number(process.env.DB_TUNNEL_LOCAL_PORT || 5433)
const STATUS_ONLY = process.argv.includes('--status')

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

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const pid = existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, 'utf8').trim()) : null
const alive = pid && pidAlive(pid)
const open = await portOpen(PORT)

if (STATUS_ONLY) {
  if (open && alive) process.stdout.write(`  up    127.0.0.1:${PORT}  (pid ${pid})\n`)
  else if (open) process.stdout.write(`  up    127.0.0.1:${PORT}  (not started by db:up — foreign process)\n`)
  else process.stdout.write(`  down  nothing listening on 127.0.0.1:${PORT}  — start with: pnpm db:up\n`)
  // Always exit 0. A non-zero "it is down" is a legitimate answer, not a
  // failure, and pnpm buries it under ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL.
  process.exit(0)
}

if (!pid) {
  // A port held by something we did not start is deliberately left alone —
  // it could be a local Postgres or a hand-run cloudflared.
  process.stdout.write(
    open
      ? `  no .tunnel.pid, but 127.0.0.1:${PORT} is in use by another process — left alone\n`
      : `  already down\n`,
  )
  process.exit(0)
}

if (!alive) {
  unlinkSync(PID_FILE)
  process.stdout.write(`  stale pid ${pid} cleaned up; nothing was running\n`)
  process.exit(0)
}

process.kill(pid)
// SIGTERM is enough for cloudflared; give it a moment, then confirm.
for (let i = 0; i < 20 && pidAlive(pid); i++) await new Promise((r) => setTimeout(r, 100))
if (pidAlive(pid)) {
  process.kill(pid, 'SIGKILL')
  process.stdout.write(`  tunnel pid ${pid} did not exit on SIGTERM — SIGKILLed\n`)
} else {
  process.stdout.write(`  ✓ tunnel stopped (pid ${pid})\n`)
}
unlinkSync(PID_FILE)
