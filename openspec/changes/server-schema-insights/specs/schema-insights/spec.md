## ADDED Requirements

### Requirement: Per-base insight records with entity tags

Insights SHALL be stored per base as rows in `bo_at_insights` (`base_id`, `body`, `status` `active`|`archived`, `generated_run_id`, `prompt_version`), each able to tag the tables/fields it references via `bo_at_insight_tags` (`target_type`, `target_id`). Tags SHALL be resolvable to entity detail (shared sidebar), mirroring document tags.

#### Scenario: Insight references entities

- **WHEN** an insight about a circular reference between two tables is generated
- **THEN** a `bo_at_insights` row is written with `status = active` and `bo_at_insight_tags` rows pointing at the two tables

### Requirement: Space + per-base prompt with resolution

There SHALL be a system default insight prompt, an editable space-level prompt, and an optional per-base override (`insight_prompts`). The effective prompt SHALL resolve **base override → space prompt → system default**. Editing the prompt SHALL bump its `version`.

#### Scenario: Per-base override wins

- **WHEN** a base has an override prompt and the Space also has a space-level prompt
- **THEN** that base generates insights from the override; other bases use the space prompt; absent that, the system default

### Requirement: Accuracy re-evaluation and archival

On each generation, every prior `active` insight for the base SHALL be re-evaluated for accuracy against the current schema. Insights no longer accurate SHALL be set to `status = 'archived'` (with `archived_run_id`) and SHALL be excluded from the default view. Archived insights SHALL remain queryable.

#### Scenario: Stale insight archived

- **WHEN** an insight referenced a field that has since been removed (so the observation no longer holds)
- **THEN** that insight is set to `status = 'archived'` and no longer appears in the default list

#### Scenario: Still-accurate insight retained

- **WHEN** a prior insight remains accurate after a schema change
- **THEN** it stays `active` and is not duplicated by the new generation

### Requirement: Last-generated and on-demand re-run

The engine SHALL expose each base's last-generated insight date and a way to trigger an on-demand re-run (Pro+), used when the effective prompt's `version` is newer than the last generation. Re-run SHALL run the generation now and debit credits.

#### Scenario: Re-run after prompt change

- **WHEN** a Pro+ user edits the base's insight prompt and triggers re-run
- **THEN** insights regenerate against the new prompt now, prior insights are re-evaluated/archived as needed, and credits are debited

### Requirement: Read/config API and default view

The engine SHALL expose internal endpoints to read a base's `active` insights (with tags) and last-generated date, and to read/write the space-level prompt and per-base override (Pro+). The default insights view SHALL return only `active` insights; archived insights SHALL be available behind an explicit filter.

#### Scenario: Insights panel loads

- **WHEN** the Insights surface opens for a base
- **THEN** it reads the active insights with their tags and the last-generated date through the engine; archived insights are not returned unless explicitly requested
</content>
