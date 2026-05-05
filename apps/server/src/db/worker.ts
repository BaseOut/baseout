// Per-request master DB factory.
//
// Per CLAUDE.md §5.1: postgres-js holds TCP sockets and workerd forbids
// reusing I/O objects across requests, so this MUST be called per-request and
// the returned client wrapped with `ctx.waitUntil(sql.end({ timeout: 5 }))`
// on response. Hyperdrive binding is used in deployed envs;
// process.env.DATABASE_URL is used in local wrangler dev (under
// import.meta.env.DEV — Vite tree-shakes the dead branch from the deployed
// bundle).
//
// PoC stub: returns null so handlers can read locals.masterDb without crashing.
// Phase 1 fills in the postgres-js + drizzle wiring.

import type { Env } from "../env";

export function createMasterDb(_env: Env, _ctx: ExecutionContext): null {
  // TODO(phase-1): const sql = postgres(connectionString, { max: 1, prepare: false });
  // TODO(phase-1): _ctx.waitUntil(sql.end({ timeout: 5 }));
  // TODO(phase-1): return drizzle(sql, { schema });
  return null;
}
