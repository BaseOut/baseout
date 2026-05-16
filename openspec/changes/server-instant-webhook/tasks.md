## Phase A — Schema

- [ ] A.1 Generate `apps/web/drizzle/0013_airtable_webhooks.sql` per design.md §Phase A.
- [ ] A.2 Apply migration; verify tables landed.
- [ ] A.3 Update `apps/web/src/db/schema/core.ts` with `airtableWebhooks` + `webhookEvents`.
- [ ] A.4 Engine mirror `apps/server/src/db/schema/airtable-webhooks.ts`.

## Phase B — apps/hooks receiver

- [ ] B.1 New route `apps/hooks/src/pages/api/airtable.ts` per design.md §Phase B.
- [ ] B.2 HMAC verify against `mac_secret_base64_enc` (decrypted per-request).
- [ ] B.3 Dedup via UNIQUE constraint on `(webhook_id, payload_cursor)`.
- [ ] B.4 Service-binding forward to engine's `/api/internal/webhooks/notify`.
- [ ] B.5 TDD: 401 mac mismatch; 404 unknown webhook; 200 dedup hit; 200 happy + forward called.

## Phase C — Engine notify route + DO tick

- [ ] C.1 New route `apps/server/src/pages/api/internal/webhooks/notify.ts`. Calls `env.SPACE_DO.get(idFromName(spaceId)).fetch('/webhook-tick')`.
- [ ] C.2 Update `apps/server/src/durable-objects/SpaceDO.ts`:
  - Add `/webhook-tick` POST handler.
  - Add webhook-debounce alarm storage state per design.md §Phase C.
  - Refactor `alarm()` to handle both cron AND webhook fires via min-alarm-dispatch.
- [ ] C.3 Tests: TDD red on the burst-trigger path + the debounce-extends path. Use `runInDurableObject`.

## Phase D — Incremental run task

- [ ] D.1 Incremental-backup task itself owned by [`workflows-instant-webhook`](../workflows-instant-webhook/tasks.md).
- [ ] D.2 New module `apps/server/src/lib/instant/apply-action-to-dynamic-db.ts` — pure-ish; per-action-type handlers.
- [ ] D.3 New module `apps/server/src/lib/instant/fetch-airtable-payloads.ts` — wraps Airtable's payloads API with retry + cursor advance.
- [ ] D.4 New engine route `POST /api/internal/spaces/:id/incremental-run-start`. Inserts `backup_runs` row + enqueues task.
- [ ] D.5 Tests: pure handlers per action type; integration test against fixture payloads.

## Phase E — Webhook lifecycle

- [ ] E.1 New engine route `POST /api/internal/spaces/:id/register-webhooks`. Iterates the Space's included bases; calls Airtable API; persists rows.
- [ ] E.2 New engine route `POST /api/internal/spaces/:id/unregister-webhooks`. Symmetric delete.
- [ ] E.3 Update apps/web's PATCH `/api/spaces/:id/backup-config`: on `frequency='instant'` transition, call register; on transition away, call unregister.
- [ ] E.4 Connection-disconnect path: call unregister for every Space using this Connection.
- [ ] E.5 Tests for register/unregister routes + the PATCH integration.

## Phase F — UI

- [ ] F.1 Update [FrequencyPicker.astro](../../../apps/web/src/components/backups/FrequencyPicker.astro) — enable Instant when tier ≥ Pro and `space_databases.status='ready'`.
- [ ] F.2 Update BackupHistoryWidget to show `⚡` glyph for `triggered_by='webhook'` rows.
- [ ] F.3 Accordion detail panel shows `created / updated / deleted` counts for webhook runs.

## Phase G — Doc sync

- [ ] G.1 Update [openspec/changes/server/specs/airtable-webhook-coalescing/spec.md](../server/specs/airtable-webhook-coalescing/spec.md) — link this change.
- [ ] G.2 Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) Out-of-Scope.
- [ ] G.3 Update [shared/Baseout_Features.md §6.1](../../../shared/Baseout_Features.md) — Instant tier corrected to Pro+ per PRD.

## Phase H — Final verification

- [ ] H.1 `pnpm --filter @baseout/hooks typecheck && pnpm --filter @baseout/hooks test` — all green.
- [ ] H.2 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] H.3 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] H.4 Human checkpoint smoke:
  - Pro Space with dynamic DB ready. PATCH frequency=instant. Confirm `airtable_webhooks` row + Airtable webhook visible in their developer console.
  - Add a record in the source base. Within ~5 minutes, a `triggered_by='webhook'` run appears with `recordCount=1`. Dynamic DB has the new row.
  - PATCH frequency back to monthly. Confirm webhook deleted on Airtable side + `airtable_webhooks` row deleted.
- [ ] H.5 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `server-instant-conflict-resolution` — Handling cases where webhook payload disagrees with dynamic-DB state.
- [ ] OUT-2 `server-instant-snapshot-rollup` — Periodic consolidation snapshots after N incrementals.
- [ ] OUT-3 `server-instant-multi-base-coalesce` — Cross-base coalesce optimization.
- [ ] OUT-4 `server-webhook-replay` — Replay-from-cursor recovery.
- [ ] OUT-5 `server-instant-cursor-monitoring` — Alert when cursor falls behind (real-time backup latency).
