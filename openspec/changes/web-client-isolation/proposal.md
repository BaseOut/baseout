## Why

The current `baseout-web` specs describe the browser communicating directly with `apps/server` in several places: the live-progress WebSocket connects to `wss://{BACKUP_ENGINE_URL}/spaces/{id}/progress`, run/restore triggers POST to `apps/server` endpoints, and data reads (health scores, schema changelogs, restore bundles) are fetched from `apps/server` directly. This exposes `apps/server`'s URL to the browser, bypasses `apps/web`'s auth layer for those calls, and makes the client responsible for knowing about two different origins.

The browser should talk to exactly one origin: `apps/web`. `apps/web` is already the auth boundary — every session token is issued and validated there. Routing all client communication through it closes the security gap and simplifies the client.

## What Changes

- **BREAKING**: Remove `wss://{BACKUP_ENGINE_URL}/...` from the browser. The browser opens `wss://baseout.com/api/ws/spaces/{id}/progress` on `apps/web` instead.
- `apps/web` connects to the `PerSpaceDO` directly via a cross-Worker Durable Object namespace binding (`script_name = "baseout-server"`), proxying WebSocket frames between the browser and the DO — no `apps/server` HTTP hop in the WebSocket path.
- `apps/web` exposes `/api/runs/{id}/start` and `/api/restores/{id}/start`. These authenticate the session, then forward to `apps/server` via a Cloudflare service binding (intra-account, no public internet).
- All `apps/server` data-read endpoints used by the browser (health scores, schema changelogs, restore bundles, AI description writes) become `/api/*` proxy routes in `apps/web`, forwarded via service binding.
- `apps/server` adds an enforcement rule: all inbound routes reject requests that do not carry a valid HMAC service token. Browser sessions are never valid callers.
- Update `apps/web/wrangler.jsonc` to declare the DO namespace binding and service binding to `apps/server`.
- Update `apps/server/wrangler.jsonc` to declare its own DO namespace bindings (unchanged in substance, confirmed as the DO owner).

## Capabilities

### New Capabilities
- `web-client-boundary`: `apps/web` is the sole origin the browser communicates with; all cross-app calls are server-side.

### Modified Capabilities
<!-- No existing spec-level capabilities change behaviour from the customer's perspective — this is an internal routing change -->

## Impact

- `openspec/changes/baseout-web/design.md` — update live-progress, run-trigger, and data-read decisions
- `openspec/changes/baseout-web/tasks.md` — update tasks 4.2, 4.7, 4.13, 4.14, 4.16, 5.2, 5.12; add DO binding + service binding setup tasks
- `openspec/changes/baseout-backup/design.md` — add HMAC enforcement rule; remove `baseout-web` from list of parties with a direct WebSocket contract to the DO
- `apps/web/wrangler.jsonc` — add DO namespace binding (script_name: baseout-server) and service binding to baseout-server
