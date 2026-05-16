# Design: Restore engine (server side)

## Mirror the backup-run lifecycle file-for-file

Backup-run lifecycle in `apps/server/src/lib/runs/` is the reference shape: a pure `processRunStart` orchestrator, a `processRunComplete` aggregator, a `processRunProgress` updater, a `processRunCancel` state-machine. Each takes a DI deps object so the validation logic is unit-testable without Postgres or Trigger.dev SDK.

Restore follows the same skeleton:

```
apps/server/src/lib/runs/
  start.ts        processRunStart       (backup)
  complete.ts     processRunComplete    (backup)
  progress.ts     processRunProgress    (backup)
  cancel.ts       processRunCancel      (backup)

apps/server/src/lib/restores/        ← new
  start.ts        processRestoreStart
  complete.ts     processRestoreComplete
  progress.ts     processRestoreProgress
  cancel.ts       processRestoreCancel
```

The benefit: reviewers and future-us can read either side and infer the other. Bug-fix patterns transfer.

## `restore_runs` table shape

```sql
CREATE TABLE baseout.restore_runs (
  id                     uuid PRIMARY KEY,
  space_id               uuid NOT NULL REFERENCES spaces(id),
  connection_id          uuid NOT NULL REFERENCES connections(id),
  source_run_id          uuid NOT NULL REFERENCES backup_runs(id),
  status                 text NOT NULL,            -- 'queued' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed'
  scope                  text NOT NULL,            -- 'base' | 'table' | 'point_in_time'
  scope_target           jsonb NOT NULL,           -- { baseId, tableId?, runId? }
  tables_restored        int  NOT NULL DEFAULT 0,
  records_restored       int  NOT NULL DEFAULT 0,
  attachments_restored   int  NOT NULL DEFAULT 0,
  trigger_run_ids        text[] NOT NULL DEFAULT '{}',
  triggered_by           text NOT NULL,            -- 'user_manual' | 'admin_override'
  is_trial               boolean NOT NULL DEFAULT false,
  started_at             timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  error_message          text,
  created_at             timestamptz NOT NULL DEFAULT NOW(),
  modified_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restore_runs_space_status ON baseout.restore_runs (space_id, status);
CREATE INDEX idx_restore_runs_source ON baseout.restore_runs (source_run_id);
```

`source_run_id` ties the restore to a single backup snapshot (the directory of CSVs at `/<orgSlug>/<space>/<base>/<datetime>/`). For `scope='point_in_time'`, `scope_target.runId` points to the prior backup_run row whose state the restore should reproduce. For `scope='table'`, `scope_target.tableId` narrows to a single CSV within that snapshot.

## Storage-side reads

The Trigger.dev task is the storage reader (per workflows convention). The server doesn't read CSVs directly; it only emits the start signal carrying the storage location keys to the task. That keeps the Worker's bundle small and consistent with the backup-side split.

## Cancel state machine

Mirrors backup:

```
queued     ─[/cancel]──> cancelled (no trigger_run_ids fan-out needed)
running    ─[/cancel]──> cancelling (CAS) ─[tasks.runs.cancel × N]──> cancelled
cancelling ─[/cancel]──> 409 (already cancelling)
cancelled  ─[/cancel]──> 409 (already terminal)
succeeded  ─[/cancel]──> 409
failed     ─[/cancel]──> 409
```

The Trigger.dev task's outer try/catch handles `AbortError` per [`workflows-schedule-and-cancel`](../workflows-schedule-and-cancel/proposal.md)'s pattern — the workflows-side change for restore will mirror that.

## Progress + complete payloads

```ts
// /api/internal/restores/:restoreId/progress
{
  triggerRunId: string;
  atBaseId: string;
  recordsAppended: number;
  tableCompleted: boolean;
}

// /api/internal/restores/:restoreId/complete
{
  triggerRunId: string;
  atBaseId: string;
  status: 'succeeded' | 'failed';
  tablesRestored: number;
  recordsRestored: number;
  attachmentsRestored: number;
  errorMessage?: string;
}
```

Schema parity with backup payloads is intentional — the [`shared-websocket-progress`](../shared-websocket-progress/proposal.md) WebSocket broadcast extends to restore frames trivially when it lands.

## Community Restore Tooling bundle (Phase E, optional)

Pro+ tier gets an exportable AI-prompt bundle: schema snapshot + per-table sample records + tier-appropriate prompts. The bundle is built on read (lazily, no precomputation). The endpoint is included in this change as scaffolding for the apps/web Pro+ UI to consume; the actual prompt content + tier gating is a separate apps/web concern.

JSON shape (provisional):

```ts
{
  bundleVersion: '1',
  generatedAt: string;
  source: { runId: string; datetime: string; orgSlug: string; spaceName: string };
  bases: Array<{
    baseId: string;
    name: string;
    tables: Array<{
      tableId: string;
      name: string;
      schema: { fields: Field[] };
      sampleRecords: Record<string, unknown>[];  // top N
      prompts: { restoreToFreshBase: string; restoreToExistingBase: string };
    }>;
  }>;
}
```

## Open questions

- **Restore-as-new-base vs restore-to-source-base**: MVP creates a new Airtable base named `<originalName>-restored-<datetime>`. Overwriting in-place requires conflict resolution (existing rows, schema drift) — out of scope.
- **Attachment restoration**: when the source CSV emits semicolon-joined `r2_object_key` lists (per `server-attachments`), the restore task needs to re-upload each attachment to Airtable. That's a downstream Airtable API call that scales linearly with attachment count — performance and credit cost both real. Pin behind a feature flag during initial rollout.
- **Trial-cap on restore**: backup caps at 5 tables / 1K records for trial; restore symmetry says the same caps apply. Confirm during implementation that the workflows-side restore task enforces matching caps.
