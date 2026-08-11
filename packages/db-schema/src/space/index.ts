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
// v6: Inbox — bo_at_inbox_state + bo_at_inbox_mutes (server-notifications-inbox).
// v7: Interfaces normalized (server-interfaces-normalize) — bo_at_interfaces
// reshaped to apps-only (drops `type`/`first_seen_at`/`last_seen_at`, adds the
// run-based lifecycle set) + new bo_at_pages, bo_at_forms, bo_at_page_tables,
// bo_at_page_fields, bo_at_form_fields. First per-Space change that is NOT purely
// additive: the reshape needs the version-gated destructive step in
// apps/server/src/lib/provisioning/upgrade.ts (the idempotent DDL alone can't
// alter an existing table). Pre-launch, interface rows are dropped and repopulate
// on the next capture (design Decision 10).
// v9: Record comments (server-comments) — bo_at_comments. Purely additive
// (new table); the idempotent DDL covers existing Spaces.
// v10: Media index (server-media-index) — bo_at_assets + bo_at_asset_refs.
// Purely additive.
// v11: Comment attachments (server-comment-attachments) —
// bo_at_comment_attachments. Purely additive (new table); the idempotent DDL
// covers existing Spaces.
// v12: Base collaborators (server-base-collaborators) — bo_at_principals,
// bo_at_base_access, bo_at_invite_links, bo_at_base_collab_meta. Purely
// additive (four new tables); the idempotent DDL covers existing Spaces.
// v13: Data-browse export jobs (server-data-browse) — bo_at_export_jobs (async
// record-export queue). Purely additive; the idempotent DDL covers existing
// Spaces. The pg_trgm value-search index is deferred until extension
// availability is confirmed on the managed per-Space provider — record-search
// ships the bounded-ILIKE + scan-budget fallback (`partial` flag) meanwhile.
export const SPACE_SCHEMA_VERSION = 13
