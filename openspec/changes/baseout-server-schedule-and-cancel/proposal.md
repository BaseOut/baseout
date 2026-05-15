## Why

Two real MVP gaps remain after the live-status fix landed:

1. **Scheduled backups don't actually fire on a schedule.** Wizard step 3 captures `backup_configurations.frequency` (monthly / weekly / daily / instant per Features §6.1), but the engine has no cron-like dispatcher. Customers paying for a "monthly backup" plan would never see a backup run unless they manually clicked the button. [PRD §6](../../../shared/Baseout_PRD.md) lists `Scheduled backups — Monthly (all tiers), Weekly (Launch+), Daily (Pro+), Instant (Pro+)` as a Must-Have V1 feature. [Backlog MVP item P1B.2.3](../../../shared/Baseout_Backlog_MVP.md) calls out "Cron alarm scheduling per `spaces.backup_frequency`" at P1 priority. The architecture is already specced — [PRD §10](../../../shared/Baseout_PRD.md) names the per-Space Durable Object as the "Backup state; cron-like controller" — and the [SpaceDO file](../../../apps/server/src/durable-objects/SpaceDO.ts) header comment explicitly reserves itself for "scheduled-backup state machine, Trigger.dev task dispatch, alarm-driven cron-like dispatching".

2. **There is no way to cancel a run.** If a backup gets stuck (transient Airtable 5xx storm, a base that's larger than the engine can handle within Trigger.dev's `maxDuration: 600`, a connection that fell into `pending_reauth` mid-run), the row stays `status='running'` until either the Phase B2 OAuth-refresh cron flips it or a human goes in via SQL. The chip-flip live-status work assumed every run reaches a terminal state under its own power; in practice some won't. Customers need a Cancel button on the row and the engine needs to actually stop the Trigger.dev task, release the ConnectionDO lock, and flip the run to `'cancelled'`. Same hook is the foundation for "pause my scheduled backup until next Tuesday" — cancel a queued future run before it fires.

The third half of this change is a documentation scope-lock. The PRD/Features matrices imply several axes of "what to back up" (schema, records, attachments, automations, interfaces, custom documentation, with tier gates). The current engine implements **schema + records for every table of every selected base**, with attachments emitted as a `[N attachments]` placeholder cell, no per-table toggles, no schema-only mode. The MVP scope confirms that as final: anything beyond it is a follow-up. The wizard step 2 base picker remains the only "what to back up" choice surfaced to users in MVP.

**One conflict to flag**, per the CLAUDE.md rule that the v1.1 PRD is authoritative when it disagrees with Features:

- [PRD §6 line 701](../../../shared/Baseout_PRD.md): `Instant — Pro+`.
- [Features §6.1](../../../shared/Baseout_Features.md): `Instant — Business+`.

This change commits to PRD's `Pro+` reading. Instant is out of scope for THIS change anyway (webhook-driven, separate `baseout-backup-instant` follow-up), but the proposal records the call so the next reader doesn't re-litigate.

## What Changes

### Phase A — Cancel a run

- **Master DB schema**: add `'cancelling'` and `'cancelled'` to the accepted values of [`baseout.backup_runs.status`](../../../apps/web/src/db/schema/core.ts). Existing column is `text` — no enum constraint to migrate — but the schema mirror's allowed-status type union must be updated in both [`apps/web/src/db/schema/core.ts`](../../../apps/web/src/db/schema/core.ts) and [`apps/server/src/db/schema/backup-runs.ts`](../../../apps/server/src/db/schema/backup-runs.ts).
- **New engine route**: `POST /api/internal/runs/:runId/cancel` in `apps/server`. Validates UUID + run exists. Sets `status='cancelling'`. Reads `trigger_run_ids` from the row, calls `runs.cancel(triggerRunId)` from `@trigger.dev/sdk` for each. The existing `backup-base.task.ts` outer try/catch + `postCompletion` path already handles a cancelled task gracefully (task throws on cancel → catch → `result.status='failed'` → /complete writes `errorMessage='cancelled'`). We add a final UPDATE to flip `status='cancelled'` from `'cancelling'` after all triggers have been asked to cancel. Mirrors the Phase 8a/8b pure-function-with-DI pattern.
- **New apps/web route**: `POST /api/spaces/:spaceId/backup-runs/:runId/cancel`. IDOR-guarded via `Astro.locals.account`. Calls the engine via `BackupEngineClient.cancelRun(runId)`. The client gets a new method alongside `whoami` + `startRun`.
- **UI**: Cancel button rendered on rows where `status ∈ {'queued', 'running'}`. Uses `setButtonLoading` per [apps/web CLAUDE.md §12](../../../apps/web/.claude/CLAUDE.md). On success, `$backupRuns` polls within 2s and the chip flips to `'Cancelling'` then `'Cancelled'`.
- **Future-scheduled cancel**: when a future run is "queued" because the SpaceDO alarm pre-inserted a row, the same cancel path works (engine sees status='queued', flips to 'cancelled', and the SpaceDO's next alarm tick skips this row). If we deferred pre-insertion to alarm-fire time (see design.md), then cancelling a "scheduled future" means clearing `backup_configurations.next_scheduled_at` + cancelling the DO alarm — covered in tasks.

### Phase B — Scheduled backups

- **Master DB schema**: add nullable `next_scheduled_at TIMESTAMP WITH TIME ZONE` to [`backup_configurations`](../../../apps/web/src/db/schema/core.ts). Updated by the SpaceDO every time it schedules an alarm; consumed by apps/web's IntegrationsView to display "Next backup: Mon Jun 1 00:00 UTC".
- **SpaceDO implementation**: replace the [stub](../../../apps/server/src/durable-objects/SpaceDO.ts) with an alarm-driven scheduler:
  - `POST /set-frequency` (internal, called by apps/web's `PATCH /api/spaces/:id/backup-config`): computes the next-fire timestamp from `(frequency, now)`, calls `state.storage.setAlarm(nextFireMs)`, writes `next_scheduled_at` to the master DB.
  - `alarm()`: on fire, INSERT a `backup_runs` row with `triggered_by='scheduled'`, status `'queued'`, then call the existing `/api/internal/runs/:runId/start` route to fan out via Trigger.dev. Re-computes the next-fire timestamp and re-sets the alarm.
- **Wire `PATCH /api/spaces/:id/backup-config`** (already exists from Phase 10a) to call the SpaceDO when `frequency` changes. The existing PATCH route already validates the frequency against the tier; this change just adds the DO hand-off.
- **Frequency-to-next-fire pure function** in `apps/server/src/lib/scheduling/next-fire.ts` (new). Deterministic, dep-injected `now()` for tests. Monthly → 1st of next month, 00:00 UTC. Weekly → next Monday 00:00 UTC. Daily → next day 00:00 UTC. Instant → throws / not-supported (out of scope this change).
- **UI**: IntegrationsView grows a "Next backup: <date>" line under each connected Space. Reads `next_scheduled_at` straight from the existing config-load query — no new endpoint.

### Phase C — Scope lock (documentation)

- Update the master plan at [`~/.claude/plans/use-the-prd-and-eager-stardust.md`](../../../../.claude/plans/use-the-prd-and-eager-stardust.md) "What this plan deliberately does NOT include" table to:
  - Mark scheduled backups + cancel as **done** (this change).
  - List the deferred follow-ups by name (`baseout-backup-attachments`, `baseout-backup-per-table-selection`, `baseout-backup-instant-webhook`, `baseout-backup-dynamic-mode`).
- Update [openspec/changes/baseout-server/proposal.md](../baseout-server/proposal.md) Out-of-Scope section to reference the same follow-up changes by name so the chain is discoverable from either entry point.
- No code change in Phase C.

## Out of Scope

| Deferred to | Item |
|---|---|
| `baseout-backup-attachments` (new openspec change) | Real attachment download + R2 upload. PRD §6.3 lists attachments as Must-Have for all tiers; the engine currently emits a `[N attachments]` placeholder per [field-normalizer.ts](../../../apps/workflows/trigger/tasks/_lib/field-normalizer.ts). Genuine MVP gap, separate concern. |
| `baseout-backup-instant-webhook` (new) | Airtable webhook → instant backup pipeline. Features §6.1 says Business+, PRD §6 says Pro+; tier resolution + the webhook ingestion shape are non-trivial. |
| `baseout-backup-per-table-selection` (new) | Wizard step 2.5: pick specific tables within a base. Not mandated by PRD/Features; users who want a subset back up the whole base and ignore the extras. |
| `baseout-backup-dynamic-mode` (new) | Dynamic backup (Launch+) per Features §6.2: schema-only D1, full D1, Shared PG, Dedicated PG. Currently every backup is static (CSV → R2). Big architectural lift. |
| `baseout-backup-restore` (new) | Restore from a snapshot. PRD §6 lists Restore as Must-Have; entirely separate engine work. |
| `baseout-backup-pause-resume` (potential follow-up) | Pause / resume a Space's schedule without changing its frequency. MVP achieves the same outcome by setting frequency to a sentinel value or by deleting+recreating the config — neither is great UX. |
| Future change | Time-zone-aware schedule fires (today: all alarms fire at 00:00 UTC). Per-org TZ preference is its own change. |
| Future change | Backoff / retry of failed scheduled runs (today: a failed scheduled run just fails; the next scheduled tick goes out at the natural cadence). |

## Capabilities

### New capabilities

- `backup-scheduling` — alarm-driven, frequency-derived dispatch of backup runs at the Space level. Owned by `apps/server` SpaceDO.
- `backup-cancellation` — cancel an in-flight or queued backup run. Spans apps/web (button + route) and apps/server (cancel endpoint + Trigger.dev `runs.cancel`).

### Modified capabilities

- `backup-engine` — gains a second entry path. Previously: apps/web POST → `/runs/start`. Now also: SpaceDO alarm → INSERT → same `/runs/start`. The fan-out + per-base task code is unchanged.
- `backup-config-policy` — `PATCH /api/spaces/:id/backup-config` (existing) gains a side effect: on `frequency` change, hand off to SpaceDO. No external API shape change.

## Impact

- **Master DB**: one additive migration. New status values are text-column appends (no enum constraint exists to migrate). New nullable `next_scheduled_at` column on `backup_configurations`. Existing rows: `next_scheduled_at = NULL` until the first PATCH or SpaceDO write fills it in.
- **apps/web**: cancel button + new POST cancel route + `BackupEngineClient.cancelRun`. `$backupRuns` polling already handles arbitrary status values via `statusLabel` / `statusBadgeClass` — adding two more is a [`apps/web/src/lib/backups/format.ts`](../../../apps/web/src/lib/backups/format.ts) change, not a polling change.
- **apps/server**: SpaceDO implementation + new `/runs/:id/cancel` route. The Trigger.dev `runs.cancel` SDK call is a single network round-trip per `triggerRunId`; the engine doesn't wait for the actual Node-side task to acknowledge.
- **Cost**: SpaceDO alarm fires are billable. One alarm per Space per scheduled tick. At MVP scale (low hundreds of Spaces, mostly monthly): trivial. At scale: still fine — DO alarm rate-limits are per-DO, not global.
- **Observability**: SpaceDO alarm writes a structured log per fire (`event: 'space_scheduled_backup'`, `spaceId`, `frequency`, `nextFireMs`). Cancel writes a structured log too (`event: 'backup_run_cancelled'`, `runId`, `triggerRunIds`, `cancelledByUserId`).
- **Security**: cancel route is org-scoped via `Astro.locals.account.organizationId`. Engine cancel is INTERNAL_TOKEN-gated. No new auth surface.
- **Cross-app contract** (new wire shapes):
  - apps/web → engine: `POST /api/internal/runs/:runId/cancel` → `200 { ok: true, cancelledTriggerRunIds }` or `404 { error: 'run_not_found' }` or `409 { error: 'run_already_terminal' }`.
  - engine ← apps/web (config PATCH): existing `PATCH /api/spaces/:id/backup-config` gains an internal side effect — no apps/web-side shape change.

## Reversibility

Phase A is pure roll-forward: drop the new endpoints + cancel button, and the status values stop being written. Existing `'cancelled'` rows would still display via the format functions but no new ones would land.

Phase B is also roll-forward for the schedule side: a SpaceDO with no alarm set is a no-op. Reverting Phase B means turning off the SpaceDO alarm-set call in the config PATCH and letting any existing alarms expire (they fire once and self-replace; clearing the storage alarm via `state.storage.deleteAlarm()` is a one-line teardown).

Phase C is documentation — fully reversible by `git revert`.

The master DB migration (additive columns / additive enum values) is forward-only by convention but doesn't break older readers; rolling back to a pre-migration version of the apps continues to function (they just ignore the new column).
