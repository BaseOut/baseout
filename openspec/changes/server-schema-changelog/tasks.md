## Status

PARTIALLY LANDED — a leaner v0 of the feed shipped in `388d380`
(`feat(server): schema changelog read feed`). Sections 1–2 below record what
landed (rewritten to match the shipped code); sections 3–6 are the remaining
scope. See the Status section in [`proposal.md`](./proposal.md) for the full
landed-vs-proposed reconciliation.

Engine half of the Schema Changelog. A read-time aggregator + one internal route
that union already-persisted diff data (`bo_at_schema_updates` + lifecycle +
`bo_at_base_runs` + automation/interface status) into a dated, base ▸ entity
changelog feed. No new DB table, no migration, no Trigger.dev task, no new
capability key — reuses the readiness/IDOR guards of `relationships-overview`.

---

## 1. Landed v0 — pure assembler + read I/O (`388d380`)

- [x] 1.1 Pure assembler `apps/server/src/lib/per-space/schema-changelog.ts` — `assembleChangelog(modifications, removals, { limit })` merges `bo_at_schema_updates` modification rows (raw `changeType`/`changeTypeName`/`before`/`after`/`breaksData`) with lifecycle removals (base/table/field/view, `status='removed'` + `first_unseen_run`) into a date-descending, limited `ChangelogEntry[]` with `kind: 'modified' | 'removed'`. Unit-testable without a DB.
- [x] 1.2 Read I/O `apps/server/src/lib/per-space/schema-changelog-io.ts` — `readSchemaChangelog(tx, baseId, { limit })` loads modifications + removals + run dates (`bo_at_base_runs.completed_at ?? started_at`) via `withSpaceSchema` and feeds the assembler.
- [x] 1.3 Integration test `tests/integration/per-space/schema-changelog.test.ts` (real local PG, 5 green) — assembled feed, ordering, limit, removal stamping.

## 2. Landed v0 — internal route (`388d380`)

- [x] 2.1 Route `GET /api/internal/spaces/:spaceId/schema-changelog?baseId=<required>[&limit=1..1000, default 200]` — `spacesSchemaChangelogHandler` in `apps/server/src/pages/api/internal/spaces/schema-changelog.ts`; guard chain mirrors `relationships-overview` (`resolveSpaceDb` → `managed_pg` → `ensureSpaceSchemaCurrent` → `withSpaceSchema`); 405/400/409/501/500 contract.
- [x] 2.2 Registered in `apps/server/src/index.ts` (alongside `spacesRelationshipsOverviewHandler`). Token gate via `/api/internal/` middleware.
- [x] 2.3 `tsc` green; no stray `console.*` (verified at commit).

## 3. Remaining — post-baseline `added` events — TDD

- [ ] 3.1 RED: assembler test — entities whose `firstSeenRun` is later than the base's earliest run yield an `added` entry; baseline-capture entities do NOT (the flood problem documented in the `schema-changelog.ts` header).
- [ ] 3.2 GREEN: extend `schema-changelog-io.ts` to load the base's earliest run + `first_seen_run` rows; extend `assembleChangelog` with `kind: 'added'`.

## 4. Remaining — automation/interface `schema_updates` emit + feed inclusion — TDD

> **Blocked on [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/tasks.md) (0/40, unbuilt).** The per-Space tables (`bo_at_automations` / `bo_at_interfaces`) exist in `packages/db-schema`, but no engine code populates or reconciles them yet — there is no automation/interface reconcile in `schema-sync.ts` to extend. Ship the capture change first; §3 and §5 are NOT blocked.

- [ ] 4.1 RED: test that a status transition (active→removed) + a config change on an automation/interface during `schema-sync` reconcile writes a `schema_updates` row with `entityType='automation'|'interface'` and correct before/after — and that a failure to write it does NOT fail the sync (best-effort/advisory).
- [ ] 4.2 GREEN: extend `schema-sync.ts`'s automation/interface reconcile to best-effort emit those `schema_updates` rows. No change to base/table/field/view diffing (already emits).
- [ ] 4.3 Extend `readSchemaChangelog` to include `entityType in (automation, interface)` rows in the feed (the assembler already passes `entityType` through; widen the type union).

## 5. Remaining — `since` / `kinds` / `includeRemoved` filters — TDD

- [ ] 5.1 RED: io/route tests — `?since=<ISO>` cuts on the entry's run date; `?kinds=modified,removed,added` filters kinds; `?includeRemoved=false` (default stays current behavior: removals included — decide + pin the default with the web tab) shapes the feed.
- [ ] 5.2 GREEN: parse the params in `schema-changelog.ts` (route), apply in `schema-changelog-io.ts`. Keep `baseId` required + `limit` semantics unchanged.

## 6. Verification + human smoke (deployed engine, `--remote`)

- [ ] 6.1 `pnpm --filter @baseout/server exec vitest run tests/integration/per-space/schema-changelog.test.ts` green with the new cases; targeted schema-sync suite green (per the "targeted suites, not full suite" DO-hang note). `tsc --noEmit` 0 errors.
- [ ] 6.2 On a `managed_pg` Space with ≥2 backup runs where the schema changed between them (rename a field, add a table, change a field type, toggle an automation), `pnpm --filter @baseout/server deploy:dev`, then `curl -H "x-internal-token: …" ".../api/internal/spaces/<id>/schema-changelog?baseId=…"` returns dated entries with correct kinds, before→after, and `breaksData` on the type change; filter params shape the feed. A Space with one run returns `entries: []` (modifications) — removals/additions only appear from the second run on.

## Deferred follow-ups

- [ ] Engine-rendered `summary` strings per entry — the landed direction is web-side rendering (the tab derives wording from `changeType`/`changeTypeName` + the SSR entity index); revisit only if a second consumer (API/export) needs engine-side text.
- [ ] Materialized `bo_at_changelog` projection (append-only, written during schema-sync) if read-time union proves heavy on a high-volume Space.
- [ ] AI `aiSummary` per event (plain-language explanation) — deferred to the Schema-chat/insights track.
- [ ] Cross-link a breaks-data (⚠️) event to its Health-tab issue.
- [ ] Snapshot A↔B comparator (two-point diff UI) — explicitly out of scope (possible V2).
