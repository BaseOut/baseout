# admin-catalog-crud

Staff management of the plan and feature catalog.

## ADDED Requirements

### Requirement: Catalog pages with audited, type-aware editing

The staff console SHALL provide pages to view and edit `plans` (including status transitions and Stripe linkage), `plan_prices`, `feature_groups`, `features`, and the `plan_features` matrix rendered in pricing-guide shape (grouped features × plan columns). Value editors SHALL be type-aware (boolean toggle, numeric limit with unit, enum select in rank order) and validate against the feature definition. Every write SHALL go through an audited admin action (actor, before/after, timestamp).

#### Scenario: Editing a matrix cell

- **WHEN** staff change Core's included records from 750K to 1M in the matrix editor
- **THEN** the value is validated as a numeric limit, an audit row records the change, and all non-overridden Core subscribers resolve 1M thereafter

#### Scenario: Enum cells respect the ladder

- **WHEN** staff edit a plan's `backup_frequency_max`
- **THEN** the editor offers only the enum's members in rank order and stores the selected member

### Requirement: Blast-radius confirmation on wide-impact writes

Before committing a `plan_features` edit, plan deactivation, or feature removal, the UI SHALL display the computed impact (count of active subscribing Organizations affected) and require explicit confirmation.

#### Scenario: Staff see who they're about to affect

- **WHEN** staff submit a change to an active plan's value
- **THEN** the confirmation states how many active Organizations resolve that value today before the write proceeds
