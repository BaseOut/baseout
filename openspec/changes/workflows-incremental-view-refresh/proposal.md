# workflows-incremental-view-refresh

## Why

`system-per-space-db` §4.2 (shipped 2026-07-23) generates per-table query matviews over the EAV record store, rebuilt "per run": the engine rebuilds them after full-backup schema-syncs and after each table's `records-sync`. The incremental (webhook-driven) path, however, only calls `regenerateViews` at end-of-pass **when schema events occurred** — the call sits inside the `if (schemaEventsApplied)` block in `runIncrementalBackup` (`apps/workflows/trigger/tasks/incremental-backup.ts:850`), and only with the *schema*-affected tables.

Consequence (documented as a behavior note when §4.2 landed): a **record-only incremental pass leaves the touched tables' matviews stale** — cell edits land in `bo_at_record_field_data` but the generated views (which the SQL REST API queries, per design Decision 7) keep serving pre-pass data until the next schema event or full run. On an "Instant"-frequency Space, that can be indefinitely for a schema-stable base, which defeats the point of instant record capture.

The original "record-only pass makes ZERO extra Airtable API calls" invariant (pinned in `tests/incremental-backup.test.ts`) conflated two things: the meta-fetch (a real Airtable API call, correctly gated on schema events) and `regenerateViews` (an **engine** call — the reserved seam was a no-op when the test was written, so skipping it was free). Now that the op does real work, record freshness requires it on record passes too; the Airtable-API invariant is untouched.

## What Changes

`apps/workflows` only — the engine's `regenerate-views` op already exists and already acks `records_disabled` cheaply:

- **Accumulate record-affected tables**: collect `tableId`s from every `applyRecordEvents` batch (payload loop AND reconciliation — all record writes flow through that one seam: `incremental-backup.ts:816`, `:669`, `:691`).
- **One unified end-of-pass `regenerateViews` call**, moved AFTER reconciliation, with the union of schema-affected ∪ record-affected tables, fired whenever the union is non-empty (no longer conditional on `schemaEventsApplied`). Moving it after reconciliation also fixes a smaller existing gap: reconciliation-applied cells currently land after the rebuild even on schema passes.
- **Best-effort**: the call is wrapped (log + continue) instead of failing the pass. Views are derived + self-healing — the engine rebuilds them on the next full-run `records-sync`/`schema-sync`, and the next incremental pass retries — so a transient engine failure after records were durably applied and the cursor advanced must not fail an otherwise-successful pass. (This also softens the pre-existing schema-pass call, which was fail-hard.)
- **Update the pinned test**: the record-only-pass test keeps asserting `getBaseSchema` and `insertSchemaVersion` are NOT called (the real zero-Airtable-calls invariant) and now asserts `regenerateViews` IS called with the touched table.

## Non-Goals

- No engine changes (`regenerate-views` op, matview SQL, records-disabled gating — all shipped in `system-per-space-db` 4.2).
- No per-batch/mid-pass refresh (one rebuild per pass matches the "refreshed per run" design; a pass ≈ a run).
- No debounce/skip heuristics for hot tables — rebuild cost is a single-table scan; revisit only if instant-cadence Spaces show real load.

## Impact

- `apps/workflows/trigger/tasks/incremental-backup.ts` (pure orchestration) + `tests/incremental-backup.test.ts`. The task wrapper's transport (`regenerateViews` → POST `op:"regenerate-views"`) is unchanged; no wire-shape change (CLAUDE.md §7 cross-app contract untouched).
- Related: parent `system-per-space-db` (4.2); sibling `server-view-capture-override` (the other behavior note from the same slice — independent, no shared code).
