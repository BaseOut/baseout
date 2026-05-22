## Overview

Four implementation tracks in one change. Phase A (StorageWriter interface + LocalFsWriter) is the architectural foundation that the rest of the change reads from. Phase B (state-machine widening) is a small, dependency-free type change. Phase C (engine routes + Trigger.dev task) is the core delete pipeline. Phase D (apps/web button + IDOR route) is the user-facing surface. Phase E is documentation close-out.

The shape parallels [`server-schedule-and-cancel`](../server-schedule-and-cancel/design.md) Phase A almost line-for-line. The differences:

| Cancel | Delete |
|---|---|
| Engine writes `'cancelling'` then `'cancelled'` (status flip, row stays) | Engine writes `'deleting'`; workflows callback hard-DELETEs row |
| Uses `@trigger.dev/sdk`'s `runs.cancel(triggerRunId)` (built-in) | Triggers a new task body, `delete-run-files`, that does the actual file removal |
| Operates on `trigger_run_ids` (fanned-out Trigger.dev runs) | Operates on `storage_type` + per-base prefixes derived from joins |
| No storage I/O | Storage I/O is the whole point — via `StorageWriter.deletePrefix(prefix)` |

The "essentially the BYOS option" framing reflects (a) the StorageWriter abstraction is BYOS-shaped from day one, even though only `LocalFsWriter` exists, and (b) the architectural seams (`storage_type` → writer factory → per-prefix delete) match the pattern future Drive/Dropbox/Box/OneDrive writers will slot into.

## Phase A — StorageWriter architecture

### The interface

```ts
// apps/workflows/trigger/tasks/_lib/storage-writer.ts
export interface StorageWriter {
  /**
   * Write a CSV at `relativeKey` under the writer's configured root.
   * Existing behavior of writeCsvToLocalDisk: returns { path, size } on
   * success; throws on path-traversal segments or fs errors.
   */
  writeCsv(relativeKey: string, csv: string): Promise<{ path: string; size: number }>;

  /**
   * Recursively delete everything under `relativePrefix` (a directory in
   * filesystem terms, a folder-or-prefix in BYOS-provider terms).
   * Idempotent — re-running against an already-deleted prefix returns
   * { deletedCount: 0 }. Throws on path-traversal segments.
   *
   * The contract is "delete this subtree"; how many objects that touches
   * is up to the implementation (one fs.rm, N Drive deletes, etc.).
   */
  deletePrefix(relativePrefix: string): Promise<{ deletedCount: number }>;
}
```

Both methods return structured results so the task can log + report per-prefix outcomes. Both throw on `relative*.includes("..")`. Per-provider implementations encapsulate their own auth/refresh logic.

### Why two methods (not three+)

`getDownloadUrl` and `init` were proposed in [server-retention-and-cleanup §A.1](../server-retention-and-cleanup/proposal.md) for the R2-coupled cleanup model. They aren't needed here:

- `getDownloadUrl` is a read-side concern (presigned URLs for download). This change is delete-only.
- `init` was for R2-binding setup. The local-fs writer has no init; future BYOS writers handle their own per-call OAuth refresh via the existing OAuth-refresh cron.

A future change (`shared-backup-download` or similar) can extend the interface when read-side concerns land. The interface is additive; no test breakage from extending it later.

### `resolveStorageWriter(storageType)` factory

```ts
// apps/workflows/trigger/tasks/_lib/storage-writers/index.ts
import type { StorageWriter } from "../storage-writer";
import { LocalFsWriter } from "./local-fs";

export function resolveStorageWriter(storageType: string): StorageWriter {
  // TODO(shared-byos-*): route 'google_drive' | 'dropbox' | 'box' |
  // 'onedrive' | 's3' to their per-provider writers. Until those land,
  // every storage_type resolves to LocalFsWriter — matching what
  // backup-base.ts has been doing since 8fc1f61. The StoragePicker UI
  // copy claiming files go to managed R2 is a separate fix in
  // web-storage-picker-honesty (see this change's proposal Out of Scope).
  return new LocalFsWriter();
}
```

The factory's job is purely dispatch. It's the right seam to add per-provider construction when BYOS lands (which needs the Space's encrypted OAuth tokens — the engine resolves those and passes them through the task payload). Until then it's a one-liner that returns the same writer for any input.

### LocalFsWriter

```ts
// apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorageWriter } from "../storage-writer";
import { writeCsvToLocalDisk } from "../local-fs-write";

const BACKUP_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.backups",
);

export class LocalFsWriter implements StorageWriter {
  async writeCsv(relativeKey: string, csv: string) {
    return writeCsvToLocalDisk(relativeKey, csv);
  }
  async deletePrefix(relativePrefix: string) {
    if (relativePrefix.includes("..")) throw new Error("invalid_path");
    const abs = join(BACKUP_ROOT, relativePrefix);
    // recursive: removes the directory + everything under it
    // force: succeeds (no throw) if the path is already gone — idempotency
    await rm(abs, { recursive: true, force: true });
    // deletedCount: 1 reflects "the prefix is gone." We don't recurse
    // ourselves to count files because the BYOS implementations care
    // about API calls, not files-on-disk. Local-fs reports the prefix
    // as the unit.
    return { deletedCount: 1 };
  }
}
```

The class wraps the existing free function for `writeCsv` (no behavior change) and adds `deletePrefix`. `BACKUP_ROOT` is recomputed here rather than imported from `local-fs-write.ts` because the rooting logic is co-located with the writer that owns the root. A small duplication; intentional.

## Phase B — State-machine widening

Current statuses: `queued | running | succeeded | failed | trial_complete | trial_truncated | cancelling | cancelled`. Terminal: all except `queued`, `running`, `cancelling`.

Add one transition:

```
<terminal>  ──user-click──▶  deleting  ──files-deleted──▶  <row HARD-DELETED>
                                  │
                                  └──files-failed──▶  <row stays 'deleting';
                                                       operator reconciles>

Where <terminal> = succeeded | failed | cancelled | trial_complete | trial_truncated
```

`'deleting'` is intermediate. The terminal action is row removal, not a status flip. Two consequences:

- **TERMINAL_STATUSES**: `'deleting'` is NOT in the set. Polling continues until either the row hard-disappears or the operator manually intervenes.
- **The format helper** treats `'deleting'` like `'cancelling'`: `badge-warning` + label "Deleting". The user sees one tick of "Deleting…" then the row vanishes.

### Why not soft-delete here

[`server-retention-and-cleanup`](../server-retention-and-cleanup/proposal.md) Phase A introduces `backup_runs.deleted_at` for the automated cron's soft-delete model. That column is the right shape for "automated bulk cleanup with audit trail." It is the wrong shape for "user clicked Delete — remove my data":

- **GDPR** ([PRD §8.5](../../../shared/Baseout_PRD.md)). User-initiated delete should leave no metadata; soft-delete leaves the row's `space_id`, `connection_id`, `started_at`, byte counts, `error_message`, etc. visible in the table.
- **BYOS asymmetry** ([Features §451](../../../shared/Baseout_Features.md)). For Drive/Dropbox destinations, the files are at the customer's storage. Baseout's only permanent metadata is the `backup_runs` row. Soft-deleting our metadata while hard-deleting the files at the customer's side is incoherent.
- **Coexistence is fine.** The automated cron flips `deleted_at` on rows whose blobs it removed. This feature DELETEs rows directly. The two operations have different semantics by design; the history widget already handles "row not present" trivially (it just isn't in the list).

If a future product call decides this feature *should* be soft-delete after all, the migration is straightforward: instead of `DELETE FROM backup_runs WHERE id = $1 AND status = 'deleting'`, write `UPDATE backup_runs SET deleted_at = now(), status = 'deleted_by_user' WHERE id = $1 AND status = 'deleting'` and surface a "Hide deleted" toggle in the UI. The state-machine shape doesn't need to change.

## Phase C — Engine architecture

### Pure function: `processRunDelete`

Mirrors `processRunCancel`:

```ts
// apps/server/src/lib/runs/delete.ts

export interface ProcessRunDeleteDeps {
  /** 404 gate. Returns null if the row doesn't exist. */
  fetchRunForDelete: (runId: string) => Promise<DeletableRun | null>;
  /**
   * CAS UPDATE: status='deleting' WHERE id=$1 AND status IN (<terminal>).
   * Returns true if exactly one row was updated.
   */
  markRunDeleting: (runId: string) => Promise<boolean>;
  /**
   * Compute the per-base prefixes for this run. Reads
   * organizations.slug, spaces.name, at_bases.name, backup_runs.started_at
   * via joins. Returns one prefix per base in the run.
   */
  computeRunPrefixes: (runId: string) => Promise<string[]>;
  /** Test seam — defaults to () => new Date(). */
  now?: () => Date;
}

export type ProcessRunDeleteResult =
  | { ok: true; prefixes: string[]; storageType: string }
  | { ok: false; error: "run_not_found" | "run_not_terminal" | "delete_in_progress" };

const TERMINAL_STATUSES = new Set([
  "succeeded", "failed", "cancelled", "trial_complete", "trial_truncated",
]);

export async function processRunDelete(...);
```

`delete_in_progress` is a distinct error from `run_not_terminal` so the UI can distinguish "you're double-clicking" from "this run is still queued/running, Cancel it first."

### Sequence: delete a terminal run

```
user clicks Delete on a terminal row (browser confirm() guard)
   │
   v POST /api/spaces/:id/backup-runs/:runId/delete                (apps/web)
[apps/web delete route]
   │  1. middleware → user + account context.
   │  2. SELECT space + run, validate org ownership (IDOR).
   │  3. env.BACKUP_ENGINE.fetch('/api/internal/runs/:runId/delete').
   │  4. Pass-through engine result → 202 ok.
   │
   v POST /api/internal/runs/:runId/delete                         (apps/server)
[apps/server delete route — INTERNAL_TOKEN]
   │  1. processRunDelete(input, deps):
   │       a. fetchRunForDelete → 404 if null.
   │       b. status check → 409 'run_not_terminal' for queued|running|cancelling.
   │       c. status check → 409 'delete_in_progress' for 'deleting'.
   │       d. markRunDeleting CAS → 409 'delete_in_progress' on race-loss.
   │       e. computeRunPrefixes via joins.
   │       f. Read storage_type from backup_configurations (via joined spaceId).
   │  2. tasks.trigger<typeof deleteRunFilesTask>("delete-run-files", {
   │       runId, storageType, prefixes,
   │     }).
   │  3. Return 202 { ok: true, triggerRunId }.
   │
   v (Trigger.dev runner, async — Node)
[apps/workflows delete-run-files.task]
   │  1. Resolve writer = resolveStorageWriter(payload.storageType).
   │  2. For each prefix in payload.prefixes:
   │       result = await writer.deletePrefix(prefix).catch(err)
   │       Accumulate { prefix, deletedCount?, error? }.
   │  3. POST /api/internal/runs/:runId/delete-complete
   │     body: { ok: <all-succeeded>, results: [...] }.
   │
   v POST /api/internal/runs/:runId/delete-complete                (apps/server)
[apps/server delete-complete route — INTERNAL_TOKEN]
   │  1. If body.ok === true:
   │       DELETE FROM backup_runs WHERE id = $1 AND status = 'deleting'.
   │       Log { event: 'backup_run_row_deleted', runId }.
   │       Return 200 { ok: true }.
   │  2. If body.ok === false:
   │       Row stays 'deleting'. Log {
   │         event: 'backup_run_delete_partial_failure',
   │         runId, failures: [{ prefix, error }...]
   │       }.
   │       Return 200 { ok: false, reason: 'row_left_for_reconciliation' }.
   │       (The future server-retention-orphan-sweep change handles the
   │        stuck row. For MVP, the operator handles it via SQL.)
   │
   v [apps/web polling — 2s loop]
   │  Row not in the list anymore (DELETED) → falls off the UI.
   │  OR row still 'deleting' → chip stays "Deleting…", which is the
   │  signal to the operator to investigate.
```

### Per-base prefix computation

`computeRunPrefixes(runId)` reads from joins. The path format produced by [buildR2Key](../../../apps/workflows/trigger/tasks/_lib/r2-path.ts) is `<orgSlug>/<spaceName>/<baseName>/<timestamp>/<tableName>.csv`. The **prefix** for a run-and-base is the directory above `<tableName>.csv`, i.e. `<orgSlug>/<spaceName>/<baseName>/<timestamp>/`. One prefix per base in the run.

```sql
SELECT
  o.slug                AS org_slug,
  s.name                AS space_name,
  ab.name               AS base_name,
  br.started_at         AS run_started_at
FROM   baseout.backup_runs                 br
JOIN   baseout.spaces                      s   ON s.id = br.space_id
JOIN   baseout.organizations               o   ON o.id = s.organization_id
JOIN   baseout.backup_configuration_bases  bcb ON bcb.space_id = br.space_id
JOIN   baseout.at_bases                    ab  ON ab.id = bcb.at_base_id
WHERE  br.id = $1
```

The prefix is then built application-side using the same segment-sanitizing rules as `buildR2Key` (`:` → `-` in the timestamp, `/` → `_` in name segments). Re-using the path-build function from `buildR2Key` (or a sibling helper `buildRunPrefix`) avoids divergence.

`computeRunPrefixes` returns `[]` if the run row exists but has no bases joined. That's a real edge case — a run started against a config that was later changed. The task receives an empty `prefixes` array, the workflows task POSTs `/delete-complete` with `ok: true, results: []`, the row gets DELETEd. Defensible: there are no files to delete; remove the metadata.

### Why a new task body, not `tasks.cancel` analog

`@trigger.dev/sdk runs.cancel(runId)` cancels an in-flight task; there is no built-in `runs.delete-files-from-its-output(runId)`. The actual file removal is application code that lives next to the file-write code (both on the workflows runner). Adding a new task body is the architecturally consistent place.

The task is light: O(bases) per delete, each `writer.deletePrefix(prefix)` is a single `fs.rm` (local-fs) or a single folder-delete API call (BYOS). No long-running work, no checkpoints needed. `maxDuration: 60` (one minute) is a safe per-task cap.

## Phase D — apps/web architecture

### Web route: `POST /api/spaces/:spaceId/backup-runs/:runId/delete`

Pure handler + thin Astro wrapper, same pattern as the cancel route:

```ts
// apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.ts
export interface DeleteHandlerDeps {
  fetchSpaceAndRun: (spaceId: string, runId: string) =>
    Promise<{ space: { id: string; organizationId: string }; run: { id: string } } | null>;
  callEngineDelete: (runId: string) => Promise<EngineDeleteRunResult>;
}
export async function handlePost(input, deps): Promise<HandleResult>;
```

IDOR gate validates the Space belongs to `Astro.locals.account.organizationId`. Engine error codes map to HTTP:

| Engine code | HTTP |
|---|---|
| `run_not_found` | 404 |
| `run_not_terminal` | 409 + `{ error: 'not_terminal' }` |
| `delete_in_progress` | 409 + `{ error: 'in_progress' }` |

### Delete button render gate

```ts
// apps/web/src/lib/backups/delete-button.ts
export function isDeletable(status: string): boolean {
  // Terminal states only. Cancelling/queued/running require Cancel first.
  return ["succeeded", "failed", "cancelled", "trial_complete", "trial_truncated"].includes(status);
}
```

The widget renders:

```
[status chip]  [Cancel if cancellable]  [Delete if deletable]
```

Per row. `isDeletable` and `isCancellable` are mutually exclusive (the cancellable statuses are `'queued' | 'running'`, which are not in the deletable set). A `'deleting'` row shows neither button — just the chip.

### Confirmation

The Delete button click handler uses `window.confirm("Delete this backup permanently? This removes the row and the backup files. This cannot be undone.")` before posting. Single-step confirm matches the existing cancel pattern's restraint. If product later wants a "type the base name" guard, that's a follow-up.

### Polling

`$backupRuns` polls every 2s while any row is non-terminal. `'deleting'` is non-terminal, so polling continues until the row is gone. Once the row DELETEs server-side, the next poll's response no longer contains it; the widget removes the DOM node. No client-side optimistic removal.

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure functions | `apps/server/src/lib/runs/delete.ts` (`processRunDelete(input, deps)`) — DI-with-vi.fn. Cases: happy delete → 'deleting' + prefixes returned; 404 when fetchRunForDelete returns null; 409 `run_not_terminal` for queued/running/cancelling/deleting; 409 `delete_in_progress` for CAS race-loss; empty-prefixes case (no bases joined). |
| Pure orchestration | `apps/workflows/trigger/tasks/delete-run-files.ts` — DI-with-vi.fn writer. Cases: all prefixes succeed → POST callback with ok:true; one prefix throws → POST callback with ok:false + failure list; empty prefixes → POST callback with ok:true and empty results. |
| Storage writer | `apps/workflows/tests/storage-writers/local-fs.test.ts` — happy writeCsv (delegates to existing free function); happy deletePrefix (recursive rm on tmpdir); deletePrefix on a non-existent path returns deletedCount:1 (force option); path-traversal `..` rejection. |
| Engine routing | `apps/server/tests/integration/runs-delete-route.test.ts` — 401 missing token, 405 non-POST, 400 invalid UUID, 404, 409 (each variant), 202 happy. Mirrors `runs-cancel-route.test.ts`. |
| Engine routing | `apps/server/tests/integration/runs-delete-complete-route.test.ts` — 401, 405, 400, 200 happy (DELETE row), 200 failure (row stays). Mirrors `runs-complete-route.test.ts`. |
| apps/web routing | `apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/delete.test.ts` — 401 unauth, 403 IDOR (space not in org), 404 run not found, 405 non-POST, 202 happy, 409 mapped from engine codes. Mirrors `cancel.test.ts`. |
| apps/web button | `apps/web/src/lib/backups/delete-button.test.ts` — isDeletable per status; deleteButtonHtml renders the right markup; handleDeleteClick gates on confirm() return, calls fetch on confirm, no-ops on cancel. JSDOM + spy on `window.confirm` and `fetch`. |
| apps/web format | Extend `apps/web/src/lib/backups/format.test.ts` to pin 'deleting' → 'Deleting' / 'badge-warning'. |
| Playwright | Extend `backup-happy-path.spec.ts` (or new `backup-delete.spec.ts`): seed run → click Delete → confirm dialog → assert row vanishes within 4s. Asserts the local-fs writer's `.backups/<spaceId>/<baseId>/...` directory is gone post-test. |

## Master DB migration

**None.**

- `backup_runs.status` is `text` (no enum constraint); the new `'deleting'` value is application-level only.
- No `deleted_at` column added (deliberate — see Phase B).
- No new tables.

Schema-mirror updates happen in `apps/web/src/db/schema/core.ts` (canonical) and `apps/server/src/db/schema/backup-runs.ts` (mirror) but they are pure TypeScript type-union widening, not SQL.

## Operational concerns

- **Failure recovery**: A row stuck `'deleting'` is the operator's signal that the task failed mid-deletion. The structured log line `backup_run_delete_partial_failure` carries the failure list. Manual reconciliation is SQL-based for MVP; the `server-retention-orphan-sweep` follow-up adds an automated retry/escalation path.
- **Observability**: three structured-log events (`backup_run_delete_requested`, `backup_run_files_deleted`, `backup_run_row_deleted` / `backup_run_delete_partial_failure`). Each carries `runId`. The first additionally carries the requesting user id.
- **Cost**: trivial. One Trigger.dev task per delete. Per-prefix delete is one fs call (local-fs) or one API call (BYOS). At MVP scale, deletes are deliberate human actions — bounded by user clicks.
- **Race vs the future retention cron**: if `server-retention-and-cleanup` ships, its cron also wants to delete files for expired runs. Race: user clicks Delete on a row the cron has already started removing files for. The CAS `WHERE status IN (<terminal>)` excludes rows the cron has flipped to a `'cleaning'` state (or whatever that change introduces). When the retention change lands it must extend the exclusion set explicitly. Captured here as a forward-looking note; not a blocker for shipping delete alone.

## What this design deliberately doesn't change

- `processRunCancel`, `processRunStart`, `processRunComplete`, `processRunProgress` and their routes. Untouched.
- The fan-out + per-base task code in `backup-base.task.ts`. The only change to `backup-base.ts` is the `writeCsv` import flipping from a free-function to the writer factory — wire format and semantics identical.
- `BackupHistoryWidget`'s polling, accordion, lifecycle, or chip rendering for any non-`'deleting'` status. The widget gains one button + one status mapping; nothing else moves.
- The OAuth-refresh cron from `server-cron-oauth-refresh`. Unrelated; BYOS writers will rely on it when they land.
- The StoragePicker UI honesty fix. Out of scope here. The Picker still says "Cloudflare R2 (managed by Baseout)" on this branch; the writer factory routes everything to local-fs regardless. That UX lie is `web-storage-picker-honesty`'s problem.
