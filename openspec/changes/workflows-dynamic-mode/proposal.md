## Why

Workflows-side counterpart to [`server-dynamic-mode`](../server-dynamic-mode/proposal.md). The server-side change owns the per-tier provisioning dispatcher (D1 / Shared PG / Dedicated PG / BYODB), the `space_databases` master-DB table, the Stripe-upgrade webhook trigger, the audit_history changelog table, and the schema-diff persistence path. This change owns the Trigger.dev task that invokes the dispatcher with retry, plus the `backup-base.task.ts` hooks that write schema upserts and append changelog rows per table.

## What Changes

- New task `apps/workflows/trigger/tasks/provision-space-database.task.ts`. Invokes the server-side dispatcher (over engine-callback `POST /api/internal/spaces/:id/provision-database`) with retry policy + Stripe-side idempotency key.
- Update `apps/workflows/trigger/tasks/backup-base.task.ts` (and the pure module) to compute per-table schema diff against the previous run, POST the diff to the engine's audit-history endpoint, and persist the upsert before the per-table CSV write.

## Out of Scope

- The provisioning dispatcher itself (D1 / Shared PG / Dedicated PG / BYODB strategies) — server-side.
- `space_databases` + `audit_history` master-DB tables — server-side.
- Stripe webhook handler that fires the trigger — server-side.
- apps/web settings UI for tier-migration — apps/web change.
