// Migration-drift guard for local dev.
//
// Compares apps/web/drizzle/meta/_journal.json (the canonical list of
// migration tags Drizzle expects to have been applied) against
// drizzle.__drizzle_migrations (the row-per-applied-migration tracking
// table). If the tracker shows fewer rows than the journal lists, the
// schema is behind the code and `wrangler dev` would 404 / 500 on any
// SSR page that SELECTs a not-yet-migrated column.
//
// Exits 0 when in-sync (silent), 1 with a clear "run `pnpm db:migrate`"
// message otherwise. Called from scripts/launch.mjs before spawning the
// dev server.
//
// Why bail rather than auto-apply: drizzle-kit migrate is the canonical
// applier (records hashes, runs DDL in a transaction). Auto-applying
// from a different path would risk hash mismatch later. The check just
// surfaces the problem clearly — the developer runs the one-line fix.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const ROOT = resolve(import.meta.dirname, '..')
const JOURNAL_PATH = resolve(ROOT, 'drizzle/meta/_journal.json')

async function check() {
  if (!existsSync(JOURNAL_PATH)) {
    // No journal yet — fresh repo. Nothing to check.
    return { ok: true, expected: 0, applied: 0 }
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    // No DB credentials in this shell. Skip the check — developer might
    // be running `pnpm render-config` or a related no-DB command. The
    // env-var gate in launch.mjs would have failed earlier if dev needs
    // it for actual operation.
    return { ok: true, skipped: 'no_database_url' }
  }
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'))
  const expectedTags = (journal.entries ?? []).map((e) => e.tag)

  // postgres-js with a tiny pool and short connect timeout — this script
  // gates dev startup, so it must fail fast on unreachable DBs rather
  // than hanging.
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 2,
    onnotice: () => {},
  })
  try {
    // Drizzle's tracking schema/table is created lazily by the first
    // `drizzle-kit migrate`. Treat its absence as "no migrations yet
    // applied" rather than a fatal error.
    const exists = await sql`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    `
    if (exists.length === 0) {
      return { ok: expectedTags.length === 0, expected: expectedTags.length, applied: 0, tags: expectedTags }
    }
    const rows = await sql`SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations`
    const applied = rows[0]?.c ?? 0
    return {
      ok: applied >= expectedTags.length,
      expected: expectedTags.length,
      applied,
      tags: expectedTags.slice(applied),
    }
  } finally {
    await sql.end({ timeout: 2 })
  }
}

const result = await check().catch((err) => ({
  ok: true, // do not block dev on a connect failure — developer might be offline
  skipped: 'connect_failed',
  message: err instanceof Error ? err.message : String(err),
}))

if (result.skipped) {
  // Silently OK. Don't spam dev startup with optional checks.
  process.exit(0)
}

if (result.ok) process.exit(0)

const pending = result.tags ?? []
const list = pending.length ? pending.map((t) => `    - ${t}`).join('\n') : '    (unknown)'

process.stderr.write(
  `\n  ✘ Pending Drizzle migrations: ${result.expected - result.applied} not yet applied.\n` +
    `\n${list}\n` +
    `\n  Run:\n` +
    `    pnpm --filter @baseout/web db:migrate\n` +
    `\n  Then restart \`pnpm --filter @baseout/web dev\`.\n` +
    `  (Schema drift would 404/500 any SSR page that SELECTs a missing column.)\n\n`,
)
process.exit(1)
