## Why

Customers, consultants, and automations need programmatic read access to what Baseout already knows — backup history and configuration per Space, and the captured Airtable schema (bases → tables → fields) with search — without going through the web UI. The data all exists today (master-DB backup tables, per-Space `bo_at_*` schema tables) but there is no public read surface: `apps/api` is a placeholder and the inbound-API change (`openspec/changes/api`) covers ingestion only. This change defines v1 of the public read-only REST API and the conventions (URLs, auth, pagination, errors, usage tracking) that every future public endpoint — and the MCP server (`openspec/changes/api-mcp`) — will inherit.

## What Changes

- Add a public, URL-versioned **read-only REST API** to `apps/api` at `api.baseout.com` — the first real surface on this Worker. Future writes will be POST/PATCH on this same resource tree (additive to v1), not a separate namespace; the disposition of the earlier `/v1/inbound/*` ingestion change (`openspec/changes/api`) is under review by the product owner (2026-07-18: it likely belongs with `apps/hooks`-style ingestion rather than here) and this change does not depend on it.
- **URL shape**: `/v1/orgs/{orgId}/spaces/{spaceId}/...` — Organization and Space IDs always in the path. Backups are platform-free (`.../spaces/{spaceId}/backups/...`); schema is platform-scoped with a bare short-code segment (`.../spaces/{spaceId}/at/schema/...`, `at` = Airtable) since captured schema shape is inherently per-Platform while backup history/config reads as universal.
- **Endpoint set (all GET except search)**:
  - Org: org detail, list Spaces, Space detail (status + settings snapshot), list connected Platforms for a Space.
  - Backups: run history with filters, run detail, backup configuration, retention policy, status rollup.
  - Schema: bases, base detail, tables per base, table detail, fields per table, field detail, schema changelog, captured schema versions, and `POST .../schema/search` accepting a structured JSON search configuration.
- **Auth**: Bearer tokens from the shared `api_tokens` table. Token model refined from the inbound change's one-token-per-Space: every token belongs to an Organization (`organization_id` NOT NULL) with `space_id` nullable (NULL = all Spaces in the Org), plus read scopes (`org:read`, `backups:read`, `schema:read`). Path IDs must match the token's grants; mismatches return 404.
- **API conventions**: cursor pagination, `{ data, pagination }` list envelope, Stripe-style error objects with `requestId`, ETag/304 on schema resources keyed by `schema_hash`, ISO 8601 UTC timestamps, OpenAPI 3 published at `docs.baseout.com`.
- **Usage tracking without enforcement**: every call metered per token/org/space/route via Workers Analytics Engine, plus the Cloudflare Workers Rate Limiting binding evaluated in shadow mode (outcome logged and surfaced in headers, no 429s) — tier quotas and blocking are deferred until plans/tiers are finalized.
- **Not in scope**: any write/mutation endpoints, tier-based quota enforcement, credit debiting, `apps/sql` (untouched), webhooks, OAuth for third parties.

## Capabilities

### New Capabilities

- `rest-read-api`: Public versioned read-only REST API at `api.baseout.com/v1/orgs/...` — resource tree, auth/scoping, pagination, error contract, schema search, caching, OpenAPI publication.
- `api-usage-tracking`: Per-token request metering via Workers Analytics Engine and shadow-mode rate-limit evaluation via the Cloudflare Rate Limiting binding, shared by all public API surfaces on `apps/api`.

### Modified Capabilities

None — `openspec/specs/` contains no public-API capability yet. The unarchived inbound-API change (`openspec/changes/api/specs/inbound-api/spec.md`) assumes one token per Space; this change supersedes that token model (org-owned, Space-optional) and the inbound spec should be reconciled when it is implemented or archived.

## Impact

- **`apps/api`** (`@baseout/api`): placeholder Worker becomes the real public API — router, auth middleware, read handlers, search, OpenAPI generation (`scripts/generate-openapi.ts` exists), Analytics Engine + rate-limit bindings in `wrangler.jsonc`.
- **`packages/db-schema`**: adds the `api_tokens` table (not yet in any live schema) with `organization_id`, nullable `space_id`, `scopes`, `token_prefix`, `token_hash`, `expires_at`, `last_used_at`.
- **Cross-repo contracts** (mirrors the inbound change's boundary rules — `apps/api` never touches client DBs directly):
  - With `apps/server`: schema reads and search are served by `server`'s internal endpoints (existing `/api/internal/spaces/:id/schema-read` and `schema-changelog`; **new** `schema-search` internal endpoint plus read parameterization — specced in the paired change `openspec/changes/server-rest-read-support/`), called with the HMAC service token.
  - With `apps/web`: `web` owns `api_tokens` CRUD UI (create/revoke, plaintext-once display); `api` only reads for auth.
- **Master DB access**: reads `organizations`, `spaces`, `space_platforms`, `backup_runs`, `backup_run_bases`, `backup_configurations`, `backup_configuration_bases`, `backup_retention_policies`, `api_tokens`; writes `api_tokens.last_used_at`.
- **Cloudflare**: new Analytics Engine dataset binding + Rate Limiting binding on the `baseout-api` Worker; Logpush for 4xx/5xx monitoring.
- **Public contract stability**: `/v1` is additive-only forever; breaking changes ship as `/v2` (same policy as the inbound change).
- **PRD alignment**: read API is consistent with PRD public-API scope; note that quota/credit enforcement specced for inbound is deliberately deferred here pending pricing finalization (flagged, not silently dropped).
