## Why

`apps/server` needs an Airtable client to run backups: OAuth token holder + refresh, schema discovery via Metadata API, record fetch with pagination + 429 handling, attachment URL refresh, and the Airtable Enterprise scope variant for Enterprise-tier customers. The OAuth handshake, AES-256-GCM crypto, and Meta API client already exist in `apps/web/src/lib/airtable/` from the `baseout-starter` port and are extraction-ready (Web Crypto, no Node primitives, well-tested PKCE + retry/backoff). Per the engineering rule "wait until a second real call site exists before extracting," the second call site is now arriving — `apps/server`. This change moves the existing code to `packages/shared/airtable/` and adds the server-specific capabilities the engine will need.

The Records API client, attachment URL refresh, Enterprise scope variant, and token-refresh cadence are net-new — none of them exist in the monorepo today.

## What Changes

- **Extract** from `apps/web/src/lib/airtable/{oauth,cookie,config,client}.ts` and `apps/web/src/lib/crypto.ts` into `packages/shared/airtable/`. Working tree only — git history not preserved (the source files are part of the monorepo's first-commit history already).
- **Update** `apps/web` imports: every reference to `@/lib/airtable/*` and `@/lib/crypto` swaps to `@baseout/shared/airtable` and `@baseout/shared/crypto`. Behavior unchanged. The OAuth route handlers (`apps/web/src/pages/api/connections/airtable/{start,callback}.ts`) continue to live in `apps/web` — only the helper modules move.
- **Add** new modules to `packages/shared/airtable/`:
  - `records.ts` — Records API client. `listRecords(baseId, tableId, { offset, pageSize, filterByFormula?, sort? })` with cursor advancement; respects Airtable's per-base 30 req/sec limit; parses `Retry-After` on 429 with exponential backoff (jittered, capped at 60 s); typed errors (`RateLimitError`, `TokenExpiredError`, `BaseNotFoundError`, `PermissionDeniedError`).
  - `attachments.ts` — Attachment URL refresh. Detects URLs within 1 h of the 2 h Airtable expiry; re-fetches the parent record to obtain refreshed URLs; parses attachment metadata `{ id, url, filename, size, type, expires_at }`.
  - `enterprise.ts` — Enterprise scope variant. Detects `enterprise.metadata:read` (and other `enterprise.*`) scopes from the granted-scopes list returned at OAuth exchange; sets `connections.is_enterprise = true`; gates Enterprise-only API surfaces (e.g. webhook registration).
  - `refresh.ts` — Token-refresh helper. Pure function (no scheduling). Given an encrypted refresh token, calls Airtable's token endpoint, returns new access token + expiry. Used by `baseout-server-cron-oauth-refresh` (separate change) to drive the cadence.
- **Wire** `apps/server` to use the client. Add a `Connection` accessor in `apps/server/src/lib/airtable.ts` that reads `connections.{access_token_enc, refresh_token_enc, token_expires_at}` per request via the existing `createMasterDb()` from `apps/server/src/db/worker.ts`, decrypts via `@baseout/shared/crypto`, and exposes a typed `AirtableClient` interface to engine-core.
- **Add** `packages/shared/airtable/index.ts` barrel exporting the public surface (typed).

## Capabilities

### New Capabilities

- `airtable-client`: shared Airtable client library used by `apps/web` (OAuth + Meta API) and `apps/server` (OAuth + Meta API + Records + attachments + Enterprise + refresh).

### Modified Capabilities

- None. `apps/web`'s Airtable OAuth flow continues to work identically; only the import path changes.

### Capabilities Not Yet Implemented (deferred to follow-up changes)

- Connection-level rate-limit *coordination* across concurrent requests (a single per-Connection token bucket): belongs in `baseout-server-durable-objects` (`ConnectionDO`).
- Token-refresh *scheduling* (the 15-minute cadence cron): belongs in `baseout-server-cron-oauth-refresh`.
- Webhook registration / renewal API calls: belongs in `baseout-server-cron-webhook-renewal`.
- Field-type catalog caching for CSV header generation: belongs in `baseout-server-engine-core`.

## Impact

- **New code path**: `packages/shared/airtable/` (~10 files, all Worker-runtime safe). New module in `apps/server/src/lib/airtable.ts`.
- **Removed code path**: `apps/web/src/lib/airtable/` and `apps/web/src/lib/crypto.ts` (moved, not deleted from the monorepo).
- **External dependencies**: no new packages. Web Crypto API, `fetch` only.
- **Cross-app contracts**:
  - `apps/web` consumes `@baseout/shared/airtable` for OAuth + Meta API. No behavior change.
  - `apps/server` consumes `@baseout/shared/airtable` + `@baseout/shared/crypto` for everything Airtable-related, gated by per-request master DB read.
  - `apps/server` and `apps/web` MUST agree on `BASEOUT_ENCRYPTION_KEY` (same value in both `wrangler.jsonc` per env; already enforced by PRD §20.2).
- **Master DB**: read-only. Reads `connections.access_token_enc`, `connections.refresh_token_enc`, `connections.token_expires_at`, `connections.scopes`, `connections.is_enterprise`. Adds `connections.is_enterprise` if not already present (verify against `packages/db-schema` or `apps/web/src/db/schema/`; if absent, defer the column add to `baseout-db-schema-airtable-enterprise` follow-up change).
- **Secrets**: no new secrets. `AIRTABLE_OAUTH_CLIENT_ID` + `_SECRET` already in apps/web; apps/server reads them from its own `wrangler.jsonc` (added in this change).
- **Operational**: `pnpm install` must succeed after the move. Both apps' typecheck and tests must pass.

## Reversibility

The extraction is a copy-and-rewire, not a delete-and-rewrite. If the extraction reveals a hidden coupling, revert is `git revert <commit>` — the original `apps/web/src/lib/airtable/` files are recreated by the revert. Server-side consumers haven't shipped yet (apps/server is PoC scaffold), so no production rollback considerations.
