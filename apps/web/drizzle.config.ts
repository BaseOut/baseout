import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in real values.',
  )
}

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema/auth.ts', './src/db/schema/core.ts'],
  out: './drizzle',
  schemaFilter: ['baseout'],
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DRIZZLE_SSL === 'false' ? false : 'require',
  },
})
