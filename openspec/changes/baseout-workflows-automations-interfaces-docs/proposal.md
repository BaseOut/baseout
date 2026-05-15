## Why

Workflows-side counterpart to [`baseout-server-automations-interfaces-docs`](../baseout-server-automations-interfaces-docs/proposal.md). The server-side change extends the master DB with automation / interface / extension metadata captured during a backup run, and writes the per-Base docs blob. This change owns the workflows-side finalization step in `backup-base.task.ts` that collects the metadata and POSTs it to the engine.

## What Changes

- Add a finalization step in `apps/workflows/trigger/tasks/backup-base.task.ts` (or a new dedicated `finalize-base-docs` task) that, after all table CSVs have landed, gathers the Airtable Base's automation list, interface list, and extension list via the Airtable Metadata API.
- POST the gathered blob to a new engine internal endpoint owned by the server-side sibling (TBD route — see `baseout-server-automations-interfaces-docs`). Engine persists the blob to the appropriate DB columns.
- Vitest coverage for the new fetch + POST step.

## Out of Scope

- Master DB columns for automation / interface / extension docs — server-side.
- The `/api/internal/runs/:runId/docs` route handler — server-side.
- Rendering the docs blob in apps/web — separate apps/web change.
