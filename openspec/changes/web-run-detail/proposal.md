# web-run-detail

## Problem

`apps/web/src/pages/backups/run.astro` renders `BackupRunDetailView` with
`metricsPending={true}` and `bases: []`. The per-base breakdown table shows a
placeholder ("Per-base breakdown isn't captured by the backup engine yet.")
even though the engine now exposes a real detail endpoint
(`GET /api/internal/runs/:runId/detail`) shipped in `server-run-detail`
(commit 050c396). The per-base drill-down page (`/backups/run/base`) also has
no production route — it exists only as a design harness fixture at
`apps/design/src/pages/backups/run/base.astro`.

## Solution

1. **`getRunDetail(runId)`** — Add to `BackupEngineClient` + `createBackupEngine`
   in `apps/web/src/lib/backup-engine.ts`. Calls
   `GET /api/internal/runs/:runId/detail` via the `BACKUP_ENGINE` service binding.
   Returns a typed success (`{ ok: true; bases: EngineRunDetailBase[] }`) or a
   typed error. Legacy/empty runs return a valid 200 with `bases: []`.

2. **`run.astro` wiring** — Fetch the detail inline in the existing SSR page
   (matching the pattern `run.astro` already uses: load run row from DB, then
   augment). Map engine `bases[]` → view's `BaseRun[]`. Set
   `metricsPending={false}` when `bases.length > 0`; keep `metricsPending={true}`
   for legacy/empty runs so the placeholder still shows. No extra web route needed
   — the engine call is made from `Astro.locals` (`BACKUP_ENGINE` binding) exactly
   as `cancel.ts` constructs the engine client.

3. **`/backups/run/base` production page** — New SSR page at
   `apps/web/src/pages/backups/run/base.astro`. Reads `?run=<runId>&base=<atBaseId>`
   from query string, verifies the run belongs to the authenticated space (IDOR
   guard mirrors `cancel.ts`), fetches the engine detail, filters to the requested
   base, renders `BackupRunBaseView` with real `tables[]`. Redirects to `/backups`
   on bad input.

## Engine contract (server-run-detail)

```
GET /api/internal/runs/:runId/detail
→ { bases: Array<{
     atBaseId, baseName, status, tablesCount, recordsCount, attachmentsCount,
     startedAt, completedAt, errorMessage,
     tables: Array<{ tableId, tableName, recordCount, fieldCount, attachmentCount }>
   }> }
```

Empty `bases: []` for legacy runs (valid 200).

## Snapshot gaps — defaulted fields

`BackupRunBaseView.BaseDetail` has fields the engine snapshot does not include:

| View field | Engine snapshot | Default |
|---|---|---|
| `fields` (per table) | `fieldCount` (in tables[]) | use `fieldCount` directly |
| `views` (per table) | not in snapshot | `0` |
| `destKind` | not per-base | inferred from run-level `storageType` |
| `folder` / `folderUrl` / `dbRef` | not in snapshot | `null` |
| `recordsRemaining` / `attachmentsRemaining` | not in snapshot | `null` |
| `failed` (attachment count) | not in snapshot | `0` |
| `failedAttachments` | not in snapshot | `[]` |
| `depth` (per base) | not in snapshot | inferred from run-level depth |
| `destProvider` / `destIcon` | not per-base | from run-level |

## Scope

- apps/web only (single-app change).
- No DB migrations (read-only page, no new columns).
- No new external dependencies.
- Cross-reference: `server-run-detail` (engine endpoint, commit 050c396).
