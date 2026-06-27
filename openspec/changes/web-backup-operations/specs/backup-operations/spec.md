## ADDED Requirements

### Requirement: A backup run is an immutable log with in-flight controls only
A completed backup run is a permanent record of what happened and SHALL NOT be edited or deleted from the history. The only controls the system offers act on a run **while it is in flight**: Pause / Restart and Cancel. There SHALL be no Delete and no Run-again at the history level — backed-up data is removed only by the cleanup schedule (see "A cleanup schedule is the only thing that removes backed-up data").

> Confirmed by the client 2026-06-20: Cancel KEEPS the partial data and records the run as `cancelled`; Restart RESUMES from where it stopped (not from scratch). Locked — see `design.md`.

#### Scenario: A running run offers Pause and Cancel
- **WHEN** the user opens a run that is still running
- **THEN** the run header offers Pause/Restart and a quieter-destructive Cancel run, and offers no other lifecycle action
- **AND** both Pause and Cancel ask for confirmation first before acting on the live run — Cancel's confirm notes the partial is kept and can't be resumed; Pause's notes it can be resumed anytime (Resume itself needs no confirm)

#### Scenario: Pausing holds the run and resumes where it stopped
- **WHEN** the user pauses an in-flight run and later restarts it
- **THEN** the run is held in a `paused` state and, on restart, resumes from where it stopped rather than starting over (confirmed with the client 2026-06-20)

#### Scenario: Cancelling keeps the partial backup already written
- **WHEN** the user confirms Cancel on an in-flight run
- **THEN** the run stops and the data captured so far is kept (not discarded), and the run is recorded with a `cancelled` status and its partial counts (confirmed with the client 2026-06-20)

#### Scenario: A settled run has no destructive history actions
- **WHEN** the user opens a run that has finished, failed, been paused-then-ended, or been cancelled
- **THEN** the run reads as a read-only log with no Delete and no Run-again — it cannot be removed from the history, and a fresh backup is started only via the top-level Run Backup Now

#### Scenario: A paused or cancelled run is shown as such in the list and detail
- **WHEN** a run is paused or cancelled
- **THEN** the run-history list and the run-detail page show a `paused` or `cancelled` status (distinct from done / running / failed), keeping any counts captured before it stopped

#### Scenario: Run control is gated by role
- **WHEN** a viewer-role user views a running run
- **THEN** Pause/Restart and Cancel are unavailable to them (read-only); only roles permitted to manage the Space can control a run

### Requirement: Failed attachments can be retried in place
Because attachments fail independently of the run (a file over the size cap, an expired Airtable URL) without failing the run, the system SHALL let the user retry only the failed attachments, re-fetched into the same run, rather than re-running the whole backup.

#### Scenario: Retry re-fetches only the failed files into the same run
- **WHEN** the user chooses Retry failed in a run's (or base's) failed-attachments slide-over
- **THEN** the system re-attempts only the listed failed attachments and reports the result within the same run (a small in-place re-fetch), not a new run

### Requirement: An on-demand backup can be triggered, with a credits acknowledgement
The system SHALL let the user start an immediate backup instead of waiting for the next scheduled run. Because an off-schedule run consumes additional credits, the action SHALL warn the user and require explicit confirmation before it starts. This action is top-level only (it is not offered per run-history row).

#### Scenario: Run Backup Now is a top-level action
- **WHEN** the user wants an immediate backup
- **THEN** a "Run backup now" action is available at the Space level (Space Home rail and the Backups header / empty state), and is NOT offered as a per-history-row "run again"

#### Scenario: Running off-schedule warns about credits and requires confirmation
- **WHEN** the user triggers Run Backup Now
- **THEN** a confirmation appears stating that running off-schedule uses additional credits, with Cancel and Run anyway, and the run starts only when the user confirms Run anyway

#### Scenario: Cancelling the confirmation starts nothing
- **WHEN** the user dismisses or cancels the credits confirmation
- **THEN** no run is started and the Space is unchanged

### Requirement: Backed-up data is restorable, base by base, into new tables
The system SHALL let the user restore from a backup as a rare, last-resort, best-effort operation. Restore works one base at a time and ALWAYS writes into NEW tables — it never overwrites or inserts back into the original tables. Restore is a secondary affordance; the product's primary value is the external backup, its documentation, and its insights.

#### Scenario: Restore is reached from a succeeded run or base
- **WHEN** the user views a run that succeeded, or one of its bases
- **THEN** a Restore action is offered from that detail page; a failed run does not offer Restore

#### Scenario: Choose one base, then its tables
- **WHEN** the user starts a restore
- **THEN** they first choose ONE base from the backup, then choose which of that base's tables to restore, with all tables selected by default and Select all / Clear available

#### Scenario: Choose the target — an existing base or a new base
- **WHEN** the user has chosen the tables to restore
- **THEN** they choose a target: an existing base (the restored tables are added to it) or a brand-new base (named here)

#### Scenario: Choose how attachments are restored
- **WHEN** the restore includes tables that have attachments
- **THEN** the user chooses how to bring them back: **as attachments** (the files are re-uploaded into the new Airtable tables) or **as links** (the field holds links to the files kept in the backup destination), defaulting to as attachments (confirmed with the client 2026-06-20)

#### Scenario: Restore always creates new tables, never overwriting
- **WHEN** the restore runs
- **THEN** it creates new tables in the target base and never overwrites or inserts back into the original tables, so existing data is never destroyed by a restore

#### Scenario: Restore is best-effort and says so
- **WHEN** the user is in the restore flow
- **THEN** a persistent notice sets expectations: records and most data recreate well, but Airtable's API cannot fully rebuild structure — **Formula fields cannot be recreated** (they must be rebuilt by hand) and some field types come back as plain **text** that the user must convert back to their original type — so a restore is best-effort and may need manual finishing

#### Scenario: After restore, the outcome reports what to finish manually
- **WHEN** a restore completes
- **THEN** the user is shown an outcome summary: which tables were recreated and how many records landed, and an explicit list of what could not be recreated automatically — Formula fields to rebuild, fields restored as text to convert back to their original type, and linked-record relationships to re-link — with a link to the new/target base to finish the work

### Requirement: A cleanup schedule is the only thing that removes backed-up data
The system SHALL bound storage with a rolling, tiered retention schedule (grandfather-father-son style) that progressively thins older backup versions, keyed to the backup frequency, with a configurable cutoff. This cleanup schedule is the ONLY mechanism that removes backed-up data; no per-run delete exists.

> Confirmed by the client 2026-06-20: the On2Air tiers are kept verbatim and fixed; the cutoff stays the one configurable knob. Locked.

#### Scenario: Retention is configured in the Space's backup options
- **WHEN** the user configures a Space's backup
- **THEN** the Options step presents the cleanup schedule below the backup Schedule, explaining that older versions are thinned over time to cap storage

#### Scenario: The retention ladder is keyed to the backup frequency
- **WHEN** the user views or changes the backup frequency
- **THEN** the retention ladder updates to match it: Monthly keeps monthly versions; Weekly keeps 3 months of weekly then monthly; Daily keeps 30 days of daily then 2 months of weekly then monthly; Continuous keeps 3 days of continuous then 27 days of daily then 2 months of weekly then monthly

#### Scenario: Older versions are thinned, then removed past the cutoff
- **WHEN** backup versions age beyond each tier
- **THEN** they are downsampled to the next-coarser cadence (continuous → daily → weekly → monthly) and finally removed once older than the cutoff

#### Scenario: The cutoff is configurable with a sensible default
- **WHEN** the user sets how long to keep backups
- **THEN** they can choose a cutoff of 1 year, 2 years, 5 years, or never, defaulting to 5 years

#### Scenario: No other action deletes backed-up data
- **WHEN** the user looks for a way to delete a specific backup run or its data from the history
- **THEN** none exists — backed-up data is removed only as the cleanup schedule thins and ages it out
