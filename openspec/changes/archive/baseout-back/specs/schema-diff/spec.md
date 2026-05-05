## ADDED Requirements

### Requirement: Compute schema diff per run

After every backup run (full or incremental), the engine SHALL diff the run's captured schema against the previous run's schema and produce a structured changeset (added fields, removed fields, renamed fields, type changes, view changes).

#### Scenario: Field added

- **WHEN** a backup run captures a schema with a field not present in the previous run
- **THEN** the changeset includes an `added_field` entry with the field's name, type, and parent table

#### Scenario: Type change detected

- **WHEN** an existing field's type differs from the previous run
- **THEN** the changeset includes a `type_change` entry with the previous and new types

### Requirement: Persist changeset to client DB

The engine SHALL persist each diff to a `schema_diffs` table in the Space's client DB, keyed by run_id, with the structured changeset and the timestamp.

#### Scenario: Diff retrievable for changelog UI

- **WHEN** front requests `GET /spaces/{id}/schema/changelog?since=<ts>`
- **THEN** the engine returns all `schema_diffs` rows since the timestamp, rendered as natural-language strings (e.g., "Field 'Status' changed from Single Select to Multiple Select on May 1")

### Requirement: Schema-change notification

If a diff is material (configurable; default: any added/removed field, any type change), the engine SHALL emit an in-app notification and send the back-owned Schema Change Notification email.

#### Scenario: Material change triggers email

- **WHEN** a diff includes a removed field
- **THEN** the engine writes a `notifications` row and sends the Schema Change Notification email

### Requirement: Health score computation

The engine SHALL compute a Health Score (0–100) per Base after every run, applying the user-configured rules in `health_score_rules`, and SHALL assign a band (Green ≥90, Yellow 60–89, Red <60). Results SHALL be persisted in a per-Base `health_scores` table in the client DB and exposed via a read endpoint to front.

#### Scenario: Score band shifts

- **WHEN** a Base's score moves from Green to Yellow between consecutive runs
- **THEN** the engine writes the new score, fires an in-app notification, and sends the back-owned Health Score Change email

#### Scenario: No rules configured

- **WHEN** an Org has no `health_score_rules` configured
- **THEN** the engine computes a default score using built-in baseline rules and persists it

### Requirement: Webhook-triggered diff for Instant Backup

For Pro+ Spaces with Instant Backup enabled, the engine SHALL compute schema diffs on each webhook-triggered incremental run, not only on scheduled full runs.

#### Scenario: Incremental schema event

- **WHEN** an Airtable webhook delivers a schema-change event coalesced into an incremental run
- **THEN** the diff is computed against the prior schema snapshot and persisted as a normal diff entry
