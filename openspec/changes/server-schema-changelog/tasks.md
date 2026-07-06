## Status

PROPOSED — not yet implemented.

Engine half of the Schema Changelog. A read-time aggregator + one internal route
that union already-persisted diff data (`bo_at_schema_updates` + lifecycle +
`bo_at_base_runs` + automation/interface status) into a dated, base ▸ entity
changelog feed. No new DB table, no migration, no Trigger.dev task, no new
capability key — reuses the readiness/IDOR guards of `relationships-overview`.

---

## 1. Pure aggregator (`buildChangelog`) — TDD

- [ ] 1.1 RED: `changelog.test.ts` — feed lifecycle rows (base/table/field/view with `firstSeenRun`/`status`/`lastSeenRun`), `bo_at_schema_updates` rows (name/type/options/description/primary_field), automation/interface status transitions, and a run→date map; assert the union produces the expected `ChangelogEvent[]` (kinds, before/after, `warning` on `breaks_data`, `entityKind` on app-layer, correct `at` per source).
- [ ] 1.2 GREEN: `apps/server/src/lib/per-space/changelog.ts` — pure `buildChangelog(args)` mapping the three sources per [`design.md`](./design.md); render `summary` engine-side; resolve location (`baseName`/`tableName`/`entityName`/`fieldType`) + `at` from the run map.
- [ ] 1.3 Edge cases (tests): first-run-only (no diff → `[]`); no-changes (`[]`); partial capture never emits `removed` (unknown, not removed); `includeRemoved=false` omits `removed`; `kinds`/`since`/`baseId` filtering; stable `id` per (runId, entityId, changeType).

## 2. Read I/O (`changelog-io.ts`) — TDD

- [ ] 2.1 RED: integration test (real local PG + `withSpaceSchema`) seeding a per-Space DB with two runs' worth of diff data, then asserting the assembled feed + each filter (`baseId`, `since`, `kinds`, `includeRemoved`).
- [ ] 2.2 GREEN: `changelog-io.ts` — load lifecycle rows + `bo_at_schema_updates` + `bo_at_base_runs` + automations/interfaces via `withSpaceSchema`; build the run→date map; call `buildChangelog`; apply filters; return `{ ok, events }`.

## 3. Automation/interface `schema_updates` emit — TDD

- [ ] 3.1 RED: test that a status transition (active→removed) + a config change on an automation/interface during `schema-sync` reconcile writes a `schema_updates` row with `entityType='automation'|'interface'` and correct before/after — and that a failure to write it does NOT fail the sync (best-effort/advisory).
- [ ] 3.2 GREEN: extend `schema-sync.ts`'s automation/interface reconcile to best-effort emit those `schema_updates` rows. No change to base/table/field/view diffing (already emits).

## 4. Internal route — TDD

- [ ] 4.1 RED: route test mirroring `relationships-overview` — `INTERNAL_TOKEN` gate (401 without), IDOR/readiness guard (`resolveSpaceDb` → `managed_pg` → `ensureSpaceSchemaCurrent`), 400 on bad params, 200 `{ ok, events }`, empty-feed 200.
- [ ] 4.2 GREEN: `apps/server/src/pages/api/internal/spaces/changelog.ts` — parse `baseId`/`since`/`kinds`/`includeRemoved`, guard, call `changelog-io`, return JSON. Mirror the guard chain of [`relationships-overview.ts`](../../../apps/server/src/pages/api/internal/spaces/relationships-overview.ts).
- [ ] 4.3 Wire `CHANGELOG_RE` + dispatch in `apps/server/src/index.ts` (alongside `spacesRelationshipsOverviewHandler`).

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server test changelog` green (aggregator + io + route). No stray `console.*`.
- [ ] 5.2 `pnpm --filter @baseout/server exec tsc --noEmit` 0 errors; `pnpm --filter @baseout/server run build` green.
- [ ] 5.3 Full targeted server suites for touched areas green (per the "targeted suites, not full suite" DO-hang note in memory) — schema-sync + per-space read suites.

## 6. Human smoke (deployed engine, `--remote`)

- [ ] 6.1 On a `managed_pg` Space with ≥2 backup runs where the schema changed between them (rename a field, add a table, change a field type, toggle an automation), `pnpm --filter @baseout/server deploy:dev`, then `curl -H "x-internal-token: …" ".../api/internal/spaces/<id>/changelog"` returns dated events with correct kinds, before→after, and a `warning` on the type change.
- [ ] 6.2 Verify filters: `?baseId=`, `?since=`, `?kinds=renamed,retyped`, `?includeRemoved=true` each shape the feed as expected. Confirm a Space with one run returns `events: []`.

## Deferred follow-ups

- [ ] Materialized `bo_at_changelog` projection (append-only, written during schema-sync) if read-time union proves heavy on a high-volume Space.
- [ ] AI `aiSummary` per event (plain-language explanation) — deferred to the Schema-chat/insights track.
- [ ] Cross-link a breaks-data (⚠️) event to its Health-tab issue.
- [ ] Snapshot A↔B comparator (two-point diff UI) — explicitly out of scope (possible V2).
