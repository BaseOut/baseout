// Per-request master DB factory (read-only usage). Same discipline as
// apps/server (CLAUDE.md §5.1): postgres-js holds sockets workerd forbids
// reusing across requests — build once per request, tear down with
// ctx.waitUntil(sql.end(...)) on response. HYPERDRIVE in deployed envs;
// DATABASE_URL var under local `wrangler dev`.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import type { Env } from "../env";

export type ApiDb = PostgresJsDatabase<typeof schema>;

export function resolveDbUrl(env: Env): string {
  const hyperdriveUrl = env.HYPERDRIVE?.connectionString;
  if (hyperdriveUrl) return hyperdriveUrl;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new Error("Master DB URL not configured: set HYPERDRIVE or DATABASE_URL");
}

export function createMasterDb(env: Env): { db: ApiDb; sql: Sql } {
  const sql = postgres(resolveDbUrl(env), {
    prepare: false,
    max: 1,
    connection: { search_path: "baseout,public" },
  });
  return { db: drizzle(sql, { schema }), sql };
}
