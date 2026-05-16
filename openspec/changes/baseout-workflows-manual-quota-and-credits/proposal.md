## Why

Workflows-side counterpart to [`baseout-server-manual-quota-and-credits`](../baseout-server-manual-quota-and-credits/proposal.md). The server-side change owns the `credit_transactions` writes, Stripe metered-usage reporting, mid-run overage cap pause, and the apps/web settings UI. This change owns two task-side bits: (a) tracking attachment byte counts during a backup so the engine can charge for them, and (b) the daily credit-balance-alert cron that emails Org admins when consumption crosses 50/75/90/100% thresholds.

## What Changes

- Update `apps/workflows/trigger/tasks/backup-base.ts` (pure module) to track `attachmentBytesByBase: { [baseId]: number }` alongside the existing record/table counts. Emit it on the per-base completion payload posted by the wrapper.
- New scheduled task `apps/workflows/trigger/tasks/credit-balance-alerts.task.ts`. Daily cron. Pure module + wrapper. For each Org with credit activity, compute yesterday's vs today's `total_consumed/total_granted` ratio; on crossing a 50/75/90/100% threshold, POST an email-trigger event to `/api/internal/orgs/:id/credit-alert`. Template render + Cloudflare Workers `send_email` dispatch live on the server side.

## Out of Scope

- `credit_transactions` master-DB schema, `chargeCredits()` server-side helper, Stripe metered-usage reporter, mid-run pause logic — all server-side.
- apps/web Settings → Billing screen — apps/web.
- React Email template + Cloudflare Workers `send_email` dispatch — server-side.
