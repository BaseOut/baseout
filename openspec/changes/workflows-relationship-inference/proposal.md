## Why

Synced-view candidates need to be (re)inferred per backup run so the Relationships tab stays current as the schema evolves. The inference *heuristic* runs engine-side ([`server-relationships`](../server-relationships/) — data locality: the engine holds the per-Space schema), so the workflows side is a thin per-run **trigger**: after a backup captures schema, drive the engine to re-infer each base's candidates.

## What Changes

- A Trigger.dev task `relationship-inference` that, given `{spaceId, runId, baseIds}`, POSTs `POST /relationships/sync {baseId, runId}` to the engine once per base.
- Pure orchestration `runRelationshipInference(input, deps)` fans out per base with **per-base error isolation** (one base's failure doesn't sink the rest) and aggregates the upsert counts — mirroring the `health-score-base` pure/wrapper split.
- The wrapper reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` from `process.env`; engine `409`/`501` (space DB not ready / not managed_pg) degrade to a no-op.

## Capabilities

### New Capabilities
- `relationship-inference`: the per-run task that triggers engine-side synced-view inference for each base in a backup run, with per-base isolation.

### Modified Capabilities
<!-- Pairs with server-relationships (which owns the heuristic + persistence). -->

## Impact

- `apps/workflows/trigger/tasks/relationship-inference.ts` (pure) + `relationship-inference.task.ts` (wrapper) + `index.ts` type re-exports.
- Tests: `tests/relationship-inference.test.ts` (3) — fan-out, per-base isolation, empty list.
- **Contract:** depends on `server-relationships`' `POST /relationships/sync {baseId,runId}` returning `{inserted,refreshed,skipped,proposed}`.
- No DB, no AI, no new secret (reuses the engine token already in the Trigger.dev env).
