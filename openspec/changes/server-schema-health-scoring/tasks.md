## 1. Master DB — catalog + config

- [ ] 1.1 Add `health_metrics` (incl. `depends_on` + `version`), `health_metric_tiers` (with `default_prompt`), `health_metric_prompts`, `health_metric_settings` to the apps/web Drizzle schema. Remove the placeholder `health_score_rules`.
- [ ] 1.2 `db:generate` migration. Seed the V1 system metrics + their tier rows + system default prompts + each metric's `depends_on` + `version` (Airtable Connection, Naming Convention, In Use, Renaming Needed, Complexity, Configuration, Relationships, Descriptions).
- [ ] 1.3 Effective-prompt resolver (pure, tested): entity override → space prompt → system default.

## 2. Per-Space DB — results

- [ ] 2.1 Extend `bo_at_health_scores` (per-metric breakdown JSON); add `bo_at_health_metric_results` (incl. `input_hash` + `reused`); extend `bo_at_health_issues` with `metric_id` + entity ref. Update `packages/db-schema/src/space/{pg,sqlite}.ts`; bump `SPACE_SCHEMA_VERSION`; regenerate; keep parity test green.

## 3. Scoring algorithm (apps/server)

- [ ] 3.1 Pure `computeBaseScore(metricResults, weights, enabled)` → `{ score, band }` (weighted mean; green ≥90 / yellow 60–89 / red <60). TDD: weighting, disabled-metric exclusion, banding.
- [ ] 3.2 Issue derivation from sub-scores below thresholds (red <60 → high, yellow → medium) with entity ref + deeplink.

## 4. AI evaluation task (apps/workflows) — `schema-health-evaluation`

- [ ] 4.1 `score-base-health` task: pure orchestration reads captured `bo_at_*` schema + metric config; resolves prompts; batches one AI call per `(base, metric, tier)` (chunk large tiers) with computed signals; returns per-entity `sub_score` + finding (structured, low temperature).
- [ ] 4.2 Resilient partial results: a failed metric is marked unscored; base score computed from the rest.
- [ ] 4.3 Debit credits via `credit_transactions` per run; gate full AI scoring Pro+.
- [ ] 4.4 Write results back through the engine (scores, metric results, issues).

## 5. Orchestration + API (apps/server / apps/web)

- [ ] 5.1 Enqueue `score-base-health` after a schema capture completes (schema or data run; see `server-split-backup-schedules`).
- [ ] 5.2 Internal read API: metric catalog + effective Space config + latest scores/breakdown/issues for the Health tab.
- [ ] 5.3 Internal write API (Pro+): edit space-level prompt, set/clear per-entity override, enable/disable a metric per base.
- [ ] 5.4 On-demand re-run endpoint (Pro+): re-score a base or a single metric now, reusing the incremental path (only targeted/dirty pairs); debit credits for what re-evaluates. Expose each metric's last-generated date (from the producing run).

## 6. Tiering, validation, cross-refs

- [ ] 6.1 Pro+ gating on AI scoring + prompt editing/overrides; note the optional deterministic-only subset for lower tiers as a follow-up (not V1).
- [ ] 6.2 Update `system-per-space-db` (`health_score_rules` → catalog tables; `bo_at_health_*` extensions) and `web/schema-ui` (rule-config requirement realized). Link the ui-only change `health-tab-scoring`.

## 7. Incremental / smart re-evaluation

- [ ] 7.1 Pure `input_hash(metric, entity)` = hash(dependent attributes per `depends_on` + effective prompt + `metric.version`); tested.
- [ ] 7.2 Run-level skip: the engine skips scoring when the base's schema hash + Space/base config version are unchanged since the last score (no enqueue, no AI, no credits, no new row).
- [ ] 7.3 Carry-forward: reuse a prior `sub_score` when `input_hash` matches (mark `reused`); re-evaluate only dirty `(metric, entity)` pairs; use `bo_at_schema_updates` to pre-select dirty entities; debit credits only for re-evaluated entities.
- [ ] 7.4 Config-change invalidation: editing a space prompt / per-entity override / bumping `metric.version` re-evaluates the affected metric/entity next run even if the schema is unchanged.

## 8. Verification

- [ ] 8.1 Demo: capture a dev base's schema → `score-base-health` runs → `bo_at_health_scores` gets a base score + band, breakdown per metric, and issues for low scorers; disabling a metric for the base re-scores without it.
- [ ] 8.2 Demo: edit a space-level prompt and set a per-field override → the next run uses the resolved prompts (override wins).
- [ ] 8.3 Demo: re-capture with no schema/config change → scoring run is skipped (no credits). Edit descriptions on 3 fields → only those 3 re-evaluate for Descriptions (credits scale), everything else carried forward.
</content>
