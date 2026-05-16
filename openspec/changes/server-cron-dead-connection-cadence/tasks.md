# Implementation tasks

## 1. Schema mirrors

- [ ] 1.1 Extend `apps/server/src/db/schema/connections.ts` with `pending_reauth_at` if not already mirrored.
- [ ] 1.2 New `apps/server/src/db/schema/notification_log.ts` mirroring the canonical schema (kind, sub_kind, org_id, connection_id, sent_at). Header comment names the canonical migration.

## 2. Cadence orchestration

- [ ] 2.1 TDD red: `apps/server/tests/integration/connection-cadence.test.ts`. Cases: (a) day-1 reauth → T+24h email sent + logged; (b) day-3 → T+72h email sent; (c) day-7 → T+7d; (d) day-14 → T+14d; (e) day-21 → T+21d email + Connection flips to `invalid`; (f) duplicate-cron-tick → no duplicate email (notification_log idempotency); (g) Connection re-activated mid-cadence → cadence aborts.
- [ ] 2.2 Implement `apps/server/src/lib/connection-cadence.ts` — `runConnectionCadencePass(deps)`. Pure function with DI (db, fetchImpl, now, postCadenceEmail).
- [ ] 2.3 Watch green.

## 3. Email route + template

- [ ] 3.1 New `apps/server/src/pages/api/internal/orgs/:id/connection-cadence-email.ts`. INTERNAL_TOKEN-gated. Accepts `{ connectionId, cadenceStep: 't+24h' | 't+72h' | ... }`. Renders the appropriate template + dispatches via the Cloudflare Workers `send_email` binding.
- [ ] 3.2 New `apps/server/src/emails/ConnectionCadence.tsx` (React Email). Conditional copy per cadence step.
- [ ] 3.3 Vitest under `apps/server/tests/integration/connection-cadence-email-route.test.ts`. Cases: 401 missing token; 200 happy; idempotency check (second call with same `{org, kind, sub_kind}` no-ops).

## 4. Cron activation

- [ ] 4.1 Uncomment the dead-connection-cadence cron line in `apps/server/wrangler.jsonc.example` (`0 13 * * *`).
- [ ] 4.2 Wire the dispatch in `apps/server/src/index.ts` `scheduled` handler.
- [ ] 4.3 Miniflare scheduled-event smoke: simulate the cron, assert `runConnectionCadencePass` is called.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] 5.2 Manual smoke: seed a Postgres `connections` row with `pending_reauth_at = NOW() - INTERVAL '1 day 1 hour'`. Trigger cron via `wrangler dev --test-scheduled`. Confirm the Cloudflare Workers `send_email` binding call + `notification_log` row.

## 6. Documentation

- [ ] 6.1 Update `specreview/04-recommendations.md` Round 4 — mark `server-cron-dead-connection-cadence` as now-active.
