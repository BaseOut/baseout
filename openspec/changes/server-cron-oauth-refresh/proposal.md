## Why

Airtable OAuth access tokens expire (60 minutes by spec). Today, the only refresh path is **on-demand**, when `apps/web`'s OAuth callback exchanges a code or when (eventually) the engine attempts a backup and finds an expired token. Without a proactive refresher:

- A `Connection` whose access token expires *between* user sessions silently rots until a backup tries to use it and fails.
- The customer-facing "needs reconnect" signal in `apps/web`'s [IntegrationsView](../../../apps/web/src/views/IntegrationsView.astro) only fires after a downstream consumer (a backup run, a schema scan) hits an `invalid_grant` — which can be days after the token actually died.
- Refresh tokens themselves rotate on use, so a refresh attempted during a backup run is already late: if the rotation succeeds the run still works, but if Airtable revoked the refresh token (e.g. the user removed the integration on Airtable's side), the run fails noisily instead of the dashboard surfacing a clean `pending_reauth` state.

The schema is already shaped for this: [`connections.status`](../../../master-schema.ts) defines `'refreshing'` and `'pending_reauth'` alongside `'active'` and `'invalid'`, and the wrangler config in [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc) already reserves a commented-out cron line for OAuth refresh (`*/15 * * * *`). This change activates that infrastructure.

## What Changes

- **Activate the OAuth refresh cron** in `apps/server` on a 15-minute cadence (`*/15 * * * *`). The Worker's `scheduled` handler dispatches refresh work; no Trigger.dev task is introduced yet (the refresh is bounded and fits inside the Worker's wall clock).
- **New module** [apps/server/src/lib/oauth-refresh.ts](../../../apps/server/src/lib/oauth-refresh.ts) (canonical name TBD): selects connections nearing expiry, transitions them through `active → refreshing → active|pending_reauth|invalid`, and writes the new encrypted tokens.
- **New module** [apps/server/src/lib/airtable-refresh.ts](../../../apps/server/src/lib/airtable-refresh.ts): minimal Airtable-specific refresh RPC (POST to `https://airtable.com/oauth1/v1/token` with `grant_type=refresh_token`). Mirrors the shape of `apps/web/src/lib/airtable/oauth.ts`'s `refreshAirtableTokens` without importing it (cross-app imports are not in scope here; deduplication waits for the Airtable extraction to `@baseout/shared`).
- **Extend** [apps/server/src/lib/crypto.ts](../../../apps/server/src/lib/crypto.ts) with an `encryptToken` companion to the existing `decryptToken`. The file's own header comment already anticipates this ("when refresh lands, an `encryptToken` export joins this file").
- **Extend** the engine-side schema mirror at [apps/server/src/db/schema/connections.ts](../../../apps/server/src/db/schema/connections.ts) to include `modifiedAt` and the columns the cron must write. No new columns in the canonical master DB — `apps/web` remains the migration owner; the mirror just declares what the engine reads/writes.
- **Activate cron triggers** by uncommenting the OAuth-refresh entry in [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc). Other cron entries (webhook renewal, trial-expiry, quota, smart-cleanup) stay commented — they are out of scope for this change.
- **Tests**: a Vitest integration test under `apps/server/tests/integration/` that drives the cron handler against a real local Postgres + a stub Airtable token endpoint, asserting state transitions and ciphertext round-trip.

## Out of Scope

- **Webhook renewal cron, trial-expiry monitor, quota monitor, smart-cleanup scheduler** — separate openspec changes per the comment block in `apps/server/wrangler.jsonc`.
- **Storage-destination OAuth refresh** (Google Drive / Dropbox / Box / OneDrive). Those Connections don't yet exist in the schema as a separate row type; they live alongside Airtable Connections under the same table once the Storage Connect flow ships in `apps/web`. When that lands, the cron grows a per-platform dispatch.
- **Refresh-on-use** inside backup tasks. When a backup task encounters an expired token and the cron hasn't run yet, the engine still uses the token and lets the API call fail naturally — that's already the existing path. A future change can add lazy refresh inside the engine if needed; this proactive cron should drive the `invalid_grant` rate to ~zero on its own.
- **Extraction of Airtable refresh logic to `@baseout/shared`**. `packages/shared/src/encryption.ts` is currently `export {}` and `apps/web/src/lib/airtable/oauth.ts` is still the only home for the refresh RPC. Extraction is its own follow-up change once the engine has its second consumer.
- **`packages/shared` adoption for crypto**. apps/server keeps its own `src/lib/crypto.ts`; consolidation waits for a second engine consumer (per the comment in that file).

## Capabilities

### New Capability

- `oauth-token-refresh` — proactive scheduled refresh of Connection OAuth tokens before expiry, with status transitions visible to `apps/web`'s integrations dashboard.

### Modified Capability

- `airtable-oauth` (Connection auth) — gains a server-side proactive refresh path. The existing `apps/web` callback flow (PKCE exchange, AES-256-GCM encryption, `connections` row INSERT/UPDATE) is **unchanged**.

## Impact

- **Master DB schema**: no migration required. All columns the cron writes (`access_token_enc`, `refresh_token_enc`, `token_expires_at`, `status`, `modified_at`) already exist in the canonical schema at [master-schema.ts](../../../master-schema.ts) and the status set already includes `'refreshing'` and `'pending_reauth'`.
- **`apps/web` reads**: no contract change. The customer-facing surface keeps reading `connections.status` and renders:
  - `'active'` → green checkmark, no CTA (today)
  - `'refreshing'` → green checkmark, no CTA (today; transient state, sub-second)
  - `'pending_reauth'` → "Reconnect" CTA (today's flow, now invoked by the cron rather than only by a downstream failure)
  - `'invalid'` → "Connection invalid" + Reconnect (today)
- **`apps/web` writes**: no contract change. The OAuth callback continues to INSERT/UPDATE on `connections` as it does today. **Concurrency**: if a user happens to re-connect on `apps/web` while the cron is mid-refresh on the same Connection row, both writers UPDATE the same row. The cron uses an `UPDATE ... WHERE status = 'active' RETURNING ...` guard to claim the row; if that returns 0 rows (because the row is already `'refreshing'` from a concurrent cron tick or because the user just re-saved it as `'active'` with new tokens), the cron skips that connection this tick. See [design.md](./design.md) §Concurrency.
- **Secrets**: requires `BASEOUT_ENCRYPTION_KEY` in `apps/server`'s Cloudflare Secrets (same value as `apps/web`). The dev value already lives in [apps/server/.dev.vars.example](../../../apps/server/.dev.vars.example). Adds **no** new secrets — Airtable's OAuth client ID + secret needed for the refresh call are read from the same `AIRTABLE_OAUTH_CLIENT_ID` / `AIRTABLE_OAUTH_CLIENT_SECRET` variables `apps/web` uses; this change adds them to `apps/server`'s secret list.
- **Cron schedule cost**: Cloudflare Workers cron invocations are billed but cheap — `*/15 * * * *` = 4 invocations/hour = 2880/month. Each invocation queries `connections WHERE token_expires_at < now() + interval '20 minutes' AND status = 'active'` and refreshes the matched rows. Bounded by the number of active Connections (low hundreds expected at V1 scale).
- **Observability**: cron writes a structured log per refresh attempt (success / `pending_reauth` / `invalid` / network error) using `@baseout/shared`'s logger. No new dashboard.
- **Cross-app surface**: nothing. The cron is fully internal to `apps/server`'s `scheduled` handler — no new `/api/internal/*` route, no new `INTERNAL_TOKEN`-gated endpoint.

## Reversibility

Pure roll-forward. To disable: comment the cron line back out in [apps/server/wrangler.jsonc](../../../apps/server/wrangler.jsonc) and redeploy. The `connections.status` set already includes `'refreshing'` and `'pending_reauth'` regardless of whether the cron runs, so reverting the cron leaves the system in the same state it's in today (on-demand refresh on backup / re-auth via `apps/web`).
