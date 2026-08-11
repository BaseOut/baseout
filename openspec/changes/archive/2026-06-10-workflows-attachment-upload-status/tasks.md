# Implementation tasks — workflows-attachment-upload-status

> **Pairs with** [`server-attachment-upload-status`](../server-attachment-upload-status/tasks.md). Pre-req: that change is green (the `/lookup` response shape `{ storageKey, uploadStatus }` and the `/record` request fields `filename` + `uploadStatus` must exist first). Follows [`workflows-attachments`](../workflows-attachments/tasks.md).

## Phase 1 — Downloader (TDD)

- [x] 1.1 **Red** — extend [apps/workflows/tests/attachment-downloader.test.ts](../../../apps/workflows/tests/attachment-downloader.test.ts): record entries carry `filename` + `uploadStatus`; with `deps.uploadStatus='ready'` a miss records `'ready'`, with `'uploaded'` it records `'uploaded'`; a lookup hit (new `{ storageKey, uploadStatus }` shape) still skips the download and returns the existing key.
- [x] 1.2 **Green** — in [apps/workflows/trigger/tasks/_lib/attachment-downloader.ts](../../../apps/workflows/trigger/tasks/_lib/attachment-downloader.ts):
  - `AttachmentRecordEntry` += `filename?: string` and `uploadStatus?: "ready" | "uploaded"`.
  - `AttachmentDownloaderDeps` += `uploadStatus: "ready" | "uploaded"` (default `"uploaded"`).
  - Widen the `lookup` callback return type to `Record<string, { storageKey: string; uploadStatus: string }>`; in `processCell` read `existing.storageKey`.
  - Include `filename: attachment.filename` and `uploadStatus: deps.uploadStatus` in each record entry.

## Phase 2 — Task wiring

- [x] 2.1 In [apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts), pass `uploadStatus: storageType === "local_fs" ? "ready" : "uploaded"` into the downloader deps.
- [x] 2.2 Adapt the `lookup` / `record` callback adapters (in `backup-base.ts` and/or `backup-base.task.ts`) to the new `/lookup` response + `/record` request shapes.

## Phase 3 — Verification

- [x] 3.1 `pnpm --filter @baseout/workflows test attachment-downloader` green.
- [x] 3.2 `pnpm --filter @baseout/workflows typecheck` green.
- [ ] 3.3 **End-to-end smoke** (needs both paired changes shipped): `npx trigger.dev dev` + `pnpm --filter @baseout/server deploy:dev`, pick **Local disk (dev only)** in the storage picker, run a backup on a base with attachments. Confirm `attachment_dedup` rows have `filename` set and `upload_status='ready'`. Re-run → no re-download (lookup hit). Engine runs `--remote`; deploy before smoking. The `'uploaded'` path needs a real R2/BYOS connection.
