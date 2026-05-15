## Overview

Seven phases. The critical-path chain: A (schema) → B (receiver in apps/hooks) → C (SpaceDO coalescing) → D (incremental run path) → E (webhook lifecycle). F (UI) + G (docs) layer on top.

Architectural call: **the webhook flow uses two separate apps** — `apps/hooks` receives + verifies + dedupes; `apps/server` coalesces + runs the incremental backup. This matches the existing repo layout and lets the hooks app stay narrow (HMAC + forward; never touches the dynamic DB).

The other architectural call: **SpaceDO gets two parallel alarm states** — one for cron-fire (scheduled snapshots, owned by `baseout-backup-schedule-and-cancel`) and one for webhook-debounce-fire (this change). They're stored as different alarm keys via the DO's storage. Care needed: Cloudflare DO supports only one alarm at a time per DO. So either:

1. **Single alarm, dispatch on fire**: store both `next_cron_fire_ms` and `next_webhook_fire_ms`; set the alarm to `min(cron, webhook)`; on fire, check which condition triggered.
2. **Two DOs per Space**: split into `SpaceCronDO` + `SpaceWebhookDO`.

Recommended: **option 1**. Simpler topology; the alarm-handler branches based on which condition fired (its own state). Both states are stored in DO storage; alarm-fire logic reads both, decides which to process, then resets the alarm to the minimum of any remaining fires.

## Phase A — Schema

```sql
CREATE TABLE baseout.airtable_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES baseout.connections(id) ON DELETE CASCADE,
  base_id text NOT NULL,
  space_id uuid NULL REFERENCES baseout.spaces(id) ON DELETE SET NULL,
  airtable_webhook_id text NOT NULL UNIQUE,
  mac_secret_base64_enc text NOT NULL,
  cursor bigint NOT NULL DEFAULT 0,
  last_event_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now()
);
CREATE INDEX airtable_webhooks_space_id_idx ON baseout.airtable_webhooks (space_id);

CREATE TABLE baseout.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES baseout.airtable_webhooks(id) ON DELETE CASCADE,
  payload_cursor bigint NOT NULL,
  received_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone NULL,
  UNIQUE (webhook_id, payload_cursor)
);
CREATE INDEX webhook_events_unprocessed_idx
  ON baseout.webhook_events (webhook_id, payload_cursor)
  WHERE processed_at IS NULL;
```

The UNIQUE on `(webhook_id, payload_cursor)` is the dedup guard.

## Phase B — Receiver (apps/hooks)

```ts
// apps/hooks/src/pages/api/airtable.ts
export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.text()
  const mac = request.headers.get('x-airtable-content-mac')
  const webhookId = JSON.parse(body).webhook?.id

  const webhook = await locals.db.select(...).from(airtableWebhooks).where(eq(..., webhookId))
  if (!webhook) return new Response('webhook_not_found', { status: 404 })

  const macSecret = decrypt(webhook.mac_secret_base64_enc, locals.masterKey)
  if (!verifyHmac(body, mac, macSecret)) return new Response('mac_mismatch', { status: 401 })

  const payloadCursor = JSON.parse(body).timestamp /* or whatever Airtable supplies */
  try {
    await locals.db.insert(webhookEvents).values({ webhook_id: webhook.id, payload_cursor: payloadCursor })
  } catch (e) {
    // UNIQUE violation = dedup hit. Return 200 idempotently.
    if (e.code === '23505') return new Response('ok', { status: 200 })
    throw e
  }

  // Forward to engine via service binding
  await locals.env.BACKUP_ENGINE.fetch('https://engine/api/internal/webhooks/notify', {
    method: 'POST',
    headers: { 'x-internal-token': locals.env.INTERNAL_TOKEN },
    body: JSON.stringify({ webhookId: webhook.id, payloadCursor }),
  })

  return new Response('ok', { status: 200 })
}
```

The HMAC verify uses the same `verifyHmac` helper as Stripe webhooks (already in `@baseout/shared`).

## Phase C — SpaceDO coalescing

Add to `apps/server/src/durable-objects/SpaceDO.ts`:

```ts
// state.storage shape:
// {
//   next_cron_fire_ms: number | null
//   webhook_debounce_until_ms: number | null
//   webhook_events_since_last_fire: number
//   webhook_threshold: number  (default 100, configurable)
//   webhook_debounce_seconds: number  (default 300, configurable)
// }

async fetch(req) {
  const url = new URL(req.url)
  if (url.pathname === '/webhook-tick') {
    const events = (await this.state.storage.get('webhook_events_since_last_fire')) ?? 0
    await this.state.storage.put('webhook_events_since_last_fire', events + 1)
    const threshold = (await this.state.storage.get('webhook_threshold')) ?? 100

    if (events + 1 >= threshold) {
      // Burst trigger — fire immediately
      await this.fireWebhookRun()
    } else {
      // Debounce — set/extend alarm
      const debounceSec = (await this.state.storage.get('webhook_debounce_seconds')) ?? 300
      const newFireAt = Date.now() + debounceSec * 1000
      const cronFireAt = (await this.state.storage.get('next_cron_fire_ms')) ?? Infinity
      await this.state.storage.put('webhook_debounce_until_ms', newFireAt)
      await this.state.storage.setAlarm(Math.min(newFireAt, cronFireAt))
    }
    return new Response('ok')
  }
  // ... existing /set-frequency etc.
}

async alarm() {
  const now = Date.now()
  const cronAt = await this.state.storage.get('next_cron_fire_ms')
  const webhookAt = await this.state.storage.get('webhook_debounce_until_ms')

  if (cronAt && now >= cronAt) {
    await this.fireCronRun()
  }
  if (webhookAt && now >= webhookAt) {
    await this.fireWebhookRun()
  }

  // Reschedule alarm to the next pending fire
  const nextCron = await this.computeNextCronFire()
  const nextWebhook = await this.state.storage.get('webhook_debounce_until_ms')  // re-read
  const nextFire = Math.min(nextCron ?? Infinity, nextWebhook ?? Infinity)
  if (nextFire !== Infinity) await this.state.storage.setAlarm(nextFire)
}

private async fireWebhookRun() {
  await this.state.storage.delete('webhook_debounce_until_ms')
  await this.state.storage.put('webhook_events_since_last_fire', 0)
  // Enqueue incremental run
  await this.env.SELF.fetch('https://engine/api/internal/spaces/<spaceId>/incremental-run-start', {
    method: 'POST',
    headers: { 'x-internal-token': this.env.INTERNAL_TOKEN },
  })
}
```

## Phase D — Incremental run

`apps/workflows/trigger/tasks/incremental-backup.task.ts`:

```ts
export const incrementalBackup = task({
  id: 'incremental-backup',
  retry: { maxAttempts: 3 },
  run: async (payload: { spaceId: string }, { ctx }) => {
    const db = createMasterDb()
    const webhooks = await db.select(...).from(airtableWebhooks).where(eq(airtableWebhooks.spaceId, payload.spaceId))
    const runId = crypto.randomUUID()

    await db.insert(backupRuns).values({
      id: runId, spaceId: payload.spaceId, connectionId: ..., status: 'running',
      triggeredBy: 'webhook', createdAt: new Date(), startedAt: new Date(),
    })

    let totalCreated = 0, totalUpdated = 0, totalDeleted = 0

    for (const webhook of webhooks) {
      let cursor = webhook.cursor
      let mightHaveMore = true
      while (mightHaveMore) {
        const resp = await fetchAirtablePayloads(webhook.base_id, webhook.airtable_webhook_id, cursor, deps)
        for (const payload of resp.payloads) {
          for (const action of payload.actions) {
            await applyActionToDynamicDb(action, deps)
            if (action.type === 'record.created') totalCreated++
            if (action.type === 'record.updated') totalUpdated++
            if (action.type === 'record.deleted') totalDeleted++
          }
          cursor = payload.cursor
        }
        mightHaveMore = resp.mightHaveMore
      }
      await db.update(airtableWebhooks).set({ cursor, lastEventAt: new Date() }).where(eq(airtableWebhooks.id, webhook.id))
    }

    await db.update(backupRuns).set({
      status: 'succeeded',
      completedAt: new Date(),
      recordCount: totalCreated + totalUpdated,
      // attachments count if applicable
    }).where(eq(backupRuns.id, runId))

    return { runId, totalCreated, totalUpdated, totalDeleted }
  },
})
```

`applyActionToDynamicDb`:

- `record.created` → INSERT into dynamic DB's `<table>` table.
- `record.updated` → UPSERT (created might have been missed).
- `record.deleted` → DELETE.
- Schema changes (`table.created`, `field.created`, etc.) → trigger a full schema sync via `upsertSchemaToDynamic`.

## Phase E — Webhook lifecycle

### Register on Instant activation

In the apps/web PATCH route for `frequency='instant'`:

```ts
if (newFrequency === 'instant' && oldFrequency !== 'instant') {
  for (const baseId of space.includedBaseIds) {
    await env.BACKUP_ENGINE.fetch('/api/internal/spaces/<id>/register-webhooks', { method: 'POST' })
  }
}
```

Engine route calls Airtable's `POST /v0/bases/<baseId>/webhooks`. Persists result to `airtable_webhooks`.

### Delete on deactivation

Symmetric: PATCH to non-Instant frequency → engine deletes webhooks. Engine route + Airtable DELETE call.

### Connection rotation

If a Connection rotates its OAuth token, the webhook MAC secret is unaffected (different lifecycle). But if the Connection is fully disconnected, the engine MUST delete the webhooks (else they keep pinging hooks.baseout.com).

## Phase F — UI

- `FrequencyPicker.astro` — remove the "not supported" error for Instant when tier ≥ Pro AND dynamic DB exists.
- History widget — runs with `triggered_by='webhook'` get a `⚡` glyph next to the timestamp. Inside the accordion, "Source: Webhook · 47 created · 12 updated · 3 deleted".

## Wire shapes

| Direction | Path | Verb | Body | Notes |
|---|---|---|---|---|
| Airtable → apps/hooks | `/api/airtable` | POST | Airtable webhook notif | HMAC-verified |
| apps/hooks → engine | `/api/internal/webhooks/notify` | POST | `{ webhookId, payloadCursor }` | service binding |
| engine internal | `/api/internal/spaces/:id/register-webhooks` | POST | `{ baseIds[] }` | calls Airtable API |
| engine internal | `/api/internal/spaces/:id/incremental-run-start` | POST | `{}` | enqueues Trigger.dev task |
| engine ↔ DO | `/webhook-tick` | POST | `{}` | per-Space DO method |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `verifyHmac` (already in `@baseout/shared`). |
| Pure | `applyActionToDynamicDb(action, dynamicDb)` per action type. |
| Integration | apps/hooks receiver — HMAC match / mismatch / dedup hit / forward success. |
| Integration | SpaceDO `/webhook-tick` — debounce path + burst-trigger path. |
| Integration | Incremental run task — fixture payloads with create/update/delete; assert dynamic DB ends in expected state. |
| Smoke | Real Airtable webhook in a dev base. Change a record. Verify Instant run fires within 5 minutes. |

## Master DB migration

`apps/web/drizzle/0013_airtable_webhooks.sql` per Phase A. Engine mirror in `apps/server/src/db/schema/airtable-webhooks.ts`.

## Operational concerns

- **Airtable webhook quota**: 50 webhooks per base per integration. Plenty for MVP.
- **Webhook deletion race**: if a Space is deleted while webhooks are still registered, future pings 404 in our receiver — handled gracefully. The Connection-disconnect path should still call Airtable's DELETE to be clean.
- **HMAC secret persistence**: encrypted in `mac_secret_base64_enc`. Never logged.
- **Cursor drift**: if processing fails partway, the cursor advances only after a successful payload batch. Re-processing on retry is safe because `applyActionToDynamicDb` operations are idempotent (UPSERT / DELETE).
- **PRD-vs-Features conflict**: pinned to PRD's Pro+ reading. Update Features in Phase G.
- **Cost**: Pro+ pricing factors in Instant compute. Webhook polls + dynamic-DB writes are credit-counted per `baseout-backup-manual-quota-and-credits` schedule.

## What this design deliberately doesn't change

- The static / scheduled backup path. Continues unchanged.
- The cron alarm fire logic in SpaceDO. New webhook alarm coexists.
- The dynamic-DB write path. Reuses `upsertRecordsToDynamic` from `baseout-backup-dynamic-mode`.
- The OAuth Connection model. Webhooks live alongside; Connection state unchanged.
