## ADDED Requirements

### Requirement: Workflows-side attachment downloader
The Trigger.dev backup-base task SHALL stream Airtable-hosted attachment bytes through a dedup-aware downloader and emit content-addressed storage keys into the CSV cell. The downloader SHALL live in `apps/workflows/trigger/tasks/_lib/attachment-downloader.ts` and SHALL be injected into the field-normalizer + backup-base orchestrator via the `deps` object pattern.

#### Scenario: dedup hit skips the write
- **WHEN** a record's attachment matches an existing `attachments` row (matched via `POST /api/internal/attachments/lookup`)
- **THEN** the downloader SHALL skip the storage-writer call
- **AND** SHALL emit the existing `r2_object_key` (storage-relative path) into the CSV cell
- **AND** SHALL log `event: 'attachment_dedup_hit'` once per skipped record

#### Scenario: dedup miss streams + records
- **WHEN** no existing row matches
- **THEN** the downloader SHALL stream bytes through a SHA-256 hasher into the active `StorageWriter`
- **AND** SHALL POST a new attachment row via `/api/internal/attachments/lookup` (idempotent on hash)
- **AND** SHALL emit the new `r2_object_key` into the CSV cell

#### Scenario: stale URL refresh
- **WHEN** the Airtable CDN returns 401 / 403 / 410 mid-stream
- **THEN** the downloader SHALL call the injected `refreshAirtableUrl` callback once
- **AND** SHALL retry the download against the new URL
- **AND** SHALL surface persistent 4xx as a task failure (caught by the wrapper's outer try/catch)

### Requirement: Per-base completion payload carries attachment counts
The `backup-base.task.ts` wrapper SHALL extend its `/api/internal/runs/:runId/complete` POST payload to include `attachmentCountByBase: { [baseId]: number }` and `attachmentBytesByBase: { [baseId]: number }`.

#### Scenario: completion payload includes counts
- **WHEN** the task body returns successfully
- **THEN** the per-base completion payload SHALL include `attachmentCountByBase` keyed by `atBaseId`
- **AND** SHALL include `attachmentBytesByBase` summing the streamed byte totals
- **AND** the route SHALL aggregate into `backup_runs.attachment_count` + `backup_runs.attachment_bytes` atomically
