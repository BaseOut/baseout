# admin-error-triage — design

## Context

`apps/admin` already mirrors every table that carries an error signal (`backup_runs`, `backup_run_bases`, `restore_runs`, `connections`, `space_databases`) and has a proven mutation stack from `shared-admin-actions` (`runAudited()` intent/result audit, durable rate limiter, same-origin CSRF, confirmation dialogs). What's missing is aggregation (one queue instead of five pages) and state (who has looked at what). The precedent to copy for the schema addition is `admin_audit_log`: canonical table + migration in `apps/web` (which owns all master-DB migrations), writable partial mirror in `apps/admin`, append-only by app discipline plus a guard test.

Hard scope rule inherited from the admin change family: master DB only, no per-Space DB clients, no `*_enc` columns in admin's mirror. Error messages quoting base/table names are metadata and in scope; record content is not reachable from the master DB at all.

## Goals / Non-Goals

**Goals:**

- One `/errors` page answering "what's broken, for whom, and has anyone handled it?"
- Acknowledgement state that survives staff shift changes, with an audit trail
- Remediation reachable from the queue without inventing new action types

**Non-Goals:**

- No alerting/paging (email, Slack) — a future change can poll the same classifier
- No error-log *search* (Logpush/R2 indexer stays deferred in the `admin` umbrella)
- No auto-resolution heuristics (e.g. hiding a failed run because a later run succeeded) in V1 — staff acks are the only state transition; see Open Questions
- No new remediation actions; no changes to `admin-actions` semantics

## Decisions

### 1. Classification in TypeScript over five typed queries — not one SQL UNION

The page issues five parallel Drizzle queries (one per source), each already scoped and indexed (`backup_runs_status_idx`, `idx_restore_runs_space_status`, etc.), then a pure lib (`src/lib/errors.ts`) normalizes rows into one `ErrorItem` shape (`{ type, targetType, targetId, orgId, orgName, spaceId, spaceName, message, occurredAt, state, links }`) and merges/groups/sorts them.

*Why not a SQL `UNION ALL`?* The sources have incompatible shapes (per-base rows need a parent-run join; connections have three error variants with different message columns), and a pure normalizer is unit-testable the same way `admin-read-surfaces` libs are. Row volumes are staff-console-sized (bounded by `LIMIT` per source, default 200 each), so in-memory merge is fine.

*Occurrence time per source:* run failures use `completed_at ?? modified_at`; connection errors use `invalidated_at` / `pending_reauth_at` / `modified_at` per variant; DB errors use `modified_at`.

### 2. Ack targets are `(target_type, target_id)` of the source row

`target_type ∈ ('backup_run', 'backup_run_base', 'restore_run', 'connection', 'space_database')`, `target_id` = the source row's UUID. Natural consequence: a *new* failed run is a new target (unacknowledged), while a connection that stays broken remains one acknowledged item until its status changes. For connections — the only source whose row *mutates* rather than accumulating — the classifier includes a `state_fingerprint` (e.g. `invalid`, `pending_reauth`, or the `oauth_refresh_last_error` text hash) in the item, and an ack row stores it in `note`-adjacent column `target_state`; an ack only suppresses the item while the fingerprint matches, so a connection that breaks *differently* resurfaces. Alternative considered: acking `(connection_id)` unconditionally — rejected because a re-broken connection would stay silently hidden.

### 3. Append-only ack table with `phase` rows — no UPDATE

```sql
CREATE TABLE baseout.admin_error_acks (
  id                text PRIMARY KEY DEFAULT gen_random_uuid(),
  phase             text NOT NULL DEFAULT 'ack',        -- 'ack' | 'unack'
  target_type       text NOT NULL,
  target_id         text NOT NULL,
  target_state      text,                               -- connection fingerprint; NULL for run/db targets
  organization_id   text,
  acked_by_user_id  text NOT NULL,                      -- denormalized, no FK (survives user deletion)
  acked_by_email    text NOT NULL,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  db_user           text NOT NULL DEFAULT current_user,
  application_name  text DEFAULT current_setting('application_name', true),
  txid              bigint NOT NULL DEFAULT txid_current()
);
CREATE INDEX admin_error_acks_target_idx ON baseout.admin_error_acks (target_type, target_id, created_at);
CREATE INDEX admin_error_acks_org_idx ON baseout.admin_error_acks (organization_id, created_at);
```

Effective state = latest row's `phase` per `(target_type, target_id[, target_state])`. Same append-only discipline as `admin_audit_log`: no UPDATE/DELETE call sites, enforced by a guard test; DB-role enforcement stays deferred with the umbrella. Canonical Drizzle definition in `apps/web/src/db/schema/core.ts`, migration is the next sequential file after the latest at implementation time (`0027_admin_error_acks.sql` as of writing — renumber if another change lands first); mirror in `apps/admin/src/db/schema/core.ts` with the standard header comment, no FKs, INSERT+SELECT usage only.

*Why not reuse `admin_audit_log` alone as the ack store?* Deriving "is item X acked" would mean scanning audit `params` jsonb — unindexed, and it couples queue-state queries to audit-log retention. A dedicated narrow table keeps the audit log pure history and the ack lookup a two-column index hit. The audit rows still exist (Decision 4) as the *who-did-what* record.

### 4. Ack/un-ack go through `runAudited()` — consistency over minimalism

A plain INSERT would technically suffice (acks are low-risk metadata), but going through `runAudited()` keeps one invariant the whole console can rely on: *every* staff mutation produces intent/result audit rows, is rate-limited, and is CSRF-checked — no second mutation pathway to reason about in security review. Cost: two extra audit rows per ack; acceptable at staff volumes. Audit `params` carry `{ targetType, targetId, hasNote }` — the note body lives only in `admin_error_acks`, so the audit log never duplicates free text.

### 5. Remediation buttons are the existing components, re-hosted

Force-backup and invalidate-connection buttons on error rows submit to the **existing** routes (`/api/actions/force-backup`, `/api/actions/invalidate-connection`) with their existing confirmation dialogs — the page imports the same UI as the tracker and `/connections`. Zero new engine surface; the `BACKUP_ENGINE` binding degradation notes carry over unchanged.

### 6. Coordination with `admin-operations-overview`

The dashboard change wants open-error counts. Contract: this change exports the classifier lib's count query (`countOpenErrors(db): Promise<{ total, byType }>`, acks applied). If the dashboard lands first it links to `/errors` without counts; whichever lands second wires the import. Neither blocks the other.

## Risks / Trade-offs

- [Connection ack fingerprint too coarse — `oauth_refresh_last_error` text may vary per attempt, resurfacing acked items] → hash only the error *class* prefix (text before the first `:`), documented in the lib; worst case is a re-surfaced item, never a hidden one. Fail-open toward visibility.
- [Five queries × 200 rows could still render a huge page for a bad night] → org-group pagination (`?page=`) and per-source `LIMIT` with a "truncated" banner when any source hits its cap — silent truncation is worse than a noisy banner.
- [Ack table grows unboundedly] → rows are tiny and append-only; retention rides the umbrella's audit-retention decision (24-month + R2 archive) rather than inventing a separate policy here.
- [Two changes touching web migrations concurrently (this and `shared-service-runs`)] → migration numbers assigned at implementation time, not in specs; tasks call out re-checking `drizzle/` before generating.

## Migration Plan

1. Land web schema + migration (`pnpm db:generate` → `pnpm db:migrate` in `apps/web`) — additive table, no backfill, zero customer impact.
2. Land admin mirror + lib + page + routes; deploy `baseout-admin-dev` via the existing pipeline.
3. Rollback: revert admin deploy (page disappears); the ack table can stay — additive and inert.

## Open Questions

- Should a failed run item auto-clear when a newer run for the same Space succeeds? Deferred: V1 keeps human acks as the only transition (predictable queue), revisit once real usage shows noise level.
- Retention for `admin_error_acks` follows the umbrella's audit-retention decision when that lands.
