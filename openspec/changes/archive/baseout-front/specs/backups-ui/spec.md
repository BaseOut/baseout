## ADDED Requirements

### Requirement: Backup history list

The Backups page SHALL render a paginated list of `backup_runs` rows for the current Space joined with `backup_run_bases`, showing status, timestamp, record/table/attachment counts, and a link to per-run audit detail.

#### Scenario: User opens Backups

- **WHEN** a user navigates to /backups
- **THEN** the most-recent N runs render with status, timestamp, counts, and a link to detail

### Requirement: Run-now button

A "Run Now" button SHALL be present on the Backups page (and the dashboard). Clicking it SHALL POST to a front endpoint that writes a `backup_runs` row with `trigger_type='manual'` and calls back's `/runs/{run_id}/start`.

#### Scenario: Run-now click

- **WHEN** a user clicks "Run Now" while no run is in progress
- **THEN** a `backup_runs` row is created and back's `/runs/{run_id}/start` is invoked; the dashboard switches to live progress

#### Scenario: Run-now while another run is in progress

- **WHEN** a user clicks "Run Now" while a run is already `status='running'`
- **THEN** the request is rejected with a "run already in progress" message

### Requirement: Per-run audit detail

The audit detail page SHALL render the `backup_runs` summary plus per-base detail from `backup_run_bases` and SHALL fetch the audit log content from a back-served endpoint when needed.

#### Scenario: Failed run detail

- **WHEN** a user opens detail for a failed run
- **THEN** the page renders the per-base failure reasons from `backup_run_bases` and surfaces a "see audit log" link to back's read endpoint

### Requirement: Run configuration UI

The Backups page SHALL include a configuration UI that edits `backup_configurations` (frequency, attachment inclusion, auto-add new bases). Changes SHALL apply on the next scheduled run.

#### Scenario: Frequency change

- **WHEN** a user changes frequency from Daily to Weekly
- **THEN** `backup_configurations.frequency='weekly'` is persisted; back's per-Space DO consumes it on the next scheduled cycle
