import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

// `drizzle-kit generate` only diffs the schema against ./migrations and does
// not connect to the DB, so a placeholder URL is fine in that path. Real
// `drizzle-kit migrate` requires OPENSIDE_IDENTITY_URL — it will fail loudly
// against the placeholder host, which is the desired behavior.
const url =
  process.env.OPENSIDE_IDENTITY_URL ??
  'postgresql://generate-only@placeholder.invalid:5432/placeholder'

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/schema.ts'],
  out: './migrations',
  schemaFilter: ['openside_identity'],
  migrations: {
    table: 'drizzle_migrations',
    schema: 'openside_identity',
  },
  dbCredentials: {
    url,
    ssl: process.env.DRIZZLE_SSL === 'false' ? false : 'require',
  },
})
