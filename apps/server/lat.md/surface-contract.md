# Surface Contract

`@baseout/server` exposes exactly two surfaces: a public `/api/health` liveness probe and `/api/internal/*` for service-to-service calls from `apps/web` and `apps/admin`.

Adding any other public route is a contract violation. Anything customer-facing belongs in `apps/web` or `apps/api`.

## Public Surface

`/api/health` only. Returns 200 with a JSON liveness payload. No auth. No body parsing. No DB access. Used by Cloudflare and uptime probes.

Adding any other public route requires updating this section, the [root cross-app-comm doc](../../../lat.md/cross-app-comm.md), and the security review checklist in [root security-model](../../../lat.md/security-model.md).

## Internal Surface

`/api/internal/*` — gated by the `x-internal-token` header. The token must equal `env.INTERNAL_TOKEN` (a Cloudflare Secret). Comparison is constant-time.

Currently routed handlers:

| Route | Purpose |
|---|---|
| `/api/internal/ping` | Smoke test for token gate + handler wiring |
| `/api/internal/__do-smoke` | PoC that forwards to `ConnectionDO` by stable name to validate DO binding |

New `/api/internal/*` routes are added by:

1. Writing the handler in `src/pages/api/internal/<name>.ts`.
2. Wiring it into the path dispatch in [src/index.ts](../src/index.ts).
3. Adding any new `INTERNAL_TOKEN`-class secret to the security checklist.

## Internal Auth

The token gate is implemented in [src/middleware.ts](../src/middleware.ts) by `applyMiddleware`. Behaviour:

- Path `/api/internal/*` without `x-internal-token` → 401.
- Path `/api/internal/*` with mismatched token → 401.
- Token comparison uses `constantTimeEqual` to avoid leaking the secret via response timing.

Both `apps/web` and `apps/admin` hold the same token in their own Cloudflare Secrets (`BACKUP_ENGINE_INTERNAL_TOKEN`). Rotating it requires updating all three Worker Secret namespaces in lockstep.

## What This Worker Does Not Expose

These belong in `apps/web` (or `apps/admin`); ending up here is a sign of the wrong split.

- No `/login`, `/register`, or any auth UI.
- No `/api/auth/*` (better-auth) routes.
- No `/ops` console.
- No customer session cookies.

If a requirement implies any of the above on `apps/server`, surface it as a scope conflict against [root monorepo-layout](../../../lat.md/monorepo-layout.md) before coding.

## Where to Look

Pointers into source and the cross-app comms map.

- Middleware: [src/middleware.ts](../src/middleware.ts)
- Worker entry + path dispatch: [src/index.ts](../src/index.ts)
- Health handler: [src/pages/api/health.ts](../src/pages/api/health.ts)
- Internal ping: [src/pages/api/internal/ping.ts](../src/pages/api/internal/ping.ts)
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
