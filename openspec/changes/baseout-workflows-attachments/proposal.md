## Why

Workflows-side counterpart to [`baseout-server-attachments`](../baseout-server-attachments/proposal.md). The server-side change owns the master-DB attachment table additions, the dedup index, R2/BYOS object storage layout, and the `/runs/complete` payload extension. This change owns the workflows-side downloader + the `backup-base` task plumbing that fetches Airtable-hosted attachment URLs, streams bytes into the storage destination, and emits dedup keys into the CSV cell.

## What Changes

- New helper `apps/workflows/trigger/tasks/_lib/attachment-downloader.ts`. Streams Airtable's signed CDN URLs into the active `StorageWriter` (via the BYOS / R2 destination strategy owned by `baseout-server-byos-destinations`). Computes a content-addressed dedup key (SHA-256 over the byte stream).
- Update `apps/workflows/trigger/tasks/_lib/field-normalizer.ts`. Replace the `[N attachments]` placeholder branch with a downloader call; emit a semicolon-joined list of `r2_object_key` (a.k.a. storage-relative path) strings into the CSV cell.
- Update `apps/workflows/trigger/tasks/backup-base.ts` to thread a `DownloadContext` (`{ baseId, tableId, recordId, fieldId }`) through per-page record processing into the field normalizer.
- Update `apps/workflows/trigger/tasks/backup-base.task.ts` to instantiate the downloader with per-task `db` / `r2` / `refreshAirtableUrl` deps.
- Extend the per-base completion callback in `backup-base.task.ts` to include `attachmentCountByBase: { [baseId]: number }`. The server-side `/runs/complete` route persists the count.

## Out of Scope

- Master DB schema additions (`attachments` table, dedup index, `attachment_count` column on `backup_run_bases`) — owned by `baseout-server-attachments`.
- The `/runs/complete` route handler extension — owned by `baseout-server-attachments`.
- Storage destination strategy itself (R2 vs Google Drive vs S3) — owned by `baseout-server-byos-destinations` + `baseout-workflows-byos-destinations`.
- Signed-URL refresh against Airtable when the CDN URL expires mid-download — implementation lives in the downloader, but the OAuth refresh path it reuses is `baseout-server-cron-oauth-refresh`.

## Cross-app contract

- The downloader writes bytes via `StorageWriter` injected by the task wrapper (per `baseout-workflows-byos-destinations`). Dedup lookup happens against the master DB via a thin engine-callback `POST /api/internal/attachments/lookup` — declared in the server-side sibling.
- After all tables complete, the task's existing per-base completion POST carries `attachmentCountByBase`. The route is idempotent; a duplicate POST against a terminal row no-ops.
