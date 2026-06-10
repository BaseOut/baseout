# workflows-r2-writer

> **Depends on**: [`system-r2-revive`](../system-r2-revive/proposal.md) (decision: R2 returns as a Node-runner S3-API `StorageWriter`, app-level env creds). This is its first code change.

## Why

`storageType === 'r2_managed'` is the default destination per [PRD §7.2](../../../shared/Baseout_PRD.md), and the web UI ([StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro)) already renders R2 as enabled + default, with `persist-policy.ts` accepting it. But on the runner, `r2_managed` falls through to `LocalFsWriter` — there is no R2 writer, so "R2" backups silently land on the runner's local disk. This change closes that gap.

R2 was previously a Cloudflare Worker direct-write (removed in `8fc1f61`). Backups now run on Trigger.dev's **Node runner**, which has no Workers bindings, so the writer uses R2's **S3-compatible API**.

## What Changes

### New file — `apps/workflows/trigger/tasks/_lib/storage-writers/r2.ts`

`createR2Writer({ creds, fetchImpl?, endpoint? }): StorageWriter` implementing the existing interface:

- `writeCsv(relativeKey, csv)` — SigV4 `PUT` of the CSV bytes (`text/csv`) to `<endpoint>/<bucket>/<relativeKey>`. Returns `{ path: 's3://<bucket>/<key>', size }`.
- `deletePrefix(relativePrefix)` — `ListObjectsV2` under the prefix, then `DeleteObjects` (batched). Idempotent: an absent prefix returns `{ deletedCount: 0 }`.
- `..` path-traversal guard mirroring the other writers (`invalid_path`).

SigV4 signing via **`aws4fetch`** (`AwsClient`) — zero-dep, fetch-native, matches the existing writers' `fetchImpl` test seam. Region is `auto` for R2.

### Modify — `apps/workflows/trigger/tasks/_lib/storage-writers/index.ts`

- Add `R2WriterCreds` (`{ accountId, accessKeyId, secretAccessKey, bucket }`) and an `{ kind: 'r2' } & R2WriterCreds` variant to the `StorageWriterCreds` union.
- Dispatch `storageType === 'r2_managed' && creds?.kind === 'r2'` → `createR2Writer` **before** the `LocalFsWriter` fallback.

### Modify — `apps/workflows/trigger/tasks/backup-base.ts`

- Add an `r2_managed` branch to the cred gate (currently only the 4 OAuth types). R2 creds come from a new optional dep `deps.getR2Creds?(): R2WriterCreds | null` (keeps the pure function testable without `process.env`), **not** from `defaultFetchStorageCreds`.

### Modify — `apps/workflows/trigger/tasks/backup-base.task.ts`

- Read `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` from `process.env`; inject as `getR2Creds`.
- If `storageType === 'r2_managed'` and any are unset, throw a clear startup error (mirror the existing `BACKUP_ENGINE_URL` guard).

### Add dependency

- `aws4fetch` in `apps/workflows/package.json`.

### Doc-only

- Update the stale "R2 removed" comment header in `apps/workflows/trigger/tasks/_lib/r2-path.ts` — `buildR2Key` now produces a real R2 object key again.

## Out of Scope

| Deferred to | Item |
|---|---|
| `workflows-attachments` | The `writeBlob` binary method on `StorageWriter` + its R2 implementation (attachments). This change handles `writeCsv`/`deletePrefix` only. |
| Future `workflows-r2-multipart` | Multipart upload for very large objects. CSVs are well within single-PUT limits. |
| Operational | Provisioning the R2 bucket + S3 API token and setting the `R2_*` env vars in Trigger.dev. |

## Capabilities

### Modified capabilities

- `backup-engine` — `r2_managed` resolves a real R2 writer instead of `LocalFsWriter`.

## Impact

- **New dependency:** `aws4fetch` (~tiny, zero-dep) in `apps/workflows`.
- **Secrets:** four `R2_*` env vars on the Trigger.dev runner. No `.dev.vars` involvement (runner is Trigger.dev-hosted). Per [CLAUDE.md §3.3](../../../CLAUDE.md).
- **Isolation:** no change to Airtable/BYOS OAuth, `storage_destinations`, or any web route. R2 is selected purely via `backup_configurations.storage_type` + env creds.
- **Cost:** R2 storage + Class A (PUT) ops. At MVP scale, negligible.

## Reversibility

Pure roll-forward addition. Reverting removes `r2.ts` + the factory branch; `r2_managed` falls back to `LocalFsWriter` as before. Already-written R2 objects remain (harmless; retention prunes later).
