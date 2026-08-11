# schema-insights-scoring

The per-base Trigger.dev task that generates AI insight observations for a base
from schema-metadata-only context via Claude, and brokers the results to the
engine's `insights-sync` route.

## ADDED Requirements

### Requirement: Generation against metadata-only context

The `generate-base-insights` task SHALL generate advisory observations for a base by evaluating the base's **effective insight prompt** against schema-metadata-only context (entity names, types, descriptions — never record data). Each observation SHALL carry an observation body and the set of entities it references (kind + id + name + optional field type), plus an optional category and evidence.

#### Scenario: Observations reference entities

- **WHEN** the task runs for a base with a resolved prompt and schema context
- **THEN** the generator is invoked once with the effective prompt + metadata context, and each returned observation carries a body and its referenced entities

#### Scenario: Metadata only

- **WHEN** the generation context is assembled
- **THEN** it contains only schema metadata (entity names, types, descriptions) and never record data

### Requirement: Observation normalization

The task SHALL drop observations with a blank body and SHALL cap the number of observations per run to a sane limit before syncing.

#### Scenario: Blank observations dropped

- **WHEN** the generator returns an observation with an empty body
- **THEN** that observation is omitted from the synced set

#### Scenario: Empty set skips sync

- **WHEN** normalization yields no observations
- **THEN** the task does not POST to `insights-sync`

### Requirement: Results brokered to the engine

The task SHALL POST the generated observations to the engine's `insights-sync` route for the base + run; the engine archives the base's prior active insights and writes the new set + entity tags. The task SHALL NOT write the per-Space DB directly. Transport errors SHALL be fire-and-forget (the engine archive lifecycle + run row are the safety nets).

#### Scenario: Results synced

- **WHEN** generation completes with at least one observation
- **THEN** the task POSTs `{ baseId, runId, insights: [{ body, category?, evidence?, entities: [...] }] }` to `insights-sync`

### Requirement: Claude call shape

The generator SHALL call Claude via the Anthropic SDK with model `claude-opus-4-8` (configurable) and obtain a structured result via a forced tool / `output_config.format` (an insights array with per-observation body + entities) — not assistant prefill (removed on the 4.x family). The API key SHALL come from `process.env.ANTHROPIC_API_KEY`.

#### Scenario: Structured output

- **WHEN** the generator calls Claude for a base
- **THEN** the request constrains the response to the insights json_schema/tool shape and the parsed observations are returned to the orchestration
