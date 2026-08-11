## Why

The Schema page needs a **Relationships** view, but the engine exposes no relationship graph. Airtable's API does describe field-level relationships (linked records, formulas, rollups, lookups, lastModified) implicitly through field types + options, and the per-Space capture already stores those in `bo_at_fields`. What it can't see is Airtable's **Sync** feature (one table synced from another) — there's no API flag for it.

This change gives the engine a relationship read/write surface: API-derived relationships computed on read, plus persisted **synced-view candidates** with an inferred/confirm/dismiss lifecycle. Pairs with [`workflows-relationship-inference`](../workflows-relationship-inference/) (triggers inference) and [`web-relationships-tab`](../web-relationships-tab/) (the UI).

## What Changes

- **API-derived relationships are computed on read** from `bo_at_fields`/`bo_at_tables` — NOT a new persisted table. A pure `deriveRelationships` maps field types → relationship types (`multipleRecordLinks`→linkedRecords, `formula`→formulas, `rollup`→rollups, `multipleLookupValues`→lookups, `lastModified*`→lastModified), resolves refs, and computes validity + removed-history from entity lifecycle status.
- **One new per-Space table** `bo_at_synced_view_candidates` (per-Space schema **v4**) for synced views: status `inferred|confirmed|dismissed`, origin `inferred|user`, match score + matched field pairs, one row per unordered table pair.
- **Synced-view inference runs engine-side** (`inferSyncedViews` + `inferAndWriteSyncedViews`) — data locality: the engine already holds the per-Space schema, so the heuristic reads its own DB rather than shipping schema to the Node runner and back. It runs best-effort after each `schema-sync`, and on demand via `/relationships/sync`.
- **Routes** (all `INTERNAL_TOKEN`-gated): `GET /relationships?baseId=` (read), `POST /relationships/sync {baseId,runId}` (re-infer), `POST /relationships/mutate {action}` (confirm/dismiss/create).

## Capabilities

### New Capabilities
- `schema-relationships`: engine read of a base's API-derived relationships + synced-view candidates, synced-view inference (engine-side), and the confirm/dismiss/create lifecycle.

### Modified Capabilities
<!-- Extends the per-Space schema (v4) + adds engine routes. schema-sync now best-effort triggers inference. -->

## Impact

- `apps/server/src/lib/per-space/relationships.ts` (pure `deriveRelationships`) + `synced-view-infer.ts` (pure heuristic) + `relationships-io.ts` (read/write/infer I/O).
- Routes: `relationships-overview.ts`, `relationships-sync.ts`, `relationships-mutate.ts` + `index.ts` wiring.
- `schema-sync.ts` — best-effort `inferAndWriteSyncedViews` after the schema write (advisory; never fails the sync).
- `packages/db-schema/src/space/{pg,sqlite}.ts` — `bo_at_synced_view_candidates`; `SPACE_SCHEMA_VERSION` 3→4; squashed migrations + `pg-ddl.ts` regenerated; parity test → 25 tables.
- **Migration:** new/re-provisioned Spaces get the table from the bundled DDL. Existing prod Spaces need the in-place upgrade — the deferred [`system-per-space-upgrade`](../system-per-space-upgrade/) follow-up (dev re-provisions).
- **Security:** new internal routes only; `INTERNAL_TOKEN`-gated; parameterized Drizzle; no new external surface.
