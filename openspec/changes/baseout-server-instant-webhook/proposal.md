## Why

[PRD §2.2 Backup Schedules](../../../shared/Baseout_PRD.md) lists Instant as a V1 feature:

> Scheduled backups — Monthly (all tiers), Weekly (Launch+), Daily (Pro+), **Instant (Pro+)**

The `baseout-backup-schedule-and-cancel` change explicitly defers Instant to this follow-up by name. The `FrequencyPicker` UI already shows it as an option but throws "not supported" if a Pro+ Space tries to select it. The cron-based scheduler ignores `frequency='instant'`. The engine has no webhook ingestion path.

[PRD §2.5](../../../shared/Baseout_PRD.md) describes the architecture:

> Airtable webhooks fire on record changes. A per-Space Durable Object coalesces events (debounce threshold: configurable, default 5 minutes or 100 events) and triggers an incremental backup run. Webhook payloads are signed; verify via HMAC before processing.

[openspec/changes/baseout-server/specs/airtable-webhook-coalescing/spec.md](../baseout-server/specs/airtable-webhook-coalescing/spec.md) already specs the coalescing contract. This change is its implementation.

**Conflict to flag** per CLAUDE.md "PRD authoritative when it disagrees with Features":

- [PRD §2.2](../../../shared/Baseout_PRD.md): Instant = Pro+.
- [Features §6.1](../../../shared/Baseout_Features.md): Instant = Business+ (requires full dynamic DB).

This change commits to **Pro+**, matching the PRD. The "full dynamic DB" reading in Features is consistent — Pro has full dynamic via Shared PG per Features §4.3, so the constraint holds either way.

**Dependency**: this change depends on `baseout-backup-dynamic-mode` because Instant runs are append-only incremental writes to the dynamic DB. If dynamic mode hasn't shipped, this change is blocked.

## What Changes

### Phase A — Schema

- **New table `airtable_webhooks`** in master DB:
  - `id uuid PK`
  - `connection_id uuid FK → connections.id`
  - `base_id text NOT NULL` — Airtable base ID (`app...`)
  - `space_id uuid NULL FK → spaces.id` — which Space's Instant backup this feeds (NULL if base not yet selected for backup)
  - `airtable_webhook_id text NOT NULL UNIQUE` — Airtable's webhook ID (returned on create)
  - `mac_secret_base64_enc text NOT NULL` — AES-256-GCM ciphertext of the webhook's MAC secret (issued by Airtable on create)
  - `cursor bigint NOT NULL DEFAULT 0` — last-seen payload cursor; advanced after each successful poll
  - `last_event_at timestamp with time zone`
  - `created_at`, `modified_at`
- **New table `webhook_events`** in master DB (transient — short retention):
  - `id uuid PK`
  - `webhook_id uuid FK → airtable_webhooks.id`
  - `payload_cursor bigint NOT NULL` — Airtable's payload cursor (monotonic)
  - `received_at timestamp with time zone DEFAULT now()`
  - `processed_at timestamp with time zone NULL`

### Phase B — Webhook receiver (apps/hooks)

- **New route** `apps/hooks/src/pages/api/airtable.ts`. Receives POST with body `{ base, webhook, timestamp, ... }`.
- **HMAC verify** — header `X-Airtable-Content-MAC` against `mac_secret`. Reject on mismatch.
- **Dedup** — Airtable sends "notification ping" payloads, not the full events. The receiver INSERTs a `webhook_events` row keyed on `(webhook_id, payload_cursor)` (UNIQUE constraint) — duplicate ping is a no-op.
- **Forward** — POST to `apps/server`'s new `/api/internal/webhooks/notify` route (service binding). Engine handles the rest.

### Phase C — SpaceDO event coalescing

- **Extend SpaceDO** (already implemented for cron scheduling in `baseout-backup-schedule-and-cancel`):
  - New method `POST /webhook-tick` — called by the engine's notify route. Increments an internal counter; sets a 5-minute alarm if not already set.
  - On alarm fire: if counter > 0 (events seen since last fire), trigger an incremental backup run.
- **Configurable thresholds** — store in `backup_configurations.webhook_debounce_seconds` (default 300) and `webhook_event_threshold` (default 100). Tier-gated.

### Phase D — Incremental run path

- **New Trigger.dev task** `apps/workflows/trigger/tasks/incremental-backup.task.ts`:
  - Reads the webhook's `cursor` from `airtable_webhooks`.
  - Polls Airtable's `GET /v0/bases/<baseId>/webhooks/<webhookId>/payloads?cursor=<cursor>` repeatedly until `mightHaveMore=false`.
  - Each payload contains `actions` (create / update / delete records).
  - Applies each action to the dynamic DB:
    - `record.created` → UPSERT.
    - `record.updated` → UPDATE (or UPSERT for safety).
    - `record.deleted` → DELETE.
  - Advances `cursor` after each batch.
  - At end: INSERT a `backup_runs` row with `triggered_by='webhook'`, `status='succeeded'`. Aggregate counts (records updated, etc.).

### Phase E — Webhook lifecycle

- **On Space connect** (after OAuth completes for a Connection): registration is deferred — webhooks are per-base, and Spaces select bases later.
- **On `backup_configurations.frequency` set to `'instant'`**: for each base in the Space's `backup_configuration_bases`, call Airtable's `POST /v0/bases/<baseId>/webhooks` to create a webhook. Persist `airtable_webhook_id` + `mac_secret`. URL: `https://hooks.baseout.com/api/airtable`.
- **On base removal from Space**: delete the webhook via `DELETE /v0/bases/<baseId>/webhooks/<webhookId>`.
- **On Connection rotation / disconnect**: same.
- **On frequency change away from Instant**: delete all webhooks for the Space's bases.

### Phase F — UI

- The existing `FrequencyPicker.astro` already shows Instant as an option, locked for sub-Pro tiers. Phase D removes the "not supported" error and lights up the option for Pro+ with a dynamic DB.
- **History widget** distinguishes `triggered_by='webhook'` runs visually — a small lightning-bolt glyph next to the row.

### Phase G — Doc sync

- Update [openspec/changes/baseout-server/specs/airtable-webhook-coalescing/spec.md](../baseout-server/specs/airtable-webhook-coalescing/spec.md) — link as implementation.
- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) Out-of-Scope — link as resolved.
- Resolve the PRD-vs-Features tier conflict in writing in [shared/Baseout_Features.md §6.1](../../../shared/Baseout_Features.md): align with PRD's Pro+ reading.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-backup-instant-conflict-resolution` | Conflict handling for cases where Airtable's webhook payload disagrees with the engine's last-known state (e.g. record deleted in source but updated in our dynamic DB). MVP: last-write-wins. |
| Future change `baseout-backup-instant-snapshot-rollup` | Periodic "consolidation snapshot" — after N incremental runs, run a full backup to re-anchor the dynamic DB. Today: incremental forever; drift risk over time. |
| Future change `baseout-backup-instant-multi-base-coalesce` | Optimization: a single Space with N webhook-Instant bases could coalesce across bases. MVP: one DO alarm per Space, one run per fire covering all changed bases. |
| Future change `baseout-backup-webhook-replay` | If webhook events are missed (network partition, queue overflow), replay from the Airtable payload cursor up to the latest. Today: cursor advance only after successful processing, so missed events are retried on next webhook ping. |
| Bundled with `baseout-backup-dynamic-mode` | The dynamic-DB write path. This change uses it but doesn't define it. |
| Bundled with `baseout-backup-manual-quota-and-credits` | Credit charge for webhook-driven runs. Default: same record/attachment per-credit costs as scheduled runs. |

## Capabilities

### New capabilities

- `airtable-webhook-receiver` — HMAC-verified webhook ingestion in `apps/hooks`. Forwards verified notifications to engine.
- `airtable-webhook-coalescing` — per-Space DO event coalescer with configurable debounce. Owned by `apps/server`.
- `backup-incremental-run` — append-only incremental write path that consumes Airtable's webhook payloads and applies them to the dynamic DB. Owned by `apps/server`.

### Modified capabilities

- `backup-engine` — `triggered_by='webhook'` becomes a real value. Existing `backup_runs.status` machine accepts these rows.
- `backup-config-policy` — `frequency='instant'` becomes valid for Pro+.
- `space-do` — gains `POST /webhook-tick` + a parallel alarm to the cron alarm. Care: don't interleave the two alarms; the cron alarm is for full snapshots, the webhook alarm is for incrementals.

## Impact

- **Master DB**: two additive tables (`airtable_webhooks`, `webhook_events`).
- **Airtable API quota**: webhook payload polls consume the same REST quota as record fetches. The per-Connection lock in ConnectionDO already serializes; webhook incrementals share the budget. Operational concern only if a Space's Connection is shared with multiple high-frequency bases.
- **apps/hooks**: new app surface. Wrangler config + DNS for `hooks.baseout.com`.
- **HMAC secret rotation**: Airtable rotates the webhook MAC secret on webhook re-creation. Engine handles by deleting + re-creating on configuration change.
- **Security**: HMAC-verify every incoming webhook. Reject on signature mismatch. Replay-protect via the UNIQUE constraint on `(webhook_id, payload_cursor)`.
- **Cross-app contract**:
  - apps/hooks → engine: `POST /api/internal/webhooks/notify` body `{ webhookId, payloadCursor }`. Returns 200 always (engine acks; failures handled async via cursor mismatch on next ping).
  - engine ← Airtable: outbound calls to `https://api.airtable.com/v0/bases/<>/webhooks` for create/delete; polls for payloads.

## Reversibility

- **Phase A** (schema): additive.
- **Phase B–C–D**: feature-flag-gated on `backup_configurations.frequency='instant'`. Reverting means flipping all such configs to a non-Instant frequency; existing webhooks remain registered on Airtable's side until explicitly deleted.
- **Phase E**: webhook deletion calls are best-effort; an orphaned webhook on Airtable's side keeps sending POSTs to our receiver, which 200s + drops them. Cleanup is operational.
- **Phase F–G**: pure roll-forward.

The forward-only state is `airtable_webhooks.cursor` advancing. If we revert, the cursor stays where it is and the next Instant activation picks up from there.
