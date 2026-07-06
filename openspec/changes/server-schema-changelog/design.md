# Design — schema-changelog diff/event model

The changelog is a **read-time union** of diff data the engine already persists.
No new capture, no new table, no Trigger.dev task. This doc pins the event model
so the aggregator (`buildChangelog`) and the web renderer agree.

## Sources → events

Three already-persisted sources feed one `ChangelogEvent[]`:

| Source (per-Space DB) | Yields | Event kind |
| --- | --- | --- |
| Lifecycle `firstSeenRun` on base/table/field/view | entity first appeared | `added` |
| Lifecycle `status='removed'` (+ `lastSeenRun`) | entity removed on a confident full capture | `removed` |
| `bo_at_schema_updates` `changeType='name'` | rename | `renamed` (before→after) |
| `bo_at_schema_updates` `changeType='type'` | field retype (carries `breaks_data`) | `retyped` (before→after, `warning`) |
| `bo_at_schema_updates` `changeType in (options,description,primary_field)` | config change | `config` (before→after) |
| `bo_at_automations`/`bo_at_interfaces` `status` transition | app-layer on/off/removed | `config` (`entityKind`, before→after e.g. "Active → Inactive") |
| `bo_at_schema_updates` `entityType in (automation,interface)` | app-layer config change | `config` (`entityKind`) |

Add/remove are **lifecycle**, not `schema_updates` — this mirrors the
`schema-diff.ts` invariant ("Modifications only; add/remove are lifecycle").

## Event shape (engine → web)

```ts
type ChangelogEventKind = 'added' | 'removed' | 'renamed' | 'retyped' | 'config' | 'view';

interface ChangelogEvent {
  id: string;                 // stable per (runId, entityId, changeType)
  at: string;                 // ISO — resolved from bo_at_base_runs (see "Dates")
  runId: string;              // → bo_at_base_runs.id
  baseId: string;
  baseName: string;
  entityType: 'base' | 'table' | 'field' | 'view' | 'automation' | 'interface';
  entityId: string;
  tableId?: string | null;    // parent table for field/view
  tableName?: string | null;
  fieldType?: string | null;  // Airtable field type (drives the field-type icon)
  entityKind?: 'automation' | 'interface' | 'page';  // app-layer entries only
  entityName?: string | null; // automation/interface name (app-layer)
  kind: ChangelogEventKind;
  summary: string;            // pre-rendered, human-readable (engine renders; web styles)
  before?: string | null;     // rename / retype / config — engine-stringified
  after?: string | null;
  warning?: string | null;    // set when breaks_data → the ⚠️ signal
  status: 'active' | 'removed';  // so removed-entity events can be muted/hidden
}
```

## Grouping — base ▸ entity

The web groups events by **base ▸ [concept-icon] entity** rows (the round-2
Changelog shape), then by calendar day for the feed. The engine returns a flat,
date-descending `events` array with enough location fields (`baseName`,
`tableName`, `entityKind`, `entityName`, `fieldType`) for the web to build the
`base ▸ [icon] name` breadcrumb + the day headers without a second round-trip.

## Dates

Every event is dated by the **run** that observed it, not wall-clock:

- `added` → `bo_at_base_runs.started_at` where `id = firstSeenRun`.
- `removed` → `started_at` where `id = lastSeenRun`.
- `renamed`/`retyped`/`config` → `started_at` where `id = schema_updates.runId`.
- automation/interface status → the run that reconciled the status change
  (`lastSeenAt`/reconcile run), else `firstSeenAt`.

The `since` filter is a cutoff on this run `started_at`, so Pro+ Instant-Backup
incremental runs surface events between scheduled full runs — same model, more
frequent events.

## Filters (route params)

- `baseId` — scope to one base (multi-base Spaces).
- `since` — ISO cutoff on the event's run `started_at`.
- `kinds` — comma-separated event kinds to include.
- `includeRemoved` — when false (default) `removed` events are omitted.

## Empty / edge states (engine contract)

- **No prior snapshot (first run only):** no diff exists — `events: []`. The web
  renders "changes appear after your second backup".
- **Backed up, no changes:** `events: []` — the web renders "no changes since".
- **Partial/failed capture:** absent entities are `unknown`, never `removed`
  (the `schema-diff.ts` confidence rule) — no false `removed` events leak in.

## Why read-time (not materialized)

The data is already normalized + indexed (`bo_at_schema_updates_run_idx`,
`bo_at_schema_updates_entity_idx`, `bo_at_base_runs_backup_run_idx`, the lifecycle
`*_run` columns). Unioning them on read keeps a single source of truth and avoids a
projection that can drift from the diff. A materialized `bo_at_changelog` is the
documented escape hatch (Deferred follow-ups) if a high-volume Space needs it.
