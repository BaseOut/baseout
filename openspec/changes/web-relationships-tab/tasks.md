## Status

Web half of Relationships — DONE + green. Read-only-plus-confirm/dismiss tab over
`server-relationships`. No DB/migration/capability-key change — gates via the
existing `schemaDocs` level (Launch+), like the Health tab.

---

## 1. Web client + proxy routes — DONE

- [x] 1.1 `backup-engine.ts` — `getRelationships(spaceId, baseId, includeDismissed?)` + `mutateRelationship(spaceId, body)` + view types (`DerivedRelationshipView` / `SyncedViewRelationshipView` / results), mirroring `getHealthOverview`.
- [x] 1.2 `pages/api/spaces/[spaceId]/relationships.ts` (GET) + `relationship-mutate.ts` (POST) — `guardSchemaDocsRequest` (auth + IDOR + tier), `baseId`/action validation, 503 when the engine is unconfigured, `schemaDocsErrorStatus` mapping. Tests `relationships.test.ts` (5) + `relationship-mutate.test.ts` (7).

## 2. Relationships tab UI — DONE

- [x] 2.1 `SchemaView.astro` — "Relationships" radio tab after Browse. Empty state when `!hasSchema`. Base picker (over non-removed bases) + "include removed / dismissed" toggle.
- [x] 2.2 Lazy fetch on first open + on base/toggle change. Render: API relationships grouped by type (count per group) + synced-views section. Row badges: invalid / has-removed / inferred / confirmed / manual + match score. `esc()` on all engine strings. Invalid rows hidden unless include-removed.
- [x] 2.3 Confirm / Dismiss on inferred synced views via event delegation → POST `/relationship-mutate` → refetch. 403 → upgrade affordance.

## 3. Verification

- [x] 3.1 web `typecheck` 0 errors + `build` green + full unit suite **926** green (incl. the 12 new proxy tests). No stray `console.*`.
- [ ] 3.2 Human smoke: on a v4 managed_pg Space, open `/schema` → Relationships → grouped relationships + inferred synced views; confirm/dismiss persists; include-removed reveals invalid/dismissed; non-entitled org sees the upgrade message. (Engine `--remote`; existing Spaces need re-provision.)

## Deferred follow-ups

- [ ] Click-through from a relationship to the shared entity-detail sidebar (cross-tab reuse of Browse's `#entity-detail`).
- [ ] Full faceted filter bar (base/type/status/validity) + flat mode.
- [ ] UI for the engine `create` action (user-authored synced view: pick source + dest).

## 5. Follow-ups (DONE)

- [x] 5.1 Click-through: relationship refs + synced-view source/dest are clickable chips that open a shared `#entity-modal` `<dialog>` via an `open-entity-detail` CustomEvent (reuses the Browse docs-by-entity endpoint; the modal is reusable cross-tab).
- [x] 5.2 Create synced view: a "New synced view" form (source/dest table selects populated from the `fv-schema-data` JSON for the current base) → `relationship-mutate {action:'create'}` → reload.
- [x] 5.3 Search box filters the last-fetched relationships client-side (label + ref/table names). Full multi-facet filter (type/status/validity beyond search + include-removed) still deferred.
