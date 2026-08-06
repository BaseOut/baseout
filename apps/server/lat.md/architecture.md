# Architecture

`@baseout/server` is a headless Cloudflare Worker. Astro adapter wraps the entry; the real fetch handler lives in [src/index.ts](../src/index.ts) and dispatches by `pathname`.

It does **not** serve any UI, login, or customer auth. The frontend gates customer requests; this Worker only sees `INTERNAL_TOKEN`-bearing internal calls plus the public `/api/health` probe.

## Worker Entry

[src/index.ts](../src/index.ts) is the default Worker export. It does three things on each `fetch`:

1. Calls `applyMiddleware` to authorise the request and attach per-request locals.
2. Dispatches by `url.pathname` to one of a small set of handlers.
3. Re-exports `ConnectionDO` and `SpaceDO` so workerd can resolve their bindings — required even though the Astro adapter wraps the entry.

A `scheduled` handler is also exported as a stub for future cron-trigger dispatch (webhook renewal, OAuth refresh).

## Middleware

[src/middleware.ts](../src/middleware.ts) is the per-request middleware. It does two things:

1. Builds `AppLocals` for the request — currently a per-request `masterDb` from `createMasterDb(env, ctx)`.
2. Enforces the [[surface-contract#Surface Contract#Internal Auth]] for any path under `/api/internal/`. Public paths (e.g. `/api/health`) skip the gate.

Token comparison uses a constant-time XOR loop to prevent timing-oracle leaks (per [root security model](../../../lat.md/security-model.md)).

## Per-Request masterDb

[src/db/worker.ts](../src/db/worker.ts) exposes `createMasterDb(env, ctx)`. **Must be called per-request** and torn down on response.

Per CLAUDE.md §5.1, postgres-js holds TCP sockets and workerd forbids reusing I/O objects across requests. The returned client is torn down via `ctx.waitUntil(sql.end({ timeout: 5 }))` on the way out.

Connection source: `env.HYPERDRIVE.connectionString` in deployed envs; `process.env.DATABASE_URL` under `import.meta.env.DEV` for local `wrangler dev`. Vite tree-shakes the dead branch from the deployed bundle.

The current PoC stub returns null — Phase 1 fills in the real postgres-js + drizzle wiring.

## Scheduled Handler

The exported `scheduled` handler in [src/index.ts](../src/index.ts) is a stub. Phase 2 will dispatch cron triggers for webhook renewal and OAuth refresh. No work happens here yet — `wrangler.jsonc` does not register any cron triggers either.

## Where to Look

Pointers into the source and shared docs.

- Worker entry: [src/index.ts](../src/index.ts)
- Middleware: [src/middleware.ts](../src/middleware.ts)
- DB factory: [src/db/worker.ts](../src/db/worker.ts)
- DOs: [[durable-objects]]
- Service contract: [[surface-contract]]
- Workers runtime rules: [CLAUDE.md §5.1](../../../CLAUDE.md)
