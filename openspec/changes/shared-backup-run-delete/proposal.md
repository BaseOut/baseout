## Why

Users can run a backup and cancel one mid-flight (per `server-schedule-and-cancel` Phase A), but they have no way to **remove** a completed run from history — neither the `backup_runs` metadata nor the CSV files the run produced. The only documented deletion surface today is the **Smart Rolling Cleanup** automated policy ([Features §6.9](../../../shared/Baseout_Features.md), [PRD §5.6](../../../shared/Baseout_PRD.md)), which is cron-driven, time-window-based, and explicitly soft-delete (`backup_runs.deleted_at` flips; the row stays for audit). That covers automated bulk pruning. It does **not** cover the user looking at a row in their backup history and saying "I want this one gone, now."

Three concrete forcing functions:

1. **GDPR compliance** ([PRD §8.5](../../../shared/Baseout_PRD.md)). "Compliance from day one — data processing agreements (DPAs) in place before dynamic plans launch." Right-to-be-forgotten requires *some* per-record user-initiated delete surface. Soft-deleting metadata while DPA-bound to delete user data on request is the wrong default.
2. **BYOS asymmetry** ([Features §451](../../../shared/Baseout_Features.md)). For Drive/Dropbox/Box/OneDrive/S3 destinations, the CSV files live in the *customer's* storage. Baseout's `backup_runs` row is the only metadata Baseout permanently holds. Keeping that metadata after the user explicitly deletes their files in their own Drive creates a confusing trail: "we removed the files from your Drive but our history page still says the backup happened at T."
3. **Disk pressure on the local-fs writer.** Per the system-r2-park stance, dev environments write CSVs to `apps/workflows/.backups/` on the Trigger.dev runner. Without a per-run delete, those directories accumulate forever during dev iteration — already visible at [apps/workflows/.backups/](../../../apps/workflows/.backups/) on this branch with runs from `2026-05-15`, `2026-05-18`, `2026-05-20`, `2026-05-22`.

The shape is the natural pair to `server-schedule-and-cancel` Phase A: same surface (web IDOR proxy → engine INTERNAL_TOKEN route → state-machine widening → UI button → 2s poll picks up the flip), with two differences. (a) The terminal action is a **row DELETE** instead of a status flip — this feature is hard-delete, by deliberate contrast with the soft-delete pattern reserved for the future automated cleanup cron in `server-retention-and-cleanup`. (b) The file removal happens on the workflows runner via a new Trigger.dev task, not via the `@trigger.dev/sdk runs.cancel(...)` built-in. The task uses a new `StorageWriter` interface that abstracts local-fs (today) and BYOS providers (future), so the same surface works for both worlds.

## What Changes

### Phase A — `StorageWriter` interface on the workflows side

- **New file** [apps/workflows/trigger/tasks/_lib/storage-writer.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writer.ts) — declares the interface:
  ```ts
  export interface StorageWriter {
    writeCsv(relativeKey: string, csv: string): Promise<{ path: string; size: number }>;
    deletePrefix(relativePrefix: string): Promise<{ deletedCount: number }>;
  }
  ```
- **New file** [apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts) — wraps the existing free function `writeCsvToLocalDisk` as `LocalFsWriter implements StorageWriter`. `deletePrefix` is `fs.rm(absPath, { recursive: true, force: true })` with the same `..` path-traversal guard the writer already enforces.
- **New file** [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts) — `resolveStorageWriter(storageType): StorageWriter` factory. Today only routes `'r2_managed'` (legacy default) and any other value to the local-fs writer, with a TODO referencing the future BYOS providers. A header comment notes that on this branch all writes go to local disk regardless of the picker selection (the StoragePicker UI lie is a separate fix in `web-storage-picker-honesty`).
- **Refactor** [apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts) to call `writer.writeCsv` via the resolved writer instead of importing `writeCsvToLocalDisk` directly. Wire format and tests unchanged.

### Phase B — State-machine widening + master DB

- **Status union widens** in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) and the mirror at [apps/server/src/db/schema/backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts): add `'deleting'`. The status column is `text` (no enum constraint) so the change is application-level only — no SQL migration. `'deleting'` is intermediate, not terminal; once file removal completes the row is hard-DELETEd.
- **No new columns.** This feature does not introduce `deleted_at`. The retention cron in `server-retention-and-cleanup` adds that column for *its* soft-delete model; this feature deliberately does not touch it.
- **Update** [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts) — `statusLabel` returns `'Deleting'` for `'deleting'`; `statusBadgeClass` returns `'badge-warning'` (matching `'cancelling'`). The row falls out of the UI once it's DELETEd on the next poll.
- **Update** [apps/web/src/stores/backup-runs.ts](../../../apps/web/src/stores/backup-runs.ts) `TERMINAL_STATUSES`: `'deleting'` is NOT terminal (polling must continue to observe the row disappearing).

### Phase C — Engine: delete + delete-complete routes + new task

- **New pure function** `apps/server/src/lib/runs/delete.ts` — `processRunDelete(input, deps)`. Same DI-with-vi.fn shape as `processRunCancel` / `processRunStart` / `processRunComplete`. Validates the row is terminal, atomically CAS-flips `status='deleting'`, computes per-base prefixes from joins, returns `{ ok: true, prefixes, storageType }` so the route can hand off to Trigger.dev.
- **New engine route** `POST /api/internal/runs/:runId/delete` in `apps/server`. INTERNAL_TOKEN gate. Mirrors `runs/cancel.ts`. Calls `processRunDelete` for the CAS + prefix computation, then `tasks.trigger<typeof deleteRunFilesTask>("delete-run-files", { runId, storageType, prefixes })`. Returns 202 with `{ ok: true, triggerRunId }`. Does NOT wait for the task to complete — the file-delete callback flips the row to gone.
- **New engine route** `POST /api/internal/runs/:runId/delete-complete` in `apps/server`. INTERNAL_TOKEN gate. Called by the workflows task when file deletion finishes (success or per-prefix failure list). On success: `DELETE FROM backup_runs WHERE id = $1 AND status = 'deleting'`. On partial-failure callback: row stays `'deleting'`, audit-logs the failure list, returns 200 so the task doesn't retry — the future retention-and-cleanup orphan sweeper handles the recovery.
- **New Trigger.dev task** in `apps/workflows/trigger/tasks/delete-run-files.task.ts` + pure orchestration `apps/workflows/trigger/tasks/delete-run-files.ts`. The pure module takes `(payload, deps)` with `deps.writer: StorageWriter`. Resolves the writer via the factory, calls `writer.deletePrefix(prefix)` for each prefix in payload, accumulates results, POSTs to `/api/internal/runs/:runId/delete-complete`. Idempotent — re-running against an already-deleted prefix returns `deletedCount: 0`.
- **Type-only re-export** of `deleteRunFilesTask` from [apps/workflows/trigger/tasks/index.ts](../../../apps/workflows/trigger/tasks/index.ts) so the engine can `tasks.trigger<typeof deleteRunFilesTask>(...)` without bundling the body.

### Phase D — apps/web: web route + Delete button

- **New apps/web route** `POST /api/spaces/:spaceId/backup-runs/:runId/delete`. IDOR-guarded via `Astro.locals.account` (Space must belong to the user's org). Pure handler `handlePost(input, deps)` with DI, mirroring the existing cancel route shape. Calls the engine's `/api/internal/runs/:runId/delete` via the `BACKUP_ENGINE` service binding.
- **Extend** [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) (the client wrapper around the binding) with `deleteRun(runId): Promise<EngineDeleteRunResult>`. Mirrors `cancelRun`. New engine error codes: `run_not_found` → 404, `run_not_terminal` → 409, `delete_in_progress` → 409.
- **New file** `apps/web/src/lib/backups/delete-button.ts` — `isDeletable(status): boolean`, `deleteButtonHtml(run): string`, `handleDeleteClick(event): Promise<void>`. Pattern: same as [cancel-button.ts](../../../apps/web/src/lib/backups/cancel-button.ts). Vitest unit tests pin the render gate + the click → POST behavior.
- **Update** [apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) — add the Delete button next to Cancel in each row. Rendered only when `isDeletable(status)`. Uses `setButtonLoading` per [apps/web CLAUDE.md §4.5](../../../apps/web/.claude/CLAUDE.md). On success, polling within 2s sees the row disappear.

### Phase E — Documentation + spec close-out

- Update [openspec/changes/server-retention-and-cleanup/proposal.md](../server-retention-and-cleanup/proposal.md) to cross-reference this change: the retention cron is the soft-delete pattern; this change is the user-initiated hard-delete pattern; they coexist.
- Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md) — add per-run delete as a closed MVP item.

## Out of Scope

| Deferred to | Item |
|---|---|
| `server-retention-and-cleanup` (existing proposal) | Automated time-window-driven cleanup cron. Uses soft-delete (`deleted_at` column). Separate operation with separate semantics from this user-initiated hard-delete. |
| Follow-up `server-retention-orphan-sweep` (new, future) | Sweep stuck `'deleting'` rows whose `delete-run-files` task never POSTed `/delete-complete`. Retries the file delete or escalates to ops. Not needed for MVP — Trigger.dev's retry policy handles transient failures and the row stays visible (as `'deleting'`) to support manual reconciliation. |
| `web-storage-picker-honesty` (new, future) | Fix the StoragePicker UI claim that selecting `r2_managed` writes to "Cloudflare R2 (managed by Baseout) — encrypted at rest, no setup required." Today all writes go to local-fs on the workflows runner regardless of the picker selection. Out of scope here — this change is delete, not the storage-selection UX. |
| Future BYOS implementation changes | `LocalFsWriter` is the only `StorageWriter` impl on day one. `GoogleDriveWriter`, `DropboxWriter`, `BoxWriter`, `OneDriveWriter`, `S3Writer` are per-provider follow-up changes that each add a class behind the same interface. |
| Future | Confirmation dialog with a "Type the base name to confirm" pattern. MVP uses a single-step browser `confirm()` per the existing cancel pattern. |
| Future | "Restore from a deleted backup" (impossible — files are gone). The Delete action is destructive by design; the UI confirmation is the only safety net. |
| Future | Bulk delete (select multiple rows, delete all). MVP is one-at-a-time. |
| Future | Credit charge per delete. Per [Features §6.9](../../../shared/Baseout_Features.md), the 10-credit charge applies to "manual triggers" of the cleanup *policy*. Per-run delete is a different operation; this change ships it free for all tiers as user-data-control. Re-evaluate if abuse patterns appear. |

## Capabilities

### New capabilities

- `backup-run-delete` — user-initiated hard-delete of a backup run. Spans apps/web (button + IDOR route), apps/server (engine routes + state-machine widening), apps/workflows (delete-run-files task + `StorageWriter` interface).
- `storage-writer` — workflows-side interface abstracting file write + file delete across local-fs (today) and BYOS providers (future). First user is `LocalFsWriter`; tomorrow's users are the BYOS provider implementations.

### Modified capabilities

- `backup-engine` — state machine gains `'deleting'` as an intermediate status. No change to write or read paths for existing statuses.
- `backup-history-ui` — gains a Delete button on terminal rows. Polling already handles arbitrary status values; the only change is one new label/badge mapping.

## Impact

- **Master DB**: zero migrations. Status column is `text`; the new `'deleting'` value is an application-level type union widening only.
- **apps/web**: new IDOR-guarded delete route, new `delete-button.ts` module, new label/badge mapping, new method on `BackupEngineClient`. No new dependencies.
- **apps/server**: new pure function, two new engine routes (`delete` + `delete-complete`), new state-machine transition. The new task enqueue uses the existing `@trigger.dev/sdk` import.
- **apps/workflows**: new task body + pure orchestration module, new `StorageWriter` interface, new `LocalFsWriter` implementation that wraps the existing free function. The existing `writeCsvToLocalDisk` stays exported (transition compatibility) but `backup-base.ts` switches its import to the new factory.
- **Cross-app contract** (new wire shapes):
  - apps/web → engine: `POST /api/internal/runs/:runId/delete` → `202 { ok: true, triggerRunId }` | `404 { error: 'run_not_found' }` | `409 { error: 'run_not_terminal' | 'delete_in_progress' }`.
  - engine → workflows: `tasks.trigger<typeof deleteRunFilesTask>("delete-run-files", { runId, storageType, prefixes })`.
  - workflows → engine: `POST /api/internal/runs/:runId/delete-complete` → `200 { ok: true }` (engine DELETEd the row) | `200 { ok: false, reason }` (engine logged the partial-failure; row stays).
- **Security**: web route is IDOR-guarded (Space ∋ user's org). Engine routes are INTERNAL_TOKEN-gated. Path-traversal guard preserved from the existing local-fs writer (`relativePrefix.includes("..")` rejected). No new auth surface.
- **Observability**: structured log per delete-click (`event: 'backup_run_delete_requested', runId, byUserId, storageType, prefixCount`), per task completion (`event: 'backup_run_files_deleted', runId, deletedCount, failures`), per row DELETE (`event: 'backup_run_row_deleted', runId`). Mirrors the cancel logging pattern.
- **Cost**: one Trigger.dev task invocation per delete (~$0.00001). Local-fs `fs.rm` is free. BYOS provider API calls (future) are subject to per-provider rate limits — the task handles those per-provider; out of scope here.

## Reversibility

Roll-forward only — once a row is hard-DELETEd and files are gone, neither is recoverable. That's by design (matches the GDPR posture). Reverting this change *as code* means: remove the Delete button, remove the routes, remove the task, remove the `'deleting'` status from the type unions. Any `'deleting'` rows that exist at revert time would need a manual SQL cleanup (UPDATE to a known terminal value or DELETE). The StorageWriter interface is purely additive and would stay — its only "user" if delete is reverted is `LocalFsWriter.writeCsv`, which is a no-op refactor of the existing free function.

The `'deleting'` state is recoverable while in flight: a row stuck `'deleting'` because the task failed mid-deletion can be manually reset to its original terminal state via SQL; the per-base prefixes can be re-derived from joins, files re-deleted via a one-shot SQL/script. Recovery is operator-level, not user-level.
