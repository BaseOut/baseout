## Phase A — Schema

- [ ] A.1 Generate the canonical migration in `apps/web/drizzle/` per design.md §Phase A: `airtable_webhooks` (org-level registry, UNIQUE (organization_id, base_id)), `airtable_webhook_subscriptions` (per-Space cursor + watermark), `backup_configurations.webhook_poll_interval_seconds`.
- [ ] A.2 Apply migration; verify tables landed.
- [ ] A.3 Update `apps/web/src/db/schema/core.ts` with `airtableWebhooks` + `airtableWebhookSubscriptions`.
- [ ] A.4 Engine mirrors `apps/server/src/db/schema/airtable-webhooks.ts` + `airtable-webhook-subscriptions.ts` (header comments name the canonical migration).
- [ ] A.5 Publish via `@baseout/db-schema` so `apps/hooks` can consume the registry table.

## Phase C — SpaceDO cadence polling

- [ ] C.1 Update `apps/server/src/durable-objects/SpaceDO.ts`:
  - Add `next_webhook_poll_ms` alarm state; extend the single-alarm min-dispatch (cron fire vs webhook poll) per design.md §Phase C.
  - Poll interval from `backup_configurations.webhook_poll_interval_seconds` + 0–10% jitter.
- [ ] C.2 Implement the dirty-check query (dirty OR 24h safety sweep) against the master DB from the alarm handler.
- [ ] C.3 Per dirty subscription: in-flight guard → `backup_runs` INSERT (`triggered_by='webhook'`) → enqueue `incremental-backup` task → `last_polled_at = now()`.
- [ ] C.4 Set `reconcile=true` in the task payload when `last_reconciled_at` older than 7 days.
- [ ] C.5 Tests (TDD red first, `runInDurableObject`): dirty → enqueue; clean → no-op; safety-sweep fires with no ping; in-flight skip; ping-during-processing re-polls next tick; alarm coexistence with cron fire.

## Phase D — Run plumbing

- [ ] D.1 `POST /api/internal/webhook-subscriptions/:id/cursor` — monotonic cursor advance (reject decreases).
- [ ] D.2 `POST /api/internal/webhook-subscriptions/:id/fallback` — enqueue full `backup-base` for the base, stamp `last_reconciled_at`, reset cursor to Airtable's latest.
- [ ] D.3 Tests: cursor monotonic guard; fallback enqueues full run; both routes `INTERNAL_TOKEN`-gated.

## Phase E — Webhook lifecycle

- [ ] E.1 Engine route `POST /api/internal/spaces/:id/register-webhooks` — find-or-create per included base: reuse active `(org, base)` row (subscription-only INSERT) or Airtable create with the full specification (dataTypes: tableData/tableFields/tableMetadata; includes: cell values "all", previous cell values, previous field definitions) and `notificationUrl` embedding the pre-generated row uuid.
- [ ] E.2 Encrypt + persist `macSecretBase64` immediately (unrecoverable later); compensating Airtable DELETE if the row INSERT fails.
- [ ] E.3 Engine route `POST /api/internal/spaces/:id/unregister-webhooks` — delete subscriptions; Airtable DELETE + `status='inactive'` when the last subscription goes.
- [ ] E.4 Map Airtable's 2-per-base-per-integration cap error to `{ error: 'airtable_webhook_cap_reached' }`.
- [ ] E.5 Wire apps/web's backup-config PATCH: transition to `instant` → register; away → unregister (route calls only; UI in `web-instant-webhook`).
- [ ] E.6 Connection-disconnect path: subscriptions' webhooks with that `connection_id` → `pending_reauth`; reconnect path re-creates or re-points per design.md §Phase E.
- [ ] E.7 Implementation-time verification: can a different same-org Connection's token refresh/poll a webhook created by another token? Record the answer in design.md and adjust E.6.
- [ ] E.8 Tests: find-or-create both branches; second Space reuses; last-unsubscribe deletes; cap error; compensating delete; reauth transitions.

## Phase G — Doc sync

- [ ] G.1 Confirm [openspec/changes/server/specs/airtable-webhook-polling/spec.md](../server/specs/airtable-webhook-polling/spec.md) matches the shipped behavior; link this change.
- [ ] G.2 Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) Out-of-Scope — link as resolved.
- [ ] G.3 Update [shared/Baseout_Features.md §6.1](../../../shared/Baseout_Features.md): Instant = Pro+ per PRD; document per-tier `webhook_poll_interval_seconds` minimums.
- [ ] G.4 PRD change-log note: §2.5 DO-coalescing description superseded by dirty-flag registry + per-Space cadence polling.

## Phase H — Final verification

- [ ] H.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — green.
- [ ] H.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green (migration + schema only; UI is `web-instant-webhook`).
- [ ] H.3 Human checkpoint smoke:
  - Pro Space with dynamic DB ready. PATCH frequency=instant. Confirm `airtable_webhooks` + subscription rows and the webhook visible in Airtable's developer console.
  - Second Space (same org) enables the same base → no new Airtable webhook; new subscription row only.
  - Add a record in the source base. Within one poll interval, a `triggered_by='webhook'` run appears; per-space DB has the change.
  - PATCH both Spaces away from instant → Airtable webhook deleted; row `status='inactive'`.
- [ ] H.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `server-instant-conflict-resolution` — payload-vs-dynamic-DB conflict handling (MVP: last-write-wins).
- [ ] OUT-2 `server-instant-snapshot-rollup` — periodic consolidation snapshots after N incrementals.
- [ ] OUT-3 `server-webhook-cursor-monitoring` — alert when a subscription's cursor nears the 7-day payload-retention edge.
- [ ] OUT-4 Central scanner cron (single dirty-scan ticking due SpaceDOs) — only if per-Space polling load demands.
