## 1. Schema mirror + crypto

- [x] 1.1 Extend [apps/server/src/db/schema/connections.ts](../../../apps/server/src/db/schema/connections.ts) to declare the columns the cron writes: `modifiedAt` + `invalidatedAt`. Header comment updated to note the cron is now a writer.
- [x] 1.2 Add `encryptToken(plaintext: string, keyB64: string): Promise<string>` to [apps/server/src/lib/crypto.ts](../../../apps/server/src/lib/crypto.ts). Output format matches [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts) byte-for-byte: `base64(iv (12 bytes) ‖ ciphertext+tag)`. Header rewritten to reflect dual-writer reality.
- [x] 1.3 Round-trip tests added to [apps/server/tests/integration/crypto.test.ts](../../../apps/server/tests/integration/crypto.test.ts) (apps/server has no `tests/unit/` dir; the existing crypto.test.ts is the unit-equivalent file inside the workerd pool). 11 tests pass: encrypt→decrypt round-trip, format compat with apps/web's decrypt path, fresh IV per call, key-mismatch rejection, invalid key rejection.
- [x] 1.4 Cross-app round-trip via [scripts/verify-crypto-compat.ts](../../../scripts/verify-crypto-compat.ts) — single script imports both apps' `encryptToken`/`decryptToken` and runs all 4 cross-products (web→web, web→server, server→server, server→web). Run via `node --experimental-strip-types scripts/verify-crypto-compat.ts`. All 4 pass.

## 2. Airtable refresh RPC

- [ ] 2.1 Create [apps/server/src/lib/airtable-refresh.ts](../../../apps/server/src/lib/airtable-refresh.ts). Single export: `refreshAirtableAccessToken(input)` returning `RefreshOutcome` (see [design.md](./design.md) §Refresh RPC).
- [ ] 2.2 Implement the POST to `https://airtable.com/oauth1/v1/token` with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret` form-encoded. Mirror the request shape from [apps/web/src/lib/airtable/oauth.ts](../../../apps/web/src/lib/airtable/oauth.ts) `refreshAirtableTokens` exactly — do not improvise headers or body encoding.
- [ ] 2.3 Map response to `RefreshOutcome`:
  - 200 + valid body → `{ kind: 'success', accessToken, refreshToken, expiresAtMs, scopes }`. `expiresAtMs = Date.now() + (response.expires_in * 1000)`.
  - 400 with `error: 'invalid_grant'` (or revoked/removed) → `{ kind: 'pending_reauth', reason }`.
  - 5xx, 429, network error → `{ kind: 'transient', reason, retryAfterMs }`.
  - Anything else → `{ kind: 'invalid', reason }`.
- [ ] 2.4 Unit-test the response mapper with `msw`-style fixture responses for each branch.

## 3. Refresh orchestrator

- [ ] 3.1 Create [apps/server/src/lib/oauth-refresh.ts](../../../apps/server/src/lib/oauth-refresh.ts). Exports `runOAuthRefreshTick(env, ctx, masterDb)`.
- [ ] 3.2 Resolve and cache the Airtable platform UUID at module scope from `baseout.platforms WHERE slug = 'airtable'`.
- [ ] 3.3 Implement the selection query from [design.md](./design.md) §Selection Query. `LIMIT 100`.
- [ ] 3.4 For each row, run the CAS claim: `UPDATE … SET status = 'refreshing', modified_at = now() WHERE id = $1 AND status = 'active' RETURNING …`. Skip rows where the claim returns 0.
- [ ] 3.5 Decrypt `refresh_token_enc` via `decryptToken`. On decrypt failure, transition row to `'invalid'` (CAS-guarded by `WHERE status = 'refreshing'`) and continue to the next row.
- [ ] 3.6 Call `refreshAirtableAccessToken`. Branch on `RefreshOutcome.kind`:
  - `success`: encrypt new tokens; `UPDATE ... SET access_token_enc, refresh_token_enc, token_expires_at, scopes, status = 'active', modified_at = now() WHERE id = $1 AND status = 'refreshing'`. If 0 rows match, log + skip (apps/web overwrote mid-flight).
  - `pending_reauth`: `UPDATE ... SET status = 'pending_reauth', modified_at = now() WHERE id = $1 AND status = 'refreshing'`.
  - `transient`: `UPDATE ... SET status = 'active', modified_at = now() WHERE id = $1 AND status = 'refreshing'` (revert; next tick retries).
  - `invalid`: `UPDATE ... SET status = 'invalid', invalidated_at = now(), modified_at = now() WHERE id = $1 AND status = 'refreshing'`.
- [ ] 3.7 Per-row structured log via `@baseout/shared`'s logger: `{ event: 'oauth_refresh', connection_id, outcome, latency_ms }`.

## 4. Wire into Worker

- [ ] 4.1 Extend [apps/server/src/index.ts](../../../apps/server/src/index.ts) `scheduled` handler. The existing TODO comment line goes; the new body:
  - Build per-request masterDb via `createMasterDb(env, ctx)`.
  - Call `runOAuthRefreshTick(env, ctx, masterDb)`.
  - `ctx.waitUntil(masterDb.sql.end({ timeout: 5 }))` on completion (or via the existing teardown path if `createMasterDb` already wires it).
- [ ] 4.2 Uncomment the OAuth-refresh cron line in [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc): `"*/15 * * * *"`. Leave the other commented cron entries in place; only this one is in scope.
- [ ] 4.3 Add `AIRTABLE_OAUTH_CLIENT_ID` and `AIRTABLE_OAUTH_CLIENT_SECRET` to the Secrets list in the wrangler.jsonc comment block, and to [apps/server/.dev.vars.example](../../../apps/server/.dev.vars.example). Confirm `BASEOUT_ENCRYPTION_KEY` is already there.
- [ ] 4.4 Update [apps/server/src/env.d.ts](../../../apps/server/src/env.d.ts) `Env` type with `AIRTABLE_OAUTH_CLIENT_ID: string` and `AIRTABLE_OAUTH_CLIENT_SECRET: string`. Confirm `BASEOUT_ENCRYPTION_KEY` is typed.

## 5. Tests

- [ ] 5.1 Integration test at `apps/server/tests/integration/oauth-refresh.test.ts`:
  - Spin up a local Postgres harness for `apps/server`. `apps/server` doesn't have its own `docker-compose.test.yml` yet — either reuse `apps/web/docker-compose.test.yml` against the same dev DB, or add a minimal one for `apps/server`. Pick whichever is faster; either is OK for this change.
  - Seed `baseout.platforms` with the Airtable row + `baseout.organizations` + a `baseout.connections` row whose `token_expires_at` is 5 minutes from now and `status = 'active'`.
  - Mock `https://airtable.com/oauth1/v1/token` via `msw`.
  - Drive the `scheduled` export directly with a synthetic `ScheduledEvent`.
- [ ] 5.2 Test cases (one `describe` block each):
  - Success: cron transitions `active → refreshing → active`; new ciphertext decrypts to the new plaintext access token; `token_expires_at` advances; `modified_at` updates.
  - `pending_reauth`: Airtable returns `400 invalid_grant`; row ends `pending_reauth`.
  - Transient: Airtable returns `503`; row ends back at `active`.
  - Invalid: Airtable returns `200` with malformed body; row ends `invalid`.
  - Concurrency: pre-set `status = 'refreshing'` on the row before driving the cron; assert the row is **skipped** (no UPDATE).
  - Concurrency mid-flight: stub `refreshAirtableAccessToken` to delay; while it's in flight, externally UPDATE the row to `status = 'active'` with new tokens (simulating `apps/web` callback). Assert the cron's success-path UPDATE matches 0 rows and the externally-written tokens survive.
- [ ] 5.3 Add `apps/server/tests/unit/airtable-refresh.test.ts` for the response mapper (covered in 2.4).
- [ ] 5.4 Add `apps/server/tests/unit/crypto.test.ts` round-trip test (covered in 1.3).

## 6. Verification + ship

- [ ] 6.1 `pnpm --filter @baseout/server typecheck` clean.
- [ ] 6.2 `pnpm --filter @baseout/server test` clean. CI green.
- [ ] 6.3 In `wrangler dev --remote`, hit `http://localhost:.../__scheduled?cron=*%2F15+*+*+*+*` and confirm logs show one tick; seeded connection moves through the success path; new ciphertext decrypts correctly when read back.
- [ ] 6.4 In `apps/web` (running locally against the same DB), open `/integrations` and confirm the seeded connection still renders correctly. Force `status = 'pending_reauth'` via SQL and confirm the Reconnect CTA appears.
- [ ] 6.5 Deploy to staging. Set `AIRTABLE_OAUTH_CLIENT_ID`, `AIRTABLE_OAUTH_CLIENT_SECRET`, `BASEOUT_ENCRYPTION_KEY` via `wrangler secret put` if not already set. Verify cron fires by tailing `wrangler tail` for a 15-minute window.
- [ ] 6.6 Production deploy gated on staging green for at least 24 hours.

## 7. Follow-ups (out of scope, captured for the backlog)

- [ ] 7.1 Extract Airtable OAuth (callback + refresh) to `@baseout/shared/airtable`. `apps/web`'s callback and `apps/server`'s cron then both import. Their own `crypto.ts` files consolidate to `@baseout/shared/encryption` at the same time.
- [ ] 7.2 Storage-destination OAuth refresh (Google Drive / Dropbox / Box / OneDrive) — requires the Storage Connect flow to land in `apps/web` first.
- [ ] 7.3 Lazy refresh inside backup tasks for the case where a token expires mid-run (low priority once the proactive cron drives `invalid_grant` near zero).
- [ ] 7.4 Metrics export — refresh outcome counters to whatever observability stack lands.
