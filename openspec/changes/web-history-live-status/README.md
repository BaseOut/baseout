# web-history-live-status

Fixes a regression where the BackupHistoryWidget's status chip stops updating after any in-app navigation, forcing the user to do a full page refresh to see whether a backup succeeded or failed. Root cause: the widget's `<script>` block runs once per session under Astro's `<ClientRouter />` (view transitions), so its `startPolling()` call never re-fires on subsequent page mounts.

The change is fully internal to `apps/web`. No `apps/server` code changes. No master-DB schema migration. Polling cadence (2s), the `$backupRuns` nanostore, and the in-place upsert render strategy all stay as-is — only the script's mount-and-cleanup wiring moves into Astro's `astro:page-load` / `astro:before-swap` lifecycle events so it runs on every page mount instead of once per session.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
