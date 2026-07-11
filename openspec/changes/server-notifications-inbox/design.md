# server-notifications-inbox — Design

Decisions for tasks 1.1/1.2, recorded 2026-07-10.

## Storage model (1.1)

**Triage state lives in the per-Space schema** (engine-owned), not the master
DB: the feed derives per Space, the ids it acknowledges are per-Space facts,
and the engine owns per-Space DDL end-to-end (`@baseout/db-schema/space`
bundled idempotent DDL + `SPACE_SCHEMA_VERSION` bump + lazy
`ensureSpaceSchemaCurrent`). Two tables:

- `bo_at_inbox_state` — `item_id text PK`, `read bool`, `done bool`,
  `snoozed_until timestamptz NULL`, `updated_at`. One row per triaged item;
  absence = untouched.
- `bo_at_inbox_mutes` — `base_id text PK`, `created_at`. Mute is per-base per
  the web spec (`Mute this base`).

**Triage is account-shared in V1** (no per-user dimension): the Inbox is
account-level and the panel's semantics (done/snooze on operational alerts)
read naturally as team state. Per-user read-state is a documented follow-up —
the PK grows a `user_id` column and the web proxy starts passing the caller.

## Aggregation (1.1)

The engine route stays **per-Space**; web fans out across the account's
Spaces (typically 1–2) in parallel at SSR time and labels rows with the Space
name (the web spec's account-level requirement). No account-scoped aggregate
route until fan-out measurably hurts.

## Alert kinds + sources (1.2)

Derivation, not a mailbox: `GET` recomputes from live sources and merges
triage state. Deterministic ids make triage idempotent.

| kind (web `InboxKind`) | lane | source | id | state-backed |
|---|---|---|---|---|
| `connection-broken` | attention | mirrored `connections` rows with status in (`invalid`,`expired`,`revoked`) for the Space | `conn:<connectionId>` | YES — row exists only while status is broken; self-heals |
| `backup-failed` | attention | mirrored `backup_runs` status=`failed` | `run:<runId>` | no — acknowledge-based |
| `schema-breaking` | attention | per-Space changelog rows with `breaks_data` | `schema:<updateId>` | no |
| `backup-ok` | activity | `backup_runs` status=`succeeded` | `run:<runId>` | no (web rolls up per base) |
| `schema-changed` | activity | changelog rows without `breaks_data` | `schema:<updateId>` | no |

**Deferred kinds** (documented, not built): `health-drop` (needs the web-spec
§3.6 debounce; health scoring is per-base and re-grades every run — naive
derivation would flap), `automation-off`, `interface-unpublished`, `chat-doc`
(no backends). The derive module's kind table is the extension point.

Window: the feed reads the most recent 30 days, capped at 200 rows per Space
before triage-merge (the web panel rolls up and paginates visually; a feed
longer than that is noise). Muted bases drop `activity`-lane rows only —
attention rows ignore mutes by web-spec rule ("unable to hide an attention
row").

## Routes

- `GET /api/internal/spaces/:spaceId/notifications` → `{ ok, items: InboxItemView[] }`
  matching web `InboxItem` (title copy composed engine-side with the `*bold*`
  marker convention; `href` deep-links: run → `/backups/runs/<id>`, schema →
  `/schema?tab=changelog`, connection → `/integrations`). Per-base rows also
  carry `baseId` — the web mute key (added 2026-07-10 during the web binding;
  without it the client mute can't address `bo_at_inbox_mutes`).
- `POST /api/internal/spaces/:spaceId/notifications/triage`
  `{ itemId, action: 'read'|'unread'|'done'|'undone'|'snooze'|'unsnooze', snoozedUntil? }` —
  idempotent upsert; **`done` on a state-backed id (`conn:*`) is rejected 422**
  (web spec: state-backed rows self-heal and offer no Mark done).
- `POST /api/internal/spaces/:spaceId/notifications/mute`
  `{ baseId, muted: boolean }` — idempotent.

All under the existing `INTERNAL_TOKEN` middleware gate; registered in
`index.ts` by regex like the schema-changelog route.

## Web binding (handoff — web-notifications-inbox §5.1)

`backup-engine.ts` client gains `getNotifications` / `triageNotification` /
`muteNotificationBase` + the `InboxItemView` type (the same mirrored-view
pattern as `ChangelogEntryView`). `SidebarLayout` SSR fans out across the
account's Spaces and passes merged, Space-labelled items to `<Inbox>`; web
proxy routes under `/api/inbox/*` carry the panel's triage actions
(middleware-authed, engine token stays server-side). Feed failures degrade to
the designed empty state — never block a page render.
