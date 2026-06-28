## Why

The Health tab today has only a placeholder `health_score_rules` and an undefined notion of "rules." We want a real, **AI-driven per-base health score**: a data-defined set of metrics (rows in a table, not hardcoded columns), each evaluated by an editable AI prompt, aggregated to a **0–100 score + red/yellow/green grade**. Metrics, prompts, and enable/disable must be configurable per Space (and overridable per base/table/field) without code changes, and extensible to user-defined metrics later (V2).

## What Changes

- Introduce a **metric catalog** as rows (not hardcoded columns): the V1 system metrics — **Airtable Connection** (Base), **Naming Convention** (Base/Table/Field), **In Use** (Table/Field), **Renaming Needed** (Table/Field), **Complexity** (Base/Table), **Configuration** (Field), **Relationships** (Table/Field), plus **Descriptions** (Base/Table/Field). Each metric is associated with 1+ **tiers** (Base / Table / Field). System-defined in V1; the model leaves room for user-defined metrics later.
- Per **(metric, tier)**: a **system default AI prompt**; an editable **space-level prompt**; and an optional **per-entity override prompt** (per specific base/table/field). Effective prompt resolves **entity override → space prompt → system default**.
- Per-base **enable/disable status** per metric (a metric can be excluded as a factor for a given base).
- A **scoring algorithm**: for each enabled metric, the AI evaluates each applicable entity (batched per metric+tier) → a 0–100 sub-score + finding; metric score = mean of its entity sub-scores; **base score = weighted mean of enabled metric scores**; band = **green ≥90 / yellow 60–89 / red <60**.
- Results are stored per-Space per run: base score + band (`bo_at_health_scores`), per-metric results (`bo_at_health_metric_results`), and actionable findings (`bo_at_health_issues`).
- The AI evaluation runs as a **`workflows` task** enqueued after a schema capture, debiting credits (Cloudflare AI, mirroring the "Generate description" precedent).
- **Smart / incremental scoring**: re-scoring is incremental — **skip a run** entirely when the base's schema hash and config are unchanged; otherwise re-evaluate only the `(metric, entity)` pairs whose dependent inputs or prompt changed and **carry the rest forward**. Each metric declares the schema attributes it `depends_on`. **Credits are debited only for entities actually re-evaluated**, so cost scales with the change (e.g. editing 3 fields' descriptions re-runs only those 3 for the Descriptions metric).
- **Supersedes** the placeholder `health_score_rules` with the metric catalog + config tables.

## Capabilities

### New Capabilities
- `schema-health-scoring`: the metric catalog + tier associations, the prompt model (system/space/entity), per-base enable/disable, the scoring algorithm, per-Space result storage, and the engine config/read API.
- `schema-health-evaluation`: the `workflows` AI-evaluation task that runs the resolved metric prompts against a captured schema and returns per-entity sub-scores + findings, with credit debiting.

### Modified Capabilities
<!-- Supersedes the `health_score_rules` placeholder introduced in the unarchived
     system-per-space-db change; captured here + in design (see "Supersedes"). -->

## Impact

- **Master DB**: `health_metrics` (incl. `depends_on` + `version` for incremental scoring) + `health_metric_tiers` (system, seeded), `health_metric_prompts` (space-level + per-entity overrides), `health_metric_settings` (per-base enable/disable). Removes the placeholder `health_score_rules`.
- **Per-Space DB**: extend `bo_at_health_scores` (per-metric breakdown), add `bo_at_health_metric_results` (per run/base/metric/entity sub-scores, with `input_hash` + `reused` for carry-forward); `bo_at_health_issues` references `metric_id` + entity.
- **apps/server**: config + read API (metrics, prompts, settings, scores); enqueue scoring after a schema capture; store results; debit credits.
- **apps/workflows**: `score-base-health` AI task (the `schema-health-evaluation` capability).
- **credits**: a per-run scoring debit via `credit_transactions`.
- **UI**: paired ui-only change `health-tab-scoring`.
- **Cross-references**: `system-per-space-db` (`bo_at_health_*`), `web/schema-ui` + `web/data-intelligence-ui` (Health tab, AI + credits, Pro+ gating), `server-split-backup-schedules` (scoring runs after schema capture — i.e. on the schema schedule).
</content>
