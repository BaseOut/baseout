# admin-error-triage

## Why

Errors currently surface in the staff console only as columns scattered across five read surfaces (`/backups`, `/restores`, `/connections`, `/databases`, and per-run drill-ins). Answering "what's broken right now, for which customer, and has anyone looked at it?" requires visiting every page and keeping notes elsewhere — there is no single triage queue and no record of which errors staff have already handled. As the customer base grows, unacknowledged failures are the highest-risk support gap: a failed backup nobody noticed.

This change adds an `/errors` triage queue to `apps/admin` that aggregates every error signal already present in the master DB, groups it by Organization, links each item to the affected Space/Organization, offers the existing remediation actions inline, and records staff acknowledgements so handled errors are distinguishable from new ones.

## Relationship to other changes

Child of the deferred [`admin`](../admin/) umbrella, sibling of [`admin-read-surfaces`](../admin-read-surfaces/) (read surfaces this queue links into) and [`shared-admin-actions`](../shared-admin-actions/) (the audit foundation and the two actions reused here). The concurrent [`admin-operations-overview`](../admin-operations-overview/) change links to `/errors` with open-error counts on the dashboard — coordinate on the shared error-classification lib but neither change blocks the other (the dashboard degrades to linking the page without counts until this lands).

Scope guardrail (shared with all admin changes): **master DB only**. No per-Space DB access, no `*_enc` columns in the admin schema mirror. Error *messages* may quote base/table names — that metadata is in scope; record-level customer content is not.

## What Changes

- **New `/errors` page in `apps/admin`** aggregating five error sources from tables admin already mirrors:
  1. Failed backup runs — `backup_runs.status = 'failed'` (+ `error_message`)
  2. Failed bases inside non-failed runs — `backup_run_bases.status = 'failed'` where the parent run is not itself `failed` (partial failures otherwise invisible at run level)
  3. Failed restore runs — `restore_runs.status = 'failed'`
  4. Connections in error states — `status IN ('invalid', 'pending_reauth')` or `oauth_refresh_last_error` set on an `active|refreshing` connection
  5. Per-Space DB provisioning errors — `space_databases.status = 'error'` (+ `error_message`)

  Each item shows error type, message, affected Space and Organization (both linked), occurrence time, and current state. Items are grouped by Organization (newest first within a group), with filters for error type and acknowledged state.

- **New `admin_error_acks` table** (canonical schema + migration owned by `apps/web`, writable partial mirror in `apps/admin` — same ownership pattern as `admin_audit_log`). Append-only acknowledgement records keyed by `(target_type, target_id)` with denormalized actor snapshots (`acked_by_user_id`, `acked_by_email`) and an optional resolution note. Un-acking appends a superseding `phase='unack'` row — no UPDATE/DELETE path, matching the house append-only discipline.

- **Acknowledge / un-acknowledge actions** as new admin POST routes, recorded through the existing `runAudited()` intent/result pipeline (new `action` values `acknowledge_error` / `unacknowledge_error`) so the rate limiter, CSRF check, and audit trail apply uniformly.

- **Inline remediation reusing existing actions only**: failed-backup items expose the existing **Force backup** button; connection-error items expose the existing **Invalidate connection** button (for `pending_reauth`/stuck-refresh cases staff want to hard-fail). No new remediation action types in this change.

## Capabilities

### New Capabilities

- `admin-error-triage`: the aggregated `/errors` queue (five master-DB error sources, org-grouped, filtered, cross-linked) and the append-only acknowledgement workflow (`admin_error_acks` table, audited ack/un-ack actions, inline reuse of force-backup and invalidate-connection).

### Modified Capabilities

- None. `admin-actions` requirements are unchanged — ack/un-ack are new `action` string values through the existing `runAudited()` contract, which the `admin-actions` spec explicitly reserved room for (jsonb `params`, free-text `action`).

## Impact

- **apps/web**: `src/db/schema/core.ts` gains `adminErrorAcks`; one new migration (next sequential number after the latest at implementation time; `0027_admin_error_acks.sql` as of writing). No web runtime code change.
- **apps/admin**: new page `/errors` + error-classification lib; writable mirror of `admin_error_acks` (INSERT only); two new API routes (`/api/actions/acknowledge-error`, `/api/actions/unacknowledge-error`) through `runAudited()`; ack buttons + existing force-backup / invalidate-connection buttons on error rows. Reads only already-mirrored tables plus the new ack table.
- **apps/server / apps/workflows**: no change.
- **Security review points**: (1) two new mutation routes — same gate stack as existing actions (staff middleware, same-origin check, SameSite=Lax cookie, durable rate limit); (2) ack rows and audit `params` carry ids + note text only, never tokens/secrets/`*_enc` values; (3) resolution notes are staff-authored free text rendered with Astro auto-escaping — no `set:html`; (4) no new SQL surface beyond Drizzle parameterized queries.
