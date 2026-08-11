## Why

Workflows-side counterpart to [`server-restore`](../server-restore/proposal.md). The server-side change owns the `restore_runs` lifecycle, the start route, and the progress + complete callback handlers. This change owns the Trigger.dev task that does the actual restore work: read CSV(s) from the storage destination, transform back into Airtable record shape, call Airtable's `POST /v0/:baseId/:tableId` (create-records) in batches with rate-limit backoff, and POST progress + completion back to the engine.

The split is symmetric with the backup-base task: the task body lives on the Trigger.dev Node runner, has unlimited wall clock, and can stream record uploads in batches of 10 (Airtable's batch limit) without running into Worker time budgets.

## What Changes

- **New task** `apps/workflows/trigger/tasks/restore-base.task.ts` — Trigger.dev wrapper.
- **New pure module** `apps/workflows/trigger/tasks/restore-base.ts` — `runRestoreBase(input, deps)` orchestration. Mirrors `runBackupBase`'s skeleton: acquire ConnectionDO lock via engine-callback → fetch decrypted access token → read CSV from storage (via injected `StorageReader` — sibling to `StorageWriter` in `workflows-byos-destinations`) → for each row, transform back to Airtable's `fields` shape → call `POST /v0/:baseId/:tableId` in batches of 10 → emit progress per table → release lock.
- **New helper** `apps/workflows/trigger/tasks/_lib/airtable-create.ts` — Airtable batch-create RPC with 429 backoff. Mirrors the read-side `airtable-client.ts` shape.
- **New helper** `apps/workflows/trigger/tasks/_lib/csv-reader.ts` — streaming CSV parser using Papa Parse's streaming mode. Inverse of `csv-stream.ts`.
- **New helper** `apps/workflows/trigger/tasks/_lib/field-denormalizer.ts` — inverse of `field-normalizer.ts`. Converts CSV cell strings back into Airtable's typed field values.
- **Restore scope handling**: `scope='base'` iterates every CSV in the snapshot directory; `scope='table'` reads one CSV; `scope='point_in_time'` is out of scope for MVP.
- **Conflict policy** (MVP): always create a fresh Airtable base named `<originalName>-restored-<datetime>`. Never write into the source base. Forward-compatible — overwrite/merge modes can be added behind a new scope discriminator later.
- **Type-only re-exports**: update `apps/workflows/trigger/tasks/index.ts` to expose `restoreBaseTask` + `RestoreBaseTaskPayload` + `RestoreBaseResult`.

## Capabilities

### New Capabilities

- `restore-task`: the Trigger.dev task body, CSV-read helpers, Airtable batch-create helper, field denormalizer, and the per-base orchestration pure module.

### Modified Capabilities

None.

## Impact

- New files in `apps/workflows/trigger/tasks/`: `restore-base.task.ts`, `restore-base.ts`, `_lib/airtable-create.ts`, `_lib/csv-reader.ts`, `_lib/field-denormalizer.ts`.
- Extended `apps/workflows/trigger/tasks/index.ts` with type-only re-exports.
- New tests under `apps/workflows/tests/`: `restore-base-task.test.ts`, `airtable-create.test.ts`, `csv-reader.test.ts`, `field-denormalizer.test.ts`.

## Out of Scope

- **Server-side route + lifecycle** — owned by [`server-restore`](../server-restore/proposal.md).
- **Attachment restoration**. The MVP restore task emits attachment cells as-is (semicolon-joined `r2_object_key` strings); the resulting Airtable base will have text-typed cells where attachments were. Re-uploading attachments is a follow-up that depends on the `_lib/attachment-uploader.ts` mirror of `attachment-downloader.ts`.
- **Conflict resolution** for restoring into an existing Airtable base. MVP creates a fresh base; overwrite/merge modes are follow-ups.
- **Point-in-time restore** (`scope='point_in_time'`) — requires replay across incremental cursors, which depends on `workflows-instant-webhook`.
- **Trial-cap enforcement on restore**. Backup caps at 5 tables / 1K records for trial; the workflows-side restore task SHOULD enforce the same caps during implementation (mirror the constants from `runBackupBase`). Tracked here as a TODO; pinned cap matrix should mirror `server-trial-quota-enforcement`'s spec.

## Cross-app contract

```
apps/server POST /api/internal/restores/:id/start
   └─ tasks.trigger<typeof restoreBaseTask>("restore-base", payload)
         └─ apps/workflows restore-base.task.ts
              ├─ POST /api/internal/connections/:id/lock     (acquire)
              ├─ POST /api/internal/connections/:id/token    (decrypted access token)
              ├─ read CSV via StorageReader
              ├─ POST /v0/:baseId/:tableId × N batches (Airtable)
              ├─ POST /api/internal/restores/:id/progress    (per table)
              ├─ POST /api/internal/restores/:id/complete
              └─ POST /api/internal/connections/:id/unlock   (finally)
```
