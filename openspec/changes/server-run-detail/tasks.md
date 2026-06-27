# server-run-detail — Tasks

## Status: IN PROGRESS

---

- [x] **Task 1: OpenSpec artifacts** — `proposal.md` + `tasks.md`

- [x] **Task 2: Schema — apps/web canonical migration**
  - Add `backup_run_bases` + `backup_run_tables` tables to `apps/web/src/db/schema/core.ts`
  - Run `pnpm --filter @baseout/web db:generate` → migration `0020_*`
  - Run `pnpm --filter @baseout/web db:migrate`
  - Confirm `pnpm --filter @baseout/web db:check` clean

- [x] **Task 3: Schema — apps/server mirrors**
  - `apps/server/src/db/schema/backup-run-bases.ts` (mirror of backup_run_bases)
  - `apps/server/src/db/schema/backup-run-tables.ts` (mirror of backup_run_tables)
  - Add both to `apps/server/src/db/schema/index.ts` barrel

- [x] **Task 4: TDD — extend runs-complete.test.ts (RED)**
  - Test: WITH per-table detail → `insertRunBaseSnapshot` + `insertRunTableSnapshots` called
  - Test: WITHOUT per-table detail → existing behavior unchanged (existing cases stay green)
  - Confirm tests fail before implementation

- [x] **Task 5: Extend `ProcessRunCompleteInput` + `ProcessRunCompleteDeps` (GREEN)**
  - Add optional `baseName?`, `tables?` to `ProcessRunCompleteInput`
  - Add optional `insertRunBaseSnapshot?` + `insertRunTableSnapshots?` to deps
  - In `processRunComplete`: when `tables` present, call the snapshot deps after `applyPerBaseCompletion` succeeds (not on replay/noop)
  - Run `runs-complete.test.ts` green

- [x] **Task 6: Extend the route handler — `apps/server/src/pages/api/internal/runs/complete.ts`**
  - `parseBody` accepts optional `baseName` + `tables` array
  - Route handler wires `insertRunBaseSnapshot` / `insertRunTableSnapshots` deps
    to Drizzle inserts against `backupRunBases` / `backupRunTables`

- [x] **Task 7: TDD — `runs-detail-route.test.ts` (RED → GREEN)**
  - Tests: 401 no token, 400 bad UUID, 405 non-GET, 200 empty bases, 200 with bases+tables
  - New handler: `apps/server/src/pages/api/internal/runs/detail.ts`
  - Register `RUNS_DETAIL_RE` in `apps/server/src/index.ts`

- [x] **Task 8: Typecheck + verification**
  - `pnpm --filter @baseout/server typecheck` 0 errors
  - `pnpm --filter @baseout/web typecheck` 0 errors
  - `pnpm --filter @baseout/web db:check` clean
  - `pnpm --filter @baseout/server exec vitest run tests/integration/runs-complete.test.ts tests/integration/runs-complete-route.test.ts tests/integration/runs-detail-route.test.ts` all green
