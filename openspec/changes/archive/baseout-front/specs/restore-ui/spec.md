## ADDED Requirements

### Requirement: Snapshot picker

The Restore page SHALL render a snapshot timeline of `backup_runs` for the Space, allowing point-in-time selection within the retention window.

#### Scenario: Snapshot outside retention

- **WHEN** a user attempts to select a snapshot outside the Space's retention window
- **THEN** the picker disables it with a hint, or shows an error if submitted

### Requirement: Scope picker

The Restore page SHALL allow scope selection (base / table / point-in-time) gated by tier (table-level requires Starter+).

#### Scenario: All-tiers base restore

- **WHEN** a Trial user submits a base-level restore
- **THEN** the form accepts the submission and proceeds

### Requirement: Destination chooser

The Restore page SHALL allow choosing a new base (Workspace ID input) or a new table in an existing base (Starter+).

#### Scenario: New table in existing base

- **WHEN** a Starter+ user picks "new table in existing base" with a target base
- **THEN** the form persists the choice on the `restore_runs` row

### Requirement: Submission contract

On submit, front SHALL write a `restore_runs` row with `status='pending'` and POST to back's `/restores/{id}/start` with the service token.

#### Scenario: Submit succeeds

- **WHEN** the user submits a restore form
- **THEN** a `restore_runs` row is created and back's `/restores/{id}/start` returns 200

### Requirement: Status updates

The Restore page SHALL subscribe to `restore_runs` updates via WebSocket or poll and SHALL render the current state until completion.

#### Scenario: Restore completes

- **WHEN** `restore_runs.status` transitions to `success`
- **THEN** the UI shows a completion banner and a link to the new base

### Requirement: Verification result display (Growth+)

For Growth+ runs, the Restore page SHALL render the post-restore verification result from `restore_runs.verification_status`.

#### Scenario: Verification mismatch surfaced

- **WHEN** `verification_status='mismatch'`
- **THEN** the UI surfaces a warning and links to detail showing the count diff

### Requirement: Community Restore Tooling render (Pro+)

For Pro+ Spaces, when a restore covers entities that cannot be auto-restored (Automations, Interfaces), the UI SHALL render the AI-prompt bundle returned from back's `/spaces/{id}/restore-bundle/{run_id}` endpoint, with copy-to-clipboard and step-by-step instructions.

#### Scenario: Bundle render

- **WHEN** a Pro+ restore completes for a base with Automations
- **THEN** the UI renders the prompt template, the entity content, and the manual restore steps
