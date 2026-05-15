## Overview

Two implementation tracks + one documentation lock, all in one openspec change. Phase A (cancel) is independent of Phase B (schedule) and ships first because (a) it's smaller, (b) it doesn't depend on SpaceDO real logic, and (c) it's load-bearing for Phase B's "cancel a future-scheduled run" UX. Phase C is a five-minute documentation update at the end so the deferred-followups picture stays in sync between the master plan and openspec.

The architecture is already specced in [PRD §5/§10](../../../shared/Baseout_PRD.md): the per-Space DurableObject is "Backup state; cron-like controller". The SpaceDO file [header comment](../../../apps/server/src/durable-objects/SpaceDO.ts) explicitly reserves itself for "scheduled-backup state machine, Trigger.dev task dispatch, alarm-driven cron-like dispatching". This change activates the dispatch half. State-machine + WebSocket fan-out remain deferred (the current polling-based live-status path is good enough for MVP per `backup-history-live-status`).

## Phase A — Cancel architecture

### State machine

Current statuses: `queued → running → succeeded | failed | trial_complete | trial_truncated`. All terminal except `queued` and `running`.

Add two transitions:

```
queued    → cancelling → cancelled   (engine route writes cancelling, then cancelled after Trigger.dev acks)
running   → cancelling → cancelled   (same — outstanding triggerRunIds are individually cancelled)
```

`cancelled` is terminal. No resume in MVP. The frontend renders `cancelling` as a slightly different chip (badge-warning with a small spinner glyph) so users see "we heard you, cancellation is in flight" — `runs.cancel()` on Trigger.dev is fire-and-forget on our side, so the actual flip from `cancelling → cancelled` happens at the next poll after the engine's two writes settle.

### Sequence: cancel a running run

```
user clicks Cancel
   │
   v POST /api/spaces/:id/backup-runs/:runId/cancel              (apps/web)
[apps/web cancel route]
   │  1. middleware → user + account context.
   │  2. SELECT space + run, validate org ownership.
   │  3. Reject 409 if run.status NOT IN (queued, running).
   │  4. env.BACKUP_ENGINE.fetch('/api/internal/runs/:runId/cancel').
   │  5. Pass-through engine result → 200 ok.
   │
   v POST /api/internal/runs/:runId/cancel                       (apps/server)
[apps/server cancel route]
   │  1. SELECT run, 404 if not found, 409 if already terminal.
   │  2. UPDATE backup_runs SET status='cancelling', modified_at=now()
   │     WHERE id = $runId AND status IN ('queued', 'running').
   │     If RETURNING is empty: race lost, return 409.
   │  3. For each triggerRunId in trigger_run_ids:
   │       await runs.cancel(triggerRunId).catch(log+swallow).
   │     Fire-and-forget on the SDK side per Trigger.dev v3 conventions.
   │  4. UPDATE backup_runs SET status='cancelled', completed_at=now(),
   │     modified_at=now() WHERE id = $runId AND status='cancelling'.
   │  5. Return 200 { ok: true, cancelledTriggerRunIds: [...] }.
   │
   v (Trigger.dev runner, async)
[backup-base.task.ts] task receives cancel signal
   │  runBackupBase throws AbortError (or similar) on the next await.
   │  The existing outer try/catch in backup-base.task.ts (added in the
   │  commit that wraps runBackupBase) catches it and produces
   │  result.status='failed', result.errorMessage='cancelled' or similar.
   │  postCompletion fires → /api/internal/runs/:id/complete.
   │
   v
[apps/server runs/complete]
   │  Sees status='cancelled' already (set by us in step 4 above) — the
   │  `WHERE status='running'` guard in the existing applyPerBaseCompletion
   │  no-ops because we already moved past 'running'. Per-base counts may
   │  not increment for this trigger run; that's fine, the run is terminal
   │  in the 'cancelled' state.

[apps/web polling — 2s loop]
   │  Sees status='cancelled'. Chip flips. Run is terminal; polling
   │  self-suspends on the next all-terminal tick.
```

### Sequence: cancel a queued future-scheduled run

Same flow, with one extra wrinkle: the SpaceDO's pending alarm is still set for the future fire. The cancel route sets the run to `cancelled` and the alarm fires anyway at its scheduled time — but the alarm's `INSERT backup_runs (...) VALUES ('queued', 'scheduled', ...)` would create a NEW run row for the new fire window. That's correct behavior: cancelling THIS scheduled run doesn't disable the schedule.

If the user wants to disable the schedule entirely, they PATCH the backup-config to set frequency to a sentinel value (out of scope; see "Pause/resume" in proposal.md deferred follow-ups).

### Trigger.dev integration

`@trigger.dev/sdk` exposes `runs.cancel(runId)` per [Trigger.dev v3 docs](https://trigger.dev/docs/management/runs/cancel). It's a server-side SDK call from `apps/server`. The cancelled task receives an `AbortError` on its next await point (Trigger.dev injects cancellation between checkpoints). Our `backup-base.task.ts` already has the outer try/catch that turns any throw into a structured `result.status='failed'` posted to `/complete`, so the cancellation path runs through the existing failure-handling code without modification.

**Edge case**: a task that's between the lock acquisition and the per-table page loop won't release the ConnectionDO lock cleanly when aborted — the `finally` block at the end of `runBackupBase` is the only unlock path, and an AbortError thrown in the middle should still hit it. To confirm, we'll add a Vitest case in `backup-base-task.test.ts` that injects a throw mid-loop and asserts the unlock POST fires. The ConnectionDO alarm safety net (60s TTL) is the second line of defense if the finally somehow doesn't fire.

### Failure modes considered

- **`runs.cancel` 404s** (task already finished, run id is stale): swallow + continue. The run row is already in 'cancelling'; we move to 'cancelled' regardless. Worst case the task wrote a `succeeded` /complete callback during the race window — that callback's `WHERE status='running'` no-ops because we're at 'cancelling'. Run ends as 'cancelled'. Acceptable.
- **Network partition** between engine and Trigger.dev: the cancel route's UPDATE to 'cancelled' still happens. The task continues running on Trigger.dev's side, eventually POSTs to /complete, which no-ops. Cancel succeeded from the user's perspective; the underlying compute completed unobserved. Acceptable.
- **User clicks Cancel twice rapidly**: first call's UPDATE wins (sets 'cancelling'), second call's WHERE-clause finds status='cancelling' (not in `('queued', 'running')`) and returns 409 idempotently. The button is `setButtonLoading`'d so the double-click physically can't happen until the first response lands anyway.

## Phase B — Scheduling architecture

### SpaceDO responsibility

One DurableObject instance per Space (already configured in [wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example): `binding: SPACE_DO, class_name: SpaceDO`). The DO ID is derived from `spaceId` via `idFromName(spaceId)` so a Space's scheduler is sticky.

Two public methods (both internal-only, called over the SPACE_DO binding from the Worker):

| Method | Caller | Body | Returns |
|---|---|---|---|
| `POST /set-frequency` | apps/server's PATCH config route | `{ spaceId, frequency, encryptionKeyMaterial? }` (no secrets needed for scheduling) | `{ ok: true, nextFireMs }` |
| `alarm()` | DO runtime (cron-like) | n/a — alarm handler | n/a — side effects only |

### Frequency → next-fire computation

Pure function in `apps/server/src/lib/scheduling/next-fire.ts`. Dep-inject `now()` for tests.

| Frequency | Rule (UTC) | Example: now = 2026-05-12 14:23:00 UTC |
|---|---|---|
| `monthly` | Next 1st of month, 00:00:00 | 2026-06-01 00:00:00 UTC |
| `weekly` | Next Monday, 00:00:00 | 2026-05-18 00:00:00 UTC |
| `daily` | Next day, 00:00:00 | 2026-05-13 00:00:00 UTC |
| `instant` | (throws — out of scope) | — |

All UTC for MVP. Time-zone-aware fires are explicitly out of scope (proposal.md Out of Scope). If `now()` happens to BE the next-fire boundary exactly, return the boundary AFTER that (no "fire at exactly now" — the alarm has already missed its own boundary by definition).

### Alarm fire sequence

```
[SpaceDO.alarm()]
   │  1. SELECT backup_configurations WHERE space_id = (my space) AND frequency != 'instant'.
   │     If no row or frequency is missing: log and return without rescheduling.
   │  2. SELECT spaces.organization_id + spaces.connection_id (need this to seed the
   │     run row).
   │  3. INSERT backup_runs (id=uuid_generate_v4(), space_id, connection_id,
   │     status='queued', triggered_by='scheduled', is_trial=false, created_at,
   │     modified_at).
   │  4. POST /api/internal/runs/:runId/start  (existing 8a route, reachable via
   │     env.SELF or service binding).
   │  5. Compute the next-fire timestamp from (frequency, now()).
   │  6. state.storage.setAlarm(nextFireMs).
   │  7. UPDATE backup_configurations SET next_scheduled_at = $nextFireMs.
```

If step 4 returns an error (engine rejects the run — e.g., 422 no_bases_selected because the user hasn't picked bases yet), we still schedule the next alarm at step 6 and log the rejection. Skipping the alarm reschedule would silently disable the schedule for any Space without bases selected — not what the user wants. The empty-bases case shows up as a 422 in logs and as a `'queued'` run that immediately gets cleaned up by the existing engine path.

### `PATCH /api/spaces/:id/backup-config` hand-off

The existing route (Phase 10a) already validates the new frequency against tier capabilities. We add one step after the UPSERT:

```ts
if (frequency !== existingConfig?.frequency) {
  const doId = env.SPACE_DO.idFromName(spaceId)
  await env.SPACE_DO.get(doId).fetch('https://do/set-frequency', {
    method: 'POST',
    body: JSON.stringify({ spaceId, frequency }),
  })
}
```

The DO sets the alarm + writes `next_scheduled_at`. apps/web's IntegrationsView reads `next_scheduled_at` straight from its existing config-load query and displays "Next backup: <date>" under each connected Space.

### Restart on deploy

DurableObject alarms persist across worker re-deploys per Cloudflare's docs — `state.storage.getAlarm()` survives. No bootstrap step needed on deploy.

For Spaces that already exist BEFORE this change ships (every dev environment, plus prod by the time we deploy), no SpaceDO has an alarm set yet. We add a one-time migration script `apps/server/scripts/bootstrap-space-do-alarms.mjs` that iterates over every `backup_configurations` row, calls `set-frequency` on each Space's DO. Idempotent — runs against `frequency` not `next_scheduled_at`, so re-running just re-computes alarms.

## Phase A + B testing strategy

| Layer | Coverage |
|---|---|
| Pure functions | `apps/server/src/lib/runs/cancel.ts` (`processRunCancel(input, deps)`) gets the same DI-with-vi.fn shape as `processRunStart` / `processRunComplete`. `apps/server/src/lib/scheduling/next-fire.ts` is pure with injectable `now()`. |
| Engine routing | `tests/integration/runs-cancel-route.test.ts` mirrors `runs-complete-route.test.ts` — 401 / 405 / 400 / 404 / 409. |
| SpaceDO | `tests/integration/space-do.test.ts` uses `runInDurableObject` (per the existing ConnectionDO pattern) to drive `set-frequency` → assert `state.storage.getAlarm()` returns expected timestamp. Drive `alarm()` directly; assert it inserted a run row + called /runs/start with the right runId. |
| apps/web cancel | `src/pages/api/spaces/[spaceId]/backup-runs/[runId]/cancel.test.ts` — 401 / 403 IDOR / 405 / 200 / 409 mapped from engine codes. |
| apps/web UI | `BackupHistoryWidget` cancel button: vitest test renders a `<Cancel>` button only when status ∈ {queued, running}; verifies POST + setButtonLoading. |
| Playwright | extend `backup-happy-path.spec.ts` with `'cancel a running backup flips status to cancelled within 4s'` — seeded user, kicks off run, immediately clicks Cancel, asserts chip flips. |

## Master DB migration

One frontend-owned migration (per CLAUDE.md §2: "Master-DB schema migrations are owned by the frontend"):

`apps/web/drizzle/0007_backup_schedule_and_cancel.sql`:

```sql
-- Phase A: status set expands. backup_runs.status is text (no enum), so no
-- constraint to migrate. The change is purely in the application-layer
-- type union (apps/web/src/db/schema/core.ts + apps/server/src/db/schema/
-- backup-runs.ts).

-- Phase B: next-scheduled-at column for display + audit. SpaceDO writes
-- this on every alarm-set / alarm-fire.
ALTER TABLE "baseout"."backup_configurations"
  ADD COLUMN "next_scheduled_at" timestamp with time zone;

-- Optional index: queries that filter on next_scheduled_at would mostly
-- be operator-facing ("which Spaces are scheduled in the next hour?").
-- Skip the index for MVP; add when there's a real query that needs it.
```

The schema types update concurrently in `apps/web/src/db/schema/core.ts` (canonical) and `apps/server/src/db/schema/backup-configurations.ts` (mirror).

## Operational concerns

- **Backfill**: existing `backup_configurations` rows get `next_scheduled_at = NULL` after the migration. The bootstrap script (Phase B task list) fills them on first run. IntegrationsView already handles `next_scheduled_at = null` (renders "Next backup: not yet scheduled").
- **Observability**: structured logs per cancel + per alarm-fire (described in proposal.md Impact §). No new monitoring infra.
- **Cost**: Phase B's DO alarms are billed per fire. At MVP scale (low hundreds of Spaces, mostly monthly): ~hundreds of alarms per month, < $0.01 in DO request cost. Worth noting only for the future-at-scale audit.

## What this design deliberately doesn't change

- The Trigger.dev v3 + ConnectionDO + R2-proxy backup path. `runs/start`, `backup-base.task.ts`, `postCompletion`, `postProgress` all stay as-is.
- The OAuth refresh cron from `baseout-server-cron-oauth-refresh`. Unrelated.
- The live-status polling from `baseout-backup-history-live-status`. Unrelated; cancellation status flips ride the same polling path.
- The wizard step 2 base picker. The MVP "what to back up" answer is locked at bases-only here.
