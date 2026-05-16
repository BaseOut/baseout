# Implementation tasks

## 1. SpaceDO WebSocket fan-out (apps/server)

- [ ] 1.1 Add WebSocket-hibernation handlers to `apps/server/src/durable-objects/SpaceDO.ts`. `webSocketMessage`, `webSocketClose`, `webSocketError` per the workerd hibernation API. Track attached sockets in `state.getWebSockets()`.
- [ ] 1.2 New private method `SpaceDO.broadcast(event: ProgressEvent | CompleteEvent)` — iterates `getWebSockets()` and calls `ws.send(JSON.stringify(event))`.
- [ ] 1.3 Wire `broadcast` into the `/api/internal/runs/:runId/progress` and `/complete` route handlers in `apps/server` — after the DO state update, call `broadcast` with the same payload shape.
- [ ] 1.4 Implement the WebSocket upgrade path inside `SpaceDO.fetch()`: when `request.headers.get('upgrade') === 'websocket'`, do the `state.acceptWebSocket(server)` dance and return the client end with `Response(...)`.
- [ ] 1.5 TDD red: `apps/server/tests/integration/space-do-websocket.test.ts`. Cases: WS upgrade succeeds; progress POST triggers broadcast; multiple attached clients all receive; client disconnect removes from set; hibernation round-trip preserves attached sockets.

## 2. apps/web WebSocket proxy route

- [ ] 2.1 New file `apps/web/src/pages/api/ws/spaces/[id]/progress.ts`. Astro endpoint that handles `GET` with `Upgrade: websocket`.
- [ ] 2.2 Inside the handler: validate `Astro.locals.account` (existing session middleware). Reject `null` with 401.
- [ ] 2.3 Validate Space ownership via existing helper (`apps/web/src/lib/account.ts` exposes `getSpaceForUser(spaceId, userId)` or equivalent — check current shape). 403 on mismatch.
- [ ] 2.4 Construct the SpaceDO stub: `const stub = env.SPACE_DO.get(env.SPACE_DO.idFromName(spaceId))`. Forward the upgrade: `return stub.fetch(request)`.
- [ ] 2.5 TDD red: `apps/web/tests/integration/ws-route.test.ts`. Cases: unauth 401, wrong-org 403, happy upgrade returns 101 + frames pass through (use `@cloudflare/vitest-pool-workers` + the existing fake-SPACE_DO pattern).

## 3. Wrangler binding wiring

- [ ] 3.1 Update `apps/web/wrangler.jsonc.example` — add `durable_objects.bindings[]` with `name: "SPACE_DO"`, `class_name: "SpaceDO"`, `script_name: "baseout-server-dev"` (dev env) and document per-env overrides for staging + production.
- [ ] 3.2 Update `apps/server/wrangler.jsonc.example` — confirm `SpaceDO` is exported by class and the migration is declared (DO already exists; this is a sanity check that the namespace is publicly bindable by another Worker in the same account).
- [ ] 3.3 Smoke locally: `pnpm dev:server` in one shell, `pnpm dev:web` in another. Confirm `wrangler dev` resolves the cross-Worker DO binding without `"script_name not found"` errors. Document the wrangler version requirement (≥ 4.61 — current pin) in apps/web README if not already.

## 4. Browser consumer

- [ ] 4.1 New module `apps/web/src/lib/backups/progress-socket.ts`. Exports `connectProgress(spaceId): WebSocket` with auto-reconnect (exponential backoff, max 30s), JSON-frame dispatch into the `backup-runs` nanostore.
- [ ] 4.2 Update `apps/web/src/stores/backup-runs.ts` — add a `applyProgressEvent({ runId, atBaseId, recordsAppended, tableCompleted })` reducer + `applyCompleteEvent({ runId, status, ... })` reducer. Both mutate the store atom optimistically; the next poll reconciles.
- [ ] 4.3 Update `apps/web/src/components/backups/BackupHistoryWidget.astro` — replace the 2s polling loop with `connectProgress(spaceId)`. Keep the 30s "safety net" poll for the disconnect window.
- [ ] 4.4 TDD red: `apps/web/src/lib/backups/progress-socket.test.ts`. Cases: dispatch increments record count, dispatch flips status on complete, reconnect after socket close, fallback poll fires after socket drop.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] 5.2 `pnpm --filter @baseout/web typecheck && test` — green.
- [ ] 5.3 Manual smoke (per CLAUDE.md UI-test rule): start dev:server + dev:web. Open `/backups` in browser. Trigger a backup. Confirm live counters update within ~200ms of each table CSV landing (use the Trigger.dev dashboard or fake task fixtures).
- [ ] 5.4 Update `openspec/changes/web-client-isolation/tasks.md` task 2.x to mark these as the implementing change; on archive of this change, the `web-live-progress` capability merges into `openspec/specs/`.

## 6. Documentation

- [ ] 6.1 Update `apps/web/CLAUDE.md` (or create one if missing) — note the cross-Worker DO binding pattern and the `script_name` per-env mapping.
- [ ] 6.2 Update `specreview/04-recommendations.md` Round 2 — mark the WebSocket item as the now-active change with a link here.
