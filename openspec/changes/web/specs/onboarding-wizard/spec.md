## ADDED Requirements

### Requirement: Five-step wizard

After sign-up, the user SHALL traverse a five-step onboarding wizard: (1) Connect Airtable, (2) Select Bases, (3) Pick Backup Frequency, (4) Pick Storage Destination, (5) Confirm + Run First Backup. Wizard state SHALL be tracked on `spaces.onboarding_step`.

#### Scenario: Wizard resume

- **WHEN** a user closes the browser at Step 3 and logs back in
- **THEN** the wizard resumes at Step 3 reading `spaces.onboarding_step`

### Requirement: Step 1 — Connect Airtable

Step 1 SHALL initiate the Airtable OAuth flow if no Connection exists from pre-registration; it SHALL persist a `connections` row with encrypted tokens.

#### Scenario: Pre-reg Connection reused

- **WHEN** a user signed up via pre-registration with Airtable already OAuthed
- **THEN** Step 1 is auto-completed and the wizard advances to Step 2

### Requirement: Step 2 — Select Bases

Step 2 SHALL present a multi-select of bases discovered via Airtable OAuth metadata, plus an "Auto-add new bases" toggle. Selected bases SHALL be persisted as `bases` rows; the toggle SHALL be persisted on `backup_configurations.auto_add_new_bases`.

#### Scenario: User toggles auto-add

- **WHEN** a user enables "Auto-add new bases"
- **THEN** `backup_configurations.auto_add_new_bases=true` is persisted

### Requirement: Step 3 — Frequency

Step 3 SHALL present Monthly / Weekly / Daily / Instant options gated by the user's tier (resolved via the capability resolver). The selection SHALL be persisted to `backup_configurations.frequency`.

#### Scenario: Trial user picks Instant

- **WHEN** a Trial user opens the frequency picker
- **THEN** Instant is disabled with a tier-upgrade hint and Daily/Weekly/Monthly remain selectable

### Requirement: Step 4 — Storage Destination

Step 4 SHALL default to managed Cloudflare R2 (no further config). BYOS options (Google Drive, Dropbox, Box, OneDrive, S3 Growth+, Frame.io Growth+, Custom Pro+) SHALL each have an OAuth/IAM flow on this step. Selection SHALL be persisted as a `storage_destinations` row.

#### Scenario: Default R2

- **WHEN** a user accepts the default
- **THEN** a `storage_destinations` row is created with `type='r2_managed'`

### Requirement: Step 5 — Confirm + Run First Backup

Step 5 SHALL present a summary panel and a "Run first backup" button. On click, `web` SHALL write a `backup_runs` row with `trigger_type='manual'` and POST to `server`'s `/runs/{id}/start` endpoint.

#### Scenario: First backup triggered

- **WHEN** a user clicks "Run first backup"
- **THEN** a `backup_runs` row is created and the call to `server`'s `/runs/{id}/start` returns 200

### Requirement: Dashboard locked until first backup completes

Between Step 5 starting the first backup and that run reaching a final status, the dashboard SHALL render a "first backup running" placeholder rather than the full dashboard.

#### Scenario: First backup completes

- **WHEN** the first backup's `backup_runs.status` reaches `success` or `failed`
- **THEN** the dashboard becomes fully accessible
