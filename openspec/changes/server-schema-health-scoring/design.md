## Context

`system-per-space-db` left Health as `health_score_rules` (master placeholder) + `bo_at_health_scores` / `bo_at_health_issues` (per-Space results), with bands green ≥90 / yellow 60–89 / red <60. We now define the real model: a data-defined metric catalog evaluated by editable AI prompts, scored per base. AI calls mirror the "Generate description" precedent (Cloudflare AI, credit-debited, Pro+). Scoring runs after a schema is captured (a schema or data run from `server-split-backup-schedules`), so it lives close to the per-Space schema tables (`bo_at_bases/tables/fields/...`).

Constraints: metrics must be **rows, not hardcoded columns** (future user-defined metrics); config is control-plane (master); per-base computed results are data-plane (per-Space DB); AI cost must be bounded.

## Goals / Non-Goals

**Goals**
- Data-defined metric catalog (rows) with 1+ tier associations (Base/Table/Field) per metric.
- Three-level prompt resolution: per-entity override → space-level prompt → system default.
- Per-base enable/disable per metric.
- A simple, explainable scoring algorithm → 0–100 + red/yellow/green per base.
- Bounded AI cost (batch per metric+tier).

**Non-Goals**
- User-defined metrics (V2; the schema allows it but V1 seeds system metrics only).
- Per-field-level grade surfaced as its own page (Health tab shows base grade + breakdown).
- Real-time scoring (runs after a schema capture, not interactively).

## Decisions

### Data model

**Master DB (control plane — config):**
- `health_metrics` (system, seeded): `id`, `key` (e.g. `descriptions`, `naming_convention`, `in_use`, `renaming_needed`, `complexity`, `configuration`, `relationships`, `airtable_connection`), `name`, `description`, `weight` (default scoring weight), `is_system` (true in V1), `depends_on` (the schema attributes the metric reads — drives incremental re-evaluation; e.g. Descriptions→`description`, Naming/Renaming→`name`, Configuration→`type`+`options`, Relationships→links, In Use→record-presence/refs, Complexity→counts, Airtable Connection→connection status), `version` (bumped when the metric's logic/prompt-shape changes, to invalidate caches). Rows, not columns.
- `health_metric_tiers` (system, seeded): `metric_id`, `tier` (`base`|`table`|`field`), `default_prompt`. The 1+ tiers a metric applies to **and** the system default prompt for that (metric, tier). (Descriptions → 3 rows: base/table/field.)
- `health_metric_prompts` (Space config): `id`, `space_id`, `metric_id`, `tier`, `scope` (`space`|`entity`), `entity_type` (null | base/table/field), `entity_id` (null | Airtable id), `prompt`, `updated_by`, `updated_at`. Rows exist only when a user **edits** the space-level prompt (scope=space) or sets a per-entity **override** (scope=entity). Unique on `(space_id, metric_id, tier, coalesce(entity_id,''))`.
- `health_metric_settings` (Space config): `space_id`, `base_id`, `metric_id`, `enabled`. Per-base enable/disable; an absent row means the metric's default-enabled state.

**Per-Space DB (data plane — results; extends `system-per-space-db`):**
- `bo_at_health_scores` (existing): per `(base, run)` → `score` (0–100), `band`, plus a `metric_breakdown` JSON (per-metric score). Append per run (trend).
- `bo_at_health_metric_results` (new): per `(run, base, metric, tier, entity?)` → `sub_score` (0–100), `summary`, optional `detail`, `input_hash` (hash of the dependent attributes + effective prompt + metric `version`, for carry-forward), `reused` (true when carried forward from a prior run without re-evaluation). Backs the breakdown + issue derivation.
- `bo_at_health_issues` (existing): now references `metric_id` + entity (`table_id?`, `field_id?`) + `severity` + `message` + `airtable_deeplink`, derived from low sub-scores.

### Prompt resolution
Effective prompt for `(metric, tier, entity)` = **entity override** (`health_metric_prompts` scope=entity for that entity) → **space prompt** (scope=space for that metric+tier) → **system default** (`health_metric_tiers.default_prompt`). Mirrors the documentation `override ?? ai ?? imported` precedence.

### Scoring algorithm (simple + explainable)
1. Resolve **enabled** metrics for the base (`health_metric_settings`; default-enabled otherwise).
2. For each enabled metric × each applicable tier × the entities of that tier in the base: resolve the effective prompt and provide schema context **plus computed signals** (e.g. counts/links for Complexity, data-presence for In Use) so prompt-driven metrics can lean on hard facts. **Batch one AI call per `(base, metric, tier)`** (chunked if large) returning a `sub_score` (0–100) + a short finding per entity. This bounds calls to ≈ `metrics × tiers × chunks`, not per-field.
3. **metric_score** = mean of that metric's entity sub-scores across its tiers (base-tier metrics score the base directly).
4. **base_score** = `round( Σ(metric_score × weight) / Σ(weight) )` over enabled metrics (equal weights by default; tunable via `health_metrics.weight`).
5. **band**: green ≥90 / yellow 60–89 / red <60.
6. **Issues**: entity sub-scores below thresholds become `bo_at_health_issues` (red <60 → high, yellow 60–89 → medium), carrying the AI finding + an "open in Airtable" deeplink.

This is easy to explain to users: *"each metric gets a 0–100 from the AI; your base score is the weighted average; graded red/yellow/green."* The breakdown shows per-metric scores and the worst offenders.

### Where it runs
A `workflows` task **`score-base-health`** is enqueued after a schema capture completes (schema or data run). It reads the captured `bo_at_*` schema (engine-brokered), pulls the metric config (master, via engine callback), runs the batched AI evaluations, computes scores, writes results via the engine, and **debits credits** per run (Cloudflare AI; like Generate description). This is the `schema-health-evaluation` capability.

### Smart / incremental re-evaluation
Re-scoring everything on every schema capture would burn credits when nothing relevant changed. Scoring is incremental at two levels:
- **Run-level skip.** Before evaluating, the engine compares the base's `schema_hash` (from `bo_at_base_runs` / `bo_at_schema_versions`) **and** a config version (the latest prompt/settings change for this Space+base) against the last scored run. If both are unchanged, the run is **skipped entirely** — no AI, no credits, no new score row.
- **Metric/entity-level carry-forward.** When a run does score, each metric's `depends_on` defines the attributes it reads. For each `(metric, entity)` the engine computes `input_hash = hash(dependent attribute values + effective prompt + metric.version)`. If it matches the most recent stored result's `input_hash`, the prior `sub_score` is **carried forward** (`reused = true`, no AI call); otherwise the entity is **re-evaluated**. `bo_at_schema_updates` (the per-change log) is used to pre-select likely-dirty entities so unchanged ones aren't even hashed.
- **Aggregation** (metric score → base score → band) combines carried-forward and freshly-evaluated sub-scores. **Credits are debited only for entities actually re-evaluated**, so cost scales with the size of the change.
- **Config changes invalidate precisely.** Editing a metric's space prompt or a per-entity override, or bumping `metric.version`, changes the relevant `input_hash` / config version, so the affected metric/entity re-evaluates on the next run even when the schema is unchanged. Enable/disable only re-aggregates (no AI).

*Example:* descriptions edited on 3 fields and nothing else → only those 3 fields' Descriptions sub-scores re-evaluate; Naming, Complexity, Relationships, and every other field carry forward; credits scale to the 3 fields.

### Tiering & cost
- The Health tab and a base grade are available where Health is (Launch+).
- **AI-driven scoring debits credits**, so full AI scoring gates **Pro+** (consistent with rule config + Generate description). Lower tiers MAY get a deterministic-only subset (Complexity/In Use computed without AI) — flagged as a follow-up, not required in V1.
- Prompt editing / per-entity overrides are **Pro+**.

## Risks / Trade-offs

- **[Risk] AI cost blow-up** if scored per entity per metric. → Batch per `(base, metric, tier)`; chunk large tiers; debit per run; gate Pro+; run on the schema-schedule cadence (not every instant run).
- **[Risk] Non-determinism / unstable grades** run-to-run. → Low temperature, structured output, computed signals fed into prompts, and trend storage so a single noisy run is visible in context.
- **[Trade-off] Prompt-driven metrics for inherently-deterministic things (Complexity, In Use).** → Provide the computed facts to the prompt; allows a uniform prompt model now and a deterministic fast-path later.
- **[Risk] Prompt-resolution + override sprawl** keyed by Airtable entity IDs. → Overrides are sparse (rows only when set); effective-prompt resolution is a 3-level coalesce; entity IDs are stable.
- **[Trade-off] Config in master references entity IDs.** → Acceptable: prompts are Baseout config; the sensitive computed *results* live in the per-Space DB (posture-aware), config does not.
- **[Risk] Stale carry-forward if dirty-detection misses an input.** → `depends_on` is part of the metric definition and unit-tested; `input_hash` also folds in the effective prompt + `metric.version`, so prompt/algorithm changes invalidate caches; bumping `metric.version` forces a full re-evaluation when a metric's logic changes.

## Supersedes

- Replaces the `health_score_rules` placeholder (`system-per-space-db`) with `health_metrics` + `health_metric_tiers` + `health_metric_prompts` + `health_metric_settings`. Update the `system-per-space-db` reference accordingly.
- Realizes the `web/schema-ui` "Health score rule configuration (Pro+)" requirement against the concrete metric/prompt model.
</content>
