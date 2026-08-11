## ADDED Requirements

### Requirement: Metric catalog with prompt and tier

The engine's metric catalog (`health_score_rules`) SHALL carry, per metric, a system-default AI `prompt`, an `entity_tier` (`base` | `table` | `field`), a `severity`, and a `weight` (its contribution to the 0–100 base grade). V1 metrics are system-defined; users do not create metrics.

#### Scenario: Catalog exposes metrics grouped by tier

- **WHEN** the Health config is read for a Space
- **THEN** the metric catalog is returned with each metric's tier, severity, weight, and system-default prompt

### Requirement: Three-level prompt resolution

For a metric, the effective prompt SHALL resolve as `per-entity override → space-level → system default`, and the engine SHALL report which level supplied it. The engine SHALL support setting/clearing the space-level prompt and per-entity overrides, and resetting to the system default.

#### Scenario: Override wins over space and default

- **WHEN** a metric has a system default, a space-level prompt, and a per-field override for field F
- **THEN** the effective prompt for F is the override (source: override), while base/other entities resolve to the space-level prompt (source: space)

#### Scenario: Reset to default

- **WHEN** the space-level prompt and overrides for a metric are cleared
- **THEN** the effective prompt is the system default (source: system)

### Requirement: Per-base metric enable/disable

The engine SHALL store a per-base enable/disable state per metric. A disabled metric SHALL be excluded from the base grade and from scoring for that base.

#### Scenario: Disabled metric excluded from the grade

- **WHEN** a metric is disabled for a base
- **THEN** the base grade is the weighted aggregate of only the enabled metrics' sub-scores

### Requirement: Per-metric scoring results, grade, and trend

Scoring SHALL produce, per base and metric, a 0–100 sub-score plus findings, and SHALL record the run that generated them. The base grade SHALL be the weighted aggregate of enabled metric sub-scores, banded green (≥90) / yellow (60–89) / red (<60). Successive base grades SHALL be retained so a trend is readable.

#### Scenario: Grade aggregates enabled metrics

- **WHEN** scoring completes for a base
- **THEN** a base score + band is written, each enabled metric has a sub-score, and the score appends to the base's trend

### Requirement: AI scoring is metadata-only, Pro+, and metered

Metric scoring SHALL evaluate the effective prompt against **schema metadata only** (entity names, types, descriptions) — never record data. AI scoring and prompt editing SHALL be gated to Pro+ and SHALL debit credits per scoring run.

#### Scenario: Below Pro+ cannot AI-score or edit prompts

- **WHEN** a non-Pro+ Space requests scoring or a prompt edit
- **THEN** the engine refuses with an entitlement error (the UI shows an upgrade affordance)

### Requirement: Last-generated and on-demand re-run

Each metric's results SHALL expose a last-generated run. When a metric's effective prompt was updated after its last-generated run, the metric SHALL be reported stale. The engine SHALL expose an on-demand re-run that re-scores a single metric for a base.

#### Scenario: Stale metric re-run

- **WHEN** a metric's prompt is edited after its last generation and a re-run is requested
- **THEN** that metric is re-scored, its sub-score + last-generated run update, and it is no longer stale

### Requirement: Health read/write routes

The engine SHALL expose `INTERNAL_TOKEN`-gated routes to read the effective Health config + latest results (grade, per-metric breakdown, issues, trend), to write prompt edits / per-entity overrides / per-base enable-disable, and to trigger a re-run. The browser reaches these only through authenticated `apps/web` proxy routes.

#### Scenario: Missing internal token

- **WHEN** a Health route is called without a valid `x-internal-token`
- **THEN** the engine responds 401
