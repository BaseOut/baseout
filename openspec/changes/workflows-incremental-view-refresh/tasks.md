## 1. Orchestration (`apps/workflows/trigger/tasks/incremental-backup.ts`)

- [x] 1.1 TDD (red first) in `tests/incremental-backup.test.ts`:
  - Rewrite the pinned "record-only pass makes ZERO extra Airtable API calls (no meta fetch, no view regen)" test → keep `getBaseSchema`/`insertSchemaVersion` NOT-called assertions, now expect `regenerateViews(["tbl1"])`.
  - New: schema+record pass calls `regenerateViews` once with the union (no dupes).
  - New: reconciliation-only writes include the reconciled table.
  - New: empty pass (no applied writes) → `regenerateViews` not called.
  - New: `regenerateViews` rejection → pass still `succeeded`, structured log event emitted.
- [x] 1.2 Accumulate `recordAffectedTables: Set<string>` from the writes at each `applyRecordEvents` call site (payload loop `:816`; reconciliation `:669` + `:691` — thread the set into `reconcileTable` the same way `counters` already is).
- [x] 1.3 Move the `regenerateViews` call out of the `if (schemaEventsApplied)` block to after the reconciliation loop; call once with `[...new Set([...affectedTables, ...recordAffectedTables])]` when non-empty; wrap in try/catch → `log({ event: "regenerate_views_failed", … })` on failure.
- [x] 1.4 Confirm the schema-pass block keeps its meta fetch/verification semantics unchanged (only the regen call moves).

## 2. Verification

- [x] 2.1 `pnpm --filter @baseout/workflows test` green; no wrapper/wire changes (`incremental-backup.task.ts` untouched).
- [ ] 2.2 Deployed smoke: dev engine + `npx trigger.dev dev`, Instant-frequency Space with records enabled → edit a cell in Airtable (no schema change), wait one poll interval, confirm the table's matview reflects the new value (`SELECT` from the generated view in the Space schema).
- [x] 2.3 Update `system-per-space-db` tasks.md 4.2 note (staleness caveat) to point at this change once shipped.
