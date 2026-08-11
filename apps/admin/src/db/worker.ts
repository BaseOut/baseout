/**
 * Per-request Postgres client factory (workerd runtime).
 *
 * COPIED from apps/web/src/db/worker.ts — kept identical on purpose. Must be
 * called per-request: postgres-js holds TCP sockets and workerd forbids
 * reusing I/O objects across requests. Callers release the socket after the
 * response (fire-and-forget `sql.end()` in middleware).
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
