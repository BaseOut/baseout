## ADDED Requirements

### Requirement: Every field the UI presents is backed by a real data source
Every data field the product UI displays or edits SHALL trace to a real backing source:
a master-DB column (`apps/web/src/db/schema/*`), a per-Space schema table
(`packages/db-schema` `bo_at_*`), or a documented engine API response field. Fields that
exist only in design fixtures SHALL be explicitly tracked (wired, removed, or scheduled)
before the surface ships to production `apps/web`.

#### Scenario: A UI field has no backing column
- **WHEN** the audit finds a field rendered by a UI surface with no corresponding DB column or engine payload field
- **THEN** the finding is recorded (UI element → expected source → status) and resolved by either a Drizzle migration adding the column, wiring to an existing column, or removing the UI field — never by shipping the surface with dead data

#### Scenario: A backing column exists but the shape mismatches
- **WHEN** the audit finds a UI field whose backing column exists but with an incompatible type or cardinality
- **THEN** the mismatch is recorded as a finding and reconciled on the DB side (migration) or UI side (presentation fix), with the decision noted in the findings table

### Requirement: The schema-pull path is verified end-to-end
The system SHALL demonstrate, on a real Space, that captured schema data flows from a
backup run into the per-Space schema tables and out through the engine broker to the
rendered Schema page.

#### Scenario: Schema renders from captured data
- **WHEN** a Space's backup run completes and the user opens the Schema page
- **THEN** the entity tree renders the bases/tables/fields/views captured by that run, served by the engine `schema-read` broker through the tier-gated web proxy — not fixture data

#### Scenario: Backup completion updates the per-Space schema
- **WHEN** a backup run finishes with schema changes in the source base
- **THEN** the `schema-sync` broker persists a new schema version to the per-Space `bo_at_*` tables and the Schema page reflects the change
