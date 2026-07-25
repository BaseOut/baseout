# comment-capture

## ADDED Requirements

### Requirement: Record comments are captured during backup for enabled Spaces

For every backup run of a Base whose payload carries `commentsEnabled: true`, the backup task SHALL identify records bearing comments (comment-count metadata on the record-listing pass, or the documented fallback), fetch each such record's comments via the Airtable REST comments endpoint with pagination, and deliver them to the engine's comments-sync route in batches during the fan-out, marking a record `complete` only when its pagination finished.

#### Scenario: Commented records are captured

- **WHEN** a backup run executes for an enabled Space over a base where 40 of 5,000 records have comments
- **THEN** comment fetches occur only for those 40 records and every fetched comment reaches comments-sync with its record marked `complete`

#### Scenario: Disabled Space makes no comment requests

- **WHEN** the payload carries `commentsEnabled: false`
- **THEN** no comment-count metadata is requested beyond the normal listing and no comments endpoint call is made

### Requirement: Comment capture failures never compromise the backup run

Comment capture SHALL run after record and attachment capture for the base, SHALL share the Airtable rate-limit pacing, and on any failure (rate-limit exhaustion, HTTP error, timeout) SHALL report `comments: partial|skipped (reason)` in run progress without changing the run's outcome or the captured record/attachment data. Records whose pagination did not finish SHALL NOT be marked `complete`.

#### Scenario: Failure mid-fan-out

- **WHEN** the comments endpoint starts failing after 10 of 40 commented records were fully captured
- **THEN** the run completes with its normal status, progress shows `comments: partial`, and only those 10 records were delivered as `complete`

#### Scenario: Comment capture never delays core capture

- **WHEN** a base has heavy comment volume
- **THEN** records and attachments for that base are fully captured before any comment fetch is issued
