## ADDED Requirements

### Requirement: Incremental-backup task pages records by modifiedTime
A Trigger.dev task `incremental-backup` SHALL accept a coalesced event window from the per-Space DO and back up only the affected records using Airtable's `LAST_MODIFIED_TIME()` filter.

#### Scenario: delta pass writes per-table deltas
- **WHEN** the task is triggered with `{ runId, spaceId, baseId, tables, cursorSince }`
- **THEN** for each table it SHALL page records where `LAST_MODIFIED_TIME() > cursorSince`
- **AND** SHALL write deltas under `/<orgSlug>/<spaceName>/<baseName>/incremental/<runId>/<tableName>.csv`
- **AND** SHALL POST cursor advancement to `/api/internal/airtable-webhooks/:id/cursor` after each successful table

#### Scenario: gap fallback
- **WHEN** the DO signals a gap (`fallback_to_full=true` in the task payload)
- **THEN** the task SHALL skip the delta path entirely
- **AND** SHALL POST `/api/internal/airtable-webhooks/:id/fallback` to instruct the DO to enqueue a fresh `backup-base` run
- **AND** SHALL exit with `{ status: 'fallback_to_full' }`
