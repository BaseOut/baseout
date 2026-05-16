## Why

Backup is one half of the data plane; restore is the other. The PRD pins restore as a Must-Have for all tiers (Community Restore Tooling adds the AI-prompt-bundle export for Pro+). Today no restore code exists: there's no `restore_runs` lifecycle owner, no apps/web entry point, no Trigger.dev task, no CSV-to-Airtable writer. The `server` parent change names the `restore-engine` capability as part of the data plane but defers its implementation; this change is that implementation, on the Worker side.

The split between this change and the paired [`workflows-restore`](../workflows-restore/proposal.md) follows the same boundary as backup:

- **Server (this change)**: HTTP entry point (`/runs/start` equivalent for restore), `restore_runs` lifecycle (queued → running → succeeded|failed|cancelled), DO state transitions, master-DB writes, callback handlers for progress + completion, optional Community Restore Tooling export endpoint.
- **Workflows (paired change)**: the Trigger.dev task that reads CSV(s) from storage, transforms back to Airtable records, calls Airtable's create-records API with backoff, posts progress + completion to the server.

## What Changes

- **New apps/web → apps/server route** `POST /api/internal/restores/:restoreId/start`. INTERNAL_TOKEN-gated. Validates the `restore_runs` row is `queued`, fans out one Trigger.dev `restore-base` task per included base (mirroring the `runs/start` pattern in [`apps/server/src/lib/runs/start.ts`](../../../apps/server/src/lib/runs/start.ts)). Persists trigger_run_ids on the row.
- **New module** `apps/server/src/lib/restores/start.ts` — pure-orchestration `processRestoreStart(input, deps)`. Same shape as `processRunStart`: injected DB queries, injected enqueue callback. Validates row exists + queued + connection active + storage destination reachable.
- **New module** `apps/server/src/lib/restores/complete.ts` — handles per-base completion POSTs from the Trigger.dev task. Aggregates per-base counts into `restore_runs.{tables_restored, records_restored, attachments_restored}`.
- **New module** `apps/server/src/lib/restores/progress.ts` — per-table progress events from the task. Mirrors `runs/progress.ts` shape.
- **New module** `apps/server/src/lib/restores/cancel.ts` — symmetric with `runs/cancel`. CAS-transitions `restore_runs` from `{queued | running}` → `cancelling`, calls `runs.cancel` per trigger_run_id, flips to `cancelled`.
- **Engine schema mirror** `apps/server/src/db/schema/restore-runs.ts` — mirror of canonical `apps/web` migration (filed in this change's Phase A). Columns: `id`, `space_id`, `connection_id`, `source_run_id` (pointer to the `backup_runs` snapshot being restored from), `status`, `scope` (`'base' | 'table' | 'point_in_time'`), `scope_target` (JSON: `{ baseId, tableId?, runId? }`), `tables_restored`, `records_restored`, `attachments_restored`, `trigger_run_ids`, `triggered_by`, `is_trial`, `started_at`, `completed_at`, `cancelled_at`, `error_message`, `created_at`, `modified_at`.
- **New trigger-client enqueue helper** `apps/server/src/lib/trigger-client.ts` — `enqueueRestoreBase(env, payload)`. Type-only `import type { restoreBaseTask } from "@baseout/workflows"`.
- **Optional**: `GET /api/internal/spaces/:id/restore-bundle/:run_id` — Community Restore Tooling endpoint that emits the AI-prompt-bundle JSON. Gated behind Pro+ on the apps/web proxy layer (apps/web checks tier before forwarding); apps/server returns the bundle for any caller with a valid INTERNAL_TOKEN.
- **Tests**: integration tests under `apps/server/tests/integration/` for each new route + pure module, mirroring the backup-run patterns.

## Capabilities

### New Capabilities

- `restore-engine`: server-side restore lifecycle — start route, progress + completion callbacks, cancel state machine, trigger_run_ids fan-out, restore_runs schema mirror, optional Community Restore Tooling bundle endpoint.

### Modified Capabilities

The `restore-engine` capability is named in the `server` parent's `## Capabilities > New Capabilities` list — this change is its first concrete implementation. The capability moves from "named but not implemented" to "MVP shipped".

## Impact

- New apps/web migration `apps/web/drizzle/<N>_restore_runs.sql` (canonical owner).
- New apps/server schema mirror `apps/server/src/db/schema/restore-runs.ts`.
- New apps/server lib modules (`restores/start.ts`, `restores/complete.ts`, `restores/progress.ts`, `restores/cancel.ts`).
- New apps/server routes (`restores/start.ts`, `restores/complete.ts`, `restores/progress.ts`, `restores/cancel.ts`).
- New apps/server `enqueueRestoreBase` helper in `trigger-client.ts`.
- Optional `spaces/[id]/restore-bundle/[run_id].ts` route.
- Cross-app contract: apps/workflows side declared in [`workflows-restore`](../workflows-restore/proposal.md).

## Out of Scope

- **Trigger.dev restore task body** (`restore-base.task.ts` + `restore-base.ts` pure module + CSV-to-Airtable transform). Owned by [`workflows-restore`](../workflows-restore/proposal.md).
- **apps/web restore UI** (run-scoped restore picker, table/base selector, conflict resolution copy). Separate apps/web change.
- **Community Restore Tooling AI-prompt-bundle content** beyond the JSON shape. The bundle endpoint is included here as scaffolding; the actual prompt content is a separate spec.
- **Point-in-time restore for incremental-backup deltas**. The first MVP scope is `'base' | 'table'` restore from a single snapshot. Point-in-time replay across incremental cursors is a follow-up.
- **Restore credits accounting**. Tracked via the `server-manual-quota-and-credits` change family.
- **Restore-conflict resolution UX**: when restoring a table whose target already exists in Airtable, the MVP behavior is "create new base" (no overwrite). Overwrite + merge modes are follow-ups.

## Cross-app contract

```
browser ─https──> apps/web POST /api/restores/:id/start
                    │ (session + Space membership check)
                    │ env.BACKUP_ENGINE.fetch(...)
                    ▼
            apps/server POST /api/internal/restores/:id/start  ──tasks.trigger──> apps/workflows restore-base task
                    ▲                                                                     │
                    │ (progress/complete POSTs)                                           │
                    └─────────────────────────────────────────────────────────────────────┘
```
