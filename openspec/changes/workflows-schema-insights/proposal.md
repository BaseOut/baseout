## Why

The workflows half of AI Schema Insights (pairs with [`server-schema-insights`](../server-schema-insights/)). On demand (an engine re-run) and after a schema capture, a Trigger.dev task generates advisory **observations** for a base by calling Claude with the base's effective insight prompt against **schema-metadata-only** context, then POSTs the observations + their entity tags to the engine's `insights-sync` route. The engine archives the base's prior active insights and writes the new set to the per-Space tables.

This mirrors [`workflows-health-scoring`](../workflows-health-scoring/) — same pure-orchestration-plus-thin-wrapper pattern, same Claude-from-the-Node-runner stance, same metadata-only sovereign-AI constraint — but produces narrative observations (each tagging the entities it references) instead of numeric per-metric sub-scores. Depends on [`server-schema-insights`](../server-schema-insights/) for the `insights-sync` contract, prompt resolution, and credit metering.

## What Changes

- New Trigger.dev task `generate-base-insights` — pure orchestration (`generate-base-insights.ts`) + thin wrapper (`generate-base-insights.task.ts`), per the workflows pattern.
- **Pure orchestration**: given the base's effective insight prompt + the schema-metadata context, call an injected `generateInsights` dep to produce observations (each with body, optional category/evidence, and referenced entities), normalize/validate the shape (drop observations with no body; cap the count to a sane per-run limit), and POST results via an injected `postInsightsSync` dep. A generation error is fire-and-forget on the transport (the engine's archive lifecycle + the run row are the safety nets); an empty observation set posts nothing.
- **Wrapper**: wires the real Claude call (`@anthropic-ai/sdk`, model `claude-opus-4-8` per CLAUDE.md, structured JSON via a forced tool / `output_config.format` — no prefill on the 4.x family) reading `ANTHROPIC_API_KEY` from `process.env`, and the engine `insights-sync` POST (`BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` from `process.env`). Credits are debited engine-side per run (Pro+ gated).

## Capabilities

### New Capabilities
- `schema-insights-scoring`: the per-base Claude insight-generation task — metadata-only prompt, observations with entity tags, brokered to the engine `insights-sync` route.

### Modified Capabilities
<!-- New task; no change to existing backup-base or health-score-base. -->

## Impact

- `apps/workflows/trigger/tasks/generate-base-insights.ts` (new, pure) + `generate-base-insights.task.ts` (new wrapper) + `index.ts` type re-export.
- `apps/workflows/tests/generate-base-insights.test.ts` (new) — pure-orchestration tests (generator called once with the effective prompt + metadata context; observations normalized/capped; empty set → no sync; POST payload shape).
- Reuses `@anthropic-ai/sdk` (already added for `workflows-health-scoring`).
- **Pairs with** [`server-schema-insights`](../server-schema-insights/) (the `insights-sync` route + prompt resolution + credits) and [`web-schema-insights`](../web-schema-insights/).
- **Security**: generation context is schema metadata ONLY (entity names/types/descriptions) — never record data (sovereign-AI stance). `ANTHROPIC_API_KEY` + `INTERNAL_TOKEN` are Trigger.dev env vars (external setup), never committed.
