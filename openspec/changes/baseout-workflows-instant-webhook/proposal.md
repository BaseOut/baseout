## Why

Workflows-side counterpart to [`baseout-server-instant-webhook`](../baseout-server-instant-webhook/proposal.md). The server-side change owns the per-Space DO that coalesces Airtable webhook events, the gap-detection + fallback-to-full-base logic, cursor advancement on `airtable_webhooks`, and the webhook registration lifecycle. This change owns the Trigger.dev task that performs the incremental backup once the DO has decided what to back up.

## What Changes

- New task `apps/workflows/trigger/tasks/incremental-backup.task.ts`. Pure module + wrapper. Reads the coalesced event window (per-Space DO posts it via engine-callback). For each affected table, pages records by Airtable's `modifiedTime` cursor, writes a deltas CSV under a `/incremental/<runId>/` subtree, and updates the cursor.
- On a gap signal from the DO, the task aborts the incremental path and POSTs a `fallback_to_full` event so the server-side per-Space DO can enqueue a full `backup-base` run instead.

## Out of Scope

- Per-Space DO coalescing logic, gap detection, cursor advancement — server-side.
- `airtable_webhooks` master-DB table + lifecycle cron — server-side.
- The public Airtable webhook receiver at `webhooks.baseout.com` — `apps/hooks`, separate change family.
