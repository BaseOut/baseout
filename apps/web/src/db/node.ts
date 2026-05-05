import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in real values.',
  )
}

const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  connection: {
    search_path: 'baseout,public',
  },
})

export const db = drizzle(sql, { schema })
export { sql }
