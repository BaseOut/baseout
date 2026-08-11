# server-notifications-inbox — Engine-brokered alert feed for the web Inbox

## Status

PROPOSED — 2026-07-10, placeholder for scheduling. Filed as the paired backend
change for `web-notifications-inbox` (its §5 integration tasks are blocked on
this). Nothing here is implemented; the web Inbox currently mounts with an
empty feed and its designed zero-states.

## Why

`web-notifications-inbox` shipped the Inbox panel (sidebar trigger, two lanes,
rollups, triage) with **no data source** — the fixture feed exists only in the
design harness. The signals the panel exists for (backup failed, connection
broken, breaking schema change, health drop, backup succeeded, schema changed)
are all engine-side facts: `backup_runs` state, connection status, the schema
changelog. The engine therefore brokers the feed the same way it brokers schema
reads — web never derives alerts client-side.

## What Changes

- **Read feed**: `GET /api/internal/spaces/:spaceId/notifications` —
  `INTERNAL_TOKEN`-gated, returns alert rows matching the web `InboxItem` shape
  (kind, title/detail, base, timestamp, deep-link, read/done/snooze state,
  `stateBacked` for kinds bound to live state). The Inbox is account-level, so
  web fans out across the account's Spaces (or a follow-up adds an
  account-scoped aggregate — decided at design time, not here).
- **Triage mutations**: read/unread, done, snooze-until, mute-per-base —
  narrow `POST` routes under the same prefix, idempotent.
- **Derivation, not a mailbox**: state-backed kinds (connection-broken,
  health-drop) are derived from live state so they self-heal per the web spec;
  event kinds (backup-failed, schema-breaking) are rows with acknowledge state.
- **Web wiring is NOT here**: binding the panel to this feed, the guarded web
  proxy, and clearing the connection-health banner on resolve stay in
  `web-notifications-inbox` §5.

## Capabilities

### New Capabilities

- `notifications-feed`: engine-brokered alert read feed + triage state, serving
  the web Inbox (`web-notifications-inbox`).

## Impact

- `apps/server/src/pages/api/internal/spaces/[spaceId]/notifications*` (new
  routes), a pure derivation module + persistence for triage state (storage
  model — per-Space tables vs master DB — is a design-time decision), tests.
- No web change in this proposal; cross-reference `web-notifications-inbox` §5
  (5.1 feed binding, 5.2 banner clearing, 5.3 settings page).
