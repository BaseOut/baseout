# comments-sync

## ADDED Requirements

### Requirement: Batched comment captures are persisted per Space

The engine SHALL expose an INTERNAL_TOKEN-gated route `POST /api/internal/spaces/comments-sync` accepting batched per-record comment captures, and SHALL persist each comment as a `bo_at_comments` row keyed by Airtable comment id with record/table references, author, text, Airtable timestamps, raw payload, and lifecycle stamps.

#### Scenario: First capture for a record

- **WHEN** a comments-sync batch reports record `recA` with two comments never seen before
- **THEN** two active `bo_at_comments` rows exist referencing `recA` with the run's stamps

#### Scenario: Unauthenticated caller

- **WHEN** the route is called without a valid `x-internal-token`
- **THEN** the request is rejected and no rows change

### Requirement: Comment edits and deletions are visible run-over-run

For each record marked `complete` in a batch, the engine SHALL update rows whose text or last-updated timestamp changed, and SHALL mark rows deleted when their comment id is absent from that record's capture. Records not present in a batch SHALL leave their comment rows untouched.

#### Scenario: Comment edited in Airtable

- **WHEN** a re-captured comment carries new text and a later last-updated timestamp
- **THEN** the row's text and timestamps update and the run stamp advances

#### Scenario: Comment deleted in Airtable

- **WHEN** a previously stored comment id is absent from a `complete` re-capture of its record
- **THEN** the row transitions to deleted status and remains readable (deleted-comment visibility)

#### Scenario: Incremental run skips a record

- **WHEN** a batch omits record `recB` entirely
- **THEN** `recB`'s comment rows are unchanged, including active status

### Requirement: Comment retention follows record retention

Comment rows SHALL be subject to the same retention/cleanup decisions as the record backups they annotate — no independent retention policy.

#### Scenario: Cleanup pass

- **WHEN** the retention machinery deletes a Space's expired record data
- **THEN** the corresponding comment rows are included in the same deletion plan
