import { spawnSync } from 'node:child_process'
import postgres from 'postgres'

const DEFAULT_URL = 'postgres://postgres:postgres@127.0.0.1:5432/baseout_test'
const READY_TIMEOUT_MS = 30_000
const READY_INTERVAL_MS = 500

async function waitForPostgres(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  let lastErr: unknown
  while (Date.now() < deadline) {
    const sql = postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 2 })
    try {
      await sql`SELECT 1`
      await sql.end({ timeout: 1 })
      return
    } catch (err) {
      lastErr = err
      await sql.end({ timeout: 1 }).catch(() => {})
      await new Promise((r) => setTimeout(r, READY_INTERVAL_MS))
    }
  }
  throw new Error(
    `Postgres not reachable at ${url} after ${READY_TIMEOUT_MS}ms. ` +
      `Run \`npm run test:db:up\` to start the test database.\n` +
      `Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
}

async function ensureSchema(url: string): Promise<void> {
  const sql = postgres(url, { max: 1 })
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS baseout`
  } finally {
    await sql.end({ timeout: 2 })
  }
}

function runMigrations(url: string): void {
  const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DRIZZLE_SSL: 'false' },
  })
  if (result.status !== 0) {
    throw new Error(`drizzle-kit migrate exited with status ${result.status}`)
  }
}

export default async function globalSetup(): Promise<() => void> {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL
  await waitForPostgres(url)
  await ensureSchema(url)
  runMigrations(url)
  return () => {}
}
