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

### Requirement: Comment refresh is planned by count delta

The engine SHALL expose an INTERNAL_TOKEN-gated route `POST /api/internal/spaces/comments-plan` accepting the per-record `commentCount`s observed during a run's record listing. It SHALL compare each observed count against the record's stored active-comment count (derived from `bo_at_comments`) and respond with `refresh` (records whose counts differ) and `zeroCandidates` (records holding stored active comments absent from the observed commented set). A record whose observed count equals its stored count SHALL be treated as unchanged — this is a documented trade-off: same-count modifications (a paired delete+add, or comment edits, which never change the count) are not detected until the record's count next changes.

#### Scenario: Unchanged count is skipped

- **WHEN** a plan request reports record `recA` with `commentCount` 3 and `recA` has 3 stored active comments
- **THEN** `recA` is not in `refresh`, and a subsequent batch omitting `recA` leaves its rows untouched

#### Scenario: Changed count triggers refresh

- **WHEN** a plan request reports record `recB` with `commentCount` 4 and `recB` has 3 stored active comments
- **THEN** `recB` is in `refresh`

#### Scenario: Count drop to zero resolves without a fetch

- **WHEN** record `recC` has stored active comments but is absent from the plan request's observed set, and workflows subsequently delivers `recC` as `complete: true` with an empty comment list
- **THEN** the plan response lists `recC` in `zeroCandidates` and the empty complete capture marks `recC`'s comments deleted

#### Scenario: Same-count edit is an accepted miss

- **WHEN** a comment on record `recD` was edited in Airtable but `recD`'s count equals its stored count
- **THEN** `recD` is not in `refresh` and its rows are unchanged this run (the edit is picked up whenever `recD`'s count next differs)

### Requirement: Comment retention follows record retention

Comment rows SHALL be subject to the same retention/cleanup decisions as the record backups they annotate — no independent retention policy.

#### Scenario: Cleanup pass

- **WHEN** the retention machinery deletes a Space's expired record data
- **THEN** the corresponding comment rows are included in the same deletion plan
