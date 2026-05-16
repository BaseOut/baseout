# Implementation tasks

## 1. backup-base attachment bytes

- [ ] 1.1 Update `apps/workflows/trigger/tasks/backup-base.ts` — `BackupBaseResult` interface adds `attachmentBytesByBase` (already-empty in the trivial case; populated when `workflows-attachments` ships).
- [ ] 1.2 Update `apps/workflows/trigger/tasks/backup-base.task.ts` — emit `attachmentBytesByBase` on the `/runs/:id/complete` POST payload.

## 2. Credit-balance-alerts cron

- [ ] 2.1 New `apps/workflows/trigger/tasks/credit-balance-alerts.task.ts`. Pure module + wrapper. Daily cron (e.g. `0 14 * * *`). For each Org returned by engine-callback `/api/internal/credit-orgs`, compute the ratio delta and POST `/api/internal/orgs/:id/credit-alert` when a threshold flips.
- [ ] 2.2 Re-export from `apps/workflows/trigger/tasks/index.ts`.

## 3. Tests

- [ ] 3.1 `apps/workflows/tests/credit-balance-alerts.test.ts` — threshold-crossing matrix (50/75/90/100), no-flip case (alert not posted), empty-Org case.

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
