import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// .dev.vars is the single local env file (2026-08-31); .env kept as legacy fallback
const devVarsPath = resolve(process.cwd(), '.dev.vars')
const envPath = resolve(process.cwd(), '.env')
if (existsSync(devVarsPath)) process.loadEnvFile(devVarsPath)
else if (existsSync(envPath)) process.loadEnvFile(envPath)

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .dev.vars.example to .dev.vars and fill in real values.',
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
    './src/db/schema/auth.ts',
    './src/db/schema/core.ts',
    './src/db/schema/two-factor.ts',
    './src/db/schema/entitlements.ts',
    './src/db/schema/ai-provider-keys.ts',
  ],
  out: './drizzle',
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
