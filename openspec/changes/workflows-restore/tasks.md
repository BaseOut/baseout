# Implementation tasks

Pre-req: `server-restore` Phase B (start route + enqueue helper) is green so this change can be smoke-tested end-to-end.

## 1. Storage reader

- [ ] 1.1 New `apps/workflows/trigger/tasks/_lib/storage-readers/types.ts`. Interface mirror of `StorageWriter` from `workflows-byos-destinations`: `init()`, `readFile(key)`, `listKeys(prefix)`, `cleanup()`.
- [ ] 1.2 New per-provider readers under `_lib/storage-readers/<provider>.ts`. Start with R2-managed (or local-FS for the post-R2-removal era) + S3.
- [ ] 1.3 Factory `_lib/storage-readers/index.ts` — `makeStorageReader(destination, env, masterKey)` dispatches on `destination.kind`.

## 2. CSV reader + field denormalizer

- [ ] 2.1 TDD red: `apps/workflows/tests/csv-reader.test.ts`. Cases: streaming parse of a 10K-row file; header-only file; malformed quote handling.
- [ ] 2.2 Implement `apps/workflows/trigger/tasks/_lib/csv-reader.ts` using Papa Parse's stream mode.
- [ ] 2.3 TDD red: `apps/workflows/tests/field-denormalizer.test.ts`. Mirror of field-normalizer.test.ts cases: scalars round-trip; multi-select semicolon expand; date/datetime round-trip; attachment-cell passthrough (placeholder text only — actual attachment restore deferred).
- [ ] 2.4 Implement `apps/workflows/trigger/tasks/_lib/field-denormalizer.ts`.

## 3. Airtable batch-create

- [ ] 3.1 TDD red: `apps/workflows/tests/airtable-create.test.ts`. Cases: happy 10-record batch; 429 backoff + retry; 422 (field validation) surfaces as task failure; partial batch with one bad record (Airtable's `typecast: true` behavior + per-record error handling).
- [ ] 3.2 Implement `apps/workflows/trigger/tasks/_lib/airtable-create.ts` — `createRecords(baseId, tableId, accessToken, records, fetchImpl?)`. Returns `{ created: AirtableRecord[], errors: AirtableError[] }`.

## 4. Pure orchestration

- [ ] 4.1 TDD red: `apps/workflows/tests/restore-base.test.ts`. Cases: happy path (read CSV → create records → progress → complete); lock contention (5s retry); empty CSV (no-op create); Airtable failure mid-table (partial counts emitted in completion).
- [ ] 4.2 Implement `apps/workflows/trigger/tasks/restore-base.ts` — `runRestoreBase(input, deps)`. Same DI shape as `runBackupBase`. Calls injected `airtable-create`, `storage-reader`, `csv-reader`, `field-denormalizer`, `postProgress`.

## 5. Trigger.dev wrapper

- [ ] 5.1 Implement `apps/workflows/trigger/tasks/restore-base.task.ts`. Reads `process.env.{BACKUP_ENGINE_URL,INTERNAL_TOKEN}`. Wraps `runRestoreBase` in try/catch + posts `/complete` on either branch.
- [ ] 5.2 TDD red: `apps/workflows/tests/restore-base-task.test.ts`. Cases mirror backup-base-task.test.ts: env-var validation; happy completion POST; thrown-error completion POST with `status='failed'`.

## 6. Index re-exports

- [ ] 6.1 Update `apps/workflows/trigger/tasks/index.ts` — `export type { restoreBaseTask, RestoreBaseTaskPayload } from "./restore-base.task"` + `export type { RestoreBaseResult, RestoreBaseInput } from "./restore-base"`.
- [ ] 6.2 `apps/server/src/lib/trigger-client.ts` consumes the type via `import type { restoreBaseTask } from "@baseout/workflows"` (server-side bullet handled in `server-restore` Phase B.5).

## 7. Verification

- [ ] 7.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
- [ ] 7.2 Manual smoke (requires `server-restore` shipped): seed a `restore_runs` row pointing at a known-good `backup_runs` snapshot. POST `/api/internal/restores/:id/start`. Watch Trigger.dev dashboard; confirm task body completes. Inspect the resulting Airtable base.
- [ ] 7.3 Update `specreview/04-recommendations.md` Round 3 — link this change + the server-side sibling.
