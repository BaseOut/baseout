## ADDED Requirements

### Requirement: Data-defined metric catalog

Health metrics SHALL be stored as rows in `health_metrics` (not hardcoded columns), each with a `key`, `name`, `weight`, and `is_system` flag. Each metric SHALL be associated with one or more tiers (`base` | `table` | `field`) via `health_metric_tiers`. V1 SHALL seed the system metrics: Airtable Connection (base), Naming Convention (base/table/field), In Use (table/field), Renaming Needed (table/field), Complexity (base/table), Configuration (field), Relationships (table/field), and Descriptions (base/table/field). The model SHALL allow user-defined metrics in future without schema change.

#### Scenario: Metric associated with multiple tiers

- **WHEN** the catalog is seeded
- **THEN** Descriptions has three `health_metric_tiers` rows (base, table, field) and Configuration has one (field)

### Requirement: Metric input dependencies and carry-forward

Each metric SHALL declare the schema attributes it reads (`health_metrics.depends_on`) and a `version`. A `(metric, entity)` result SHALL be reusable (carried forward without re-evaluation) when its dependent attributes, effective prompt, and metric version are unchanged since the most recent result, recorded via `bo_at_health_metric_results.input_hash`. Aggregation SHALL combine carried-forward and freshly-evaluated sub-scores identically.

#### Scenario: Dependencies seeded per metric

- **WHEN** the catalog is seeded
- **THEN** the Descriptions metric's `depends_on` includes the `description` attribute and Naming Convention's includes `name`

#### Scenario: Carried-forward results count toward the score

- **WHEN** a base is re-scored and some `(metric, entity)` results are carried forward (`reused = true`)
- **THEN** the base score is computed from the carried-forward and freshly-evaluated sub-scores together, identically to a full evaluation

### Requirement: Three-level prompt resolution

Each `(metric, tier)` SHALL have a system default prompt (`health_metric_tiers.default_prompt`). A Space MAY edit a space-level prompt and MAY set per-entity override prompts (`health_metric_prompts`, scope `space` | `entity`). The effective prompt for evaluating an entity SHALL resolve **entity override → space-level prompt → system default**.

#### Scenario: Per-field override wins

- **WHEN** a field has an override prompt for the Naming Convention metric and the Space also has a space-level field prompt
- **THEN** the field is evaluated with the per-field override; other fields use the space-level prompt; absent that, the system default

#### Scenario: Editing a space-level prompt

- **WHEN** a Pro+ user edits the space-level table prompt for Descriptions
- **THEN** a `health_metric_prompts` (scope=space, tier=table) row is written and used for all tables lacking a per-table override

### Requirement: Per-base metric enable/disable

A metric MAY be disabled as a scoring factor for a specific base via `health_metric_settings` (`space_id`, `base_id`, `metric_id`, `enabled`). A disabled metric SHALL be excluded from that base's evaluation and from its score. An absent setting row SHALL mean the metric's default-enabled state.

#### Scenario: Disabling a metric for one base

- **WHEN** a user disables Complexity for Base A
- **THEN** Base A's next score excludes Complexity entirely while other bases still include it

### Requirement: Health scoring algorithm

For each enabled metric, the system SHALL produce a per-entity sub-score (0–100) for each applicable entity, computed by the AI evaluation (see `schema-health-evaluation`). The metric score SHALL be the mean of its entity sub-scores; the **base score** SHALL be the weighted mean of enabled metric scores (`round(Σ(metric_score × weight) / Σ(weight))`); and the **band** SHALL be green ≥90, yellow 60–89, red <60.

#### Scenario: Base score from metric scores

- **WHEN** a base's enabled metrics score (equal weights) Descriptions 80, Naming 90, Complexity 100
- **THEN** the base score is 90 and the band is green

#### Scenario: Disabled metric does not affect the score

- **WHEN** a metric is disabled for a base
- **THEN** it contributes neither a metric score nor weight to that base's weighted mean

### Requirement: Per-Space result storage

Scoring results SHALL be stored in the per-Space DB: `bo_at_health_scores` (per base per run: `score`, `band`, per-metric breakdown), `bo_at_health_metric_results` (per run/base/metric/tier/entity: `sub_score` + finding), and `bo_at_health_issues` (low sub-scores → `severity` + `message` + entity reference + `airtable_deeplink`). Scores SHALL append per run (trend); issues reflect the latest run.

#### Scenario: Breakdown and issues produced

- **WHEN** a scoring run completes for a base
- **THEN** `bo_at_health_scores` gets one row (base score + band + metric breakdown), `bo_at_health_metric_results` holds the per-metric/entity sub-scores, and entities below threshold appear in `bo_at_health_issues` with severity and a deeplink

### Requirement: Config and read API

The engine SHALL expose internal endpoints for the Health tab to read the metric catalog + a Space's effective config (metrics, resolved prompts, per-base enable state) and the latest scores/breakdown/issues, and to write space-level prompts, per-entity overrides, and per-base enable/disable. Prompt editing and overrides SHALL require Pro+.

#### Scenario: Health tab loads config + score

- **WHEN** the Health tab opens for a base
- **THEN** it reads the enabled metrics, their effective prompts, the latest base score/band, the per-metric breakdown, and the issue list through the engine

### Requirement: On-demand re-run

The engine SHALL expose a way to trigger an on-demand re-score for a base, optionally scoped to a single metric, re-evaluating the affected `(metric, entity)` pairs immediately rather than waiting for the next schema capture. It SHALL reuse the incremental path (only the targeted/dirty pairs are re-evaluated) and debit credits accordingly. This backs the UI "Re-run" control after a prompt change. Pro+. Each `bo_at_health_metric_results` SHALL be attributable to the run that generated it so a per-metric "last generated" date can be derived.

#### Scenario: Re-run a metric after a prompt edit

- **WHEN** a Pro+ user triggers a re-run for a metric whose prompt changed
- **THEN** that metric's entities are re-evaluated now, the metric + base score update, and credits are debited only for the re-evaluated entities
</content>
