# Tasks — server-saved-views

TDD throughout (§3.4).

## 1. Schema (D1)

- [x] 1.1 `savedViews` in space pg.ts + sqlite.ts; squash-regen both 0000 migrations;
      regen both bundled DDLs; `SPACE_SCHEMA_VERSION = 15`; parity + ddl tests green.

## 2. Broker (D2, D3)

- [x] 2.1 `saved-views-logic.ts` — pure create/patch validation incl. the `table_locked`
      rejection (tests: valid shapes, missing name/tableId/config, tableId-in-patch).
- [x] 2.2 `saved-views.ts` CRUD over SpaceTx (list ordered sort_order→created_at, get,
      create, update+updatedAt, delete).
- [x] 2.3 `views.ts`/`view.ts` handlers + route regexes in index.ts; route-guard tests
      (401/405/400) mirroring spaces-documents-route.test.ts.

## 3. Close

- [x] 3.1 Gates: db-schema vitest + tsc (122/122); apps/server targeted suites + tsc
      (saved-views logic 7 + route guards 6 green). Live smoke rode `api-views-tools`
      (local wrangler pair): the v15 LAZY UPGRADE fired on first broker access
      (ensureSpaceSchemaCurrent added to both view brokers — the broker clones missed it
      initially because the documents tables predate the lazy-upgrade era) and the full
      create/list/patch/table_locked/delete round-trip passed against the Staging Space.
