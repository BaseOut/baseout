## ADDED Requirements

### Requirement: Per-metric scoring against metadata-only context

The `health-score-base` task SHALL, for each enabled metric of a base, evaluate the metric's effective prompt against schema-metadata-only context (entity names, types, descriptions — never record data) and produce a 0–100 sub-score plus findings. Sub-scores SHALL be clamped to 0–100.

#### Scenario: Each enabled metric is scored

- **WHEN** the task runs for a base with N enabled metrics
- **THEN** the scorer is invoked once per metric and each produces a clamped 0–100 sub-score with findings

### Requirement: Per-metric failure isolation

If scoring a single metric fails, the task SHALL skip that metric (recording it as unscored) and continue scoring the rest, rather than failing the whole run.

#### Scenario: One metric errors

- **WHEN** the scorer throws for one metric
- **THEN** that metric is omitted from the results and the remaining metrics are still scored and synced

### Requirement: Results brokered to the engine

The task SHALL POST the per-metric results (ruleId, score, findings) to the engine's `health-sync` route for the base + run; the engine writes the per-Space tables and aggregates the base grade. The task SHALL NOT write the per-Space DB directly.

#### Scenario: Results synced

- **WHEN** scoring completes
- **THEN** the task POSTs `{ baseId, runId, metrics: [{ ruleId, score, findings }] }` to `health-sync`

### Requirement: Claude call shape

The scorer SHALL call Claude via the Anthropic SDK with model `claude-opus-4-8` (configurable) and obtain a structured JSON result via `output_config.format` (a json_schema with a numeric `score` and a `findings` array) — not assistant prefill (removed on the 4.x family). The API key SHALL come from `process.env.ANTHROPIC_API_KEY`.

#### Scenario: Structured output

- **WHEN** the scorer calls Claude for a metric
- **THEN** the request constrains the response to the score+findings json_schema and the parsed result is returned to the orchestration
