# feature-catalog

Features as typed data, organized by group, valued per plan.

## ADDED Requirements

### Requirement: Feature groups organize features for display

The system SHALL store `feature_groups` (slug, display name, sort order) and every feature SHALL belong to exactly one group. Seeded groups match the pricing guide's comparison-table sections: Backup, Restore & retention, Data access, AI & intelligence, Collaboration, Governance & security, Support.

#### Scenario: Comparison table renders from the catalog

- **WHEN** the pricing comparison data is requested
- **THEN** features return grouped and ordered by their group's and their own sort order, with no hardcoded grouping in code

### Requirement: Features are typed, slugged, and meter-linked

Each `features` row SHALL have a stable slug, display name, group, `value_type` (`boolean | limit | enum`), a unit for limits (records, GB, credits, calls, count, days), `enum_values` with an explicit rank order for enums (e.g. backup frequency, database class), and metering linkage (`meterable` flag + `meter_kind` of `flow | stock | creation` where meterable). Code SHALL gate on feature slugs, never display names.

#### Scenario: Enum feature compares by rank

- **WHEN** enforcement asks whether `daily` cadence is allowed under a plan whose `backup_frequency_max` is `weekly`
- **THEN** the comparison uses the enum's rank order (daily > weekly → not allowed), not string comparison

#### Scenario: Feature rename is copy-only

- **WHEN** a feature's display name changes
- **THEN** no code, gating, or stored values change (slug is the identity)

### Requirement: Per-plan values live in plan_features

`plan_features` SHALL hold one typed value per (plan, feature): boolean flag, numeric limit (with a documented sentinel for fair-use/unbounded), or enum member. The seed SHALL populate the complete locked matrix from `research/pricing/pricing-guide.md` §3 for all four public plans and the trial (trial = Lite values with `backup_frequency_max = one_time`).

#### Scenario: Full matrix resolves for a plan

- **WHEN** all features are resolved for the Core plan
- **THEN** the result matches the pricing guide's Core column (750K records, 250 GB files, 1,000 AI credits, 50 bases, weekly max cadence, 10 Spaces, 10 GB DB, 5 seats, …) with every feature present

#### Scenario: Editing a plan value propagates

- **WHEN** a `plan_features` value is updated
- **THEN** every Organization on that plan without an override for that feature resolves the new value on their next resolution, with no per-account writes

### Requirement: Catalog writes are staff-only and audited

Mutations to `plans`, `plan_prices`, `feature_groups`, `features`, and `plan_features` SHALL be restricted to staff (`role='super'`) surfaces and SHALL write an audit record (actor, table, before/after).

#### Scenario: Plan value edit leaves a trail

- **WHEN** a staff member changes Plus's AI credits from 5,000 to 6,000
- **THEN** an audit row records who changed what, from and to which value, and when
