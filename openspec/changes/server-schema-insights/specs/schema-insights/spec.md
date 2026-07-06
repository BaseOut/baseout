# schema-insights

The engine's per-Space AI Insights model: generated observations tagging the
entities they reference, an `active` / `archived` lifecycle with auto-archive on
regeneration, a space-level + per-base insight prompt with three-level resolution,
and `INTERNAL_TOKEN`-gated read / config / sync / re-run routes.

## ADDED Requirements

### Requirement: Per-base insight storage with entity tags

The engine SHALL store, per base, AI-generated insight observations. Each insight SHALL carry its observation body, the generation run that produced it, a generated-at timestamp, an optional category and evidence, and the set of **entities it references** (each entity a kind — `base` | `table` | `field` — plus id, name, and, for fields, the field type). Insights are AI-generated; users do not author them by hand.

#### Scenario: Insights persisted with entity tags

- **WHEN** a generation run produces observations for a base
- **THEN** each observation is stored with its body, run id, generated-at, and its referenced entities (kind + id + name + optional field type)

### Requirement: Active / archived lifecycle with auto-archive on regeneration

Each insight SHALL have a status of `active` or `archived`. When a base is (re)generated, the base's existing `active` insights SHALL be **archived** (retained, not deleted) and the new run's observations SHALL become `active`. Reads SHALL return only `active` insights by default and SHALL include `archived` insights when explicitly requested.

#### Scenario: Prior generation auto-archives

- **WHEN** a base that already has active insights is regenerated
- **THEN** the previous active insights become archived and the new run's observations become the active set

#### Scenario: Archived hidden by default

- **WHEN** a base's insights are read without requesting archived
- **THEN** only `active` insights are returned; requesting archived also returns the retired ones

### Requirement: Space-level + per-base insight prompt with three-level resolution

The effective insight prompt for a base SHALL resolve as `per-base override → space-level → system default`, and the engine SHALL report which level supplied it. The engine SHALL support setting/clearing the space-level prompt and a per-base override, and resetting to the system default. The system default SHALL always be present.

#### Scenario: Per-base override wins

- **WHEN** a base has a per-base override and the space has a space-level prompt
- **THEN** the effective prompt for that base is the override (source: override), while a base with no override resolves to the space-level prompt (source: space)

#### Scenario: Reset to default

- **WHEN** the per-base override and the space-level prompt are both cleared
- **THEN** the effective prompt is the system default (source: system)

### Requirement: Last-generated and staleness

The engine SHALL expose each base's last-generated timestamp for insights and SHALL report the base **stale** when its effective prompt was updated after that last generation. Staleness drives the on-demand re-run affordance.

#### Scenario: Prompt edit marks stale

- **WHEN** the effective prompt for a base is updated after its last generation
- **THEN** the base is reported stale until a re-generation runs

#### Scenario: Never generated

- **WHEN** a base has never had insights generated
- **THEN** it is not reported stale (there is nothing to re-run against)

### Requirement: AI generation is metadata-only, Pro+, and metered

Insight generation SHALL evaluate the effective prompt against **schema metadata only** (entity names, types, descriptions) — never record data. AI generation and prompt editing SHALL be gated to Pro+ and SHALL debit credits per generation run.

#### Scenario: Below Pro+ cannot generate or edit prompts

- **WHEN** a non-Pro+ Space requests generation or a prompt edit
- **THEN** the engine refuses with an entitlement error (the UI shows an upgrade affordance)

### Requirement: Insights read/config/sync/re-run routes

The engine SHALL expose `INTERNAL_TOKEN`-gated routes to read a base's insights (active, or including archived) with their entity tags + last-generated + stale; to read the effective prompt config (resolved prompt + source + space/override values); to write the space-level prompt / per-base override / reset; to accept generated results from the workflows task (`insights-sync`); and to trigger an on-demand re-generation (`insights-rerun`). The browser SHALL reach these only through authenticated `apps/web` proxy routes.

#### Scenario: Missing internal token

- **WHEN** an insights route is called without a valid `x-internal-token`
- **THEN** the engine responds 401

#### Scenario: Results brokered in via insights-sync

- **WHEN** the workflows task POSTs `{ baseId, runId, insights: [...] }` to `insights-sync`
- **THEN** the engine archives the base's prior active insights and writes the new observations + entity tags in a single transaction

#### Scenario: Re-run enqueues generation

- **WHEN** an on-demand re-run is requested for a base
- **THEN** the engine generates a run id and enqueues the generation task for that base
