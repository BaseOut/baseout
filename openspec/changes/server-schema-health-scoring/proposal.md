## Why

The Health tab is the engine half of the ui-only `health-tab-scoring` UI (which names this backend `server-schema-health-scoring`). The substrate is partly shipped — master `health_score_rules` (deterministic catalog: code/category/severity/weight/config) and per-Space `bo_at_health_scores` + `bo_at_health_issues` (result tables) from `system-per-space-db`. What's missing is the **scoring engine**, the **prompt model** (system default → space → per-entity override), per-base **enable/disable**, the **per-metric breakdown + trend**, and the **read/write routes**.

**Spec reconciliation (flag, do not silently pick — CLAUDE §1):** the shipped catalog is **deterministic** (weight/threshold rules), but the ui-only spec is explicitly **metric-driven and AI-powered** (each metric has an editable AI prompt, Pro+, debits credits). These are two scoring paradigms. This change proposes evolving the catalog to carry an AI prompt while keeping `weight`/`severity` for the score math — but the **AI architecture is a decision for the human** (see design.md → Open decisions). PRD §3.7 / Features §11.1 ("AI Schema Insights") gate this; reconcile there before building the engine.

## What Changes (proposed, pending the architecture decision)

- **Master `health_score_rules`** gains `prompt` (system-default AI prompt) and `entity_tier` (`base` | `table` | `field`) so metrics group by tier per the spec.
- **New per-Space tables** (`@baseout/db-schema` space): `bo_at_health_metric_prompts` (space-level prompt per metric), `bo_at_health_metric_overrides` (per-entity prompt per metric), `bo_at_health_metric_state` (per-base enable/disable), and `bo_at_health_metric_scores` (per-base per-metric sub-score + `last_generated_run` for the staleness/re-run signal).
- **Prompt resolution** (pure, testable): `override → space → system default`, returning the effective prompt + its source.
- **Engine routes** (`INTERNAL_TOKEN`-gated): read effective config (catalog + resolved prompts + enable state + latest base score/band + per-metric breakdown + issues + trend); write prompt edits / per-entity overrides / per-base enable-disable; trigger an on-demand re-run.
- **Scoring** runs after a schema capture (paired `workflows-health-scoring`); the engine brokers results into the per-Space tables. AI scoring + prompt editing are **Pro+** and debit credits.

## Capabilities

### New Capabilities
- `schema-health-scoring`: the engine's metric catalog (prompt + tier + weight), prompt resolution, per-base enable/disable, per-metric scoring results + trend, and the read/write/re-run routes.

### Modified Capabilities
<!-- Evolves the health_score_rules catalog (deterministic → +AI prompt) and serves the per-Space result tables from system-per-space-db. -->

## Impact

- **Migration**: `health_score_rules` += `prompt`, `entity_tier` (master, frontend-owned) + the four new per-Space tables (`@baseout/db-schema` space schema, `SPACE_SCHEMA_VERSION` bump).
- `apps/server/src/lib/per-space/health-*.ts` (new): prompt resolution + score aggregation (pure) + the brokered reads/writes.
- `apps/server/src/pages/api/internal/spaces/[spaceId]/health-*.ts` (new routes), registered in `index.ts`.
- **Pairs with** `workflows-health-scoring` (the scoring task) + `web-health-tab` (the UI).
- **Security**: AI prompts are customer-authored free text fed to a model — sandbox/scope the prompt to field-names-only metadata (no record data) per the sovereign-AI stance; credits metered; Pro+ gated.

## Resolved (human, 2026-06)
- **Build all of it** — the full AI scoring engine, not a deterministic-first MVP.
- **AI model: Claude API**, invoked from the workflows Node runner (CLAUDE.md: default to the latest/most-capable Claude; consult the `claude-api` skill for the model id). Scoring debits credits; AI scoring + prompt editing are Pro+.
- Build order mirrors Phase 2: foundation (data model + pure prompt-resolution/aggregation, TDD) → scoring task (`workflows-health-scoring`) → engine routes → UI (`web-health-tab`).
