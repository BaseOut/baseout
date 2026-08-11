Knowledge graph for `@baseout/server` — the headless backup/restore engine. Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

## Sections

The internals of `apps/server`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Worker entry, middleware, per-request masterDb, scheduled handler
- [[surface-contract]] — `/api/health` + `/api/internal/*` only. INTERNAL_TOKEN gate semantics.
- [[durable-objects]] — `ConnectionDO` (per-Connection rate-limit gateway), `SpaceDO` (per-Space scheduler)
- [[db-mirror]] — Mirrored Drizzle tables, canonical migration sources, sync rules
- [[trigger-tasks]] — Trigger.dev v3 task topology (planned)
- [[r2-streaming]] — Streaming patterns for backup output to R2 / BYOS (planned)
