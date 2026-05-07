## Overview

A Cloudflare Workers cron in `apps/server` runs every 15 minutes, finds `connections` rows whose access token expires inside the next 20 minutes, and refreshes them via Airtable's OAuth token endpoint. The 5-minute overlap between cadence and lookahead absorbs missed ticks (Cloudflare cron is best-effort) and per-row failures (a row that fails to claim the lock on tick N is still inside the window on tick N+1).

The cron does **not** introduce a new public surface. It runs entirely in the Worker's `scheduled` handler. Its only contract with the rest of the system is the [`connections`](../../../master-schema.ts) row — write the new ciphertext + expiry + status, and `apps/web`'s integrations dashboard renders the right thing.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Trigger | Cloudflare Workers cron `*/15 * * * *` | Wrangler config in [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc); already reserved as a comment |
| Handler | `scheduled` export in [apps/server/src/index.ts](../../../apps/server/src/index.ts) | Existing stub becomes the dispatch site |
| DB | Master Postgres via Hyperdrive (deployed) / direct (`wrangler dev`) | Per-request postgres-js client per [CLAUDE.md §5.1](../../../CLAUDE.md); `ctx.waitUntil(sql.end({ timeout: 5 }))` on exit |
| Crypto | [apps/server/src/lib/crypto.ts](../../../apps/server/src/lib/crypto.ts) (existing `decryptToken` + new `encryptToken`) | Web Crypto AES-256-GCM; same `BASEOUT_ENCRYPTION_KEY` as `apps/web` |
| Airtable refresh | New [apps/server/src/lib/airtable-refresh.ts](../../../apps/server/src/lib/airtable-refresh.ts) | Mirrors shape of `apps/web/src/lib/airtable/oauth.ts` `refreshAirtableTokens`; deduplication via `@baseout/shared` is a future change |
| Logging | `@baseout/shared` structured logger | Per-row event with `connection_id`, `outcome`, `latency_ms` |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` + `msw` | Real local Postgres (Docker per [docker-compose.test.yml](../../../apps/server/docker-compose.test.yml) when added); Airtable token endpoint mocked at the HTTP boundary |

## Source Layout

```
apps/server/
├── src/
│   ├── index.ts                          # extend `scheduled` to dispatch oauth-refresh
│   ├── lib/
│   │   ├── crypto.ts                     # add encryptToken alongside decryptToken
│   │   ├── oauth-refresh.ts              # NEW — orchestrator: select, claim, refresh, write
│   │   └── airtable-refresh.ts           # NEW — Airtable-specific RPC (POST /oauth1/v1/token)
│   └── db/schema/
│       └── connections.ts                # extend mirror with modifiedAt + writable columns
├── tests/
│   └── integration/
│       └── oauth-refresh.test.ts         # NEW — drives scheduled handler against real PG + mocked Airtable
└── wrangler.jsonc                        # uncomment OAuth refresh cron line
```

## Selection Query

```sql
SELECT id, organization_id, platform_id, refresh_token_enc, token_expires_at, scopes, platform_config
FROM baseout.connections
WHERE platform_id = $airtable_platform_id
  AND status = 'active'
  AND refresh_token_enc IS NOT NULL
  AND token_expires_at < now() + interval '20 minutes'
ORDER BY token_expires_at ASC
LIMIT 100
```

The `LIMIT 100` is a soft cap — at expected V1 scale (low hundreds of active Connections total) one tick handles them all. If real-world load grows past 100 connections in a 20-minute window, the next tick picks up the remainder; we only revisit if the lookahead window starts overflowing.

`platform_id` is resolved once at module load via `SELECT id FROM baseout.platforms WHERE slug = 'airtable'` and cached in module scope (the platforms table is seeded reference data).

## Concurrency

Two writers can touch a `connections` row simultaneously: this cron (across multiple Worker invocations if Cloudflare overlaps two ticks during slow refreshes) and `apps/web`'s OAuth callback (when a user re-connects). The contract:

1. **Cron claims the row** with `UPDATE baseout.connections SET status = 'refreshing', modified_at = now() WHERE id = $1 AND status = 'active' RETURNING refresh_token_enc, token_expires_at, scopes, platform_config`.
2. If `RETURNING` is empty (`rowCount === 0`), the row was already `'refreshing'` (concurrent cron tick) or the user just saved fresh tokens via `apps/web` (status flipped during selection). The cron **skips** this connection — there's nothing to refresh.
3. If `RETURNING` returns the row, the cron decrypts the refresh token, calls Airtable, and on success runs `UPDATE ... SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3, status = 'active', modified_at = now() WHERE id = $4 AND status = 'refreshing'`. If that UPDATE matches 0 rows (because `apps/web` overwrote the row mid-flight), the cron **discards** its result — `apps/web` has fresher tokens.
4. On Airtable error (see §Error Handling), the cron transitions the row to `'pending_reauth'` or `'invalid'` instead, with the same `WHERE status = 'refreshing'` guard.

This is a CAS pattern over the `status` column — no advisory lock needed, no row-level lock needed beyond the row update itself.

## Refresh RPC

`apps/server/src/lib/airtable-refresh.ts` exports a single function:

```ts
async function refreshAirtableAccessToken(input: {
  refreshToken: string
  scopes: string | null
  clientId: string
  clientSecret: string
}): Promise<RefreshOutcome>
```

`RefreshOutcome` is one of:

- `{ kind: 'success', accessToken, refreshToken, expiresAtMs, scopes }` — Airtable returned a fresh token pair.
- `{ kind: 'pending_reauth', reason }` — Airtable returned `400 invalid_grant` or similar irrecoverable error tied to user action (token revoked, user removed integration). The customer must re-connect.
- `{ kind: 'transient', reason, retryAfterMs }` — Airtable returned 5xx, 429, or a network failure. Leave status untouched (back to `'active'`); the next cron tick will retry.
- `{ kind: 'invalid', reason }` — Airtable returned a malformed response or a non-classified error. Surfaces to logs; row goes to `'invalid'` and operations are paged.

The shape mirrors `apps/web/src/lib/airtable/oauth.ts`'s `refreshAirtableTokens` so a future extraction to `@baseout/shared` is mechanical, not a redesign.

## Status Transition Map

| From | Trigger | To | Side effect |
|---|---|---|---|
| `active` | cron claims | `refreshing` | row picked up this tick |
| `refreshing` | Airtable returns success | `active` | new tokens written, expiry refreshed |
| `refreshing` | Airtable returns `invalid_grant` / revocation | `pending_reauth` | `apps/web` IntegrationsView shows Reconnect CTA |
| `refreshing` | Airtable returns 5xx/429/network | `active` | revert; retry on next tick |
| `refreshing` | Airtable returns malformed/unknown | `invalid` | row blocked; ops paged via logs |

`'pending_reauth'` is the **important** terminal state — it's the bridge to `apps/web`. The user reconnecting drives `'pending_reauth' → 'active'` via the existing OAuth callback path, no engine involvement.

## Error Handling

- **Decrypt failure** on the refresh token (cipher tampered with, key mismatched): row goes to `'invalid'` and the failure is logged at error level. Should be impossible in practice — would imply key rotation without re-encryption migration. Page on this.
- **Airtable 5xx/429**: revert row to `'active'`. The next tick (15 minutes later) retries. If the lookahead window is 20 minutes and the cadence is 15, a single missed tick still has one retry inside the window.
- **Cron tick takes longer than 15 minutes**: Cloudflare overlaps ticks. The CAS guard above prevents double-refreshing — the second tick finds rows already in `'refreshing'` and skips them. Worst case: a row stays `'refreshing'` for the duration of the slow tick. We do **not** add a TTL to the `'refreshing'` status in this change; it can be added in a follow-up if observed in prod.
- **Worker hits its 30-second wall clock**: with `LIMIT 100` per tick and Airtable refresh latency typically < 500ms, a single tick should finish in well under 30 seconds. If the limit becomes a problem, raise it via Trigger.dev wrapping in a follow-up — out of scope here.

## `apps/web` Contract Surface

This change makes **no** code change in `apps/web`, but it depends on the following existing behavior remaining stable. If any of these change in `apps/web`, this change needs a corresponding update.

| `apps/web` artifact | What this change relies on |
|---|---|
| [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) `connections` table | Canonical schema. The mirror in `apps/server/src/db/schema/connections.ts` must stay column-compatible. |
| [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts) | AES-256-GCM format: `base64(iv (12) ‖ ciphertext+tag)`. The new `encryptToken` in `apps/server` produces the same format so `apps/web` can decrypt what the cron writes. |
| [apps/web/src/lib/airtable/oauth.ts](../../../apps/web/src/lib/airtable/oauth.ts) `refreshAirtableTokens` | Reference implementation for the RPC shape. The cron's local copy mirrors it; both consume Airtable's same `/oauth1/v1/token` endpoint with `grant_type=refresh_token`. |
| [apps/web/src/views/IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro) | Renders `connections.status`. Continues to render `'pending_reauth'` as a Reconnect CTA — the cron just causes that state to appear earlier and more reliably. |
| `apps/web` OAuth callback writer | INSERTs/UPDATEs the connection row with `status = 'active'`. The cron's CAS guard relies on `'active'` as the only state it claims from. |

## Verification

End-to-end checks before this change is considered done:

1. `pnpm --filter @baseout/server typecheck` — clean.
2. `pnpm --filter @baseout/server test` — new integration test passes against local Postgres + msw'd Airtable token endpoint, asserting all 4 status transitions (success, pending_reauth, transient, invalid).
3. `wrangler dev --remote` — manually trigger the cron handler via `curl http://localhost:.../__scheduled?cron=*%2F15+*+*+*+*` (Wrangler exposes scheduled handlers this way in dev). Confirm a seeded connection moves through `active → refreshing → active` with new ciphertext.
4. `apps/web` IntegrationsView renders correctly when a seeded connection is forced to `'pending_reauth'` (manual SQL update). This confirms the visible contract is intact.
5. Encryption round-trip: a row encrypted by the cron decrypts cleanly via `apps/web`'s `crypto.ts` (the same `BASEOUT_ENCRYPTION_KEY` is in both Worker secret namespaces).
6. After a deploy with the cron active, `apps/server` logs show a refresh tick every 15 minutes; `connections` with stale `token_expires_at` drop to zero within an hour.

## Out-of-Scope Decisions Worth Recording

- **No `'refreshing'` TTL**: see Error Handling above. Add only if prod shows stuck rows.
- **No per-Connection back-off** beyond the natural 15-minute cadence. If a single Connection consistently fails refresh, it'll cycle `active → refreshing → active` every tick until it expires, then `apps/web`'s downstream consumer (the next backup, or the customer opening the dashboard) drives it to `pending_reauth`. Not pretty, but bounded.
- **No metrics export** to Prometheus / Datadog / etc. Logs only. A metrics endpoint is its own change.
