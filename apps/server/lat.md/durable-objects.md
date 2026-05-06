# Durable Objects

Two Durable Object classes live in `apps/server`: `ConnectionDO` (per-Connection rate-limit gateway) and `SpaceDO` (per-Space scheduler). Both are currently PoC stubs that prove binding + reachability.

The full state-machine and rate-limit logic lands in Phase 1. They are documented here so callers can plan against the eventual interface.

## ConnectionDO

[src/durable-objects/ConnectionDO.ts](../src/durable-objects/ConnectionDO.ts). One DO instance per Airtable Connection, identified by Connection ID. Phase 1 will host:

- Leaky-bucket rate-limit throttling per Connection (Airtable's `5 req/sec/base` ceiling).
- Queueing of inbound requests from `SpaceDO`s sharing this Connection.
- OAuth token-refresh handoff (the DO owns the lock so two refreshes don't race).
- Lock state for cross-Space coordination on the same Connection.

Today it is a stub `fetch` returning `{ do: "ConnectionDO", id }`.

## SpaceDO

[src/durable-objects/SpaceDO.ts](../src/durable-objects/SpaceDO.ts). One DO instance per Space. Phase 1 will host:

- The per-Space scheduled-backup state machine (idle / scheduled / running / failed).
- Trigger.dev task dispatch for backup runs.
- WebSocket fan-out so `apps/web` can stream real-time progress.
- DO Alarms for cron-like dispatch when the wrangler-level cron is too coarse.

Today it is a stub `fetch` returning `{ do: "SpaceDO", id }`.

## Wrangler Bindings

Both DOs are bound in [wrangler.jsonc](../wrangler.jsonc) and re-exported from [src/index.ts](../src/index.ts).

The bare `@astrojs/cloudflare` adapter output does not export DO classes by default, so the entry must do this explicitly. The `__do-smoke` route in [[surface-contract#Surface Contract#Internal Surface]] exists to prove the binding path end-to-end.

## State Persistence

DOs use `state.storage` for transactional in-memory state and `state.blockConcurrencyWhile` to gate concurrent fetches during boot.

Per CLAUDE.md §5.1, no I/O object (postgres client, R2 stream, fetch body) may be retained across `fetch` calls — DOs survive across requests but their I/O does not.

## Test Coverage

`apps/server/tests/` exercises DO bindings via Miniflare via `@cloudflare/vitest-pool-workers`. Phase 1 adds unit tests for the rate-limit and scheduler state machines; today the only test surface is the smoke path.

## Where to Look

Pointers to source and runtime rules.

- ConnectionDO: [src/durable-objects/ConnectionDO.ts](../src/durable-objects/ConnectionDO.ts)
- SpaceDO: [src/durable-objects/SpaceDO.ts](../src/durable-objects/SpaceDO.ts)
- Wrangler binding + migrations: [wrangler.jsonc](../wrangler.jsonc)
- DO + Worker rules: [CLAUDE.md §5.1](../../../CLAUDE.md)
