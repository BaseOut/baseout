# baseout-backup-trial-quota-enforcement

Enforces the Trial-tier limits defined in [PRD §2.6](../../../shared/Baseout_PRD.md) and [Features §5.6.4](../../../shared/Baseout_Features.md): **7-day duration**, **1 backup run**, **1,000 records cap**, **5 tables cap**, **100 attachments cap**. Today the engine has `status='trial_complete'` and `status='trial_truncated'` in its state machine but enforces caps only at runtime per-run; it does not block subsequent runs, does not lock out Daily/Instant frequencies, does not honor the 7-day expiry, and has no upgrade-gate UX. This change ships the trial state machine + pre-flight enforcement + email lifecycle + conversion flow.

Cross-app: `apps/web` owns the trial-state column on `subscriptions`, the upgrade-gate middleware, the Trial Welcome / Day 5 / Day 7 emails, and the Stripe-conversion flow; `apps/server` owns the per-run cap enforcement (already partially exists) + the post-run callback that marks `trial_backup_run_used`.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
