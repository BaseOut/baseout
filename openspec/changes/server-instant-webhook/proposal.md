## Why

[PRD §2.2 Backup Schedules](../../../shared/Baseout_PRD.md) lists Instant as a V1 feature:

> Scheduled backups — Monthly (all tiers), Weekly (Launch+), Daily (Pro+), **Instant (Pro+)**

The `server-schedule-and-cancel` change explicitly defers Instant to this follow-up by name. The `FrequencyPicker` UI already shows it as an option but throws "not supported" if a Pro+ Space tries to select it. The cron-based scheduler ignores `frequency='instant'`. The engine has no webhook-driven change-detection path.

**Architecture (settled 2026-07-18; supersedes the prior receive→forward→DO-coalesce design in this change and the PRD §2.5 debounce description):** Airtable notification pings carry no data — changes are pulled via the cursor-based payloads API, and payloads are retained 7 days with client-held cursors. So the pipeline is **pull-based on a per-Space cadence**:

1. `apps/hooks` verifies each ping and bumps `last_ping_at` on a central org-level webhook registry (change `hooks`).
2. Each Space's DO wakes on its own configurable poll interval (the tier knob: "Instant" = short interval), queries the registry for its subscribed bases with `last_ping_at` newer than the Space's own watermark, and enqueues an incremental run per dirty base.
3. The incremental Trigger.dev task (change `workflows-instant-webhook`) pulls payloads from the Space's own cursor and applies them to the per-space DB.

Webhooks are registered **once per (Organization, base)** and shared by all of that org's Spaces via a subscription table — Airtable caps webhooks at 2 per base per OAuth integration, so per-Space webhooks don't scale. Each subscription carries its own payload cursor; Airtable cursors are client-held transaction numbers, so N Spaces can read the same webhook's payload stream independently.

**Tier conflict (unchanged ruling):** PRD §2.2 says Instant = Pro+; Features §6.1 says Business+. This change commits to **Pro+**, matching the PRD.

**Dependency**: `server-dynamic-mode` — incremental runs are append-only writes to the per-space dynamic DB. If dynamic mode hasn't shipped, this change is blocked.

## What Changes

### Phase A — Schema (canonical migration owned by `apps/web` per CLAUDE.md)

- **New table `airtable_webhooks`** in master DB — the org-level registry:
  - `id uuid PK` — also the public path token in the `notificationUrl` (`hooks.baseout.com/webhooks/airtable/{id}`)
  - `organization_id uuid NOT NULL FK → organizations.id`
  - `connection_id uuid NOT NULL FK → connections.id` — the Connection whose OAuth token created the webhook (used for refresh + payload polling)
  - `base_id text NOT NULL` — Airtable base ID (`app...`)
  - `airtable_webhook_id text NOT NULL UNIQUE` — Airtable's webhook ID (returned on create)
  - `mac_secret_base64_enc text NOT NULL` — AES-256-GCM ciphertext of the MAC secret (returned ONLY at creation; persist immediately)
  - `status text NOT NULL DEFAULT 'active'` — `active | notifications_disabled | pending_reauth | inactive`
  - `expires_at timestamptz` — Airtable webhooks expire 7 days after creation; extended by refresh AND by listing payloads
  - `last_ping_at timestamptz` — the dirty flag; written by `apps/hooks`
  - `last_ping_source_ip text`
  - `last_renewed_at timestamptz`
  - `created_at`, `modified_at`
  - `UNIQUE (organization_id, base_id)` — the dedupe guard: one webhook per base per org
- **New table `airtable_webhook_subscriptions`** in master DB — which Spaces consume which webhook, each with independent progress:
  - `id uuid PK`
  - `webhook_id uuid NOT NULL FK → airtable_webhooks.id ON DELETE CASCADE`
  - `space_id uuid NOT NULL FK → spaces.id ON DELETE CASCADE`
  - `payload_cursor bigint NOT NULL DEFAULT 1` — this Space's position in the webhook's payload stream (Airtable cursors start at 1)
  - `last_polled_at timestamptz` — the Space's dirty-check watermark
  - `last_reconciled_at timestamptz` — last `modifiedTime` reconciliation / full re-read anchor
  - `created_at`, `modified_at`
  - `UNIQUE (webhook_id, space_id)`
- **`backup_configurations`**: new column `webhook_poll_interval_seconds int NOT NULL DEFAULT 900`. Replaces the previously-planned `webhook_debounce_seconds` + `webhook_event_threshold` (never shipped). Tier-gated platform minimums (values land in Features §6.1 as part of Phase G).
- The previously-planned `webhook_events` table is **dropped from the design** — no per-event rows anywhere.

### Phase B — Registry access + engine mirror

- Engine-side schema mirrors `apps/server/src/db/schema/airtable-webhooks.ts` + `airtable-webhook-subscriptions.ts` (header comments naming the canonical `apps/web` migration).
- No receiver work in this change — `apps/hooks` owns the receiver (change `hooks`). There is **no** `/api/internal/webhooks/notify` route and **no** hooks→server service binding.

### Phase C — SpaceDO cadence polling

- **Extend SpaceDO** (cron scheduling already implemented in `server-schedule-and-cancel`):
  - A webhook-poll alarm at `webhook_poll_interval_seconds` (+ jitter), coexisting with the cron-snapshot alarm via the established single-alarm min-dispatch pattern.
  - On fire: query master DB for this Space's subscriptions where `last_ping_at > last_polled_at` **OR** `last_polled_at` older than the 24h safety sweep. For each dirty base: skip if a run is already in-flight for that (space, base), else insert a `backup_runs` row (`triggered_by='webhook'`) and enqueue the `incremental-backup` task. Set `last_polled_at = now()` on enqueue.
  - The safety sweep makes ping loss harmless: every subscription is polled unconditionally at least daily.

### Phase D — Incremental run plumbing (server side)

- Engine route `POST /api/internal/webhook-subscriptions/:id/cursor` — the task's cursor-advance callback.
- Engine route `POST /api/internal/webhook-subscriptions/:id/fallback` — the task's gap signal; enqueues a full `backup-base` run for the affected base and stamps `last_reconciled_at`.
- Task body itself is owned by [`workflows-instant-webhook`](../workflows-instant-webhook/proposal.md): payloads-API-primary with a records-API `modifiedTime` reconciliation path (both supported; payloads can miss things).

### Phase E — Webhook lifecycle

- **On enabling webhook-driven backups for a Space's base** (`frequency='instant'` today; any sub-daily interval later): **find-or-create** — if an active `airtable_webhooks` row exists for `(organization_id, base_id)`, only insert a subscription row; else call Airtable `POST /v0/bases/{baseId}/webhooks` with:
  - `notificationUrl: https://hooks.baseout.com/webhooks/airtable/{pre-generated row uuid}`
  - `specification.options`: `dataTypes: ["tableData","tableFields","tableMetadata"]`; `includes: { includeCellValuesInFieldIds: "all", includePreviousCellValues: true, includePreviousFieldDefinitions: true }` (payload-driven processing + schema-intelligence diffing need full context)
  - Persist `airtable_webhook_id` + encrypted `mac_secret_base64` **immediately** (secret is unrecoverable after the create response).
- **On disable / base removal / tier downgrade**: delete the Space's subscription row. If it was the webhook's **last** subscription: `DELETE /v0/bases/{baseId}/webhooks/{webhookId}` and set `status='inactive'`.
- **On Airtable's 2-webhooks-per-base-per-integration cap being hit** (third org connecting the same base): fail gracefully with an actionable error surfaced to the UI; never leave a half-registered state.
- **On Connection invalid/revoked**: rows created by that Connection → `status='pending_reauth'`; on reconnect (or via another active org Connection with base access), re-create and swap the row. *(Verify during implementation: whether payload polling works with a different same-org Connection's token — docs are ambiguous; if yes, prefer re-pointing `connection_id` over re-creating.)*
- **On `status='notifications_disabled'`** (Airtable disabled pings after retry exhaustion): re-enable via the toggle-notifications endpoint — owned by `server-cron-webhook-renewal`.

### Phase F — UI

Moved to [`web-instant-webhook`](../web-instant-webhook/proposal.md) per the change-naming convention (poll-interval picker, ⚡ webhook-run glyph, `pending_reauth` attention state).

### Phase G — Doc sync

- Update [openspec/changes/server/specs/airtable-webhook-polling/spec.md](../server/specs/airtable-webhook-polling/spec.md) (renamed from `airtable-webhook-coalescing`) — link as implementation.
- Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) Out-of-Scope — link as resolved.
- Update [shared/Baseout_Features.md §6.1](../../../shared/Baseout_Features.md): Instant = Pro+ per PRD; document per-tier `webhook_poll_interval_seconds` minimums.
- Note in the PRD change-log that §2.5's DO-coalescing description is superseded by cadence polling (dirty-flag registry + per-Space pull).

## Out of Scope

| Deferred to | Item |
|---|---|
| `server-instant-conflict-resolution` | Payload-vs-dynamic-DB conflict handling. MVP: last-write-wins. |
| `server-instant-snapshot-rollup` | Periodic consolidation snapshot after N incrementals to re-anchor drift. |
| `server-webhook-cursor-monitoring` | Alerting when a subscription's cursor lags near the 7-day payload-retention edge. |
| `server-manual-quota-and-credits` | Credit charge for webhook-driven runs (same per-record/attachment costs as scheduled). |
| `server-dynamic-mode` | The per-space dynamic-DB write path. Used here, defined there. |
| `hooks` | The public receiver. |
| `server-cron-webhook-renewal` | Expiry refresh + notification re-enable cron. |
| `web-instant-webhook` | All UI. |

## Capabilities

### New capabilities

- `airtable-webhook-polling` — org-level webhook registry + per-Space subscriptions with independent cursors; SpaceDO cadence polling of the dirty-flag registry; webhook registration lifecycle (find-or-create, unsubscribe, delete-on-last, cap handling, reauth states). Replaces the never-implemented `airtable-webhook-coalescing` capability.
- `backup-incremental-run` — engine-side plumbing (run rows, cursor/fallback callbacks) for the incremental task.

### Modified capabilities

- `backup-engine` — `triggered_by='webhook'` becomes a real value in the existing `backup_runs` state machine.
- `backup-config-policy` — `frequency='instant'` valid for Pro+; `webhook_poll_interval_seconds` with tier-gated minimums.
- `space-do` — gains the webhook-poll alarm alongside the cron alarm (single-alarm min-dispatch).

## Impact

- **Master DB**: two additive tables + one `backup_configurations` column (canonical migrations in `apps/web`).
- **Airtable API quota**: payload polling shares the same 5 rps per-base REST budget as everything else; all calls route through the per-Connection ConnectionDO gateway. Multiple Spaces polling one busy base share that budget — the per-Space interval floor needs a per-base guard.
- **Security**: MAC secrets encrypted at rest, never logged; registry holds no customer record data (base IDs, webhook IDs, timestamps only) — actual changes flow Airtable → Trigger.dev task → per-space DB.
- **Cross-app contract**: hooks writes `last_ping_at`/`last_ping_source_ip`; server reads them. Workflows task ↔ engine: cursor + fallback callbacks above.

## Reversibility

- **Phase A**: additive.
- **Phase C–E**: gated on `frequency='instant'`. Reverting = flipping configs to a non-instant frequency; orphaned Airtable-side webhooks keep pinging hooks, which dirty-marks rows nobody polls — harmless; cleanup operational.
- Forward-only state: per-subscription `payload_cursor`. On revert it freezes; next activation resumes from it (or falls back to full re-read if > 7 days stale).
