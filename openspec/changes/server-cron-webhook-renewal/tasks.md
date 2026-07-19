# Implementation tasks

## 1. Schema mirror

- [ ] 1.1 Confirm `apps/server/src/db/schema/airtable-webhooks.ts` mirror carries `expires_at`, `status` (`active | notifications_disabled | pending_reauth | inactive`), `last_renewed_at` per `server-instant-webhook` Phase A (canonical migration in `apps/web`); header comment names the source.
- [ ] 1.2 Ensure it's in the engine schema barrel `apps/server/src/db/schema/index.ts`.

## 2. Airtable RPC wrappers

- [ ] 2.1 New `apps/server/src/lib/airtable-webhook-renewal.ts`:
  - `refreshAirtableWebhook(baseId, webhookId, accessToken, fetchImpl?)` → POST `/v0/bases/:baseId/webhooks/:webhookId/refresh`; returns `{ expires_at } | { error: 'not_found' | 'unauthorized' | 'rate_limited' | string }`.
  - `toggleAirtableWebhookNotifications(baseId, webhookId, enable, accessToken, fetchImpl?)` → the toggle-notifications endpoint; same error mapping.
- [ ] 2.2 Vitest with stubbed fetch per upstream status code; assert error mapping for both wrappers.

## 3. Pure-orchestration module

- [ ] 3.1 TDD red: `apps/server/tests/integration/webhook-renewal-pass.test.ts`. Cases: happy renewal (`expires_at` + `last_renewed_at` update, status stays `active`), notifications re-enable (`notifications_disabled → active`), 404 → `pending_reauth`, 401/403 → `pending_reauth`, 5xx → row unchanged + retried next pass, toggle 5xx → stays `notifications_disabled`, no eligible rows → no-op.
- [ ] 3.2 Implement `apps/server/src/lib/webhook-renewal.ts` — `runWebhookRenewalPass(deps)`; deps: `db`, `fetchImpl`, `now`, `decryptToken`. Sequential await at MVP scale.

## 4. Cron activation

- [ ] 4.1 Uncomment the webhook-renewal cron line in `apps/server/wrangler.jsonc.example` (`0 * * * *`).
- [ ] 4.2 Route the hourly cron to `runWebhookRenewalPass` in the `scheduled` dispatcher.
- [ ] 4.3 Miniflare scheduled-event test: simulate `cron: "0 * * * *"`, assert the pass runs.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] 5.2 Document the cron in the apps/server cron-services docs section.
- [ ] 5.3 Smoke: seed a row with `expires_at = NOW() + INTERVAL '23 hours'` and another with `status='notifications_disabled'`; `wrangler dev --test-scheduled`; confirm the first's `expires_at` advances and the second returns to `active`.

## 6. Documentation

- [ ] 6.1 Update `specreview/04-recommendations.md` Round 4 — mark `server-cron-webhook-renewal` as now-active.
