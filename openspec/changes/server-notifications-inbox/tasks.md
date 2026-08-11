# server-notifications-inbox — tasks

## Status

ENGINE BUILT — 2026-07-10. §1–§3 implemented (derive + io modules, three
routes, per-Space triage tables at `SPACE_SCHEMA_VERSION` 6). §4.1 web
handoff remains. Unblocks `web-notifications-inbox` §5.

## 1. Design

- [x] 1.1 Decide the triage-state storage model (per-Space schema vs master DB) and the account-level aggregation stance (web fan-out vs an aggregate route); record in `design.md`.
- [x] 1.2 Pin the alert-kind derivation sources: `backup_runs` (failed/succeeded), connection status (state-backed), schema changelog (breaking / non-breaking), health score (state-backed, debounced per web §3.6).

## 2. Read feed — TDD

- [x] 2.1 RED: pure derivation module tests — kind mapping, `stateBacked` flags, deep-link targets, triage-state merge.
- [x] 2.2 GREEN: `GET /api/internal/spaces/:spaceId/notifications` (`INTERNAL_TOKEN`-gated), returning the web `InboxItem` shape.

## 3. Triage mutations — TDD

- [x] 3.1 RED: route tests — read/unread, done, snooze-until, mute-per-base; idempotent; done rejected for state-backed kinds (they self-heal, per the web spec).
- [x] 3.2 GREEN: mutation routes + persistence.

## 4. Handoff

- [x] 4.1 Cross-check the payload contract against `apps/web/src/components/layout/inbox.ts` (`InboxItem`) and hand off to `web-notifications-inbox` §5.1–5.2 for the web binding.
