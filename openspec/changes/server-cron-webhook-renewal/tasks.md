# Implementation tasks

## 1. Schema mirror

- [ ] 1.1 Extend (or create) `apps/server/src/db/schema/airtable-webhooks.ts` with `expires_at`, `status`, `last_renewed_at` columns. Header comment names the canonical migration owner (`apps/web/drizzle/<n>_airtable_webhooks.sql`, landing as part of `server-instant-webhook` Phase A).
- [ ] 1.2 Add to the engine schema barrel `apps/server/src/db/schema/index.ts`.

## 2. Airtable RPC wrapper

- [ ] 2.1 New `apps/server/src/lib/airtable-webhook-renewal.ts`. Exports `refreshAirtableWebhook(baseId, webhookId, accessToken, fetchImpl?)`. Posts to `https://api.airtable.com/v0/bases/:baseId/webhooks/:webhookId/refresh`. Returns `{ expires_at } | { error: 'not_found' | 'unauthorized' | 'rate_limited' | string }`.
- [ ] 2.2 Vitest `apps/server/tests/integration/airtable-webhook-renewal.test.ts` — stub fetch with each upstream status code; assert error mapping.

## 3. Pure-orchestration module

- [ ] 3.1 TDD red: `apps/server/tests/integration/webhook-renewal-pass.test.ts`. Cases: happy renewal (status `active → renewed`, `expires_at` updates), Airtable 404 (`status → pending_reauth`), Airtable 5xx (no row update, retried next pass), no eligible rows (no-op).
- [ ] 3.2 Implement `apps/server/src/lib/webhook-renewal.ts` — `runWebhookRenewalPass(deps)`. Deps: `db`, `fetchImpl`, `now`, `decryptToken`. Selects rows with `expires_at < now + 24h` AND `status = 'active'`; loops with sequential await (parallel only when row count exceeds threshold — keeps logs readable at MVP scale).

## 4. Cron activation

- [ ] 4.1 Uncomment the webhook-renewal cron line in `apps/server/wrangler.jsonc.example` (`0 * * * *`).
- [ ] 4.2 Extend the `scheduled` handler dispatch in `apps/server/src/index.ts` (or wherever the cron-cron mapping lives) to route the hourly cron to `runWebhookRenewalPass`.
- [ ] 4.3 Test the dispatch end-to-end via Miniflare scheduled-event API: simulate `cron: "0 * * * *"`, assert the pass runs.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] 5.2 Document the cron in `apps/server/README.md` or `apps/server/CLAUDE.md` cron-services section (add one if not present).
- [ ] 5.3 Smoke locally: seed an `airtable_webhooks` row with `expires_at = NOW() + INTERVAL '23 hours'`. Trigger the cron via `wrangler dev --test-scheduled`. Confirm row's `expires_at` advances + status flips to `renewed`.

## 6. Documentation

- [ ] 6.1 Update `specreview/04-recommendations.md` Round 4 — mark `server-cron-webhook-renewal` as now-active.
