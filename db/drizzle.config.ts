import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Canonical master-DB migration lineage — ONE location for the whole core DB
// (root CLAUDE.md §3.9). Moved here from apps/web/ by
// openspec/changes/system-db-migrations: five apps read this schema
// (web, server, hooks, api, sql), so the migrations are shared infrastructure
// rather than one app's concern.
//
// Paths below are relative to the CWD of the drizzle-kit invocation, which is
// this directory — `pnpm --filter @baseout/db run db:*` always runs here.

// Credentials live in `.dev.vars`, not `.env` — that is the house convention
// (CLAUDE.md §3.3: `.dev.vars` is the source of truth for the dev Workers, and
// `wrangler secret bulk .dev.vars` syncs from it). `.dev.vars` is dotenv-format,
// so process.loadEnvFile parses it directly.
//
// db/.dev.vars is checked first so this package can hold its own DB credential
// (useful for CI, where only the migration runner needs one); apps/web/.dev.vars
// is the fallback so a developer with a working web setup needs no extra file.
for (const candidate of ['./.dev.vars', '../apps/web/.dev.vars']) {
  const envPath = resolve(process.cwd(), candidate)
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
    break
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to db/.dev.vars or apps/web/.dev.vars ' +
      '(see apps/web/.dev.vars.example), or export it for a one-off run.',
  )
}

// pg@8.22 treats `sslmode=require` as verify-full, which rejects the DO
// managed cluster's self-signed CA chain (SELF_SIGNED_CERT_IN_CHAIN) — and
// drizzle-kit swallows the rejection and exits 1 with ZERO output (the
// 2026-07-27 silent `db:migrate` failure). Two traps stack: the URL's
// sslmode overrides any `ssl` option in pg, AND drizzle-kit's dbCredentials
// is a UNION type ({url} | {host,...,ssl}) that silently IGNORES `ssl` next
// to `url`. So: decompose the URL into discrete fields and pass ssl
// explicitly (encrypted, chain-unverified — the postgres-js runtime
// posture). The runtime keeps reading the untouched DATABASE_URL.
const dbUrl = new URL(process.env.DATABASE_URL)

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    '../apps/web/src/db/schema/auth.ts',
    '../apps/web/src/db/schema/core.ts',
    '../apps/web/src/db/schema/two-factor.ts',
    '../apps/web/src/db/schema/entitlements.ts',
    '../apps/web/src/db/schema/ai-provider-keys.ts',
  ],
  out: './migrations',
  schemaFilter: ['baseout'],
  dbCredentials: {
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 5432),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    // See the sslmode note above. DRIZZLE_SSL=false for a local unencrypted PG.
    ssl:
      process.env.DRIZZLE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false },
  },
})
