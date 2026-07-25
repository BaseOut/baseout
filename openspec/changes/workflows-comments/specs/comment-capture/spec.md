# comment-capture

## ADDED Requirements

### Requirement: Record comments are captured during backup for enabled Spaces

For every backup run of a Base whose payload carries `commentsEnabled: true`, the backup task SHALL identify records bearing comments (comment-count metadata on the record-listing pass, or the documented fallback), SHALL submit the observed counts to the engine's comments-plan route, and SHALL fetch comments via the Airtable REST comments endpoint (paginated) **only for records the plan marks as needing refresh**, delivering them to the comments-sync route in batches during the fan-out, marking a record `complete` only when its pagination finished. Zero-candidates returned by the plan that were observed with `commentCount = 0` SHALL be delivered as empty `complete` captures without a fetch. If the plan call fails, the task SHALL fall back to fetching all observed commented records.

#### Scenario: Only changed records are fetched

- **WHEN** a backup run executes over a base where 40 of 5,000 records have comments and the plan reports 6 of them changed since the last capture
- **THEN** comment fetches occur only for those 6 records, every fetched comment reaches comments-sync with its record marked `complete`, and the other 34 records get no comments-endpoint call

#### Scenario: Dropped-to-zero record resolves without a fetch

- **WHEN** the plan returns a zeroCandidate that the listing pass observed with `commentCount = 0`
- **THEN** the task sends that record as `complete: true` with an empty comment list and makes no comments-endpoint call for it

#### Scenario: Plan failure degrades to full refresh

- **WHEN** the comments-plan call fails during a run
- **THEN** the task fetches comments for every observed commented record (pre-optimization behavior) and the run proceeds normally

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
