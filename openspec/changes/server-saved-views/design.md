# Design — server-saved-views

## D1 — `bo_at_saved_views`: one row per saved preset, config opaque

Per-Space table (pg + sqlite kept in dialect parity): `id` uuid PK, `name` text, `table_id`
text, `config` jsonb, `pinned` boolean default false, `sort_order` integer default 0,
`created_by_user_id` text nullable, `created_at`/`updated_at` timestamptz. Index on
`table_id`. `config` is the web-owned `SerializedConfig` (extracted into
`apps/web/src/lib/data-browse/preset-serialize.ts` by the paired `web-saved-views`) stored
opaquely — the engine never inspects it, the exact posture the documents broker takes with
Plate bodies. No `group_id`: view groups are a design-fixture concept that production
DataView never passes; grouping stays client-side if it ever ships.

`SPACE_SCHEMA_VERSION` 14 → 15, purely additive — the idempotent DDL covers existing
Spaces; regen pipeline: drizzle squash-regen of migrations/space-{pg,sqlite}/0000 +
`gen-space-{pg,sqlite}-ddl.mjs` + the parity tests.

## D2 — Broker pair cloned from the documents shape

`views.ts` (GET list / POST create) + `view.ts` (GET / PATCH / DELETE) under
`/api/internal/spaces/:spaceId/views[/:viewId]`, mirroring the documents brokers exactly:
UUID gates, `resolveSpaceDb` (409 space_db_not_ready / 501 non-managed_pg), 404
`view_not_found`. CRUD I/O in `lib/per-space/saved-views.ts`; the testable request
validation in `lib/per-space/saved-views-logic.ts` (pure, engine test pool has no PG).

## D3 — Save locks the table: `table_id` is immutable, server-enforced

Dan's 2026-07-23 rule (first Save locks a preset's Base + Table) becomes a server
invariant, not just UI affordance: PATCH rejects a `tableId` key with 400 `table_locked`.
Everything else (`name`, `config`, `pinned`, `sortOrder`) is patchable; `updated_at`
bumps on every PATCH.

## D4 — What stays client-side

Drafts, unsaved edits on top of a saved baseline, open tabs, and the active preset are the
web draft layer (localStorage) — the server holds only SAVED presets, where row `config`
IS the baseline. List order: `sort_order` then `created_at` — stable for both the pin-bar
and MCP consumers.
