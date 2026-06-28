## Why

When the schema is re-captured, bases/tables/fields that are no longer present in Airtable must be **marked removed** (kept for history, not deleted), and the default reads must exclude them so removed items don't clutter the UI — with an opt-in to include them. The lifecycle columns for this already exist (`system-per-space-db`: `status`, `first_unseen_run`); what's missing is the read-side default + include-removed behavior, and reaffirming the removal-marking on re-capture.

## What Changes

- **Reaffirm** that schema processing marks vanished bases/tables/fields `status = 'removed'` with `first_unseen_run` (the run that found them missing), retaining the row for history — and only on a confident full enumeration (a failed/partial run leaves them `unknown`, never falsely removed). *No new columns* — these exist in `system-per-space-db`.
- **Read API**: the schema read endpoints SHALL default to **active-only**; they SHALL accept an `include_removed` flag that additionally returns `removed` items (flagged with their removal run/date), so the UI can offer a "show deleted" filter.

## Capabilities

### New Capabilities
- `removed-item-filtering`: the removal-marking on schema re-capture (reaffirmed for bases/tables/fields) plus the read-API default-active / `include_removed` behavior.

### Modified Capabilities
<!-- Builds on the lifecycle columns (status / first_unseen_run / last_seen_run) already defined in the
     unarchived system-per-space-db change — no new columns; this adds read-side behavior. -->

## Impact

- **Per-Space DB**: no schema change — `status` + `first_unseen_run` already exist on `bo_at_bases/tables/fields` (`system-per-space-db`).
- **apps/server**: schema read endpoints default to active-only and accept `include_removed`.
- **apps/workflows**: ensure the `backup-base` schema step marks vanished bases/tables/fields `removed` (per `system-per-space-db`'s confident-enumeration rule).
- **UI**: paired ui-only change `deleted-items-filter`.
- **Cross-references**: `system-per-space-db` (lifecycle columns + removal rule), `server-schema-relationships` (analogous removed-link history), and the Browse / Health / Insights reads that consume the schema endpoints.
</content>
