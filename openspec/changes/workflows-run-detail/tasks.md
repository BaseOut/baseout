# workflows-run-detail — Tasks

## Status: IN PROGRESS

---

- [x] **Task 1: OpenSpec artifacts** — `proposal.md` + `tasks.md`

- [x] **Task 2: TDD — extend backup-base-task.test.ts (RED)**
  - Test: completion POST body carries `baseName` (string from payload)
  - Test: completion POST body carries `tables[]` with `{ tableId, tableName, recordCount, fieldCount, attachmentCount }` per table
  - Test: `attachmentCount` per table equals the delta of `attachmentsProcessed` for that table
  - Test: existing test assertions remain green (additive contract)
  - Confirmed 2 new tests failed, 9 existing passed before implementation

- [x] **Task 3: Extend `BackupBaseResult` + `runBackupBase` (GREEN)**
  - Added `BackupTableDetail` interface + optional `tableDetail` field to `BackupBaseResult`
  - In the `for (const table of tables)` loop, accumulate one entry per table with `tableId`, `tableName`, `recordCount`, `fieldCount`, `attachmentCount`
  - Return `tableDetail` in the result struct (present on succeeded/trial paths; absent from `failed()` shorthand)
  - All 11 tests green; all 177 across 21 test files green

- [x] **Task 4: Extend `postCompletion` in backup-base.task.ts**
  - Accepts `baseName` + `tableDetail` from result + payload
  - Spreads into the completion body only when `tableDetail` is present
  - No change to existing body fields

- [x] **Task 5: Typecheck + verification**
  - `pnpm --filter @baseout/workflows exec vitest run tests/backup-base-task.test.ts` — 11/11 green
  - `pnpm --filter @baseout/workflows exec vitest run` — 177/177 green (21 test files)
  - `pnpm --filter @baseout/workflows typecheck` — 0 errors
