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
- [x] 2.2 Deployed smoke: dev engine + `npx trigger.dev dev`, Instant-frequency Space with records enabled → edit a cell in Airtable (no schema change), wait one poll interval, confirm the table's matview reflects the new value (`SELECT` from the generated view in the Space schema). → SMOKED 2026-07-24 on the `pers` dev Space (deployed engine + `npx trigger.dev@4.5.7 dev` — the CLI must match the 4.5.7 SDK; 4.5.1 aborts): registered webhooks via `/register-webhooks`, set `frequency='instant'` + 60s poll + `space_databases.records_enabled=true`, stamped `last_ping_at` by hand (hooks receiver not deployed — hooks.baseout.com 525s, so real pings can't arrive in ANY env yet). Poll tick enqueued `incremental-backup`; the record-only pass (reconcile-healed drift, no schema change) wrote the EAV store and **created the `flashcards` matview with values matching Airtable** (`rec7vu1m9EGfgJrEj` → answer "utah") — the change under test (regen on record-only passes) verified live. CAVEAT — the literal cell-edit trigger could not be exercised: the OAuth grant is read-only (`data.records:read`, no write scope), so no programmatic edit is possible, and a human UI edit still needs a manual `last_ping_at` stamp until apps/hooks deploys. Observed consequences of the known 4.2 `/complete` 400: every incremental run sticks at `running` (reconciliation sweep later fails it), `last_reconciled_at` never stamps (full re-read every dirty poll), and the DO in-flight guard then blocks the next poll for the 15-min grace — instant polling degrades to ~1 run/15+ min per base until 4.2 lands. Config reverted (monthly/900s, webhooks unregistered + Airtable-deleted); `records_enabled=true` + EAV rows + matview left in place as artifacts.
- [x] 2.3 Update `system-per-space-db` tasks.md 4.2 note (staleness caveat) to point at this change once shipped.
