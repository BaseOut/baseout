## Why

The workflows half of the AI Health tab (pairs with `server-schema-health-scoring`). After a schema capture (and on an on-demand re-run), a Trigger.dev task scores each enabled Health metric for a base by calling Claude with the metric's effective prompt against **schema-metadata-only** context, then POSTs per-metric sub-scores + findings to the engine's `health-sync` route. The engine aggregates the base grade and writes the per-Space result tables.

## What Changes

- New Trigger.dev task `health-score-base` — pure orchestration (`health-score-base.ts`) + thin wrapper (`health-score-base.task.ts`), per the workflows pattern.
- **Pure orchestration**: given the base's enabled metrics (with resolved effective prompts) + the schema-metadata context, score each metric via an injected `scoreMetric` dep, clamp to 0–100, collect findings, and POST results via an injected `postHealthSync` dep. A per-metric scorer error skips that metric (counted) rather than failing the whole run.
- **Wrapper**: wires the real Claude call (`@anthropic-ai/sdk`, model `claude-opus-4-8` per CLAUDE.md, structured JSON via `output_config.format` — no prefill) reading `ANTHROPIC_API_KEY` from `process.env`, and the engine `health-sync` POST. Credits are debited engine-side per run (Pro+ gated).

## Capabilities

### New Capabilities
- `health-scoring`: the per-base Claude scoring task — metadata-only prompts, per-metric sub-score + findings, brokered to the engine.

### Modified Capabilities
<!-- New task; no change to existing backup-base. -->

## Impact

- `apps/workflows/trigger/tasks/health-score-base.ts` (new, pure) + `health-score-base.task.ts` (new wrapper) + `index.ts` type re-export.
- `apps/workflows/tests/health-score-base.test.ts` (new) — pure-orchestration tests (scorer called per enabled metric; clamp; per-metric error skips; POST shape).
- New dependency: `@anthropic-ai/sdk` in `apps/workflows`.
- **Pairs with** `server-schema-health-scoring` (the `health-sync` route + prompt resolution + credits) and `web-health-tab`.
- **Security**: scoring context is schema metadata ONLY (entity names/types/descriptions) — never record data (sovereign-AI stance). `ANTHROPIC_API_KEY` is a Trigger.dev env var (external setup), never committed.
