## 1. Per-Space DB

- [ ] 1.1 Add `bo_at_insights` (`base_id`, `body`, `status`, `generated_run_id`, `prompt_version`, `archived_run_id`) and `bo_at_insight_tags` (`insight_id`, `target_type`, `target_id`) to `packages/db-schema/src/space/{pg,sqlite}.ts`; bump `SPACE_SCHEMA_VERSION`; regenerate; keep parity test green.

## 2. Master DB — prompt config

- [ ] 2.1 Add `insight_prompts` (`space_id`, `scope`, `base_id?`, `prompt`, `version`) to apps/web Drizzle; migration; seed the system default prompt.
- [ ] 2.2 Effective-prompt resolver (pure, tested): base override → space prompt → system default.

## 3. Generation task (apps/workflows) — `schema-insights-generation`

- [ ] 3.1 `generate-base-insights` task: significance gate (material `bo_at_schema_updates` since last insights run, or prompt `version` changed, or first run) — else skip (no AI/credits).
- [ ] 3.2 Generate insights from the resolved prompt + schema + material diff; write `bo_at_insights` (`active`) + `bo_at_insight_tags`; dedupe against existing active insights.
- [ ] 3.3 Re-evaluate prior `active` insights for accuracy in the same run; archive the inaccurate (`status='archived'`, `archived_run_id`).
- [ ] 3.4 Structured low-temperature output; debit credits via `credit_transactions`; gate Pro+.

## 4. Orchestration + API (apps/server)

- [ ] 4.1 Enqueue `generate-base-insights` after a schema capture (only when the significance gate would pass; coordinate with `server-split-backup-schedules`).
- [ ] 4.2 Read API: a base's `active` insights (with tags) + last-generated date; archived behind an explicit filter.
- [ ] 4.3 Config write API (Pro+): space-level prompt + per-base override.
- [ ] 4.4 On-demand re-run endpoint (Pro+) — runs generation now (used when the prompt `version` is newer than the last generation); debit credits.

## 5. Tiering + cross-refs

- [ ] 5.1 Pro+ gating on generation + prompt editing/overrides.
- [ ] 5.2 Cross-reference `system-per-space-db` (materiality + `bo_at_*` entities), `server-split-backup-schedules` (post-capture trigger), `server-schema-health-scoring` (shared AI/credits/prompt patterns), and the Docs tagging model. Link the ui-only change `schema-insights-ui`.

## 6. Verification

- [ ] 6.1 Demo: a material schema change → `generate-base-insights` produces tagged insights for the base; a minor (description-only) change → generation skipped (no credits).
- [ ] 6.2 Demo: remove a field referenced by an insight → next run archives that insight (drops from default view); still-accurate insights remain.
- [ ] 6.3 Demo: edit the base insight prompt → base shows stale + Re-run regenerates now.
</content>
