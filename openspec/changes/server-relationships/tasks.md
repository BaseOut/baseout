## Status

Engine half of the Relationships tab — DONE + green. API relationships derive on
read from `bo_at_fields`; only synced-view candidates persist (per-Space **v4**).
Inference runs engine-side. Pairs with `workflows-relationship-inference` +
`web-relationships-tab`.

---

## 1. Pure logic (TDD) — DONE

- [x] 1.1 `deriveRelationships` (`relationships.ts`) — field type → relationship type, ref resolution, validity + removed-history from lifecycle. Tests: `tests/integration/per-space/relationships.test.ts` (9).
- [x] 1.2 `inferSyncedViews` (`synced-view-infer.ts`) — name+type overlap, threshold/minMatches, canonical one-per-pair, dismissals excluded, deterministic. Tests: `tests/integration/per-space/synced-view-infer.test.ts` (8).

## 2. Data model + migration — DONE

- [x] 2.1 `bo_at_synced_view_candidates` added to BOTH dialects (`pg.ts` + `sqlite.ts`); `SPACE_SCHEMA_VERSION` 3→4. Squashed migrations regenerated (space-pg/space-sqlite 0000) + bundled `pg-ddl.ts` regenerated; parity test → **25 tables** (5/5 green).
- [x] 2.2 New/re-provisioned Spaces get the table from the bundled DDL (dev re-provision). **FOLLOW-UP:** existing-Space in-place v3→v4 upgrade is `system-per-space-upgrade` (not implemented; out of scope per §3.2).

## 3. I/O + inference — DONE

- [x] 3.1 `relationships-io.ts`: `readRelationships` (derive + synced views, table names attached, dismissed excluded by default), `writeSyncedViewCandidates` (upsert; skip dismissed; refresh confirmed), `setSyncedViewStatus` (confirm/dismiss), `createUserSyncedView` (origin=user, idempotent), `inferAndWriteSyncedViews` (read schema + dismissed → `inferSyncedViews` → write).

## 4. Routes — DONE

- [x] 4.1 `GET /relationships?baseId=[&includeDismissed=1]` (`relationships-overview.ts`), `POST /relationships/sync {baseId,runId}` (`relationships-sync.ts` — engine-side infer), `POST /relationships/mutate {action}` (`relationships-mutate.ts` — confirm/dismiss/create). Registered in `index.ts` (sync/mutate before the bare `/relationships` matcher). Route-guard tests `spaces-relationships-route.test.ts` (12).
- [x] 4.2 `schema-sync.ts` best-effort `inferAndWriteSyncedViews` after the schema write (own tx; swallows errors).

## 5. Verification

- [x] 5.1 server `typecheck` clean + `build` green; relationships/synced-view-infer/route suites + schema-mirrors/health/runs-start/space-do batch green (81); `db-schema` parity 25 tables. No stray `console.*`.
- [ ] 5.2 Human smoke (with the UI): on a **v4** managed_pg Space, a base shows API relationships grouped by type + inferred synced views; confirm/dismiss persists; dismissed not re-proposed after re-backup. (Existing Spaces need re-provision — `system-per-space-upgrade`.)
