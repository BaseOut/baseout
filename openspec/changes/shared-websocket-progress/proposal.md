## Why

`BackupHistoryWidget` ([apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro)) polls `/api/spaces/{id}/runs` every 2 seconds to surface live backup progress (per commit `09cdd21`). At MVP scale this works, but it scales poorly: a Space dashboard left open in 100 browser tabs generates 100 hits/sec at the Worker, and the polling interval forces a visible 0-2s lag on per-table progress events that the backup task is already pushing in real time.

The data is already real-time on the engine side: `apps/workflows`'s backup-base task posts `/api/internal/runs/:runId/progress` to the Worker after each table CSV lands, and the [`SpaceDO`](../../../apps/server/src/durable-objects/SpaceDO.ts) holds the per-Space run state in memory. The missing link is a browser-to-`SpaceDO` WebSocket so progress events fan out from the DO directly to all attached browsers, with the Worker as the auth-only proxy.

This change implements the WebSocket leg of the broader `shared-client-isolation` principle: browser opens `wss://baseout.com/api/ws/spaces/{id}/progress`, `apps/web`'s route validates the session + Space ownership, then forwards the WebSocket upgrade to `apps/server`'s `SpaceDO` via a cross-Worker Durable Object namespace binding. The browser never sees `apps/server`'s URL.

## What Changes

- New apps/web route `GET /api/ws/spaces/{id}/progress` ([`apps/web/src/pages/api/ws/spaces/[id]/progress.ts`](../../../apps/web/src/pages/api/ws/spaces/[id]/progress.ts)). Validates session via existing middleware, validates Space ownership via `apps/web`'s `account.ts` helper, then opens a WebSocket upgrade against `env.SPACE_DO.idFromName(spaceId).fetch(upgradeRequest)` and pipes frames between browser and DO.
- New Cloudflare Durable Object **namespace binding** in `apps/web/wrangler.jsonc.example`:
  ```jsonc
  "durable_objects": {
    "bindings": [
      {
        "name": "SPACE_DO",
        "class_name": "SpaceDO",
        "script_name": "baseout-server-dev"     // env-specific
      }
    ]
  }
  ```
  Note: `apps/web` does NOT own the `SpaceDO` class — it consumes the namespace via `script_name`. The DO definition stays in `apps/server/src/durable-objects/SpaceDO.ts`. No migrations on the apps/web side.
- New WebSocket handler on `SpaceDO` in `apps/server`:
  - Accept WebSocket upgrades; track attached sockets per Space (set of `WebSocket`).
  - When the existing `/api/internal/runs/:runId/progress` handler bumps DO state, broadcast a JSON frame `{ type: 'progress', runId, atBaseId, recordsAppended, tableCompleted }` to every attached socket.
  - When `/api/internal/runs/:runId/complete` fires, broadcast `{ type: 'complete', runId, status, ... }`.
  - On socket close, remove from the set. On DO hibernation, the WebSocket-hibernation API ([documented in `apps/server` CLAUDE.md `Cloudflare Workers Runtime` section]) keeps frame delivery alive without billing for idle time.
- Client side: replace the 2-second poll in `BackupHistoryWidget.astro` with a WebSocket consumer. Fall back to poll-on-disconnect so an offline / proxy-blocked client still sees updates within 2s.
- Wire the existing nanostore (`apps/web/src/stores/backup-runs.ts`, per project state-management standard in CLAUDE.md §4.1) as the merge point — WebSocket frames update the store, the widget re-renders reactively.

## Capabilities

### New Capabilities

- `web-live-progress`: browser-to-`SpaceDO` WebSocket via `apps/web` proxy, with hibernation-aware fan-out from the DO to all attached clients.

### Modified Capabilities

- `web-client-boundary` (from `shared-client-isolation`): the WebSocket-side of the isolation principle is now concrete. After this change ships, the HTTP-side (already shipped via `INTERNAL_TOKEN` service binding) plus the WebSocket-side complete the original `shared-client-isolation` proposal.

## Impact

- **`apps/web/wrangler.jsonc.example`**: add `SPACE_DO` namespace binding (script_name pinned per env).
- **`apps/web/src/pages/api/ws/spaces/[id]/progress.ts`**: new file (the WebSocket route).
- **`apps/web/src/components/backups/BackupHistoryWidget.astro`**: switch consumer.
- **`apps/web/src/stores/backup-runs.ts`**: declare a `WebSocket`-feed-aware atom + reducer.
- **`apps/server/src/durable-objects/SpaceDO.ts`**: add WebSocket-hibernation API handlers + broadcast on progress/complete events.
- **`apps/server/tests/integration/space-do-websocket.test.ts`**: new test under Miniflare — open WS, post a progress event via the internal endpoint, assert frame delivery.
- **`apps/web/tests/integration/ws-route.test.ts`**: new test — unauth upgrade rejected with 401, authed upgrade succeeds, frames pass through.

## Out of Scope

- The HTTP-side proxy routes (`/api/runs/:id/start`, `/api/runs/:id/cancel`, etc.) — already shipped via service binding + `INTERNAL_TOKEN`. The `shared-client-isolation` change tracks any remaining HTTP-side cleanup.
- Broadcast to clients in other organizations / spaces — the SpaceDO's identity (`idFromName(spaceId)`) inherently isolates clients per Space; the auth check in the apps/web route enforces Space membership.
- Restore-progress events — restore engine doesn't exist yet (`server-restore` is a separate proposal). When it lands, this WebSocket fan-out extends naturally to `{ type: 'restore_progress', restoreId, ... }`.
- BackupHistoryWidget UX changes beyond the data-source swap. Live-progress visual treatments stay as-is.

## Cross-app contract

```
browser ─wss──> apps/web /api/ws/spaces/:id/progress
                    │ (session + Space membership check)
                    │ env.SPACE_DO.idFromName(spaceId).fetch(upgradeReq)
                    ▼
            apps/server SpaceDO  (WebSocket-hibernation)
                    ▲
                    │ (progress/complete POSTs from /api/internal/runs/:runId/*)
                    │
       apps/workflows backup-base.task.ts
```

- apps/web is the only public-facing entry point.
- apps/server's `SpaceDO` is the broadcast hub.
- apps/workflows continues to POST progress / complete events to `/api/internal/runs/:runId/*` as today; the route handler now bumps DO state AND triggers the broadcast.
