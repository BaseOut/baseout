> **Pairs with**: [`server-attachment-upload-status`](../server-attachment-upload-status/proposal.md) — the schema columns + `/lookup`/`/record` endpoint shapes this change consumes. **Depends on** it shipping first.
>
> **Extends**: [`workflows-attachments`](../workflows-attachments/proposal.md) (the downloader + `backup-base` wiring, landed 2026-06-08 on branch `autumn/backup-fix-local`).

## Why

The **Jun 10, 2026 Dan / Autumn Sync** agreed the `attachment_dedup` table should record each file's name and an explicit `ready` vs `uploaded` status. The paired server change adds those columns and widens the endpoints; this change makes the workflows downloader actually populate them, so the model is true end-to-end rather than schema-only.

Today the downloader records `compositeId`, `storageKey`, `sizeBytes`, and `mimeType` after a `writeBlob`, with no filename and no status. The status is knowable at write time: `backup-base.ts` already resolves the active `storageType`, so a `local_fs` write is `ready` (staged on the Trigger.dev runner's disk, not yet at a destination) and an R2/BYOS write is `uploaded`.

Per the meeting's aligned decision, this prioritizes **functional completion over performance optimization** — no batching/chunking changes here.

## What Changes

[apps/workflows/trigger/tasks/_lib/attachment-downloader.ts](../../../apps/workflows/trigger/tasks/_lib/attachment-downloader.ts):

- `AttachmentRecordEntry` gains optional `filename` and `uploadStatus` (`'ready' | 'uploaded'`).
- `AttachmentDownloaderDeps` gains `uploadStatus: 'ready' | 'uploaded'` (defaults to `'uploaded'`), injected once per task run.
- The injected `lookup` return type widens to `Record<string, { storageKey: string; uploadStatus: string }>` to match the paired server change; `processCell` reads `existing.storageKey` from the hit object. Skip-on-hit behavior is unchanged, so redundant uploads stay prevented.
- Each new record entry includes `filename: attachment.filename` (the downloader already receives it) and `uploadStatus: deps.uploadStatus`.

[apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts):

- Passes `uploadStatus: storageType === "local_fs" ? "ready" : "uploaded"` into the downloader deps.
- Adapts the `lookup` / `record` callback adapters to the new request/response shapes.

### Out of scope

- The schema + endpoints — paired [`server-attachment-upload-status`](../server-attachment-upload-status/proposal.md).
- A standalone phase that uploads `ready` rows and flips them to `uploaded` — deferred follow-up.
- Chunks-of-100 vs Airtable URL expiry — deferred per the meeting. The existing one-retry-on-401/403/410 in the downloader is untouched.

## Security review

No new auth surface, secret, or external integration. The downloader still reaches the master DB only through the INTERNAL_TOKEN-gated engine callbacks. Node-only runtime per [CLAUDE.md §6](../../../CLAUDE.md) — no `cloudflare:workers` import.
