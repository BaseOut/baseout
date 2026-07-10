# server-notifications-inbox — tasks

## Status

PROPOSED — placeholder for scheduling; nothing implemented. Unblocks
`web-notifications-inbox` §5 when built.

## 1. Design

- [ ] 1.1 Decide the triage-state storage model (per-Space schema vs master DB) and the account-level aggregation stance (web fan-out vs an aggregate route); record in `design.md`.
- [ ] 1.2 Pin the alert-kind derivation sources: `backup_runs` (failed/succeeded), connection status (state-backed), schema changelog (breaking / non-breaking), health score (state-backed, debounced per web §3.6).

## 2. Read feed — TDD

- [ ] 2.1 RED: pure derivation module tests — kind mapping, `stateBacked` flags, deep-link targets, triage-state merge.
- [ ] 2.2 GREEN: `GET /api/internal/spaces/:spaceId/notifications` (`INTERNAL_TOKEN`-gated), returning the web `InboxItem` shape.

## 3. Triage mutations — TDD

- [ ] 3.1 RED: route tests — read/unread, done, snooze-until, mute-per-base; idempotent; done rejected for state-backed kinds (they self-heal, per the web spec).
- [ ] 3.2 GREEN: mutation routes + persistence.

## 4. Handoff

- [ ] 4.1 Cross-check the payload contract against `apps/web/src/components/layout/inbox.ts` (`InboxItem`) and hand off to `web-notifications-inbox` §5.1–5.2 for the web binding.
