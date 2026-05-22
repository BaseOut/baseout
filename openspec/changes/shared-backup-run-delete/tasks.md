## Phase A — StorageWriter interface + LocalFsWriter

Foundation phase. Adds the abstraction `backup-base.ts` will read through; does not change any external behavior. Ship + tests green before starting Phase B.

### A.1 — Interface + factory

- [ ] A.1.1 Create [apps/workflows/trigger/tasks/_lib/storage-writer.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writer.ts) declaring the `StorageWriter` interface with `writeCsv(relativeKey, csv): Promise<{ path, size }>` and `deletePrefix(relativePrefix): Promise<{ deletedCount }>`. Header comment names the change (`shared-backup-run-delete`) and the BYOS evolution path.
- [ ] A.1.2 Create [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts) exporting `resolveStorageWriter(storageType: string): StorageWriter`. Today returns a single `LocalFsWriter` instance for every input. Header comment names the TODO for BYOS providers.

### A.2 — LocalFsWriter

- [ ] A.2.1 TDD red: create [apps/workflows/tests/storage-writers/local-fs.test.ts](../../../apps/workflows/tests/storage-writers/local-fs.test.ts). Cases: `writeCsv` delegates to the existing `writeCsvToLocalDisk` (assert returned `{ path, size }` matches free-function output for the same input — tmpdir + cleanup); `deletePrefix` removes a populated prefix recursively (seed a tmpdir tree, call deletePrefix on the parent, assert disk state); `deletePrefix` on a non-existent prefix returns `{ deletedCount: 1 }` without throwing (force option); `deletePrefix` with `..` in the input throws `invalid_path`.
- [ ] A.2.2 Implement [apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts) as `class LocalFsWriter implements StorageWriter`. `writeCsv` calls the existing free function. `deletePrefix` does the `..` guard, joins under `BACKUP_ROOT`, and calls `fs.rm(abs, { recursive: true, force: true })`. Watch green.

### A.3 — Wire backup-base.ts onto the factory

- [ ] A.3.1 Update [apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts): replace the direct `import { writeCsvToLocalDisk } from "./_lib/local-fs-write"` with `import { resolveStorageWriter } from "./_lib/storage-writers"`. Resolve once near the top of `runBackupBase` (`const writer = resolveStorageWriter(payload.storageType)`); call `writer.writeCsv(key, csv)` where the free function used to be called.
- [ ] A.3.2 Update the `BackupBaseDeps.writeCsv` test seam type so existing tests in [apps/workflows/tests/backup-base.test.ts](../../../apps/workflows/tests/backup-base.test.ts) continue to work without modification (the dep type is identical — `(key: string, csv: string) => Promise<unknown>` — only the production default-binding changes).
- [ ] A.3.3 Extend [apps/workflows/trigger/tasks/backup-base.task.ts](../../../apps/workflows/trigger/tasks/backup-base.task.ts) payload type with `storageType: string` and forward it into the `runBackupBase` call. The engine's `/runs/start` already reads `storage_type` from `backup_configurations` (or defaults — see Phase C tasks); this just plumbs it.
- [ ] A.3.4 Update [apps/server/src/lib/runs/start.ts](../../../apps/server/src/lib/runs/start.ts) to fetch `storage_type` from `backup_configurations` and include it in the task payload.

### A.4 — Phase A verification

- [ ] A.4.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — all green.
- [ ] A.4.2 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green (the start.ts change is the only server-side touch in Phase A).
- [ ] A.4.3 Human checkpoint: run a backup locally. Files land in `apps/workflows/.backups/` exactly as before. Wire format identical.
- [ ] A.4.4 On approval: stage by name (no `git add -A`), commit locally. Hold per current standing instruction.

## Phase B — State-machine widening

Small, dependency-free type change. Ships in lockstep with the engine routes in Phase C but isolated as its own commit for reviewability.

- [ ] B.1 Widen the status type union in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) `backup_runs.status` comment + literal-union type: add `'deleting'`. Status column stays `text`; no migration.
- [ ] B.2 Mirror the widening in [apps/server/src/db/schema/backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts). Header comment notes that canonical writer is apps/web; engine writes `'deleting'` directly via `processRunDelete` and hard-DELETEs the row on `delete-complete`.
- [ ] B.3 Update [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts) — `statusLabel('deleting')` returns `'Deleting'`; `statusBadgeClass('deleting')` returns `'badge-warning'`.
- [ ] B.4 Confirm [apps/web/src/stores/backup-runs.ts](../../../apps/web/src/stores/backup-runs.ts) `TERMINAL_STATUSES` does NOT include `'deleting'`. (Polling must continue.) No edit needed if the set is unchanged — verify only.
- [ ] B.5 Extend [apps/web/src/lib/backups/format.test.ts](../../../apps/web/src/lib/backups/format.test.ts) to pin the new label/badge mappings.
- [ ] B.6 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green.

## Phase C — Engine: pure function + routes + delete-run-files task

The core delete pipeline. Phase A must be complete (the task imports the writer factory).

### C.1 — Pure function: processRunDelete

- [ ] C.1.1 TDD red: create [apps/server/tests/integration/runs-delete.test.ts](../../../apps/server/tests/integration/runs-delete.test.ts). Mirror `runs-cancel.test.ts` structure. Cases:
  - happy delete (terminal row) → 'deleting' + prefixes returned + storageType returned;
  - 404 when `fetchRunForDelete` returns null;
  - 409 `run_not_terminal` for status='queued';
  - 409 `run_not_terminal` for status='running';
  - 409 `run_not_terminal` for status='cancelling';
  - 409 `delete_in_progress` for status='deleting' (up-front check);
  - 409 `delete_in_progress` for CAS race-loss (markRunDeleting returns false);
  - empty-prefixes case (no bases joined) returns ok:true with `prefixes: []`.
- [ ] C.1.2 Implement [apps/server/src/lib/runs/delete.ts](../../../apps/server/src/lib/runs/delete.ts) — `processRunDelete(input, deps)`. DI shape mirrors `processRunCancel`. Watch green.

### C.2 — Prefix computation helper

- [ ] C.2.1 TDD red: create [apps/server/tests/integration/runs-prefixes.test.ts](../../../apps/server/tests/integration/runs-prefixes.test.ts) for a `buildRunPrefixes(joinedRows, runStartedAt): string[]` pure helper. Cases: single base → one prefix; multiple bases → one prefix each; segment-sanitization (`/` → `_`) on space/base names; `:` → `-` in the timestamp; trailing-slash convention is consistent. Pin the format identical to `buildR2Key` minus the `<tableName>.csv` segment.
- [ ] C.2.2 Implement [apps/server/src/lib/runs/build-run-prefixes.ts](../../../apps/server/src/lib/runs/build-run-prefixes.ts) — `buildRunPrefixes(rows, runStartedAt)`. Watch green.
- [ ] C.2.3 Wire `computeRunPrefixes` (the dep injected into `processRunDelete`) to its production implementation in the engine route — a single SELECT with the joins documented in the design doc, then `buildRunPrefixes(rows, run.started_at)`.

### C.3 — Engine route: POST /api/internal/runs/:runId/delete

- [ ] C.3.1 TDD red: create [apps/server/tests/integration/runs-delete-route.test.ts](../../../apps/server/tests/integration/runs-delete-route.test.ts). Mirror `runs-cancel-route.test.ts`. Cases: 401 missing token, 405 non-POST, 400 invalid UUID, 404 mapped from pure function, 409 (each variant: `run_not_terminal`, `delete_in_progress`), 202 happy with `{ ok: true, triggerRunId }` in body.
- [ ] C.3.2 Implement [apps/server/src/pages/api/internal/runs/delete.ts](../../../apps/server/src/pages/api/internal/runs/delete.ts). Wires real DB deps + `tasks.trigger<typeof deleteRunFilesTask>("delete-run-files", { runId, storageType, prefixes })` from `@trigger.dev/sdk` + `import type { deleteRunFilesTask } from "@baseout/workflows"`. Wire route into [apps/server/src/index.ts](../../../apps/server/src/index.ts) with `RUNS_DELETE_RE = /^\/api\/internal\/runs\/([^/]+)\/delete$/`.
- [ ] C.3.3 Add the structured log `event: 'backup_run_delete_requested'` with `runId`, `storageType`, `prefixCount`.

### C.4 — Engine route: POST /api/internal/runs/:runId/delete-complete

- [ ] C.4.1 TDD red: create [apps/server/tests/integration/runs-delete-complete-route.test.ts](../../../apps/server/tests/integration/runs-delete-complete-route.test.ts). Cases: 401 missing token, 405 non-POST, 400 invalid UUID, 200 happy (body `{ ok: true, results: [...] }` → DELETE row), 200 partial-failure (body `{ ok: false, results: [...] }` → row stays, structured log), 409 if row is not in `'deleting'` (skipped DELETE — defensive).
- [ ] C.4.2 Implement [apps/server/src/pages/api/internal/runs/delete-complete.ts](../../../apps/server/src/pages/api/internal/runs/delete-complete.ts). On `body.ok=true`: `DELETE FROM backup_runs WHERE id = $1 AND status = 'deleting'`. On `body.ok=false`: log + return 200. Wire route into [apps/server/src/index.ts](../../../apps/server/src/index.ts).
- [ ] C.4.3 Add the structured logs: `backup_run_row_deleted` on the happy DELETE, `backup_run_delete_partial_failure` on the partial case with the full `results` failure list.

### C.5 — Trigger.dev task: delete-run-files

- [ ] C.5.1 TDD red: create [apps/workflows/tests/delete-run-files.test.ts](../../../apps/workflows/tests/delete-run-files.test.ts) for the pure orchestration module. Inject a fake writer (`{ deletePrefix: vi.fn() }`) and a fake `postDeleteComplete` callback. Cases: all prefixes succeed → callback `{ ok: true, results: [...deletedCount]}`; one prefix throws → callback `{ ok: false, results: [...with error] }`; empty `prefixes` → callback `{ ok: true, results: [] }`.
- [ ] C.5.2 Implement the pure orchestration at [apps/workflows/trigger/tasks/delete-run-files.ts](../../../apps/workflows/trigger/tasks/delete-run-files.ts). Signature: `runDeleteRunFiles(payload, deps)`. `payload = { runId, storageType, prefixes }`. `deps = { writer: StorageWriter, postDeleteComplete: ({ runId, ok, results }) => Promise<void> }`. Watch green.
- [ ] C.5.3 Implement the task wrapper [apps/workflows/trigger/tasks/delete-run-files.task.ts](../../../apps/workflows/trigger/tasks/delete-run-files.task.ts). Reads env vars (`BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`), wires the production `writer = resolveStorageWriter(payload.storageType)` and the production `postDeleteComplete` (HTTP POST to engine with `x-internal-token`), then calls `runDeleteRunFiles`. `maxDuration: 60`.
- [ ] C.5.4 Type-only re-export from [apps/workflows/trigger/tasks/index.ts](../../../apps/workflows/trigger/tasks/index.ts): `export type { deleteRunFilesTask, DeleteRunFilesPayload } from "./delete-run-files.task";`.

### C.6 — Phase C verification

- [ ] C.6.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — green.
- [ ] C.6.2 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
- [ ] C.6.3 Hold human smoke until Phase D lands (no UI yet to trigger the route from).

## Phase D — apps/web: web route + Delete button

Depends on Phase B (label/badge) and Phase C (engine routes).

### D.1 — Engine client

- [ ] D.1.1 Extend [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) with `deleteRun(runId): Promise<EngineDeleteRunResult>`. Mirror `cancelRun`. New engine error codes: `run_not_found`, `run_not_terminal`, `delete_in_progress`.
- [ ] D.1.2 Extend [apps/web/src/lib/backup-engine.test.ts](../../../apps/web/src/lib/backup-engine.test.ts) with cases for each result variant.
- [ ] D.1.3 Extend [apps/web/src/pages/api/connections/airtable/_engine-status.ts](../../../apps/web/src/pages/api/connections/airtable/_engine-status.ts) (or its sibling that maps engine codes to HTTP) with `run_not_terminal → 409` and `delete_in_progress → 409`.

### D.2 — Web delete route

- [ ] D.2.1 TDD red: create [apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.test.ts). Cases: 401 unauth, 403 IDOR (space not in org), 404 run not found, 405 non-POST, 202 happy, 409 mapped from each engine code (`not_terminal`, `in_progress`).
- [ ] D.2.2 Implement [apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.ts). Pure handler `handlePost(input, deps)` + thin Astro wrapper. Mirror the cancel route's shape exactly.

### D.3 — Delete button module + widget integration

- [ ] D.3.1 TDD red: create [apps/web/src/lib/backups/delete-button.test.ts](../../../apps/web/src/lib/backups/delete-button.test.ts). Cases: `isDeletable` returns true for each terminal status and false for queued/running/cancelling/deleting; `deleteButtonHtml` renders the right `<button data-delete-run="...">` markup; `handleDeleteClick` gates on `window.confirm` (no fetch when cancelled, fetch when confirmed); fetch failure → toast + button re-enabled.
- [ ] D.3.2 Implement [apps/web/src/lib/backups/delete-button.ts](../../../apps/web/src/lib/backups/delete-button.ts). Functions: `isDeletable(status)`, `deleteButtonHtml(run)`, `handleDeleteClick(event)`. Mirror the cancel-button module 1:1; the only differences are the confirm step and the destination URL.
- [ ] D.3.3 Wire the Delete button into [apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro): import `isDeletable`, `deleteButtonHtml`, `handleDeleteClick`; render the button next to the cancel button per row; add a delegated click handler on the document that calls `handleDeleteClick(event)` for `[data-delete-run]` targets.
- [ ] D.3.4 `setButtonLoading` per [apps/web CLAUDE.md §4.5](../../../apps/web/.claude/CLAUDE.md) — Delete button shows spinner while the POST is in flight.

### D.4 — Phase D verification

- [ ] D.4.1 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green.
- [ ] D.4.2 Apply Drizzle migrations against the dev DB (none expected — verify journal still in sync): `pnpm --filter @baseout/web db:check`.
- [ ] D.4.3 Human checkpoint: smoke locally end-to-end.
  - Run a backup against a real-Airtable dev base. Watch it complete (status='succeeded').
  - Verify CSV files exist under `apps/workflows/.backups/<orgSlug>/...`.
  - Click Delete on the row. Confirm the dialog. Watch the chip flip to `Deleting…` then the row disappears within ~4s.
  - DevTools Network shows POST `/backup-runs/:runId/delete` returning 202 and (via 2s poll) the row falling out of `GET /backup-runs`.
  - Verify the CSV directory under `apps/workflows/.backups/<orgSlug>/.../<timestamp>/` no longer exists on disk.
  - Edge case: try Delete on a `'running'` row. Button should not render. Confirm the only path is Cancel-then-Delete.
- [ ] D.4.4 On approval: stage by name, commit locally.

## Phase E — Documentation close-out

- [ ] E.1 Update [openspec/changes/server-retention-and-cleanup/proposal.md](../server-retention-and-cleanup/proposal.md) to cross-reference this change: "The user-initiated per-run delete pattern is owned by `shared-backup-run-delete` and uses hard-delete; this change's cron is the soft-delete sibling for automated bulk cleanup." Add a Forward-references section to its proposal if one doesn't exist.
- [ ] E.2 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md) — add a row under the relevant Backups section: "Per-run user-initiated delete (web + server + workflows) — closed by `shared-backup-run-delete`."
- [ ] E.3 If [shared/Baseout_PRD.md §7.3](../../../shared/Baseout_PRD.md) Must-Have list does NOT already include "user-initiated per-run delete" (it currently lists "Retention / smart cleanup (user-configurable)" only), file a one-line PRD addition as part of this change OR a separate `system-prd-bump` change. Prefer inlining here — it's a tiny addition and avoids a separate change spinning up for a single line.
- [ ] E.4 Update this change's own proposal Out of Scope section as `server-retention-orphan-sweep` and `web-storage-picker-honesty` get filed (or close as won't-do), so the chain stays discoverable.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `server-retention-orphan-sweep` — Sweep stuck `'deleting'` rows whose `delete-run-files` task never POSTed `/delete-complete`. Retry the file delete or escalate to ops. Adds an automated recovery path on top of this change's manual-reconciliation MVP.
- [ ] OUT-2 `web-storage-picker-honesty` — Fix the StoragePicker UI claim that selecting `r2_managed` writes to "Cloudflare R2 (managed by Baseout) — encrypted at rest, no setup required." Replace with accurate copy reflecting BYOS-only V1 (per `system-r2-park`) and the local-fs dev writer.
- [ ] OUT-3 `shared-byos-google-drive` / `shared-byos-dropbox` / `shared-byos-box` / `shared-byos-onedrive` — Per-provider StorageWriter implementations. Each adds a class behind the same interface, registered in the `resolveStorageWriter` factory.
- [ ] OUT-4 `web-backup-run-delete-bulk` — Multi-select + bulk delete. Out of scope for MVP.
- [ ] OUT-5 `web-backup-run-delete-confirm-strict` — Type-the-base-name confirmation pattern for high-stakes deletes. MVP uses the single-step `window.confirm()`.
