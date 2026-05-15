# Implementation tasks

Pre-req: `baseout-server-byos-destinations` Phase A (master DB) + Phase C (credential decrypt over engine-callback) are green.

## 1. StorageWriter interface + factory

- [ ] 1.1 New `apps/workflows/trigger/tasks/_lib/storage-writers/types.ts` — interface + shared error types.
- [ ] 1.2 Per-provider implementations under `_lib/storage-writers/<provider>.ts`. R2-managed first (the post-R2-removal local-FS shim can keep working in dev).
- [ ] 1.3 Factory `_lib/storage-writers/index.ts` — `makeStorageWriter(destination, env, masterKey)` dispatches on `destination.kind`.

## 2. backup-base.task wiring

- [ ] 2.1 Refactor `apps/workflows/trigger/tasks/backup-base.task.ts` to load the destination (via engine-callback) and instantiate the writer once per task. Replace the existing direct `writeCsvToLocalDisk` call with `writer.writeFile(key, csv)`.
- [ ] 2.2 Add `writer.cleanup()` in the task's `finally` block so partial transfers are cleared (provider-dependent).

## 3. Tests

- [ ] 3.1 One `apps/workflows/tests/storage-writers/<provider>.test.ts` per implementation. Stub HTTP / SDK boundary; assert key shape, retry behavior, and error surfaces.
- [ ] 3.2 Update `apps/workflows/tests/backup-base-task.test.ts` — inject a fake `StorageWriter`; assert lifecycle (init → writeFile per table → cleanup).

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
