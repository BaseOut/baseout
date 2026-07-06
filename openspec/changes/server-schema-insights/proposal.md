## Why

The AI Health tab landed its engine + workflows + web halves ([`server-schema-health-scoring`](../server-schema-health-scoring/), [`workflows-health-scoring`](../workflows-health-scoring/), [`web-health-tab`](../web-health-tab/)), giving each base a 0–100 grade + per-metric breakdown + issues. The next schema-intelligence surface is **AI Insights**: free-form advisory *observations* about a base ("Customers and Orders reference each other circularly — consider…") that each **tag the specific tables/fields they reference**, are **generated on demand and after significant schema changes**, **auto-archive when stale**, and are steered by a **prompt** (space-level + per-base override), exactly parallel to Health scoring but producing narrative observations instead of numeric sub-scores.

The ui-only [`schema-insights-ui`](../../../) spec (which names this backend `server-schema-insights`) defines the read/config experience — an Insights section on the Health tab with observation cards, entity-tag chips, prompt config, and an archived toggle. This change is the **engine half**: the per-Space insights storage + lifecycle, the space-level + per-base prompt model with resolution, and the read/config/re-run routes. It pairs with [`workflows-schema-insights`](../workflows-schema-insights/) (the Claude generation task) and [`web-schema-insights`](../web-schema-insights/) (the UI).

**Spec reconciliation (flag, do not silently pick — CLAUDE §1):** insights are **generated narrative**, not a scored catalog — there is no per-metric weight or 0–100 math. This change models a *single* space-level insight prompt (plus per-base override) rather than a metric catalog, and stores each generated observation as a row referencing its entities. PRD §3.7 / Features §11.1 ("AI Schema Insights") gate this; AI generation + prompt editing are **Pro+** and debit credits, matching the Health stance.

## What Changes

- **New per-Space tables** (`@baseout/db-schema` space, both dialects): `bo_at_schema_insights` (one row per generated observation: `base_id`, `run_id`, `body`, optional `category`/`evidence`, `generated_at`, `status` = `active` | `archived`), `bo_at_schema_insight_entities` (each insight's entity tags: `insight_id`, `entity_kind` = `base` | `table` | `field`, `entity_id`, `entity_name`, optional `field_type`), and `bo_at_schema_insight_prompt` (space-level prompt + per-base override + `prompt_updated_at` for the staleness signal).
- **Insight prompt resolution** (pure, testable): `resolveInsightPrompt({ baseOverride, space, systemDefault })` → `{ prompt, source: 'override' | 'space' | 'system' }`. The system-default prompt is a constant (no catalog — insights aren't a metric set).
- **Archive lifecycle** (pure, testable): on a fresh generation for a base, the previous `active` insights for that base are **archived** (retained, not deleted) and the new observations become `active`; a **staleness** flag reports when the effective prompt was updated after the base's last generation → drives the Re-run affordance.
- **Engine routes** (`INTERNAL_TOKEN`-gated): read a base's insights (`active` by default, `?includeArchived=1` reveals archived) + the effective prompt config (resolved prompt + source + last-generated + stale); write the space-level prompt / per-base override / reset; and an `insights-sync` write route (the workflows task's POST target) + an on-demand `insights-rerun` (generate runId + enqueue the task).
- **Generation** runs on demand and after a schema capture (paired [`workflows-schema-insights`](../workflows-schema-insights/)); the engine brokers the results into the per-Space tables. AI generation + prompt editing are **Pro+** and debit credits.

## Capabilities

### New Capabilities
- `schema-insights`: the engine's per-Space insights storage (observations + entity tags + archive lifecycle + auto-archive-when-stale), the space-level + per-base prompt model with resolution, and the read/config/sync/re-run routes.

### Modified Capabilities
<!-- Adds new per-Space tables (SPACE_SCHEMA_VERSION bump) + new engine routes; no change to the health catalog or existing schema-docs routes. -->

## Impact

- **Migration**: three new per-Space tables (`@baseout/db-schema` space schema, both dialects, `SPACE_SCHEMA_VERSION` bump; squashed migrations + bundled `pg-ddl.ts` regenerated; pg↔sqlite + DDL↔migration parity). No master-DB change (insights carry no org-scoped catalog).
- `apps/server/src/lib/per-space/insights-*.ts` (new): prompt resolution + archive lifecycle + staleness (pure), plus the brokered reads/writes (`insights-io.ts`, `insights-config-io.ts`, `insights-resolve.ts`).
- `apps/server/src/pages/api/internal/spaces/[spaceId]/insights-*.ts` (new routes: `insights` read, `insights-config`, `insights-prompt`, `insights-sync`, `insights-rerun`), registered in `index.ts`.
- `apps/server/src/lib/trigger-client.ts` — `enqueueGenerateBaseInsights` (type-only `import type` from `@baseout/workflows`).
- **Pairs with** [`workflows-schema-insights`](../workflows-schema-insights/) (the generation task + `insights-sync` contract) and [`web-schema-insights`](../web-schema-insights/) (the UI).
- **Security**: prompts are customer-authored free text fed to a model — the generation context is **schema metadata only** (entity names/types/descriptions, never record data) per the sovereign-AI stance; credits metered; AI generation + prompt editing Pro+-gated; the `insights-sync` route is `x-internal-token`-gated exactly like `schema-sync`/`health-sync`. See design.md → Security.

## Resolved (human, pending — mirrors Health)
- **AI model: Claude API**, invoked from the workflows Node runner (CLAUDE.md: default to the latest/most-capable Claude; consult the `claude-api` skill for the model id). Generation debits credits; AI generation + prompt editing are Pro+.
- Build order mirrors Health: foundation (data model + pure prompt-resolution/archive-lifecycle/staleness, TDD) → sync + read/config routes → enqueue + re-run → task ([`workflows-schema-insights`](../workflows-schema-insights/)) → UI ([`web-schema-insights`](../web-schema-insights/)).
