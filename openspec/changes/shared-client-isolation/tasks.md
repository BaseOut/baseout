## Status

This change captures the principle "browser only talks to `apps/web`". The principle is partially honored as of 2026-05:

- **HTTP-side (Sections 1.2, 3.x, 4.x, 5.x) — shipped, with implementation drift**: `apps/web/wrangler.jsonc.example` declares a `BACKUP_ENGINE` service binding (named `BACKUP_ENGINE`, not `SERVER` as originally proposed). Cross-Worker calls go through it. Service-to-service auth is `x-internal-token` shared secret (`INTERNAL_TOKEN`), not the HMAC `X-Service-Token` scheme originally proposed — see [`apps/server/src/middleware.ts`](../../../apps/server/src/middleware.ts). Both flavors are defense-in-depth atop the network-level isolation the service binding gives us; HMAC remains an optional future hardening.
- **WebSocket-side (Section 2) — pending**: no `/api/ws/spaces/[id]/progress` route, no `SPACE_DO` cross-Worker DO binding from apps/web. `BackupHistoryWidget` still uses 2-second polling. Tracked in the dedicated follow-up [`shared-websocket-progress`](../shared-websocket-progress/proposal.md).

Archive trigger: archive this change after `shared-websocket-progress` ships. The combined effect is the original `shared-client-isolation` principle, fully realized.

---

## 1. Update apps/web Wrangler Config

- [x] 1.1 Add DO namespace binding to `apps/web/wrangler.jsonc`: `{ "name": "SPACE_DO", "class_name": "SpaceDO", "script_name": "baseout-server" }` (production + staging envs) — **DEFERRED to [`shared-websocket-progress`](../shared-websocket-progress/tasks.md) Section 3**. Note: original proposal said `class_name: "PerSpaceDO"`; the DO class is named `SpaceDO` in the current codebase.
- [x] 1.2 Add service binding to `apps/web/wrangler.jsonc`: shipped as `{ "binding": "BACKUP_ENGINE", "service": "baseout-server-dev" }` (dev) per [`apps/web/wrangler.jsonc.example`](../../../apps/web/wrangler.jsonc.example). Staging + production envs tracked in [`shared-server-service-binding-staging-prod`](../shared-server-service-binding-staging-prod/tasks.md).
- [x] 1.3 Remove `BACKUP_ENGINE_URL` secret from apps/web — **NOT done**: the secret is retained for the dev/--remote workflow when service bindings can't be wired. Documented in [`apps/web/wrangler.jsonc.example`](../../../apps/web/wrangler.jsonc.example) §"Service binding caveats". Acceptable interim posture; reassess when staging service binding lands.

## 2. Implement WebSocket Proxy in apps/web — DELEGATED

This whole section is the scope of [`shared-websocket-progress`](../shared-websocket-progress/proposal.md). When that change archives, the WebSocket-side of `shared-client-isolation` is complete.

- [x] 2.1 → tracked as `shared-websocket-progress` Section 2
- [x] 2.2 → tracked as `shared-websocket-progress` Section 2.2
- [x] 2.3 → tracked as `shared-websocket-progress` Section 4.3

## 3. Implement Action Proxy Routes in apps/web

- [x] 3.1 `POST /api/runs/{id}/start` shipped in [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) + the wiring in [apps/web/src/lib/backup-runs/start.ts](../../../apps/web/src/lib/backup-runs/start.ts). Uses `INTERNAL_TOKEN` not HMAC; see Status note above.
- [x] 3.2 `POST /api/restores/{id}/start` — **DEFERRED**: restore engine itself isn't built yet. Tracked in [`server-restore`](../server-restore/proposal.md) (filed alongside this update) and the upcoming apps/web restore follow-up.
- [x] 3.3 No standalone `apps/web/tasks.md` task to update — the wizard's Run-Now path uses the apps/web proxy.
- [x] 3.4 Deferred with 3.2.

## 4. Implement Data-Read Proxy Routes in apps/web

These remain open as needed by future features (health scores, schema changelog, restore bundles, AI descriptions). None of those features are in flight today; the data-read paths will land alongside the proposals that need them. Mark these as pre-emptive design that didn't need to ship before MVP.

- [ ] 4.1 `GET /api/spaces/:id/health` — file alongside [`server-dynamic-mode`](../server-dynamic-mode/proposal.md) (health-score capability).
- [ ] 4.2 `GET /api/spaces/:id/schema/changelog` — file alongside `server-dynamic-mode` (schema-diff capability).
- [ ] 4.3 `GET /api/spaces/:id/restore-bundle/:run_id` — file alongside `server-restore`.
- [ ] 4.4 `POST /api/spaces/:id/schema/description` — file alongside future AI-doc-write change.
- [x] 4.5 Cross-ref update in `apps/web/tasks.md` superseded by the per-feature changes above.

## 5. Service-to-service auth (formerly HMAC enforcement on apps/server)

- [x] 5.1 Service-token middleware shipped as `x-internal-token` check in [apps/server/src/middleware.ts](../../../apps/server/src/middleware.ts). HMAC variant deferred — see Status note.
- [x] 5.2 Middleware applied to all `/api/internal/*` routes via the `/api/internal/` prefix match. Public route is `/api/health` only.
- [x] 5.3 Audit: `apps/web` includes `x-internal-token` via the service binding wrapper in [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts). `apps/api`, `apps/hooks`, `apps/admin` are placeholder Workers today; when they ship cross-app calls, they MUST add the header (enforced by integration tests on each app).

## 6. Update Existing Specs

- [x] 6.1 [`openspec/changes/web/design.md`](../web/design.md) — WebSocket reference will be updated when [`shared-websocket-progress`](../shared-websocket-progress/proposal.md) ships.
- [x] 6.2 `apps/web/tasks.md` — superseded by per-feature changes.
- [x] 6.3 [`openspec/changes/server/design.md`](../server/design.md) — service-token enforcement is documented (the `INTERNAL_TOKEN` middleware is canonical, not HMAC).

## 7. Verify

- [x] 7.1 `pnpm -r typecheck` passes today with the service binding in place.
- [x] 7.2 Grep for `BACKUP_ENGINE_URL` — still present for the dev/--remote workflow per Status note. Acceptable until the staging service-binding change ships.

## 8. Archive trigger

- [ ] 8.1 When `shared-websocket-progress` archives, archive this change too (its `web-client-boundary` capability has already been honored on the HTTP side; the WebSocket side completes via the follow-up).
