// Per-request master DB factory.
//
// Per CLAUDE.md §5.1: postgres-js holds TCP sockets and workerd forbids
// reusing I/O objects across requests. Callers MUST invoke this once per
// request, attach the returned `{ db, sql }` to per-request locals, and on
// response wrap teardown with `ctx.waitUntil(sql.end({ timeout: 5 }))`.
//
// URL resolution is runtime-checked: prefer the HYPERDRIVE binding when it
// has a connectionString (deployed envs), fall back to DATABASE_URL var
// (local `wrangler dev` reads it from .dev.vars). apps/server builds with
// tsup (not Vite) so we don't have `import.meta.env.DEV` for build-time
// branching — runtime check is simpler and equally safe.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import type { Env } from "../env";

export type AppDb = PostgresJsDatabase<typeof schema>;

function resolveDbUrl(env: Env): string {
  const hyperdriveUrl = env.HYPERDRIVE?.connectionString;
  if (hyperdriveUrl) return hyperdriveUrl;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new Error(
    "Master DB URL not configured: neither HYPERDRIVE.connectionString nor DATABASE_URL is set",
  );
}

export function createMasterDb(env: Env): { db: AppDb; sql: Sql } {
  const sql = postgres(resolveDbUrl(env), {
    prepare: false,
    max: 1,
    connection: { search_path: "baseout,public" },
  });
  return { db: drizzle(sql, { schema }), sql };
}
