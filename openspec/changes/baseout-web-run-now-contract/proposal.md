## Why

`apps/server`'s engine-core change ([`baseout-server-engine-core`](../baseout-server-engine-core/)) cannot start without knowing the request envelope `apps/web` will send to enqueue a backup run. Today the envelope is unspecified: the May 7 cutover plan reserves the name `baseout-web-run-now` for the *full* implementation (depends on server engine-core), but no contract spec exists.

Until both sides agree on the wire shape, server engine-core blocks; until web has a stub that returns 501 with a `Spec` header, the contract has no lived-in artifact a human or agent can `curl`.

This change is **contract-only**. It locks the request/response envelope, the `INTERNAL_TOKEN` header convention, and the `backup_runs` row pre-creation responsibility. No production logic is shipped — `apps/web` has a stub returning 501 with a `Spec: openspec/changes/baseout-web-run-now-contract` header. The full implementation lands in a future `baseout-web-run-now` change once `baseout-server-engine-core` ships the actual enqueue logic.

This is also the contract from which `apps/server` engine-core writes its consumer.

## What Changes

- **Add** spec [specs/web-run-now-contract/spec.md](./specs/web-run-now-contract/spec.md) — SHALL/MUST scenarios for:
  - Request body shape, required and optional fields.
  - Response body shape on success (`202`) and error (`4xx`/`5xx`).
  - Required headers (`x-internal-token`, `Content-Type`).
  - `backup_runs` row pre-creation (web is the orchestrator that creates the row in `queued` status before calling server).
- **Add** stub endpoint [apps/web/src/pages/api/internal/runs/start.ts](../../../apps/web/src/pages/api/internal/runs/start.ts) — validates `INTERNAL_TOKEN`, validates request body shape via Zod, returns `501 Not Implemented` with header `Spec: openspec/changes/baseout-web-run-now-contract` and body `{ error: 'Not yet implemented', spec: '<path>' }`.
- **Add** typed helper [apps/web/src/lib/server-client.ts](../../../apps/web/src/lib/server-client.ts) — `enqueueRun(payload: EnqueueRunRequest): Promise<EnqueueRunResponse>` that throws `NotImplementedError` until `baseout-server-engine-core` lands. Future implementation calls `apps/server` over HTTP with the `INTERNAL_TOKEN` header.

## Capabilities

### New Capabilities

- `web-run-now-contract` — frozen request/response envelope for the run-enqueue flow between `apps/web` and `apps/server`. Spec: [specs/web-run-now-contract/spec.md](./specs/web-run-now-contract/spec.md).

### Modified Capabilities

None.

## Impact

- New file: spec + stub endpoint + typed helper.
- No DB changes today (the schema for `backup_runs` already exists per `apps/web/src/db/schema/core.ts`).
- No external API. No `apps/server` code changes (server agent reads this spec when implementing engine-core).
- **Cross-app contract**: this is the contract. Server side reads it as authoritative.

## Reversibility

Contract-only. Reverting deletes the three files. No migration. No external API contract to roll back.

## Server-side handoff [SERVER-NOTE]

When implementing `baseout-server-engine-core`:

1. The accepted request envelope is in [specs/web-run-now-contract/spec.md](./specs/web-run-now-contract/spec.md).
2. The web stub at [apps/web/src/pages/api/internal/runs/start.ts](../../../apps/web/src/pages/api/internal/runs/start.ts) will be replaced with the live caller. Until then, server-side test code can hit it to verify the spec header is honored.
3. The matching server-side endpoint should live at `POST /api/internal/runs/start` on `apps/server` (same path, different worker) and accept the same JSON body. Server is responsible for: enqueuing a Trigger.dev task, returning `202` with `{ ok: true, runId, queuedAt }`, and updating `backup_runs.status` from `queued` → `running` when the worker picks up the job.
4. Heartbeat/progress emission is out of scope for this contract — see [`baseout-web-websocket-progress-contract`](../baseout-web-websocket-progress-contract/).
