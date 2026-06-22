// @baseout/db-schema/space — per-Space DB schema (one DB per Space).
//
// Two dialects, kept in lockstep (tests/space-schema-parity.test.ts):
//   - spacePg     → Postgres   (managed_pg + byodb backends)
//   - spaceSqlite → SQLite/D1  (d1 backend)
//
// Consumers import the dialect that matches the Space's `space_databases.backend`:
//   import { spacePg } from '@baseout/db-schema/space'
//   db.insert(spacePg.records).values(...)
//
// The master DB schema is the default export (@baseout/db-schema); this is a
// separate subpath because the per-Space schema is a distinct database with its
// own drizzle config + migrations (PRD §21.1). Design-of-record:
// openspec/changes/system-per-space-db.
export * as spacePg from './pg'
export * as spaceSqlite from './sqlite'

// Bumped whenever the per-Space schema changes. Provisioning records this on the
// per-Space DB (PRAGMA user_version on D1 / a meta row on PG) and the lazy
// on-access migration check compares against it to apply pending migrations.
export const SPACE_SCHEMA_VERSION = 1
