/**
 * Per-request Postgres client factory for the Astro app (workerd runtime).
 *
 * Must be called per-request — postgres-js holds TCP sockets, and workerd
 * forbids reusing I/O objects across requests. Callers are responsible for
 * `ctx.waitUntil(sql.end())` on response to release sockets cleanly.
 *
 * In dev (`astro dev` with @astrojs/cloudflare platformProxy) the connection
 * routes through miniflare's Hyperdrive proxy to the real Postgres via
 * `localConnectionString` in wrangler.jsonc. In prod the Hyperdrive pool
 * does the same job over the network.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import * as schema from './schema'

export type AppDb = PostgresJsDatabase<typeof schema>

export function createDb(connectionString: string): { db: AppDb; sql: Sql } {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 5,
    connection: {
      search_path: 'baseout,public',
    },
  })
  const db = drizzle(sql, { schema })
  return { db, sql }
}
