## Context

[`server-schema-health-scoring`](../server-schema-health-scoring/) shipped the AI Health pattern in this repo: a per-Space result model, a three-level prompt with pure resolution, `INTERNAL_TOKEN`-gated read/write/re-run routes, and a workflows Claude task brokering results in via a `*-sync` route. **AI Insights** is the same shape applied to *narrative observations* instead of *numeric metrics*: the engine stores generated observations (each tagging the entities it references), resolves an insight prompt (space-level + per-base override), and exposes read/config/sync/re-run routes. This document proposes the data model, the prompt-resolution + archive lifecycle, and flags the reused decisions rather than re-litigating them.

The key difference from Health: insights are **not a scored catalog**. There is no per-metric weight, no 0–100 base grade, no per-metric enable/disable. Insights are a flat, growing set of observations per base, each with a status (`active` / `archived`) and entity tags — so the model is simpler (no master-DB catalog, one prompt per base rather than one per metric).

## Goals / Non-Goals

**Goals**
- Store generated insight observations per base with the entities each references, and an `active` / `archived` lifecycle.
- A single space-level insight prompt with an optional per-base override + pure three-level resolution + reset.
- Auto-archive the previous generation when a fresh one lands; report staleness when the prompt changed since the last generation.
- Pure, testable prompt-resolution + archive-lifecycle + staleness logic.
- `INTERNAL_TOKEN`-gated read / config / sync / re-run routes.

**Non-Goals**
- Hand-authored/curated insights (they are AI-generated; narrative documentation is Schema Docs).
- The Insights UI ([`web-schema-insights`](../web-schema-insights/)) and the generation task body ([`workflows-schema-insights`](../workflows-schema-insights/)).
- A per-metric catalog or numeric scoring (that is Health; insights are narrative).
- Choosing the AI model/provider unilaterally (reuses the Health decision — Claude API from the workflows runner).

## Data model (proposed)

Three new per-Space tables (both dialects, `SPACE_SCHEMA_VERSION` bump). No master-DB catalog — insights carry no org-scoped rule set.

### `bo_at_schema_insights` — one row per generated observation
| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `base_id` | text | the Airtable base the observation is about |
| `run_id` | text | the generation run that produced it (staleness + auditing) |
| `body` | text | the advisory observation sentence |
| `category` | text nullable | optional typed category (e.g. "Circular reference") — drives the UI row icon |
| `evidence` | text nullable | optional supporting fact behind the observation |
| `status` | text | `active` \| `archived` (CHECK) |
| `generated_at` | timestamp | when the run produced it |

### `bo_at_schema_insight_entities` — the entities an insight tags
| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `insight_id` | uuid FK → `bo_at_schema_insights.id` | |
| `entity_kind` | text | `base` \| `table` \| `field` (CHECK) |
| `entity_id` | text | the Airtable entity id |
| `entity_name` | text | denormalized name for chip rendering without a schema join |
| `field_type` | text nullable | the field's Airtable type (drives the chip icon) when `entity_kind = field` |

### `bo_at_schema_insight_prompt` — space-level prompt + per-base override
| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `base_id` | text nullable | `NULL` = the space-level prompt; non-null = a per-base override |
| `prompt` | text | the customer-authored prompt |
| `prompt_updated_at` | timestamp | drives the staleness signal vs. a base's last `generated_at` |

The system-default prompt is a **constant in the engine** (`INSIGHTS_SYSTEM_DEFAULT_PROMPT`), not a table row — insights are a single narrative task, not a catalog.

## Prompt resolution (pure)

`resolveInsightPrompt({ baseOverride, space, systemDefault })` → `{ prompt, source }`:

- a non-blank per-base override wins → `source: 'override'`;
- else a non-blank space-level prompt → `source: 'space'`;
- else the system default → `source: 'system'`.

Blank/absent layers fall through. Unit-tested independent of storage + AI (mirrors `resolveMetricPrompt`).

## Archive lifecycle (pure + brokered)

- **On a fresh generation for a base** (`insights-sync`): within `withSpaceSchema`, set the base's existing `active` rows to `archived` (retained, not deleted), then insert the run's new observations + their entity tags as `active`. Pure `planInsightArchive(existingActive, incoming)` decides which ids archive and which insert; the I/O layer applies it in a transaction (mirrors `writeHealthResults`).
- **Staleness**: `isInsightsStale(promptUpdatedAt, lastGeneratedAt)` → true when the effective prompt's `prompt_updated_at` is newer than the base's most-recent `generated_at` → drives the Re-run affordance. Pure, unit-tested (mirrors `isMetricStale`).
- **Read**: `active` by default; `?includeArchived=1` includes `archived` rows (muted/labeled in the UI).

## Routes (INTERNAL_TOKEN-gated)

| route | method | purpose |
| --- | --- | --- |
| `insights` | GET | a base's insights (`active`, or all with `?includeArchived=1`) + their entity tags + last-generated + stale |
| `insights-config` | GET | the effective prompt config: resolved prompt + source + space/override values + last-generated + stale |
| `insights-prompt` | POST | set/clear the space-level prompt or a per-base override; reset to system default |
| `insights-sync` | POST | the workflows task's write target: `{ baseId, runId, insights: [{ body, category?, evidence?, entities: [...] }] }` — archives prior active + writes new (mirrors `health-sync`) |
| `insights-rerun` | POST | generate a runId + enqueue the generation task (the trigger) |

All registered in `index.ts` with a route regex; all mirror the `schema-sync`/`health-sync` guards (UUID spaceId, `resolveSpaceDb` active + `managed_pg` → 501, `x-internal-token`). Pro+ entitlement (`manual_ai`) is enforced web-side on the mutation/re-run proxies, matching Health.

## Security

- **Sovereign AI.** Prompts are customer free text; the generator (in [`workflows-schema-insights`](../workflows-schema-insights/)) is fed **schema metadata only** (entity names/types/descriptions) — never record data. The system prompt constrains output; model output is never executed.
- **Credits + gating.** AI generation debits credits per run; generation + prompt editing are Pro+.
- **Internal surface.** `insights-sync` + `insights-rerun` are `x-internal-token`-gated like every other `/api/internal/*` route; the browser reaches reads/config only through authenticated `apps/web` proxies.

## Risks / Trade-offs

- **[Risk] AI cost/latency per base.** → Generate on demand + after significant schema changes; cache via `generated_at`; re-run only when stale; Pro+ + metered.
- **[Risk] Prompt-injection via customer prompts.** → Metadata-only context; constrained system prompt; never execute output.
- **[Risk] Unbounded archived growth.** → Retain-not-delete keeps history readable; a retention/prune of very old archived insights is a deferred follow-up (out of scope, CLAUDE §3.2).
- **[Trade-off] New per-Space tables + a schema-version bump.** → Additive; mirrors the health-scoring + schema-docs precedent (dev re-provision; in-place lazy upgrade filed separately).

## Component reuse
- The `*-sync` broker pattern (engine route ← workflows POST) for writing results — copied from `health-sync`.
- The pure prompt-resolution + staleness helpers — same shape as `resolveMetricPrompt` / `isMetricStale`.
- The per-Space read-broker + `withSpaceSchema` transaction pattern from schema-docs + health-scoring.
- The credits/quota metering + the Pro+ capability gate (`resolveCapabilities`).

## Resolved decisions (human, pending — inherited from Health)
- **AI model + runtime → Claude API from the workflows Node runner.** Not the Worker (no long-running AI in workerd); not Workers AI. Model id per the `claude-api` skill.
- **Scope → full AI generation engine** (prompt model + per-Space tables + Claude generation + credits + Pro+ editor), built foundation → routes → task → UI.
