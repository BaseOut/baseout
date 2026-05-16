# server-dynamic-mode

Activates the Dynamic database tier of the backup engine per [PRD §5.1 Plan-Based Data Storage Model](../../../shared/Baseout_PRD.md) and [Features §4.3 Database Tier Details](../../../shared/Baseout_Features.md). Today every backup is `mode='static'` (CSV → R2). Dynamic-mode lands schema + records (+ attachment metadata) into a per-Space client database — D1 schema-only for Trial/Starter; D1 full for Launch/Growth; Shared PG for Pro; Dedicated PG for Business; BYODB for Enterprise.

This is the load-bearing change for downstream features that need queryable record data: the Direct SQL API (Pro+), Schema Diff (Launch+), Schema Health Score, AI Schema Insight, the Restore engine, and webhook-driven Instant backup. None of those can ship without dynamic mode landing first.

Cross-app: `apps/web` owns the provisioning UI (Stripe-on-upgrade → provisioner enqueue); `apps/server` owns the per-tier provisioner + the dynamic write path in `backup-base.task.ts`.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
