## Context

`apps/server` owns two Durable Object classes: `PerConnectionDO` (rate-limit gateway per Airtable Connection) and `PerSpaceDO` (per-Space backup state machine + live-progress WebSocket hub). The current `baseout-web` specs tell the browser to open a WebSocket directly to `apps/server`'s `PerSpaceDO` and to call `apps/server` REST endpoints directly for run triggers and data reads. This means `apps/server`'s public URL must be exposed to the browser, and `apps/web`'s session-auth layer is bypassed for those calls.

## Goals / Non-Goals

**Goals:**
- Browser talks to `apps/web` only — one origin, one auth boundary
- WebSocket path has no Worker-to-Worker HTTP hop (DO accessed directly by `apps/web` via cross-Worker binding)
- Action calls (run/restore trigger) and data reads go browser → `apps/web` → `apps/server` via Cloudflare service binding (stays on Cloudflare's internal network)
- `apps/server` enforces HMAC service token on all routes — browser sessions cannot call it directly

**Non-Goals:**
- Changing the DO's internal data model or event schema
- Changing backup/restore business logic
- Changing what data is displayed — only the routing changes

## Decisions

### WebSocket: cross-Worker DO namespace binding (not service-binding proxy)

`apps/web/wrangler.jsonc` declares a DO namespace binding with `script_name = "baseout-server"`:

```jsonc
"durable_objects": {
  "bindings": [
    { "name": "SPACE_DO", "class_name": "PerSpaceDO", "script_name": "baseout-server" }
  ]
}
```

`apps/web` creates a `PerSpaceDO` stub for the Space ID, forwards the browser's WebSocket upgrade request to the DO, and returns the response. The DO uses the WebSocket Hibernation API (`ctx.acceptWebSocket(ws)`) — it owns the socket state. `apps/server` continues writing progress events into the same DO instance; `apps/web` does not need to be involved in those writes.

**Why not a service-binding proxy to `apps/server` for WebSocket?** That would put `apps/server`'s Worker thread in the connection path for every live message. Direct DO access via the cross-Worker binding removes that hop — the DO handles messages from both Workers independently.

**Why not a separate WebSocket Worker?** No additional indirection needed; `apps/web`'s Worker is already handling the browser request.

### Action calls: Cloudflare service binding

`apps/web/wrangler.jsonc` declares a service binding to `apps/server`:

```jsonc
"services": [
  { "binding": "SERVER", "name": "baseout-server" }
]
```

`apps/web`'s `/api/runs/{id}/start` and `/api/restores/{id}/start` handlers:
1. Validate the browser session (existing better-auth middleware)
2. Verify the user owns the Space
3. Forward to `apps/server` via `env.SERVER.fetch(...)` with an HMAC service token header
4. Return the response to the browser

Service binding calls stay on Cloudflare's internal network — sub-millisecond latency, no TLS handshake, no DNS. `apps/server` validates the HMAC token and rejects anything without it.

### Data reads: same service binding pattern

Health scores, schema changelogs, restore bundles, and AI description write-paths all become `/api/*` routes in `apps/web` that proxy via `env.SERVER.fetch(...)`. Same auth check → forward → return pattern.

### `apps/server` HMAC enforcement

All routes in `apps/server` move behind a request-level middleware that:
1. Reads the `X-Service-Token` header
2. Validates HMAC-SHA256 against the shared `SERVICE_HMAC_TO_WEB` secret
3. Returns 401 if absent or invalid

This makes it structurally impossible for a browser to call `apps/server` directly, even if the URL is discovered.

## Risks / Trade-offs

- **[Risk] Cross-Worker DO binding latency** → Sub-millisecond on Cloudflare's network; same data center. No meaningful difference from `apps/server` accessing the DO directly.
- **[Risk] DO WebSocket Hibernation across Workers** → Cloudflare's Hibernation API is keyed to the DO instance, not which Worker called it. `apps/web` forwarding a WebSocket upgrade to the DO works identically to `apps/server` doing it. Confirmed supported pattern.
- **[Trade-off] Two wrangler binding configs to keep in sync** → If the DO class is renamed in `apps/server`, `apps/web`'s binding must be updated too. Mitigated by the openspec change tracking both.
- **[Trade-off] `apps/web` becomes a proxy for some data reads** → Minimal overhead; these are low-frequency reads (health score on dashboard load, not on every frame).

## Migration Plan

1. Add DO namespace binding and service binding to `apps/web/wrangler.jsonc`
2. Implement `/api/ws/spaces/{id}/progress` WebSocket handler in `apps/web`
3. Implement `/api/runs/{id}/start`, `/api/restores/{id}/start`, and data-read proxy routes in `apps/web`
4. Add HMAC enforcement middleware to `apps/server`
5. Update browser-side WebSocket client URL from `BACKUP_ENGINE_URL` to relative `/api/ws/spaces/{id}/progress`
6. Remove `BACKUP_ENGINE_URL` secret from `apps/web`; it is no longer needed
7. Update `baseout-web` specs (design.md, tasks.md) to reflect the new routing
8. Update `baseout-backup` design.md to reflect HMAC enforcement and removal of direct browser contract
