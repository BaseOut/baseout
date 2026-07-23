## Overview

Pull-based change detection on a per-Space cadence. The chain: A (schema) → C (SpaceDO polling) → D (run plumbing) → E (lifecycle). The receiver lives in `apps/hooks` (change `hooks`); the task body lives in `apps/workflows` (change `workflows-instant-webhook`); UI lives in `apps/web` (change `web-instant-webhook`).

Two architectural calls anchor everything:

1. **Dirty-flag registry, not event delivery.** Airtable pings carry no data; payloads are pulled from a client-held cursor and retained 7 days. So hooks records "changes waiting" as one timestamp (`airtable_webhooks.last_ping_at`) and each Space discovers dirty bases by comparing that against its own `last_polled_at` watermark. There is no per-event row, no queue, no forward hop. A lost ping is recovered by the next ping or the daily safety sweep; nothing is lost permanently because the cursor replays the payload log.

2. **Org-level webhooks, per-Space subscriptions.** Airtable allows 2 webhooks per base per OAuth integration — Baseout is one integration, so per-Space webhooks can't work. One webhook per `(organization, base)` (UNIQUE constraint), fan-out via `airtable_webhook_subscriptions`, each subscription holding its own `payload_cursor`. Airtable cursors are plain transaction numbers passed on each list call, so N Spaces read one payload stream independently at different cadences. **No shared "processed" flag exists** — processed-ness is per-Space (watermark + cursor).

## Phase A — Schema

```sql
CREATE TABLE baseout.airtable_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),        -- also the notificationUrl path token
  organization_id uuid NOT NULL REFERENCES baseout.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES baseout.connections(id),
  base_id text NOT NULL,
  airtable_webhook_id text NOT NULL UNIQUE,
  mac_secret_base64_enc text NOT NULL,
  status text NOT NULL DEFAULT 'active',                -- active | notifications_disabled | pending_reauth | inactive
  expires_at timestamp with time zone,
  last_ping_at timestamp with time zone,
  last_ping_source_ip text,
  last_renewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  UNIQUE (organization_id, base_id)
);
CREATE INDEX airtable_webhooks_last_ping_idx ON baseout.airtable_webhooks (last_ping_at);
CREATE INDEX airtable_webhooks_expiry_idx ON baseout.airtable_webhooks (expires_at) WHERE status = 'active';

CREATE TABLE baseout.airtable_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES baseout.airtable_webhooks(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  payload_cursor bigint NOT NULL DEFAULT 1,
  last_polled_at timestamp with time zone,
  last_reconciled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now(),
  UNIQUE (webhook_id, space_id)
);
CREATE INDEX airtable_webhook_subscriptions_space_idx ON baseout.airtable_webhook_subscriptions (space_id);

ALTER TABLE baseout.backup_configurations
  ADD COLUMN webhook_poll_interval_seconds integer NOT NULL DEFAULT 900;
```

Canonical migration lands in `apps/web/drizzle/` (master-DB schema is web-owned); engine mirrors in `apps/server/src/db/schema/` with header comments naming the source. The previously-planned `webhook_events` table is dropped from the design entirely.

## Phase C — SpaceDO cadence polling

The dirty-check query, run by the SpaceDO alarm handler against the master DB (the DO already holds master-DB access; **no new endpoint anywhere** — hooks writes the table, server reads it):

```sql
SELECT s.id AS subscription_id, s.payload_cursor, s.last_reconciled_at,
       w.id AS webhook_id, w.base_id, w.connection_id, w.status
FROM baseout.airtable_webhook_subscriptions s
JOIN baseout.airtable_webhooks w ON w.id = s.webhook_id
WHERE s.space_id = $spaceId
  AND (
    w.last_ping_at > COALESCE(s.last_polled_at, 'epoch')                  -- dirty
    OR COALESCE(s.last_polled_at, 'epoch') < now() - interval '24 hours'  -- safety sweep
  );
```

Alarm handling reuses the single-alarm min-dispatch pattern from `server-schedule-and-cancel`:

```
storage: { next_cron_fire_ms, next_webhook_poll_ms }
setAlarm(min(next_cron_fire_ms, next_webhook_poll_ms))
alarm(): fire whichever is due; recompute; re-set to the new min.
next_webhook_poll_ms = now + webhook_poll_interval_seconds*1000 + jitter(0..10% of interval)
```

Jitter prevents thundering-herd on the master DB when thousands of Spaces share an interval. Per dirty subscription: skip if a webhook-triggered run for that (space, base) is already in-flight (`backup_runs` check), else INSERT `backup_runs (triggered_by='webhook', status='queued')` and enqueue `incremental-backup` with `{ runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile: <bool> }`. `reconcile=true` when `last_reconciled_at` is older than the reconciliation cadence (default 7 days) — the task then runs the `modifiedTime` catch-all after the payload pass. Set `last_polled_at = now()` at enqueue; a ping racing in during processing lands `last_ping_at > last_polled_at`, so the next tick re-polls — nothing is missed.

**Watermark semantics**: `last_polled_at` answers "have I looked since the last ping?" — it does NOT track processing success. Processing progress is the cursor, advanced only after payload batches durably apply. A failed run leaves the cursor put; the next poll re-reads the same payloads idempotently.

**Escape hatch if per-Space polling ever gets heavy**: invert to one central scanner cron reading dirty rows once a minute and ticking only due SpaceDOs — one query instead of N. No schema or receiver change required; deferred until load says otherwise.

## Phase D — Run plumbing

- `POST /api/internal/webhook-subscriptions/:id/cursor` `{ cursor }` — task callback; sets `payload_cursor` (monotonic guard: never decrease).
- `POST /api/internal/webhook-subscriptions/:id/fallback` `{ reason }` — task gap signal; enqueues a full `backup-base` run for the base, stamps `last_reconciled_at`, resets `payload_cursor` to the latest cursor returned by Airtable.
- Both `INTERNAL_TOKEN`-gated per CLAUDE.md §5.2.

## Phase E — Lifecycle

**Enable (find-or-create):**

```
row = SELECT ... WHERE organization_id=$org AND base_id=$base AND status != 'inactive'
if row: INSERT subscription (webhook_id=row.id, space_id) ON CONFLICT DO NOTHING
else:
  id = gen uuid
  resp = POST /v0/bases/$base/webhooks {
    notificationUrl: "https://hooks.baseout.com/webhooks/airtable/" + id,
    specification: { options: {
      filters: { dataTypes: ["tableData","tableFields","tableMetadata"] },
      includes: { includeCellValuesInFieldIds: "all",
                  includePreviousCellValues: true,
                  includePreviousFieldDefinitions: true } } }
  INSERT airtable_webhooks (id, ..., mac_secret_base64_enc = encrypt(resp.macSecretBase64),
                            airtable_webhook_id = resp.id, expires_at = resp.expirationTime)
  INSERT subscription
```

The MAC secret is returned **only** in the create response — encrypt and persist before anything else can fail. If the Airtable create succeeds but our INSERT fails, delete the Airtable webhook (compensating action) rather than leaking an orphan we can't verify.

**Disable**: DELETE subscription; if none remain for the webhook → Airtable DELETE + `status='inactive'` (row retained for audit; receiver 410s its pings).

**Cap hit**: Airtable enforces 2 webhooks per base per OAuth integration (10 per base overall). On the create failing with the cap error, surface `{ error: 'airtable_webhook_cap_reached' }` — the UI explains that this base is already webhook-connected by the maximum number of organizations.

**Connection invalid/revoked**: registry rows with that `connection_id` → `status='pending_reauth'`. On reconnect, attempt refresh with the new token; if Airtable 404s the webhook, re-create (new row id, new URL, new secret) and re-point subscriptions. **Implementation-time verification**: whether a different same-org Connection's token can refresh/poll a webhook created by another token (docs ambiguous — webhook management is scoped to the OAuth integration + base access). If yes, prefer re-pointing `connection_id` to an active Connection over re-creating.

**Rate limits**: every Airtable call (create, delete, refresh, payload polls) goes through the per-Connection ConnectionDO gateway; the shared 5 rps per-base budget covers payload polling AND snapshot backups AND schema reads together.

## Wire shapes

| Direction | Path | Verb | Body | Notes |
|---|---|---|---|---|
| Airtable → apps/hooks | `/webhooks/airtable/{row_id}` | POST | ping `{base, webhook, timestamp}` | HMAC-verified; `hooks` change |
| hooks → master DB | `airtable_webhooks` upsert | — | `last_ping_at`, `last_ping_source_ip` | the cross-app contract is the table shape |
| SpaceDO → master DB | dirty-check query | — | see Phase C | direct read; no HTTP hop |
| SpaceDO → Trigger.dev | `incremental-backup` enqueue | — | `{runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile}` | |
| task → engine | `/api/internal/webhook-subscriptions/:id/cursor` | POST | `{cursor}` | monotonic |
| task → engine | `/api/internal/webhook-subscriptions/:id/fallback` | POST | `{reason}` | enqueues full backup-base |
| engine → Airtable | `/v0/bases/:b/webhooks[...]` | POST/DELETE | create/delete/refresh | via ConnectionDO gateway |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | Dirty-check predicate (dirty / clean / safety-sweep-due / never-polled). |
| Pure | Find-or-create decision (existing row, inactive row, no row, cap error mapping). |
| Integration | SpaceDO poll alarm: dirty subscription → run row + enqueue; in-flight skip; watermark race (ping during processing → re-poll next tick). Use `runInDurableObject`. |
| Integration | Lifecycle routes: enable creates webhook + subscription; second Space enabling same base reuses; disable of last subscription deletes; cap error surfaced; compensating delete on INSERT failure. |
| Integration | Cursor callback monotonic guard; fallback callback enqueues full run. |
| Smoke | Real Airtable webhook in a dev base: change a record → ping dirty-marks → next poll tick enqueues → incremental run applies the change. |

## Operational concerns

- **Ping-loss tolerance**: safety sweep polls every subscription at least daily regardless of dirty state; gap detection (cursor beyond 7-day payload retention) falls back to full re-read. The ping chain is never the only line of defense.
- **`notifications_disabled` recovery**: owned by `server-cron-webhook-renewal` (toggle-notifications endpoint; catch-up rides the cursors, not the pings).
- **Registry data residency**: master DB holds base IDs, webhook IDs, timestamps, encrypted secret — no customer record data. Payload content flows Airtable → task → per-space DB directly.
- **Cursor drift**: cursor advances only after a payload batch durably applies; retries are idempotent (UPSERT/DELETE semantics in the task).
- **PRD sync**: PRD §2.5's "coalesce + debounce 5 minutes or 100 events" description is superseded by cadence polling; note in Phase G doc sync.

## Implementation notes — Phases C–E as built (2026-07-23)

- **Run kind**: webhook poll runs INSERT with **`kind='incremental'`** (not the
  `full` default) — a cursor-driven payload apply is neither a full snapshot
  nor a schema-only capture, and the Phase D fallback needs to insert a
  distinguishable **`kind='full'`** re-read for the same base. `kind` is plain
  text with app-level values, so this is additive; the ⚡ badge handling lands
  in `web-instant-webhook`. The SpaceDO also flips the row to `running` +
  `trigger_run_ids=[<task handle>]` at enqueue so the standard `/complete`
  idempotency and the reconciliation sweep cover incremental runs unchanged.
- **In-flight guard**: implemented as DO storage (`webhook_inflight`:
  `{baseId: runId}`) reconciled against `backup_runs.status` each tick —
  master `backup_runs` has no base column and `backup_run_bases` rows only
  exist at completion, so a pure-DB per-(space, base) check wasn't possible.
  The DO is the only writer of webhook runs for its Space, so the map is
  authoritative; queued/running = in flight, terminal/missing = pruned.
- **Arming**: new DO surface `POST /set-webhook-polling { enabled }` (called
  by the Phase E register/unregister routes). `alarm()` additionally
  self-arms whenever the config says `frequency='instant'` and drops the poll
  state when it doesn't — DO-storage drift can pause polling for at most one
  tick. `/set-frequency` re-arming now mins against a stored poll fire.
- **Paused webhooks**: the poll lane skips subscriptions whose webhook row is
  `pending_reauth`/`inactive` (dead token / retired) without stamping the
  watermark; `notifications_disabled` still polls — Airtable keeps generating
  payloads while pings are muted and the renewal cron re-enables them.
- **Fallback's "Airtable's latest cursor"**: `cursorForNextPayload` from the
  list-webhooks endpoint (`GET /v0/bases/:b/webhooks`), fetched with the
  webhook's Connection token via the ConnectionDO `/token` gate. Best-effort:
  when it can't be fetched the full re-read + `last_reconciled_at` stamp still
  land and the response says `cursorReset:false`; the next poll re-signals if
  the stream is still unreadable.
- **Inactive-row recreate**: an `inactive` row still holds the UNIQUE
  (organization, base) slot, so re-enable DELETEs the dead row (its
  subscriptions are gone by definition — inactive is set on last-unsubscribe)
  and creates fresh, rather than mutating the PK that doubles as the
  notificationUrl token.
- **E.7 (cross-Connection webhook management), docs-based answer**: Airtable
  scopes webhook visibility/management to the **OAuth integration** ("webhooks
  are only manageable by tokens of the integration that created them"), not to
  the individual authorizing token — so any same-org Baseout Connection with
  access to the base is expected to refresh/poll another Connection's webhook,
  favoring re-pointing `connection_id` over re-creating on reconnect. NOT yet
  smoke-verified with two live Connections; the reconnect re-point automation
  waits on that.
- **Known cross-change gap**: `incremental-backup.task.ts`'s completion POST
  (`created/updated/deleted/reconciledRecords/...`) doesn't parse against the
  current `/runs/:runId/complete` body validator (`tablesProcessed/...`
  required) — widening that contract is `workflows-instant-webhook` territory.

## What this design deliberately doesn't change

- The scheduled snapshot path and its cron alarm logic (the webhook poll is a second alarm state in the same min-dispatch).
- The dynamic-DB write path (`server-dynamic-mode` owns it).
- The OAuth Connection model (webhooks reference a Connection; Connection state machine unchanged).
- The run state machine (`backup_runs`) — webhook runs are ordinary rows with `triggered_by='webhook'`.
