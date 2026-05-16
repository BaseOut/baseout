## 1. Schema mirror + crypto

- [x] 1.1 Extend [apps/server/src/db/schema/connections.ts](../../../apps/server/src/db/schema/connections.ts) to declare the columns the cron writes: `modifiedAt` + `invalidatedAt`. Header comment updated to note the cron is now a writer.
- [x] 1.2 Add `encryptToken(plaintext: string, keyB64: string): Promise<string>` to [apps/server/src/lib/crypto.ts](../../../apps/server/src/lib/crypto.ts). Output format matches [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts) byte-for-byte: `base64(iv (12 bytes) ‖ ciphertext+tag)`. Header rewritten to reflect dual-writer reality.
- [x] 1.3 Round-trip tests added to [apps/server/tests/integration/crypto.test.ts](../../../apps/server/tests/integration/crypto.test.ts) (apps/server has no `tests/unit/` dir; the existing crypto.test.ts is the unit-equivalent file inside the workerd pool). 11 tests pass: encrypt→decrypt round-trip, format compat with apps/web's decrypt path, fresh IV per call, key-mismatch rejection, invalid key rejection.
- [x] 1.4 Cross-app round-trip via [scripts/verify-crypto-compat.ts](../../../scripts/verify-crypto-compat.ts) — single script imports both apps' `encryptToken`/`decryptToken` and runs all 4 cross-products (web→web, web→server, server→server, server→web). Run via `node --experimental-strip-types scripts/verify-crypto-compat.ts`. All 4 pass.

## 2. Airtable refresh RPC

- [x] 2.1 Create [apps/server/src/lib/airtable-refresh.ts](../../../apps/server/src/lib/airtable-refresh.ts). Single export: `refreshAirtableAccessToken(input)` returning `RefreshOutcome` (see [design.md](./design.md) §Refresh RPC).
- [x] 2.2 Implement the POST to `https://airtable.com/oauth2/v1/token` with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret` form-encoded. **Endpoint corrected from oauth1 → oauth2** (canonical lives in [apps/web/src/lib/airtable/config.ts](../../../apps/web/src/lib/airtable/config.ts) as `AIRTABLE_TOKEN_URL`).
- [x] 2.3 Map response to `RefreshOutcome`:
  - 200 + valid body → `{ kind: 'success', accessToken, refreshToken, expiresAtMs, scope }`. `expiresAtMs = nowMs() + (response.expires_in * 1000)`. Missing `refresh_token` on a 200 → treated as `'invalid'` (avoid clobbering DB column with null).
  - 400 with `error: 'invalid_grant' | 'invalid_request_or_grant' | 'unauthorized_client' | 'access_denied'` → `{ kind: 'pending_reauth', reason }`.
  - 5xx, 429, network error → `{ kind: 'transient', reason, retryAfterMs }`.
  - Anything else → `{ kind: 'invalid', reason }`.
- [x] 2.4 Unit-test the response mapper. Lives at [apps/server/tests/integration/airtable-refresh.test.ts](../../../apps/server/tests/integration/airtable-refresh.test.ts) (apps/server still has no `tests/unit/` dir; same convention as crypto.test.ts). 11 tests covering each branch + request shape assertion.

## 3. Refresh orchestrator

- [x] 3.1 Created [apps/server/src/lib/oauth-refresh.ts](../../../apps/server/src/lib/oauth-refresh.ts). Exports `runOAuthRefreshTick(deps)`. Pure-function-with-DI pattern (matches Phase 7/8a/8b convention); `db`, `encryptionKey`, `clientId`, `clientSecret`, `refresh`, `nowMs`, and `log` are all deps.
- [x] 3.2 Airtable platform UUID resolved per tick (not cached at module scope) — a re-seed of `baseout.platforms` would otherwise pin to a stale UUID until the worker restarts. The query is cheap and runs once per tick.
- [x] 3.3 Selection query from [design.md](./design.md) §Selection Query implemented. `LIMIT 100`.
- [x] 3.4 CAS claim: `UPDATE … SET status='refreshing', modified_at=now() WHERE id=$1 AND status='active' RETURNING id`. Skip with `claim_skipped` outcome counter on 0 rows.
- [x] 3.5 Decrypt failure → row → `'invalid'` (CAS-guarded), counter increment, continue.
- [x] 3.6 All four `RefreshOutcome.kind` branches implemented, each with `WHERE status='refreshing'` CAS guard. Success-path 0-row UPDATE → `cas_lost` counter (apps/web overwrote mid-flight).
- [x] 3.7 Per-row structured log emitted via injected `log` dep. Real wiring at scheduled-handler call site stringifies to stdout (no shared logger lib in apps/server yet; switch is a follow-up).

## 4. Wire into Worker

- [x] 4.1 Extended [apps/server/src/index.ts](../../../apps/server/src/index.ts) `scheduled` handler: branches on `event.cron`, builds per-request `masterDb`, calls `runOAuthRefreshTick`, tears down via `ctx.waitUntil(sql.end({timeout:5}))`. Logs the tick summary (considered/claimed/per-outcome).
- [x] 4.2 Activated the OAuth-refresh cron in [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example): `"*/15 * * * *"`. Other cron entries left commented (future changes).
- [x] 4.3 `AIRTABLE_OAUTH_CLIENT_ID` + `AIRTABLE_OAUTH_CLIENT_SECRET` added to the Secrets list in wrangler.jsonc.example comments and to [apps/server/.dev.vars.example](../../../apps/server/.dev.vars.example). `BASEOUT_ENCRYPTION_KEY` already present (per Phase 1 commit `97cba60`).
- [x] 4.4 Updated [apps/server/src/env.d.ts](../../../apps/server/src/env.d.ts) with the two new env vars; `BASEOUT_ENCRYPTION_KEY` already typed.

## 5. Tests

- [x] 5.1 Integration test at [apps/server/tests/integration/oauth-refresh.test.ts](../../../apps/server/tests/integration/oauth-refresh.test.ts). **Pure-function shape, not real-Postgres.** Injects a fake `AppDb` whose `.execute` returns scripted rows in call order. Each test scripts the platform-lookup → selection → per-row(claim + outcome-update) sequence. Covers all 4 outcomes + both concurrency paths + decrypt failure + multi-row aggregation. Spinning up a real Postgres harness for apps/server is deferred to a follow-up (would need its own docker-compose.test.yml).
- [x] 5.2 Test cases (10 total): platform-not-seeded bail; no-candidates bail; success path; pending_reauth (invalid_grant); transient (5xx); invalid (unknown error); claim-skipped (concurrent claimer); cas-lost (mid-flight apps/web overwrite); decrypt-failed (corrupt cipher); multi-row aggregation.
- [x] 5.3 Mapper unit tests at [apps/server/tests/integration/airtable-refresh.test.ts](../../../apps/server/tests/integration/airtable-refresh.test.ts) (2.4 above).
- [x] 5.4 Crypto round-trip already shipped in Phase 1 ([apps/server/tests/integration/crypto.test.ts](../../../apps/server/tests/integration/crypto.test.ts)).

## 6. Verification + ship

- [x] 6.1 `pnpm --filter @baseout/server exec tsc --noEmit` clean.
- [x] 6.2 `pnpm --filter @baseout/server test` — 161 passed + 1 skipped / 162 total. `pnpm --filter @baseout/web test` — 335/335.
- [ ] 6.3 In `wrangler dev --remote`, hit `http://localhost:.../__scheduled?cron=*%2F15+*+*+*+*` and confirm logs show one tick; seeded connection moves through the success path; new ciphertext decrypts correctly when read back.
- [ ] 6.4 In `apps/web` (running locally against the same DB), open `/integrations` and confirm the seeded connection still renders correctly. Force `status = 'pending_reauth'` via SQL and confirm the Reconnect CTA appears.
- [ ] 6.5 Deploy to staging. Set `AIRTABLE_OAUTH_CLIENT_ID`, `AIRTABLE_OAUTH_CLIENT_SECRET`, `BASEOUT_ENCRYPTION_KEY` via `wrangler secret put` if not already set. Verify cron fires by tailing `wrangler tail` for a 15-minute window.
- [ ] 6.6 Production deploy gated on staging green for at least 24 hours.

## 7. Follow-ups (out of scope, captured for the backlog)

- [ ] 7.1 Extract Airtable OAuth (callback + refresh) to `@baseout/shared/airtable`. `apps/web`'s callback and `apps/server`'s cron then both import. Their own `crypto.ts` files consolidate to `@baseout/shared/encryption` at the same time.
- [ ] 7.2 Storage-destination OAuth refresh (Google Drive / Dropbox / Box / OneDrive) — requires the Storage Connect flow to land in `apps/web` first.
- [ ] 7.3 Lazy refresh inside backup tasks for the case where a token expires mid-run (low priority once the proactive cron drives `invalid_grant` near zero).
- [ ] 7.4 Metrics export — refresh outcome counters to whatever observability stack lands.
