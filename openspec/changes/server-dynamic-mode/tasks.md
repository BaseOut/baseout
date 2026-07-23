> ⚠️ **STALE — superseded by [`system-per-space-db`](../system-per-space-db/tasks.md) (see the banner on this change's proposal.md).** The 0/47 count below overstates remaining work: Phase A (the `space_databases` table + engine mirror) and much of the provisioning/data model shipped through `system-per-space-db` under its refined design (`backend` × `records_enabled`, generic `bo_at_*` tables). Do NOT plan or implement from this list — work the per-Space data model from `system-per-space-db/tasks.md`, and re-scope whatever genuinely remains of this change (if anything) against it before checking boxes here. Noted 2026-07-21 while sequencing the instant-webhook suite, whose "dynamic mode" dependency reduces to `system-per-space-db` task 1.6.
>
> **RE-SCOPED 2026-07-23** per the banner above. The original Phase A–I list is retired
> (disposition table at the bottom). What genuinely remains of "dynamic mode" is the
> **engine-brokered incremental-apply seam**: the server half of the `IncrementalDb`
> contract injected by `apps/workflows/trigger/tasks/incremental-backup.ts`
> (`openBaseRun` / `completeBaseRun` / `applySchemaEvents` / `applyRecordEvents` /
> `getStoredRecords` / `insertSchemaVersion` / `getAppliedSchemaState` /
> `regenerateViews` / `listStoredRecordIds` / `listTableIds`) — every method of which
> is currently a `notYetWired` stub in `incremental-backup.task.ts`. Per-Space schema
> v8 (`bo_at_base_runs.run_type`, `action_source`/`actor` on `bo_at_schema_updates` +
> `bo_at_record_updates`) shipped 2026-07-21 specifically to receive these writes.

## Re-scoped task list

### Phase 1 — Pure incremental-apply module (FOUNDATION)

- [x] 1.1 TDD red: `tests/integration/per-space/incremental-apply.test.ts` — wire-shape parsing (`SchemaWrite`/`RecordWrite` unions mirrored from `apps/workflows/trigger/tasks/incremental-backup.ts`), schema-write planning (createTable expands to table+field upserts; destroys plan confident `removed` + cascade, records cascade to `deleted`; updateField patches only present keys; updateTableMetadata logs ride attribution; updateView skipped un-gated), record-write planning (createRecord cells sparse-encoded, no logs; updateCell encodes value + superseded-value log with attribution; cleared cell = null value with log; destroyRecord → `deleted`), stored-cell decode + applied-schema-state builders. → DONE 2026-07-23: 21 tests, watched red (missing module) → green.
- [x] 1.2 New `apps/server/src/lib/per-space/incremental-apply.ts` (PURE, no I/O): request/op parsing + `planSchemaWrites` / `planRecordWrites` emitting ordered typed plan-ops, `decodeStoredCells`, `buildAppliedSchemaState`. Reuses `encodeCellValue` from `record-diff.ts`. Header names the workflows module as the canonical wire-shape source. → DONE. Semantics pinned: order-preserving plans; NOT-NULL fallbacks (null name → `''`, null field type → `'unknown'`); empty `set` emits log-only; `logSchemaUpdate` rows carry `tableId` = the table for both table and field entities (matches `schema-diff.ts` convention); stored-cell decode passes unparsable values through raw; orphan fields dropped from applied-schema-state.

### Phase 2 — Per-space IO appliers (FOUNDATION)

- [x] 2.1 New `apps/server/src/lib/per-space/incremental-io.ts` (thin drizzle appliers, `space-db-pg.ts` style, all take the `withSpaceSchema` tx): `openIncrementalBaseRun` (select-or-insert `bo_at_base_runs` with `run_type='incremental'`), `completeIncrementalBaseRun` (status + counts→`records_count` + `completed_at` + `error_message`), `applyIncrementalSchemaPlan`, `applyIncrementalRecordPlan`, `insertSchemaVersionDeduped` (hash-dedup + stamps `base_runs.schema_version_id`/`schema_hash`), read seams `getStoredRecords` / `getAppliedSchemaState` / `listStoredRecordIds` / `listTableIds`. Drizzle bodies are smoke-verified per house pattern (`describe-schema-io` precedent); decisions live in Phase 1's pure module. → DONE. Cascade on `removeTableCascade` flips child fields/views `removed` + records `deleted` (rfd rows persist for history); `upsertCell` also stamps `records.modified_time` + `last_seen_run`; `open-base-run` is select-or-insert so task retries replay to the same `baseRunId`. Counts note: `records_count` aggregates created+updated+deleted+reconciled (no per-category columns on `bo_at_base_runs` — granularity rides the master `/runs/:id/complete` POST). Live-PG paths ride the 4.5 smoke.

### Phase 3 — Internal route (FOUNDATION)

- [x] 3.1 New `POST /api/internal/spaces/:spaceId/incremental-apply` — single op-dispatch route (`op` discriminator, one URL for the wrapper to wire): `open-base-run` | `complete-base-run` | `apply-schema-events` | `apply-record-events` | `get-stored-records` | `insert-schema-version` | `get-applied-schema-state` | `regenerate-views` (honest no-op — per-table views deferred, system-per-space-db §4.2) | `list-stored-record-ids` | `list-table-ids`. Mirrors `records-sync.ts` guards (405 / UUID 400 / `space_db_not_ready` 409 / `backend_not_implemented` 501); `ensureSpaceSchemaCurrent` best-effort on `open-base-run`. Registered in `src/index.ts` beside the schema-sync/records-sync block. → DONE. `pages/api/internal/spaces/incremental-apply.ts` + `SPACES_INCREMENTAL_APPLY_RE`; the handler header documents the full IncrementalDb-method → op mapping; `regenerate-views` answers `{ok, regenerated:false, reason:'views_not_generated'}` (after the not-ready/backend guards, before any tx); each op runs in one `withSpaceSchema` transaction; errors → 500 `{error:'apply_failed'}`.
- [x] 3.2 Route-shape tests `tests/integration/spaces-incremental-apply-route.test.ts` (401 token gate / 405 / 400 bad UUID / 400 bad body + unknown op) per the `spaces-migrate-schema-route` pattern. → DONE: 6 tests, watched red (404 pre-registration) → green; also pins the 400 `reason` passthrough (`unknown_op`, `bad_backup_run_id`). DB happy paths need live PG → 4.5 smoke, per house pattern.

### Phase 4 — Remaining wiring (NOT foundation — follow-ups)

- [ ] 4.1 Payloads-auth resolution route (Airtable webhook id `ach…` + decrypted Connection token + `last_reconciled_at` + `viewCaptureEnabled` for a subscription) — pairs with `server-instant-webhook`; the task payload deliberately carries none of these.
- [ ] 4.2 Workflows-side wrapper wiring: replace the `notYetWired` stubs in `incremental-backup.task.ts` with an HTTP transport onto 3.1 + route payload polls through the per-Connection gateway (owned by a `workflows-instant-webhook` follow-up).
- [ ] 4.3 `regenerate-views` real implementation — blocked on the per-table query views (system-per-space-db §4.1–4.3, deferred).
- [ ] 4.4 `updateView` apply under the Enterprise view-capture gate (system-per-space-db 8.2 — gate not yet enforced anywhere).
- [ ] 4.5 Live smoke: deployed dev engine + `trigger.dev dev`, webhook-driven run populates `bo_at_*` with `run_type='incremental'` + attribution.
- [ ] 4.6 On approval: stage by name, commit locally.

## Disposition of the original Phase A–I list (retired 2026-07-23)

| Original | Disposition |
|---|---|
| A `space_databases` schema | SHIPPED via system-per-space-db 1.4 (refined: `backend` × `records_enabled`, migration 0017). |
| B provisioner (D1/PG/BYODB tiers) | `managed_pg` SHIPPED via system-per-space-db 2.1 (`lib/provisioning/`, `/provision-database` route); `d1`/`byodb` DEFERRED there (`backend_not_implemented`). |
| C engine write path | Full-backup path SHIPPED via system-per-space-db §3 (`schema-sync`/`records-sync` routes + `space-db-pg.ts`); the incremental path is the re-scoped Phases 1–3 above. |
| D schema differ + master `audit_history` | SHIPPED as `lib/per-space/schema-diff.ts` → `bo_at_schema_updates` (per-Space, NOT master `audit_history` — see system-per-space-db 7.2/7.3). |
| E capability resolver (`resolveBackupMode`/`resolveDatabaseTier`) | Superseded by `backend` × `records_enabled` posture (`lib/provisioning/posture.ts` + web-side provisioning call); tier→mode gating is web scope, out of this change. |
| F provisioning triggers (Stripe/downgrade) | Web/billing scope — out of this change (engine's defensive path exists via `/provision-database` idempotency). |
| G dashboard | Web scope — out of this change. |
| H/I doc sync + verification | Folded into the re-scoped phases + 4.5/4.6. |
