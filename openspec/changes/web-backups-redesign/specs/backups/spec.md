## ADDED Requirements

### Requirement: Backups list is an auditable run-history table
The system SHALL present a Space's Backups page as a table of every backup run, one row per run, each showing enough to scan at a glance and drilling into the run's full detail. This replaces the inline-expanding accordion.

#### Scenario: A completed run row
- **WHEN** the Backups page lists a finished run
- **THEN** the row shows its status, when it finished, what triggered it, and its base / record / attachment counts and duration, with a Details affordance into the run

#### Scenario: An in-progress run row
- **WHEN** a run is running or queued
- **THEN** the row shows a running/queued status (with a spinner for running) and no duration, and reads as "still going" rather than complete

#### Scenario: A failed run row
- **WHEN** a run failed
- **THEN** the row shows a failed status and omits success-only counts, drawing attention without alarming the whole list

#### Scenario: The whole row drills in
- **WHEN** the user clicks anywhere on a run row
- **THEN** the run-detail page opens for that run, matching the run's state (a running run opens the running detail, a failed run the failed detail)

#### Scenario: No runs yet
- **WHEN** the Space has never run a backup
- **THEN** the page shows an empty state explaining that runs land here with full audit detail, plus a way to run the first one

#### Scenario: Run one now
- **WHEN** the user wants a one-off backup
- **THEN** a "Run backup now" action in the header starts a run (the action moved off a separate card)

### Requirement: A backup run has a dedicated detail page
The system SHALL present a single backup run on its own page — overall status and timing, the layers it captured, where it wrote, and a per-base breakdown — instead of expanding inline in the list.

#### Scenario: A succeeded run
- **WHEN** the user opens a run that completed
- **THEN** the page shows the run's status, trigger, start/finish and duration, totals (bases · tables · records · attachments), the captured layers, the destination, and a table of every base with its per-base counts and output location

#### Scenario: A running run shows progress, not final numbers
- **WHEN** the user opens a run that is still running
- **THEN** the header shows an estimated time remaining, and bases still in flight show captured-so-far versus total for records and attachments, with bases not yet started marked pending

#### Scenario: A failed run explains itself
- **WHEN** the user opens a run that failed
- **THEN** the page shows it stopped, which base failed, and the error, while bases that completed before the failure still show their counts

#### Scenario: Which layers were captured
- **WHEN** the user reads a run's detail
- **THEN** the run shows whether Schema, Data, and Attachments were each captured, reflecting the Space's chosen depth

#### Scenario: Failed attachments are reviewable
- **WHEN** a run could not back up one or more attachments
- **THEN** a banner reports the count and opens a slide-over listing each failed file with its base, table, and reason, and a way to retry them; the rest of the run is still reported as complete

#### Scenario: Each base drills into its tables
- **WHEN** the user wants the per-table detail of a base in the run
- **THEN** each base row links to that base's table-level detail for this run

### Requirement: A base within a run drills down to its tables
The system SHALL present one base of one run on its own page — the base's tables, each with its Fields, Records, Views, and Attachments — as the leaf of the audit trail, so the user can confirm exactly what was captured.

#### Scenario: A backed-up base
- **WHEN** the user opens a base that was backed up in the run
- **THEN** the page lists the base's tables, each with its field, record, view, and attachment counts, plus the base's status, timing, and the folder or database it wrote to

#### Scenario: A base still being captured
- **WHEN** the user opens a base that is still running in an in-progress run
- **THEN** the table currently being written shows records and attachments captured-so-far versus total, and tables not yet started are marked pending

#### Scenario: A base that failed
- **WHEN** the user opens a base that failed in the run
- **THEN** the page shows nothing was written, the tables as failed or pending, and the error explaining why

#### Scenario: Base-level failed attachments
- **WHEN** a base has attachments that could not be backed up
- **THEN** the affected tables are flagged with a failed count and the base's failed attachments are reviewable in a slide-over scoped to that base

#### Scenario: Distinct from the schema view
- **WHEN** the user is on a base's run detail
- **THEN** the page reflects this run's contents and volumes (counts the engine wrote), not a run-agnostic structure or ERD — that is the Schema page's job

#### Scenario: Drilling preserves the run state
- **WHEN** the user drills from a running or failed run into a base
- **THEN** the base page reflects that same run state (running or failed), and a back action returns to the run in the same state

### Requirement: Run figures are recorded, never fabricated
Because the UI is accountable to users auditing their backups, the system SHALL source every figure it shows from real data: tables, fields, and views from Airtable metadata, and record and attachment counts from the backup engine as it writes. The UI SHALL NOT invent counts that are not obtainable.

#### Scenario: Counts trace to a source
- **WHEN** the run or base detail shows a number
- **THEN** it is a count the system can actually obtain (Airtable metadata for structure, the engine for record/attachment volumes), and the page makes that provenance clear in its footnote
