## Phase A — Cancel a run

Independent of Phase B. Ship + smoke + commit before starting B.

### A.1 — Master DB schema mirror + types

- [x] A.1.1 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts): widen the `backup_runs.status` literal type union to include `'cancelling' | 'cancelled'`. No migration needed (column is `text`); the constraint is application-level.
- [x] A.1.2 Mirror the same status-union widening in [apps/server/src/db/schema/backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts). Header comment notes the canonical writer is still `apps/web` per CLAUDE.md §2.
- [x] A.1.3 Update [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts) — `statusLabel` returns `'Cancelling'` / `'Cancelled'`; `statusBadgeClass` returns `'badge-warning'` for cancelling, `'badge-neutral'` (or whatever the existing succeeded-vs-failed pair uses for "user-driven terminal") for cancelled.
- [x] A.1.4 Extend [apps/web/src/stores/backup-runs.ts](../../../apps/web/src/stores/backup-runs.ts) `TERMINAL_STATUSES` set to include `'cancelled'`. `cancelling` is NOT terminal (polling must continue to observe the flip to `cancelled`).
- [x] A.1.5 Vitest: extend [apps/web/src/lib/backups/format.test.ts](../../../apps/web/src/lib/backups/format.test.ts) to pin the new label/badge mappings.

### A.2 — Engine cancel pure function + route

- [x] A.2.1 TDD red: `apps/server/tests/integration/runs-cancel.test.ts` (new). Mirrors `runs-complete.test.ts` exactly — `vi.fn()` deps, scripted DB responses. Cases: happy cancel running → 'cancelling' → fires `runs.cancel` per triggerRunId → 'cancelled'; happy cancel queued → no triggerRunIds → flips straight to 'cancelled'; 404 when fetchRunById returns null; 409 when run already terminal; `runs.cancel` 404 swallowed → still flips to cancelled; race-loss-on-CAS returns 409.
- [x] A.2.2 Implement `apps/server/src/lib/runs/cancel.ts` — `processRunCancel(input, deps)`. Pure function with DI. Same shape as `processRunStart` / `processRunComplete`. Watch green.
- [x] A.2.3 TDD red: `apps/server/tests/integration/runs-cancel-route.test.ts` (new). 401 missing token, 405 non-POST, 400 invalid UUID. Mirrors `runs-complete-route.test.ts`.
- [x] A.2.4 Implement `apps/server/src/pages/api/internal/runs/cancel.ts`. Wires real DB deps + the `@trigger.dev/sdk` `runs.cancel` import. Wire into [apps/server/src/index.ts](../../../apps/server/src/index.ts) with `RUNS_CANCEL_RE = /^\/api\/internal\/runs\/([^/]+)\/cancel$/`.
- [x] A.2.5 Workflows-side AbortError handling + cancel test live in [`baseout-workflows-schedule-and-cancel`](../baseout-workflows-schedule-and-cancel/tasks.md). The test is at `apps/workflows/tests/backup-base-task-cancel.test.ts` after the workspace split.

### A.3 — apps/web cancel route + client + button

- [x] A.3.1 Extend [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts): add `cancelRun(runId): Promise<EngineCancelRunResult>`. Mirror the `whoami` / `startRun` shape. Engine error codes to add: `run_not_found`, `run_already_terminal`. Extend tests in [backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts).
- [x] A.3.2 Extend [apps/web/src/pages/api/connections/airtable/_engine-status.ts](../../../apps/web/src/pages/api/connections/airtable/_engine-status.ts) with `run_already_terminal → 409`.
- [x] A.3.3 TDD red: `apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/cancel.test.ts` (new). Cases: 401 unauth, 403 IDOR (space not in org), 404 run not found, 405 non-POST, 200 happy, 409 already terminal.
- [x] A.3.4 Implement `apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/cancel.ts`. Pattern: same as the existing run-start/cancel routes — inner `handlePost(input, deps)` pure-function, outer route does DB wiring + auth.
- [x] A.3.5 Add a Cancel button to [BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro). Rendered only when `status ∈ {'queued', 'running'}`. Uses `setButtonLoading` per [apps/web CLAUDE.md §12](../../../apps/web/.claude/CLAUDE.md). Click → POST `/api/spaces/:spaceId/backup-runs/:runId/cancel`. Toast on success/failure.
- [x] A.3.6 Vitest test for the cancel-button render gate and click-to-POST behavior. JSDOM + spy on fetch.

### A.4 — Phase A verification

- [x] A.4.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [x] A.4.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [x] A.4.3 Human checkpoint: smoke locally. Click Run backup now on a real-Airtable dev base. Within 2 seconds of the row appearing as `Running`, click Cancel. Watch the chip flip `Cancelling` → `Cancelled` within ~4s. DevTools Network shows `/cancel` POST returning 200.
- [x] A.4.4 On approval: stage by name (no `git add -A`), commit locally. Push or hold per current standing instruction.

## Phase B — Scheduled backups

Depends on Phase A only for the cancel button being useful on `triggered_by='scheduled'` rows. Otherwise independent.

### B.1 — Master DB migration

- [ ] B.1.1 Generate `apps/web/drizzle/0007_backup_schedule_and_cancel.sql` with `ALTER TABLE backup_configurations ADD COLUMN next_scheduled_at timestamp with time zone`. Use `pnpm --filter @baseout/web db:generate` so Drizzle authors the SQL.
- [ ] B.1.2 Apply via `pnpm --filter @baseout/web db:migrate` against the dev DB. Verify the column landed via `psql $DATABASE_URL -c "\d baseout.backup_configurations"`.
- [ ] B.1.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) `backup_configurations` table definition with the new column (`nextScheduledAt: timestamp(...).nullable()`).
- [ ] B.1.4 Mirror in [apps/server/src/db/schema/backup-configurations.ts](../../../apps/server/src/db/schema/backup-configurations.ts). Header comment names the canonical migration.

### B.2 — Frequency → next-fire pure function

- [ ] B.2.1 TDD red: `apps/server/tests/integration/scheduling/next-fire.test.ts` (new). Cases: monthly mid-month → next 1st 00:00 UTC; monthly on the 1st (after 00:00) → next month's 1st; weekly any day → next Monday 00:00 UTC; weekly on Monday after 00:00 → next Monday; daily mid-day → tomorrow 00:00 UTC; daily at 00:00 sharp → tomorrow; instant throws.
- [ ] B.2.2 Implement `apps/server/src/lib/scheduling/next-fire.ts` — `computeNextFire(frequency, now: Date): number | null`. Pure. Watch green.

### B.3 — SpaceDO implementation

- [ ] B.3.1 TDD red: `apps/server/tests/integration/space-do.test.ts` (new). Uses `runInDurableObject` from `cloudflare:test`. Cases:
  - `POST /set-frequency monthly` → `state.storage.getAlarm()` returns the expected next-fire timestamp.
  - `alarm()` → calls `INSERT` on a passed-in fake DB AND calls `fetch` on a passed-in fake engine binding with the right path/body.
  - `alarm()` re-schedules itself for the next fire.
  - `alarm()` on a Space with `frequency='instant'` → no-op (out of scope this change).
- [ ] B.3.2 Replace the SpaceDO stub at [apps/server/src/durable-objects/SpaceDO.ts](../../../apps/server/src/durable-objects/SpaceDO.ts):
  - `fetch(req)`: routes `POST /set-frequency` to a method that reads the body, validates frequency, computes next-fire via the Phase B.2 pure function, calls `state.storage.setAlarm(nextFireMs)`, returns `{ ok: true, nextFireMs }`.
  - `alarm()`: SELECT the Space's config, INSERT a `backup_runs` row, call the engine's `/runs/start`, compute + set the next alarm.
- [ ] B.3.3 Header comment rewritten to reflect that scheduled-dispatch is now live; WebSocket fan-out + state-machine remain deferred.

### B.4 — Wire the config PATCH into SpaceDO

- [ ] B.4.1 Extend [apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts) (Phase 10a) — after the existing UPSERT, if `frequency` changed, post to the engine's new internal endpoint that proxies through to SpaceDO. (We need a Worker-side proxy because apps/web can't reach SPACE_DO directly across the service binding; the engine forwards.)
- [ ] B.4.2 New engine route: `POST /api/internal/spaces/:spaceId/set-frequency` in `apps/server`. Validates UUID + frequency. Looks up the SpaceDO by `idFromName(spaceId)` and calls its `/set-frequency` method via `env.SPACE_DO.get(id).fetch(...)`. Writes `backup_configurations.next_scheduled_at` AFTER the DO confirms.
- [ ] B.4.3 Tests for the new engine proxy route (mirroring `connections/do-proxy.ts` pattern). 401 / 400 / 200.

### B.5 — IntegrationsView surface

- [ ] B.5.1 Extend [apps/web/src/views/IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro) to read `next_scheduled_at` from the config-load query and render "Next backup: <formatted date>" under each connected Space card. Handles null with "Not yet scheduled."
- [ ] B.5.2 Format helper in [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts): `formatNextScheduledAt(d: string | null): string`. Local-tz-aware via `Intl.DateTimeFormat`.
- [ ] B.5.3 Vitest test for the format helper.

### B.6 — Bootstrap existing Spaces

- [ ] B.6.1 New script `apps/server/scripts/bootstrap-space-do-alarms.mjs`. Iterates every `backup_configurations` row, calls the new `/api/internal/spaces/:spaceId/set-frequency` route for each. Idempotent — re-running just re-computes alarms. Skips Spaces with `frequency='instant'` (out of scope).
- [ ] B.6.2 Add npm script in [apps/server/package.json](../../../apps/server/package.json): `"bootstrap:space-do-alarms": "node --env-file-if-exists=.env scripts/bootstrap-space-do-alarms.mjs"`.

### B.7 — Phase B verification

- [x] B.7.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green. (Unblocked by [baseout-server-spacedo-alarm-test-isolation-fix](../baseout-server-spacedo-alarm-test-isolation-fix/) — three alarm-storage tests were red from `6d887a6` until that change collapsed them to a single-block `runInDurableObject` pattern + bumped `FIXED_NOW` past the 2026-05-13 wall-clock boundary.)
- [ ] B.7.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] B.7.3 Human checkpoint smoke:
  - PATCH a Space's `backup-config` to set frequency to `daily`. Wait one tick (the bootstrap script writes `next_scheduled_at` for tomorrow 00:00 UTC).
  - Manually fire the SpaceDO alarm via `wrangler durable-objects` (or hit a debug endpoint). Watch a new `triggered_by='scheduled'` row appear in `backup_runs`.
  - DevTools / wrangler tail: structured `space_scheduled_backup` event with the right spaceId + nextFireMs.
- [ ] B.7.4 On approval: stage by name, commit locally.

## Phase C — Documentation scope-lock

- [ ] C.1 Update [~/.claude/plans/use-the-prd-and-eager-stardust.md](../../../../.claude/plans/use-the-prd-and-eager-stardust.md) "What this plan deliberately does NOT include" table:
  - Cross out scheduled backups + cancel — now done.
  - Append rows for: `baseout-backup-attachments`, `baseout-backup-instant-webhook`, `baseout-backup-per-table-selection`, `baseout-backup-dynamic-mode`, `baseout-backup-restore`. Each row names the openspec change-id-to-be so the chain stays discoverable.
- [ ] C.2 Update [openspec/changes/baseout-server/proposal.md](../baseout-server/proposal.md) Out-of-Scope section to reference the same follow-ups by name.
- [ ] C.3 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md): tick boxes for the scheduled + cancel backlog items (P1B.2.3 etc.). Keep attachments / per-table on the backlog as open MVP gaps.
- [ ] C.4 Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](./proposal.md) Out-of-Scope section: as new follow-up changes get filed, link to them from here so future readers can traverse the dependency graph.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-backup-attachments` — Real attachment backup. Replaces the `[N attachments]` placeholder with actual file downloads from Airtable's attachment URLs + R2 uploads. Composite-ID dedup per the openspec design.md scenario "attachment-dedup-by-content-hash". Must-Have per PRD §6.3.
- [ ] OUT-2 `baseout-backup-instant-webhook` — Airtable webhooks → instant backup pipeline. Resolves the Features-vs-PRD tier conflict (Business+ vs Pro+) explicitly in its own proposal.
- [ ] OUT-3 `baseout-backup-per-table-selection` — Wizard step 2.5: pick specific tables within a base. Not mandated by PRD/Features; reactive to user requests.
- [ ] OUT-4 `baseout-backup-dynamic-mode` — Schema-only D1 / full D1 / Shared PG / Dedicated PG. Launch+ per Features §6.2. Big architectural lift.
- [ ] OUT-5 `baseout-backup-restore` — Restore from a snapshot. Must-Have per PRD §6. Entirely separate engine work.
- [ ] OUT-6 `baseout-backup-pause-resume` — Pause/resume a Space's schedule. Cleanly separates from "cancel a specific run". Sentinel-value-in-frequency would work in MVP if needed sooner.
- [ ] OUT-7 `baseout-backup-tz-aware-schedule` — Per-org timezone preference for scheduled fires. MVP is UTC-only.
