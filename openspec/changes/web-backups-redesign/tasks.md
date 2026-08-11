# Tasks — Backups redesign (list → run → base → tables)

## Built — on `main`, verified, UNCOMMITTED until this change is committed
- [x] **`BackupsListView.astro`** — run-history table (status pill · when · trigger · bases · records · attachments · duration · Details); whole row drills in (running→`?state=running`, failed→`?state=failed`, else `?id=`); empty state at `?fixture=empty`
- [x] **`pages/backups.astro`** rewritten to render the table; re-anchors the fixture timeline to "now"; drops the `RunBackupButton` card + accordion `BackupHistoryWidget`
- [x] **`BackupRunDetailView.astro`** — per-run audit page: header (status · start/finish · duration OR ETA + remaining · Cancel/Delete/Run-again) → failed-attachments banner → summary (bases · tables · records · attachments + Schema/Data/Attachments depth chips + destination) → per-base table (status · time · records[+remaining] · attachments[+remaining] · tables · fields · folder/DB output · "N failed") → failed-attachments slide-over (file · base · table · reason + Retry)
- [x] **`pages/backups/run.astro`** harness — `?state=done|running|failed`; per-base fixtures sum to the run totals (14 tables · 12,407 records · 218 attachments)
- [x] **`BackupRunBaseView.astro`** — per-base table-level audit: header (base name · status · timing · Open in Airtable) → failed-attachments banner → summary (tables · fields · records · views · attachments + depth chips + output) → per-table breakdown (status · fields · records[+remaining] · views · attachments[+remaining] · "N failed") → failed-attachments slide-over scoped to the base
- [x] **`pages/backups/run/base.astro`** harness — `?run=&base=&state=`; per-table fixtures sum to each base's run totals
- [x] Run-detail drill-down links thread `&state=` so running/failed flows stay coherent into the base level
- [x] `SpaceHomeView.astro` Backup-history section links each run's Details into the run page
- [x] `astro check` green (0 errors, 43 files); all states walked in Playwright (done / running / failed; failed-attachments slide-over; light + dark)

## To do
- [ ] List **filters / search / pagination** (by status, base, date; by Run ID / error from a support ticket; "Load more") — flagged in spec `08-backups`, not required for this change
- [ ] Wire the action buttons (Run now, Cancel, Delete, Run again, Retry failed) to real endpoints
- [ ] Remove the orphaned `BackupHistoryWidget.astro` + `RunBackupButton.astro` once nothing references them
- [ ] Engineer: real per-run and per-base detail endpoints behind the `RunDetail` / `BaseRun` / per-table models

## Reconciled against monorepo apps/web (2026-06-26)
Audited during the ui-only → apps/web promotion pass. The read/audit frontend is already present and green here:
- Present + wired: `BackupsListView`, `BackupRunDetailView` (renders in `metricsPending` mode — real run-level
  totals, per-base shown pending), `BackupRunBaseView` (the view), `pages/backups.astro`, `pages/backups/run.astro`.
  `BackupRunDetailView` already carries the base drill-down links.
- **`pages/backups/run/base.astro` deliberately NOT added this pass.** In production `run.astro` passes `bases: []`
  + `metricsPending`, so the run page renders no base links → the base route is unreachable, and `BackupRunBaseView`
  has no pending mode (requires a full `base.tables[]`). Building it now would mean an all-zeros view or fabricated
  data. It unblocks together with the Engineer per-base detail endpoint (the "To do" above) — not pre-empted.
- List filters/search/pagination: out of scope ("not required for this change").
- Orphan cleanup of `BackupHistoryWidget` (only used by the now-orphaned `DashboardView`) is the deferred
  "separate pass" (cascades into stories/classification/`widget-lifecycle.test.ts`/cancel+delete-button libs);
  `RunBackupButton` is still actively used by `backups.astro`, so it stays.
