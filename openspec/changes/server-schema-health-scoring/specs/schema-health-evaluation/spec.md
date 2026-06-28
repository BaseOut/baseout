## ADDED Requirements

### Requirement: Scoring task runs after a schema capture

A `workflows` task (`score-base-health`) SHALL be enqueued after a schema capture completes for a base (a `schema` or `data` run). It SHALL read the captured per-Space schema and the Space's metric config, evaluate the enabled metrics, and write the results (scores, per-metric results, issues) back via the engine.

#### Scenario: Enqueued after schema run

- **WHEN** a `schema`-kind run finishes capturing a base's schema
- **THEN** `score-base-health` is enqueued for that base and produces a fresh score + breakdown + issues

### Requirement: Incremental re-evaluation

Scoring SHALL be incremental. The run SHALL be **skipped entirely** when the base's schema hash and the Space+base config (prompts / settings) are unchanged since the last scored run — no AI, no credits, no new score row. When it does run, it SHALL re-evaluate only the `(metric, entity)` pairs whose dependent inputs or effective prompt changed (detected via `input_hash`, with `bo_at_schema_updates` used to pre-select likely-dirty entities), carrying unchanged results forward (`reused = true`) without an AI call. Credits SHALL be debited only for entities actually re-evaluated.

#### Scenario: Nothing changed → run skipped

- **WHEN** a schema capture completes but the base's schema hash and config are unchanged since the last score
- **THEN** no AI evaluation runs, no credits are debited, and no new score row is written

#### Scenario: Only changed entities re-evaluated

- **WHEN** descriptions changed on 3 fields and nothing else changed
- **THEN** only those 3 fields' Descriptions sub-scores are re-evaluated (credits for those only), and every other metric/entity result is carried forward

#### Scenario: Prompt edit forces re-evaluation despite unchanged schema

- **WHEN** a metric's space-level prompt is edited but the schema is unchanged
- **THEN** that metric's entities re-evaluate on the next run (their `input_hash` changed) while other metrics carry forward

### Requirement: Batched AI evaluation per metric and tier

The task SHALL batch AI calls **per `(base, metric, tier)`** (chunking large tiers), sending the relevant schema slice and the resolved prompt, plus computed signals where applicable (e.g. table/field/link counts for Complexity, data-presence for In Use). Each call SHALL return a structured per-entity `sub_score` (0–100) and a short finding. The task SHALL NOT make one AI call per field.

#### Scenario: One call covers a table's fields

- **WHEN** the field-tier Naming Convention metric is evaluated for a table
- **THEN** a single batched AI call returns a sub-score + finding for each field in that table (chunked if the table is very wide)

#### Scenario: Computed signals feed the prompt

- **WHEN** the Complexity metric is evaluated for a base
- **THEN** the task supplies table/field/link counts to the prompt so the AI grades against concrete numbers

### Requirement: Credit debiting for scoring

Each scoring run SHALL debit credits via `credit_transactions` (Cloudflare AI usage, consistent with the Generate-description precedent). Full AI scoring SHALL be gated to Pro+.

#### Scenario: Scoring debits credits

- **WHEN** `score-base-health` completes a base's AI evaluation
- **THEN** the appropriate credits are debited via `credit_transactions` for that run

### Requirement: Deterministic, low-variance output

The task SHALL request structured output at low temperature and incorporate computed signals so scores are stable run-to-run. Results SHALL be written per run so a noisy run is visible against the trend rather than silently replacing prior context.

#### Scenario: Repeat run on unchanged schema

- **WHEN** the schema is unchanged between two scoring runs
- **THEN** the base score is stable within a small tolerance (no large swings from prompt non-determinism)

### Requirement: Resilient partial results

If an individual metric/tier evaluation fails, the task SHALL record that metric as unscored for the run and still produce a base score from the metrics that succeeded, rather than failing the whole run.

#### Scenario: One metric's AI call fails

- **WHEN** the Relationships evaluation errors but other metrics succeed
- **THEN** the base score is computed from the successful metrics, and Relationships is marked unscored for that run
</content>
