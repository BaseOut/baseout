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

// Executable DDL for provisioning (no drizzle weight). Engine imports the lean
// '@baseout/db-schema/space/pg-ddl' subpath directly; re-exported here too.
export { SPACE_PG_DDL, spacePgDdlStatements } from './pg-ddl'
// Idempotent variant for in-place upgrades (system-per-space-upgrade).
export { spacePgDdlStatementsIdempotent } from './pg-ddl-upgrade'

// Bumped whenever the per-Space schema changes. Provisioning records this on the
// per-Space DB (the bo_at_meta.schema_version row) and the lazy on-access
// migration check compares against it to apply pending migrations.
// v2: refined 20-table design — inline ai_* annotation columns (no
// bo_at_documentation), bo_at_meta, and the Docs-feature tables.
// v3: Health metric config + results (server-schema-health-scoring) —
// bo_at_health_metric_{prompts,overrides,state,scores}.
// v4: Relationships — bo_at_synced_view_candidates (server-relationships). API
// relationships are derived on read from bo_at_fields, so no table for those.
// v5: Chat — bo_at_chat_threads + bo_at_chat_messages (server-schema-chat).
export const SPACE_SCHEMA_VERSION = 5
