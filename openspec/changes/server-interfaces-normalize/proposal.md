# server-interfaces-normalize — Proposal

## Why

The shipped MCP interface capture (`server-mcp-interface-pages`) stores every Interface app, page, and standalone form as a row in one table (`bo_at_interfaces`) with the raw payload — including full field names, types, and select options — duplicated verbatim in a `definition` jsonb blob. The owner has confirmed the real capture format and decided the backup representation must be normalized: forms are a first-class entity in their own table, pages get their own table with real columns, and page/form → table/field usage is stored as ID links against `bo_at_tables`/`bo_at_fields` instead of duplicating schema detail we already hold. We are pre-launch, so the fleet-wide per-Space migration this requires is cheap now and will not be later.

## What Changes

- **BREAKING (per-Space schema): split `bo_at_interfaces` into three entity tables.**
  - `bo_at_interfaces` — Interface apps only (`pbd…` containers); drops page/form rows and the `type` discriminator.
  - `bo_at_pages` (new) — one row per interface page (`pag…`), with real columns `interface_id`, `page_type`, `source_table_id`.
  - `bo_at_forms` (new) — one row per form (`pag…`, `pageType='form'`), standalone (`interface_id` null) or interface-owned, with `source_table_id`; `source_table_name` from the payload is dropped (join `bo_at_tables`).
- **New link tables (IDs only — no names/types/options duplication):**
  - `bo_at_page_tables` — page ↔ table usage (one row per `tablesByTableId` entry).
  - `bo_at_page_fields` — page ↔ field usage, carrying page-scoped `is_editable`.
  - `bo_at_form_fields` — form ↔ field usage; created now, populated when form field capture (`get_form_schema`) lands.
- **Run-based lifecycle everywhere:** entity and link rows carry `status` (`active`|`removed`|`unknown`) + `first_seen_run` / `first_unseen_run` / `last_seen_run` (→ `bo_at_base_runs.id`), replacing the `first_seen_at`/`last_seen_at` timestamps on interface rows. Removal only on a confident full capture; parent removal cascades to child pages/links in the same run; reappearing entities resurrect to `active`.
- **Definition slimming:** stored definitions keep unknown-key pass-through but no longer persist `tablesByTableId` field detail (names/types/options). Side effect: the capture hash becomes stable under schema-side field renames.
- **Sync engine rework:** `interfaces-sync.ts` extraction/diff and the `space-db-pg.ts` read/apply functions target the new tables; `bo_at_schema_updates` gains `entity_type` values `page` and `form` (previously everything was `interface`).
- **Out of scope:** automation link tables (`bo_at_automation_tables`/`_fields`, `bo_at_page_automations`, `bo_at_form_automations`) — deferred until a structured automation capture path exists; web read surfaces (no reader of `bo_at_interfaces` exists yet — the dual-source merge contract in `apps/web/src/lib/interfaces/merge-sources.ts` is updated as a type-level follow-up when the first reader ships); restore/write-back of interfaces.

## Capabilities

### New Capabilities

- `interface-entity-model`: the normalized per-Space storage model for Interface apps, pages, and forms — three entity tables, three ID-link tables, run-based lifecycle columns, and the cross-table linking rules (plain columns, no FKs).
- `interface-pages-sync`: capture → extract → diff → persist behavior against the normalized model — supersedes the same-named spec in `openspec/changes/server-mcp-interface-pages/specs/interface-pages-sync/` (that change is built but not archived; its Decision 1 "one table, definition-blob parentage" is explicitly reversed here).

### Modified Capabilities

<!-- none in openspec/specs/ — interface-pages-sync lives only in the un-archived server-mcp-interface-pages change and is superseded via the New Capabilities entry above -->

## Impact

- `packages/db-schema/src/space/pg.ts` + `src/space/sqlite.ts` — new/changed tables (both dialects, parity-tested); `migrations/space-pg/` + `migrations/space-sqlite/` — one additive+destructive migration each; `SPACE_SCHEMA_VERSION` bump so the lazy on-access migrator upgrades every per-Space DB.
- `apps/server/src/lib/per-space/interfaces-sync.ts` — extraction emits typed entities + link rows; diff computes per-table lifecycle ops instead of jsonb field-usage deltas; capture hash excludes field names/options.
- `apps/server/src/lib/per-space/space-db-pg.ts` — `readInterfaceWorkingSet` / `applyInterfaceDiff` rewritten for the new tables.
- `apps/server/tests/integration/per-space/interfaces-sync.test.ts` + the change's smoke script — updated fixtures/assertions.
- `apps/workflows` — **no change** (forwards the raw MCP envelope verbatim; wire contract `interfacePages` is unchanged).
- Manual submissions (`submitted_via` ≠ `mcp`) — still land in `bo_at_interfaces`; the dual-source row model is preserved for apps, and manual page/form intake is a documented follow-up decision.
- `server-schema-entity-graph` (planned) — its "reads" edges should be assembled from `bo_at_page_tables`/`bo_at_page_fields` instead of parsing definitions; noted as a cross-reference, not implemented here.
- Pre-launch: no production per-Space DBs need data backfill; dev/staging Spaces are re-captured on next run.
