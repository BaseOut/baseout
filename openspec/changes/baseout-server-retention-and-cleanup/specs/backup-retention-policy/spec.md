## ADDED Requirements

### Requirement: Per-Space retention policy persistence

Each Space SHALL have at most one `backup_retention_policies` row that captures its current retention policy. The row's `policy_tier` field SHALL be one of `basic`, `time_based`, `two_tier`, `three_tier`, or `custom`. Per-tier knob fields (`keep_last_n`, `daily_window_days`, `weekly_window_days`, `monthly_indefinite`, `custom_rules`) SHALL only be populated for the tiers that use them.

#### Scenario: Space has no policy row

- **WHEN** the cleanup engine reads a Space whose `backup_retention_policies` row is absent
- **THEN** the engine SHALL use the default policy resolved from the Space's subscription tier via `resolveRetentionPolicy(tier)`

#### Scenario: Space has a row but missing knob fields

- **WHEN** a Space's policy row has `policy_tier='two_tier'` but `weekly_window_days IS NULL`
- **THEN** the engine SHALL fall back to the tier default for `weekly_window_days` from `resolveRetentionPolicy(tier)` rather than crashing

### Requirement: Capability-bounded policy edits

The PATCH route for a Space's retention policy SHALL reject any payload whose knob values fall outside the editable range defined by `resolveRetentionPolicy(tier)` for that Space's current tier. Edits that change the `policy_tier` to one not allowed for the current tier SHALL also be rejected.

#### Scenario: Starter tries to set Pro-only three-tier policy

- **WHEN** a Starter Space PATCHes `policy_tier='three_tier'` against `/api/spaces/:id/retention-policy`
- **THEN** the route SHALL return 400 `{ error: 'policy_tier_not_available_at_tier' }` and leave the existing row unchanged

#### Scenario: Knob value below the tier minimum

- **WHEN** a Launch Space PATCHes `daily_window_days=3` and the tier-resolved min is 7
- **THEN** the route SHALL return 400 `{ error: 'knob_out_of_range', field: 'daily_window_days', min: 7, max: 90 }`

### Requirement: Tier-cap upper bound

The cleanup engine SHALL enforce the per-tier snapshot-age cap (`tierCapDays` per Features §3 Snapshot Retention) as an upper bound on every run regardless of the Space's configured policy. A Space whose Custom policy retains a run beyond the tier cap SHALL still see that run deleted by the next cleanup pass.

#### Scenario: Business custom policy attempts to keep 36 months

- **WHEN** a Business Space (24-month tier cap) has a Custom policy that retains a run aged 30 months
- **THEN** the cleanup engine SHALL include the run in the `delete` set, citing `reason: 'tier_cap_exceeded'` in the structured log

### Requirement: Soft-delete marker on backup runs

When the cleanup engine deletes the R2 objects for a backup run, it SHALL set `backup_runs.deleted_at = now()` AFTER all R2 deletes succeed. The `backup_runs` row itself SHALL NOT be hard-deleted; the metadata stays for audit and history-listing.

#### Scenario: R2 list/delete fails mid-pass

- **WHEN** the engine successfully lists the R2 keys for a run but the bulk delete fails partway through
- **THEN** `backup_runs.deleted_at` SHALL remain NULL and the next cleanup pass SHALL retry from scratch

#### Scenario: Run already soft-deleted

- **WHEN** a cleanup pass encounters a `backup_runs` row with `deleted_at IS NOT NULL`
- **THEN** the engine SHALL skip the row (no R2 list, no DB write)
