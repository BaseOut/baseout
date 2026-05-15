# baseout-backup-retention-and-cleanup

Implements the retention + automated cleanup half of the backup lifecycle per [PRD §5.6](../../../shared/Baseout_PRD.md) and [Features §6.9 Smart Rolling Cleanup](../../../shared/Baseout_Features.md). Without this change, every scheduled backup keeps accumulating in R2 indefinitely — at the cadences defined in `baseout-backup-schedule-and-cancel`, a Starter Space on monthly backups would still be paying for snapshots from year one. This change adds tier-gated retention windows, a per-tier cleanup-policy ladder (Basic → Time-based → Two-tier → Three-tier → Custom), an automated cleanup engine, a credit-charged manual-cleanup trigger, and the dashboard UI to configure it.

Cross-app: `apps/server` owns the cleanup job + the R2 delete path; `apps/web` owns the policy-config UI + the manual-trigger button + capability resolution from Stripe metadata. One additive master-DB migration (new `backup_retention_policies` table + `backup_runs.deleted_at` column).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
