## Context

`system-per-space-db` shipped the Health *result* tables (`bo_at_health_scores` score/band/categories, `bo_at_health_issues` ruleId/severity/message/occurrence) and the master `health_score_rules` catalog (org-scoped: code/name/category/severity/weight/config). The ui-only `health-tab-scoring` spec defines the *experience*: per-base grade + per-metric breakdown, per-base enable/disable, an editable AI prompt per metric with `override → space → system default` resolution + reset, a last-generated/re-run staleness signal, an issues list, and a trend — Pro+ for AI scoring + prompt editing, debiting credits.

The gap is the **scoring engine + the prompt/config model + the read/write routes**. The catalog is deterministic today; the spec is AI-prompt-driven. This document proposes the model and **flags the architecture decisions** rather than picking them.

## Goals / Non-Goals

**Goals**
- A metric model that supports an editable prompt per metric with three-level resolution + per-base enable/disable.
- Per-metric sub-scores + last-generated (for staleness/re-run) and a trend, brokered to per-Space tables.
- Pure, testable prompt-resolution + score-aggregation logic.
- `INTERNAL_TOKEN`-gated read/write/re-run routes.

**Non-Goals**
- User-created metrics (V2; V1 metrics are system-defined).
- The Health tab UI (`web-health-tab`) and the scoring task body (`workflows-health-scoring`).
- Choosing the AI model/provider unilaterally (see Open decisions).

## Decisions (proposed)

1. **Catalog carries the system-default prompt.** Add `prompt` + `entity_tier` (`base`|`table`|`field`) to `health_score_rules`. `weight`/`severity` stay — they weight a metric's contribution to the 0–100 base score. The catalog is the **System default** layer.
2. **Three-level prompt resolution, pure.** `resolveMetricPrompt({ override, space, systemDefault })` → `{ prompt, source: 'override'|'space'|'system' }`. Storage: `bo_at_health_metric_prompts` (space-level, per metric) + `bo_at_health_metric_overrides` (per metric + `target_type`/`target_id`). Resolution is unit-tested independent of storage + AI.
3. **Per-base enable/disable** in `bo_at_health_metric_state` (`base_id`, `rule_id`, `enabled`). Disabled metrics drop from the grade; the aggregator excludes them.
4. **Per-metric scores + staleness.** `bo_at_health_metric_scores` (`base_id`, `rule_id`, `run_id`, `score`, `last_generated_run`). A metric is **stale** when its effective prompt's updated-at is newer than its `last_generated_run`'s timestamp → drives the Re-run affordance. The base grade is the weighted aggregate of enabled metric sub-scores (pure `aggregateGrade`).
5. **Scoring after capture, brokered.** The scoring task (`workflows-health-scoring`) runs after a schema capture and POSTs per-metric sub-scores + findings to an engine route that writes the per-Space tables (mirrors `schema-sync`). On-demand **re-run** is an engine route that enqueues a single-metric scoring task.
6. **Sovereign AI.** Prompts are customer free text; the scorer is fed **schema metadata only** (entity names/types/descriptions — never record data), matching the schema-docs AI stance. Credits debited per scoring run; Pro+ gated.

## Resolved decisions (human, 2026-06)

- **A. AI model + runtime → Claude API from the workflows Node runner.** Per-metric scoring calls Claude with schema-metadata-only context; the model id comes from the `claude-api` skill (latest/most-capable per CLAUDE.md). Not the Worker (no long-running AI in workerd); not Workers AI.
- **B. Phase scope → full AI engine.** Build the prompt model + per-Space tables + Claude scoring + credits + the Pro+ prompt editor. Incremental build order (foundation → task → routes → UI), but the target is the complete feature.

## Risks / Trade-offs

- **[Risk] AI cost/latency per base.** → Score per-metric, cache results (`last_generated_run`), re-run only stale metrics; gate Pro+ + meter credits.
- **[Risk] Prompt-injection via customer prompts.** → Feed metadata only; constrain the system prompt; never execute model output.
- **[Trade-off] New per-Space tables + a schema-version bump.** → Additive; mirrors the schema-docs precedent.

## Component reuse
- The schema-sync broker pattern (engine route ← workflows POST) for writing results.
- The credits/quota metering used elsewhere; the Pro+ capability gate (`resolveCapabilities`).
- The per-Space read-broker pattern from `shared-schema-docs`.
