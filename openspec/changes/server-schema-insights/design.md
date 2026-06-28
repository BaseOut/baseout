## Context

Insights are AI-generated observations about a base's schema, complementary to the numeric health score (`server-schema-health-scoring`). They run after a schema capture (`server-split-backup-schedules`), read the per-Space schema (`bo_at_*`), reference entities via tags (like the Docs tagging model), and must stay current — stale insights are archived. This reuses the established patterns: AI via Cloudflare + credits, prompt resolution, incremental gating off `bo_at_schema_updates`.

## Goals / Non-Goals

**Goals**
- Per-base AI insights stored as rows, each tagging the tables/fields it references.
- Regenerate only on **significant** schema change (not every capture); gate on materiality.
- Space-level prompt + per-base override; last-generated date + re-run on prompt change.
- Keep the active set current: re-evaluate prior insights each generation and archive the inaccurate ones.

**Non-Goals**
- User-authored insights (these are AI-generated; user-authored narrative is the Docs feature).
- Per-table/field insight scoping config beyond tags (insights are base-scoped, tags reference entities).
- Real-time generation (runs after a schema capture).

## Decisions

### Data model
**Per-Space DB (Airtable-derived results):**
- `bo_at_insights`: `id`, `base_id`, `body` (the observation; markdown/text), `status` (`active` | `archived`), `generated_run_id`, `prompt_version` (the prompt version that produced it), `archived_run_id` (nullable). Append-only; archival flips `status`.
- `bo_at_insight_tags`: `insight_id`, `target_type` (`base` | `table` | `field`), `target_id` (Airtable id). Mirrors `bo_at_document_tags`; drives the UI entity chips → shared sidebar.

**Master DB (config):**
- `insight_prompts`: `space_id`, `scope` (`space` | `base`), `base_id` (null for space scope), `prompt`, `version`, `updated_by`, `updated_at`. Rows exist only when edited; a system default prompt seeds the floor. Effective prompt = **base override → space prompt → system default**.

### Generation + significance gate
A `workflows` task `generate-base-insights` is enqueued after a schema capture. It **skips** unless there are **significant changes** since the last insights run — defined by material `bo_at_schema_updates` (added/removed/retyped tables or fields, relationship changes; description-only edits are minor) **or** a changed effective prompt (by `version`) **or** first run. When it runs it:
1. Resolves the effective prompt; reads the current schema + the material diff.
2. Generates new insights (referencing entities) → inserts `bo_at_insights` (`active`) + `bo_at_insight_tags`.
3. **Re-evaluates each prior `active` insight** for accuracy against the current schema; those no longer accurate are set `status = 'archived'` with `archived_run_id` and dropped from the default view.
4. Records the run as the new "last generated"; debits credits.

### Last-generated + re-run
Last-generated = the `generated_run_id`'s timestamp (per base). When the effective prompt's `version` is newer than the last generation, the base is "stale" and the UI offers **Re-run** — an engine on-demand trigger (Pro+) that runs the task now (mirrors the health-scoring re-run).

### Tiering & cost
AI insights debit credits → gate **Pro+** (consistent with scoring + Generate description). Prompt editing/overrides Pro+. Significance gating keeps cost proportional to real schema change.

## Risks / Trade-offs

- **[Risk] Over-archiving on a noisy accuracy check.** → Low-temperature structured re-evaluation; archival is reversible (status flip), and archived insights remain queryable (just hidden by default).
- **[Risk] Insight churn / duplicates across runs.** → On regeneration, dedupe against active insights (don't re-create an equivalent insight; keep the existing one rather than archive+recreate).
- **[Trade-off] "Significant change" heuristic.** → Start from material `bo_at_schema_updates`; tune the threshold; prompt change always forces a run. Document the rule.
- **[Trade-off] Credits on a heavy base.** → Re-evaluation is over the *active* insight set (bounded), and generation is gated on significance; both keep cost in check.
</content>
