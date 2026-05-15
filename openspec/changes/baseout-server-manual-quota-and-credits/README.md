# baseout-backup-manual-quota-and-credits

Meters manual backup runs (and the per-run credit consumption of scheduled + manual backup activity) per the credit-cost schedule in [Features §5.2](../../../shared/Baseout_Features.md) and the included-count matrix in [Features §4.2](../../../shared/Baseout_Features.md). Today's engine executes any manual run that lands without charging credits and without enforcing the per-tier monthly quota. This change adds the credit ledger, the per-period quota counter, the pre-flight gate that blocks runs when the tier's overage policy says `cap`, and the dashboard surface that shows credit balance + alert thresholds.

Cross-app: `apps/web` owns the credit ledger + quota counter + overage settings UI + Stripe overage billing reporter; `apps/server` owns the per-operation credit reporter that the engine emits from `runs/complete`.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
