# Implementation tasks

## 1. Provisioning task

- [ ] 1.1 New `apps/workflows/trigger/tasks/provision-space-database.task.ts`. Pure-module + wrapper. Wrapper reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN`. Pure module calls the dispatcher endpoint with retry (3 attempts, exponential backoff) and surfaces a `provisioned | failed` result.

## 2. backup-base schema-diff plumbing

- [ ] 2.1 Update `apps/workflows/trigger/tasks/backup-base.ts` — at the end of each per-table iteration, compute the schema diff vs the previous run's stored schema (resolved via engine-callback) and POST an `audit_history` row.
- [ ] 2.2 Update `apps/workflows/trigger/tasks/backup-base.task.ts` to instantiate the diff helper with engine-callback deps.

## 3. Tests

- [ ] 3.1 `apps/workflows/tests/provision-space-database.test.ts` — happy-path, retry-then-success, retry-then-fail.
- [ ] 3.2 `apps/workflows/tests/backup-base-task-schema-diff.test.ts` — assert audit_history POST happens once per table.

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
