# Implementation tasks

## 1. ConnectionDO audit endpoint

- [ ] 1.1 TDD red: extend `apps/server/tests/integration/connections-do-proxy.test.ts` (or new `connection-do-lock-audit.test.ts`). Cases: (a) no lock held → returns `{ heldFor: null }`; (b) fresh lock → returns `{ heldFor: <ms> }`, lock retained; (c) stale lock (`heldFor > LOCK_MAX_AGE_MS`) → returns `{ heldFor: <ms> }`, lock released as side-effect.
- [ ] 1.2 Implement `POST /lock/audit` handler inside `ConnectionDO.fetch()`. Reads `state.storage.get('lockedAt')`; if present and `now - lockedAt > LOCK_MAX_AGE_MS`, deletes the lock + emits a structured log line `event: 'connection_lock_released_by_audit'`.
- [ ] 1.3 INTERNAL_TOKEN gate — reuses the existing middleware pattern in `apps/server/src/middleware.ts`.

## 2. Pure-orchestration module

- [ ] 2.1 TDD red: `apps/server/tests/integration/connection-lock-manager.test.ts`. Cases: (a) no live runs → no-op; (b) one live run → audit endpoint called once, lock fresh, no release; (c) one stale lock → endpoint called, release log line emitted, master-DB unchanged; (d) audit endpoint 500 → swallowed, next pass retries.
- [ ] 2.2 Implement `apps/server/src/lib/connection-lock-manager.ts` — `runConnectionLockManagerPass(deps)`. Deps: `db`, `fetchImpl`, `now`. Query: `SELECT DISTINCT connection_id FROM backup_runs WHERE status = 'running' AND modified_at < NOW() - INTERVAL '30 minutes'` (any run that's been "running" for > 30 min is suspect). Loop: POST `/api/internal/connections/:id/lock/audit` for each.

## 3. Cron activation

- [ ] 3.1 Uncomment the connection-lock-manager cron line in `apps/server/wrangler.jsonc.example` (`*/15 * * * *`).
- [ ] 3.2 Wire dispatch in `apps/server/src/index.ts` `scheduled` handler.
- [ ] 3.3 Miniflare scheduled-event smoke: simulate the cron, assert the pass runs.

## 4. Constants

- [ ] 4.1 Add `LOCK_MAX_AGE_MS = 30 * 60 * 1000` to `apps/server/src/durable-objects/ConnectionDO.ts` near the existing `LOCK_TTL_MS` constant. Document the relationship: the DO's existing alarm releases at TTL (10 min), the audit releases at MAX_AGE (30 min) — the audit is the long-tail safety net for cases the alarm missed.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] 5.2 Manual smoke: spawn a backup-base task that intentionally crashes before the unlock POST. Confirm the DO holds the lock until either the alarm fires (10 min) or the next cron pass (15 min). The audit is the belt to the alarm's suspenders.

## 6. Documentation

- [ ] 6.1 Update `specreview/04-recommendations.md` Round 4 — mark `baseout-server-cron-connection-lock-manager` as now-active.
