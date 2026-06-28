## ADDED Requirements

### Requirement: Generation gated on significant change

A `workflows` task (`generate-base-insights`) SHALL be enqueued after a schema capture for a base, but SHALL generate only when there are **significant** schema changes since the last insights run — material `bo_at_schema_updates` (added/removed/retyped tables or fields, relationship changes) — or the effective prompt `version` changed, or it is the first run. Otherwise it SHALL skip (no AI, no credits).

#### Scenario: Minor change skips generation

- **WHEN** a schema capture records only a description tweak and no material structural change, with an unchanged prompt
- **THEN** insight generation is skipped (no AI, no credits)

#### Scenario: Material change triggers generation

- **WHEN** a table is removed (a material change) since the last insights run
- **THEN** `generate-base-insights` runs for that base

### Requirement: Insight generation references entities

The task SHALL generate insights from the resolved prompt + current schema (and the material diff), each insight tagging the tables/fields it references (writing `bo_at_insight_tags`). It SHALL dedupe against existing `active` insights so an equivalent observation is kept rather than archived-and-recreated.

#### Scenario: New insight tagged to its entities

- **WHEN** the task surfaces an observation about a specific table's fields
- **THEN** a `bo_at_insights` row plus `bo_at_insight_tags` for those entities are written, and an equivalent pre-existing active insight is not duplicated

### Requirement: Prior-insight re-evaluation in the same run

In the same generation, the task SHALL re-evaluate each prior `active` insight for accuracy against the current schema and archive those no longer accurate (`status = 'archived'`, `archived_run_id` set). Re-evaluation SHALL be over the bounded active set.

#### Scenario: Re-evaluate and archive

- **WHEN** generation runs and a prior active insight is no longer accurate
- **THEN** it is archived in the same run while still-accurate ones remain active

### Requirement: Credits and low-variance output

Insight generation SHALL debit credits via `credit_transactions` and SHALL request structured, low-temperature output for stable results. Full insight generation SHALL be gated to Pro+.

#### Scenario: Generation debits credits

- **WHEN** `generate-base-insights` produces/updates insights for a base
- **THEN** the appropriate credits are debited for that run
</content>
