## Context

`apps/api` is a placeholder Worker. The unarchived inbound change (`openspec/changes/api/`) already establishes the public-API ground rules for this Worker: `api.baseout.com`, URL-versioned `/v1`, Bearer auth against a shared `api_tokens` table, Zod validation, OpenAPI at `docs.baseout.com`, additive-only v1. This change adds the read side. All data already exists: `backup_runs` / `backup_configurations` / `backup_retention_policies` in the master DB, and captured schema in the per-Space `bo_at_*` tables reachable only through `apps/server`.

Decisions already made with the product owner (2026-07-18): public vocabulary is `orgs` (not accounts); backups are platform-free while schema carries a bare platform short-code segment (`/at/`); tokens are Org-owned with optional Space binding; rate limits are tracked but not enforced until pricing tiers are finalized; `apps/sql` is untouched; the earlier inbound-API change is under review (writes, when they come, will be POSTs on this resource tree — inbound-style ingestion likely belongs with `apps/hooks`).

## Goals / Non-Goals

**Goals**

- Ship the complete v1 read-only resource tree (org, spaces, backups, schema, search) with conventions strong enough that future endpoints and the MCP server (`api-mcp`) inherit them unchanged.
- One source of truth per operation (path + Zod schemas + handler) feeding router, OpenAPI, and later MCP tools.
- Meter every request per token so tier enforcement can be turned on later without re-instrumenting.

**Non-Goals**

- Writes/mutations, quota blocking, credit debiting, webhooks, token CRUD UI (owned by `web`), the SQL API, OAuth for third-party apps.

## Decisions

### D1. Lives on `apps/api` — the Worker's first real surface

Read routes live in `apps/api` under `/v1/orgs/*` — not a fourth public Worker.

- Shared token auth, one wrangler config, one OpenAPI doc, one deploy; the MCP server (`api-mcp`) mounts on the same Worker.
- Future write endpoints are POST/PATCH on this same resource tree (additive within v1). The earlier inbound change's separate `/v1/inbound/*` namespace is under product-owner review (2026-07-18) — ingestion-style pushes likely belong with `apps/hooks`; nothing here depends on inbound landing.
- *Alternative rejected*: separate Worker — duplicates auth/metering middleware and doubles drift surface for no isolation benefit.

### D2. URL shape: platform-free backups, bare platform code for schema

```
/v1/orgs/{orgId}
/v1/orgs/{orgId}/spaces
/v1/orgs/{orgId}/spaces/{spaceId}
/v1/orgs/{orgId}/spaces/{spaceId}/platforms
/v1/orgs/{orgId}/spaces/{spaceId}/backups/...
/v1/orgs/{orgId}/spaces/{spaceId}/at/schema/...
```

- **Backups are platform-free.** Backup history, configuration, retention, and status read as universal concepts; a Space's platform(s) show up as attributes (e.g. per-base breakdowns carry Airtable base ids), not as routing. If a future platform genuinely needs divergent backup routes, they can be added additively under the platform segment then — we don't pay the URL tax on every call today for a divergence we can't yet describe.
- **Schema is platform-scoped** with the bare canonical short code (`at` — same code as the `bo_at_` table prefix and `platforms.code`): `.../spaces/{spaceId}/at/schema/bases`. Captured schema shape is inherently per-Platform (Airtable's base/table/field/view model won't match Notion's), and multi-platform Spaces are an explicit future direction (`space_platforms` join table already exists). With additive-only v1, omitting the code would force a parallel route tree later.
- No `platforms/` literal in the segment (product-owner call, 2026-07-18 — URL length): collision risk between two-letter platform codes and future Space sub-resource names is negligible and routes are registered explicitly. `GET .../spaces/{spaceId}/platforms` (the discovery listing) keeps its full name — it's a resource, not a namespace.
- V1 behavior: the only accepted code is `at`; any other value → 404 `platform_not_found`. Documentation states which subtrees exist per platform.
- *Alternative rejected*: fully platform-free URLs with the platform as a response field/doc concern only — reads fine today but breaks the day one Space carries two platforms' schemas.

### D3. Data-access boundary: master DB in-Worker, client DBs via `server`

Mirrors the inbound change's rule that `apps/api` never touches client DBs:

- Org/Space/backup resources: `apps/api` reads the master DB directly (it already reads it for `api_tokens`, per the inbound design).
- Schema resources (`bo_at_*` in per-Space DBs): `apps/api` forwards to `apps/server` internal endpoints with the HMAC service token — existing `schema-read` / `schema-changelog`, plus a **new `POST /api/internal/spaces/:id/schema-search`** endpoint. That server-side work is the paired follow-up change `server-rest-read-support` (per the CLAUDE.md §3.6 pairing convention); this change defines the contract.
- Rationale: per-Space DB backends vary (D1 / managed PG / BYODB) and connection/dispatch logic lives in `server`; duplicating it in `api` would be the real drift risk.

### D4. Token model: Org-owned, Space-optional

`api_tokens`: `organization_id` NOT NULL, `space_id` NULLABLE (NULL = all Spaces in the Org), `scopes` text[] (`org:read`, `backups:read`, `schema:read`; write scopes reserved), `token_prefix` (display), `token_hash` (SHA-256, plaintext shown once), `is_active`, `expires_at`, `last_used_at`. Token format `bo_live_<random>` (`bo_test_` reserved).

- Path must match grants: wrong `orgId`, or `spaceId` outside a Space-bound token, returns **404** (never 403 — don't confirm other tenants' IDs exist).
- Supersedes the inbound change's one-token-per-Space note; reconcile there at implementation/archive time.

### D5. Conventions

- **Pagination**: cursor-based everywhere (`?limit=` 1–100 default 50, `?cursor=` opaque base64 keyset). No offsets.
- **Envelope**: lists `{ "data": [...], "pagination": { "nextCursor": string|null } }`; single resources bare objects; errors `{ "error": { "type", "code", "message", "param?", "requestId" } }` + `X-Request-Id` header on every response.
- **Timestamps**: ISO 8601 UTC. **IDs**: Baseout UUIDs for org/space/run; native Airtable IDs (`appX`/`tblX`/`fldX`) for schema entities.
- **Caching**: schema responses carry `ETag` derived from the base's current `schema_hash`; `If-None-Match` → 304.
- **Conveniences**: `?expand=` (e.g. `tables/{id}?expand=fields`), `?fields=` sparse responses — specced from day one so clients don't over-fetch.

### D6. Schema search

`POST .../schema/search` with a structured JSON config (`query`, `types`, `match.mode` = contains|exact|prefix, `match.in`, `filters` incl. `baseIds`/`fieldTypes`/`isPrimary`/`changedAfter`, `sort`, `limit`/`cursor`), plus convenience `GET .../schema/search?q=` mapping to defaults. Results are heterogeneous hits, each carrying `type` and full ancestry (base → table) so a field hit is actionable without extra round-trips.

- Execution is in `server` (D3): v1 is normalized `LIKE`-based matching over `bo_at_bases/tables/fields/views` name/description/options — no FTS dependency, identical semantics on D1 and PG. Relevance ranking / fuzzy can be added later without breaking the request shape (`match.mode: "fuzzy"` is additive).

### D7. Usage tracking without enforcement (Cloudflare-native)

- **Metering**: a Workers **Analytics Engine** dataset (`baseout_api_requests`); one `writeDataPoint` per authenticated request — blobs: token id, org id, space id, platform, route template, method, status, surface (`rest`/`inbound`/`mcp`); doubles: 1 (count), duration ms. Queryable via the AE SQL API for usage dashboards and future billing reconciliation.
- **Shadow rate limiting**: the Workers **Rate Limiting binding** configured with a generous provisional key rate (e.g. 100 req/60s per token — a placeholder, see Open Questions); `limit()` is evaluated on every request and the outcome **logged and reflected in `X-RateLimit-*` headers, but never blocks** (`RATE_LIMIT_ENFORCE=false` env flag). Flipping to enforce (429 + `Retry-After`) is a config change, not a code change.
- Monthly tier quotas (the inbound change's 10K/50K/200K model) are **not** wired: plans aren't final. The AE dataset is the system of record that makes turning them on cheap.
- *Alternative considered*: zone-level WAF Rate Limiting Rules — kept available as a pure-ops abuse backstop (no code), but per-token logic belongs in the Worker where the token is known.

### D8. Single operation registry → router, OpenAPI, MCP

Each endpoint is declared once: `{ method, pathTemplate, scope, querySchema/bodySchema (Zod), responseSchema (Zod), handler }`. The router, the OpenAPI 3 generator (`scripts/generate-openapi.ts`), and the `api-mcp` tool catalog all derive from this registry. A drift between REST and docs or MCP becomes structurally impossible rather than CI-caught.

## Risks / Trade-offs

- [No enforcement = no abuse protection] → shadow limits + AE give detection; a zone-level WAF rule can be applied operationally without a deploy; revisit before public launch.
- [Extra hop for schema reads (`api` → `server`)] → Worker-to-Worker via service binding (not public HTTP); ETag/304 short-circuits repeat polls.
- [`LIKE` search on large schemas] → schema entities per Space are thousands, not millions; acceptable v1; FTS is an internal upgrade invisible to the contract.
- [Deep URLs] → backups dropped the platform segment entirely; schema uses the two-letter code; flat fetch-by-ID routes (`.../at/schema/tables/{tableId}`) keep drill-down nesting for listing only.
- [Bare `/at/` segment could theoretically collide with a future Space sub-resource name] → platform codes are a small registry of two-letter codes; route registration is explicit; reject any future Space resource named like a platform code at review time.
- [Rate Limiting binding is beta] → it is shadow-only here; if it misbehaves, nothing customer-visible breaks.
- [`api_tokens` not in any live schema yet] → this change owns introducing it in `packages/db-schema`; `web` CRUD lands separately — until then tokens are provisioned by staff via admin/SQL.

## Migration Plan

No existing traffic or consumers; nothing to migrate. Order: `packages/db-schema` migration (`api_tokens`) → `server-rest-read-support` internal endpoints → `apps/api` routes behind `api.baseout.com` → OpenAPI publish. Rollback = route removal; no data mutations anywhere.

## Open Questions

- Provisional shadow-limit numbers (100 req/60s per token?) and whether a hard abuse ceiling should actually block pre-launch, or stay fully observational. **Needs product-owner confirmation** that the Workers Rate Limiting binding + Analytics Engine combination is what was meant by "Cloudflare's API rate limits feature" (vs zone WAF Rate Limiting Rules — see D7 for how both slot in).
- `docs.baseout.com` hosting mechanics (static OpenAPI + reference UI) — inherited open item from the inbound change.
- Whether `GET /v1/orgs/{orgId}` should include usage summary (calls this period from AE) at v1 or ship later as an additive field.
