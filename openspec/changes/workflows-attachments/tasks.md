# Implementation tasks

Pre-req: `server-attachments` Phase A (DB schema) + `server-byos-destinations` Phase B (storage writer) are green.

## 1. Downloader helper

- [ ] 1.1 New file `apps/workflows/trigger/tasks/_lib/attachment-downloader.ts`. Pure module + factory pattern. Inputs: storage writer, master-DB attachment-lookup callback, refresh-URL callback, `fetch` impl. Output: `download(url, ctx): Promise<{ key, sizeBytes, contentType }>`.
- [ ] 1.2 Streaming write — buffer chunks through SHA-256 hasher into the storage writer. Never load whole attachment into memory; respect single-chunk size limits.
- [ ] 1.3 Dedup branch — before writing, hash the first chunk + length-prefix, query the attachments table via `POST /api/internal/attachments/lookup`. If hit, skip the write and return the existing key.
- [ ] 1.4 URL-refresh branch — on 401 / 403 / 410 from the Airtable CDN, call the injected refresh callback and retry once.

## 2. Field-normalizer integration

- [ ] 2.1 Update `apps/workflows/trigger/tasks/_lib/field-normalizer.ts`. The `attachment` field-type branch now takes the downloader + `DownloadContext` and emits a semicolon-joined list of returned keys.
- [ ] 2.2 Backward-compat shim: if the downloader dep is absent (legacy tests), fall back to the existing `[N attachments]` placeholder to keep the old tests green until they're updated.

## 3. Task plumbing

- [ ] 3.1 Update `apps/workflows/trigger/tasks/backup-base.ts` to accept `attachmentDownloader` in the `BackupBaseDeps` interface and thread `DownloadContext` from the record/field iteration into the normalizer call.
- [ ] 3.2 Update `apps/workflows/trigger/tasks/backup-base.task.ts` to construct the downloader once per task invocation with real `db` (via engine-callback), `storageWriter`, and `refreshAirtableUrl` deps.
- [ ] 3.3 Extend the per-base completion payload constructed in `backup-base.task.ts` to include `attachmentBytesByBase` and `attachmentCountByBase`.

## 4. Tests

- [ ] 4.1 New `apps/workflows/tests/attachment-downloader.test.ts`. Cases: happy-path streaming write, dedup hit (no write), URL-refresh retry, 5xx surfaces as task failure.
- [ ] 4.2 Update `apps/workflows/tests/field-normalizer.test.ts` — add an `attachment` field-type case that exercises the downloader path with a stubbed dep.
- [ ] 4.3 Update `apps/workflows/tests/backup-base-task.test.ts` to assert the completion payload carries `attachmentCountByBase`.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
- [ ] 5.2 Cross-check: server-side `server-attachments` task list no longer carries workflows file-path bullets; only the schema + route + dedup-storage bullets remain.
