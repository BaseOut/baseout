## Why

The original Backups page (spec `08-backups`) was a polling **accordion** history widget plus a separate Run-backup card. It expanded each run inline into an unstyled wall of label/value pairs, crammed five chunks of data into every collapsed row, and polled every 10s — which read as laggy. With the Space-scoped IA (`web-nav-ia-restructure`) and the configured-Overview-becomes-a-dashboard direction (`web-space-setup-wizard`), backup history needed to become a proper **auditable drill-down** that mirrors the product hierarchy: a Space's runs → one run → one base → that base's tables. That hierarchy (Space → Base → Tables · Fields · Records · Views · Attachments) and the three capture layers (Schema / Data / Attachments) over static (file) vs dynamic (database) destinations are the model in `overview/`.

## What Changes

- **The Backups page becomes a run-history table**, one row per run (status · when · trigger · bases · records · attachments · duration · Details), each row drilling into the run. It replaces the accordion `BackupHistoryWidget` and the separate `RunBackupButton` card; the one-off run moves to the header.
- **A dedicated run-detail page** replaces inline accordion expansion: overall status/timing (or ETA + remaining while running), the three captured layers, the destination, and a per-base breakdown table. Failed attachments surface as a banner that opens a slide-over. Each base row drills one level deeper.
- **A new base-detail level**: one run's one base, drilled to its **tables**, each with Fields · Records · Views · Attachments, plus the base's status/timing and where its output landed. This is the leaf of the audit trail. It is deliberately **distinct from the Schema page** (`10-schema`), which is a run-agnostic view of structure; base-detail is *what this run captured for this base*.
- **State is honest end to end**: a run in progress shows captured-so-far vs total (records and attachments) and an ETA at every level; a failed run/base shows why nothing was written. Drilling from a running or failed run lands on the matching deeper state.

## Capabilities

### New Capabilities
- `backups`: the auditable drill-down — a run-history list, a per-run detail page, and a per-base table-level detail page, with done / running / failed states at each level and reviewable failed attachments. This supersedes the spec `08-backups` accordion-widget intent.

## Impact

- apps/web: new `views/BackupsListView.astro` (run-history table), `views/BackupRunDetailView.astro` (per-run audit), `views/BackupRunBaseView.astro` (per-base tables); `views/SpaceHomeView.astro` Backup-history section links each run's Details into the run page. New `RunDetail` / `BaseRun` / per-table models richer than `BackupRunSummary` (the engineer wires the real per-run and per-base detail endpoints).
- apps/design harness: `pages/backups.astro` rewritten to render the table (re-anchored timeline; `?fixture=empty|failed`); new `pages/backups/run.astro` (`?state=done|running|failed`) and `pages/backups/run/base.astro` (`?run=&base=&state=`) with per-table fixtures that sum to the per-run totals.
- Orphaned: `components/backups/BackupHistoryWidget.astro` and `RunBackupButton.astro` are no longer composed into the page (left in place, harmless; removal is a follow-up).
- Merged to `main`; ported to `apps/web` (real product code) via the normal PR flow.
