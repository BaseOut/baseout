## 1. Update apps/web Wrangler Config

- [ ] 1.1 Add DO namespace binding to `apps/web/wrangler.jsonc`: `{ "name": "SPACE_DO", "class_name": "PerSpaceDO", "script_name": "baseout-server" }` (production + staging envs)
- [ ] 1.2 Add service binding to `apps/web/wrangler.jsonc`: `{ "binding": "SERVER", "name": "baseout-server" }` (production env: `baseout-server`; staging env: `baseout-server-staging`)
- [ ] 1.3 Remove `BACKUP_ENGINE_URL` secret from `apps/web/wrangler.jsonc` and `.dev.vars.example` — no longer needed

## 2. Implement WebSocket Proxy in apps/web

- [ ] 2.1 Create `apps/web/src/api/ws/spaces/[id]/progress.ts` — WebSocket upgrade handler that creates a `PerSpaceDO` stub via `SPACE_DO` binding and forwards the upgrade to the DO
- [ ] 2.2 Ensure the handler validates the user session before establishing the DO connection (reject unauthenticated upgrades with 401)
- [ ] 2.3 Update browser-side WebSocket client URL from `wss://${BACKUP_ENGINE_URL}/spaces/${id}/progress` to `/api/ws/spaces/${id}/progress`

## 3. Implement Action Proxy Routes in apps/web

- [ ] 3.1 Create `POST /api/runs/{id}/start` handler in `apps/web` — validate session + Space ownership, forward to `env.SERVER.fetch()` with HMAC `X-Service-Token` header
- [ ] 3.2 Create `POST /api/restores/{id}/start` handler in `apps/web` — same pattern
- [ ] 3.3 Update `apps/web/tasks.md` task 3.9 (wizard Step 5) to call `/api/runs/{id}/start` on `apps/web` instead of `apps/server` directly
- [ ] 3.4 Update `apps/web/tasks.md` task 4.13 (Restore submit) to POST to `/api/restores/{id}/start` on `apps/web`

## 4. Implement Data-Read Proxy Routes in apps/web

- [ ] 4.1 Create `GET /api/spaces/{id}/health` proxy route — fetches health score from `apps/server` via service binding
- [ ] 4.2 Create `GET /api/spaces/{id}/schema/changelog` proxy route — fetches schema diff history from `apps/server` via service binding
- [ ] 4.3 Create `GET /api/spaces/{id}/restore-bundle/{run_id}` proxy route — fetches Community Restore Tooling bundle from `apps/server` via service binding
- [ ] 4.4 Create `POST /api/spaces/{id}/schema/description` proxy route — forwards AI-generated description write to `apps/server` via service binding
- [ ] 4.5 Update `apps/web/tasks.md` tasks 4.6, 4.14, 4.16, 5.2, 5.12 to reference the new `/api/*` proxy routes

## 5. Add HMAC Enforcement to apps/server

- [ ] 5.1 Implement `validateServiceToken(request, env)` middleware in `apps/server/src/lib/` using `@baseout/shared`'s HMAC validator
- [ ] 5.2 Apply middleware to all routes in `apps/server`'s fetch handler — return 401 if token missing or invalid
- [ ] 5.3 Confirm `apps/web`, `apps/api`, `apps/hooks`, and `apps/admin` all include `X-Service-Token` in their forwarded requests (audit service binding call sites)

## 6. Update Existing Specs

- [ ] 6.1 Update `openspec/changes/baseout-web/design.md` — replace "Live progress is consumed via WebSocket from `baseout-backup`" with the new cross-Worker DO binding pattern; update Phase 3 and Phase 4 descriptions
- [ ] 6.2 Update `openspec/changes/baseout-web/tasks.md` — rewrite tasks 4.2, 4.7, 4.13, 4.14, 4.16, 5.2, 5.12 to reference `apps/web` proxy routes; add new binding setup tasks
- [ ] 6.3 Update `openspec/changes/baseout-server/design.md` — add HMAC enforcement decision; update stakeholder note that `apps/web` accesses the DO via cross-Worker binding, not a direct browser connection

## 7. Verify

- [ ] 7.1 Run `pnpm -r typecheck` to confirm binding types resolve correctly
- [ ] 7.2 Confirm no browser-accessible route in `apps/web` calls `apps/server` without a service binding (grep for `BACKUP_ENGINE_URL` — should be zero results)
