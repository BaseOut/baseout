# Trigger.dev Tasks

Long-running backup work runs on Trigger.dev v3, not inside the Worker. The Worker enqueues tasks; the Trigger.dev runtime executes them with a 600s `maxDuration` ceiling per [trigger.config.ts](../trigger.config.ts).

This file is a placeholder — Phase 1 wires the first task. The shape below is what's planned, not what exists.

## Why Trigger.dev

A single base backup can take minutes to hours and stream gigabytes of records and attachments. Cloudflare Workers have a 30-second wall clock for fetch handlers and limited subrequests. Trigger.dev v3 gives us:

- Long-running task wallclock (up to 600s default; extendable per task).
- Concurrency control per project (bounded by license tier).
- Built-in retries with exponential backoff.
- Per-run logs viewable in the Trigger.dev dashboard.

The Worker remains the dispatcher — it accepts an internal request, validates it, then triggers the task and returns immediately.

## Task Topology (Planned)

Phase 1 introduces one task per logical unit of work. Anticipated tasks:

| Task ID | Trigger | Purpose |
|---|---|---|
| `backup-base` | `SpaceDO` enqueue | Backup one Airtable Base. Reads schema, fetches records, streams to R2/BYOS. |
| `restore-base` | `apps/web` user action via `/api/internal/restore` | Restore a Backup Snapshot back into Airtable. |
| `webhook-renewal` | `scheduled` cron (Phase 2) | Refresh Airtable webhook subscriptions before expiry. |
| `oauth-refresh` | `scheduled` cron (Phase 2) | Refresh Airtable OAuth tokens nearing expiry. |

Tasks live in `apps/server/trigger/tasks/`. Project config is `trigger.config.ts` (`maxDuration: 600`).

## Concurrency Model

Per-base backups can run with **unlimited concurrency** (PRD §2.7) — one Trigger.dev task per Base per run. Bounding happens at the Connection level via [[durable-objects#Durable Objects#ConnectionDO]], which throttles the actual Airtable API calls inside each task.

This means: many tasks can be in-flight simultaneously, but they all queue against the same `ConnectionDO` if they share a Connection. The DO is the choke point, not the task scheduler.

## Local Development

`trigger.config.ts` projects can run via the Trigger.dev local dev server.

Worker code that enqueues tasks should reach the same Trigger.dev API endpoint locally and in deployment — the API key in Cloudflare Secrets points at the right environment per worker env.

## Where to Look

Pointers to runtime config and the eventual task code.

- Project config: [trigger.config.ts](../trigger.config.ts) (planned)
- Task implementations: `trigger/tasks/` (planned)
- Trigger.dev v3 docs: <https://trigger.dev/docs>
- Backup engine spec: [shared/Baseout_PRD.md §7](../../../shared/Baseout_PRD.md)
