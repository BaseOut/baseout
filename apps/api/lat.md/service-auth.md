# Service Auth

Two auth boundaries: **inbound** customer bearer tokens (per-Org, hashed in DB) and **outbound** calls to `apps/server` via the `SERVER` service binding gated by `INTERNAL_TOKEN`. There is no HMAC scheme in this app.

## Inbound: Bearer API Tokens

Tokens (`bo_live_…`) are issued in `apps/web`'s settings UI; the DB stores **only the SHA-256 hash** in `api_tokens.token_hash` per [shared/Baseout_PRD.md §21.3](../../../shared/Baseout_PRD.md). Plaintext is shown once at creation.

Per request ([src/lib/auth.ts](../src/lib/auth.ts)):

1. Read `Authorization: Bearer <token>`; parse + SHA-256.
2. Look up by hash in the mirrored `api_tokens` table ([src/db/schema.ts](../src/db/schema.ts)). 401 on miss, inactive, or expired.
3. The row becomes the request's `TokenGrant`: org id, optional Space binding (`space_id` NULL = all Spaces), scope list, and `createdByUserId` — the issuing user, joined at auth time and threaded into mutation attribution (design D5; no second query, no service-ghost users).
4. `authorizeGrant` per operation: path-Org mismatch → tenant-safe 404 `org_not_found` (never 403); Space-bound token on another Space → 404 `space_not_found`; missing scope → 403 `insufficient_scope`.
5. `last_used_at` is written behind the response via `ctx.waitUntil`.

## Scopes

Ten scopes, declared in `SCOPES` ([src/lib/auth.ts](../src/lib/auth.ts)); each operation declares exactly one. A `:write` scope does NOT imply its `:read` — tokens compose scopes explicitly (api-write-foundation D2).

The list: `org:read`, `backups:read`, `schema:read`, `views:read`, `views:write`, `documents:read`, `documents:write`, `reports:read`, `reports:write`, `data:read`. Document reads are deliberately NOT under `schema:read` — schema structure and internal documentation are different sensitivity classes (api-documents-tools D2). Web's token-creation UI offers all nine; write scopes render unchecked by default with warning copy. Per [root security-model](../../../lat.md/security-model.md), grant the narrowest viable set.

## Outbound: SERVER Service Binding

Per-Space schema reads go to `apps/server`'s `/api/internal/*` through the `SERVER` binding with the `x-internal-token: INTERNAL_TOKEN` header ([src/lib/server-client.ts](../src/lib/server-client.ts)).

The token is byte-identical to the value `baseout-server` holds (the same secret web's `BACKUP_ENGINE_INTERNAL_TOKEN` carries). The binding gives network-level isolation; the token stays as defense-in-depth. Secrets come from `.dev.vars` via the deploy script's `wrangler secret bulk` sync — never hand-set (CLAUDE.md §3.3).

## Where to Look

Pointers to related rules and helpers.

- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Root security model: [root security-model](../../../lat.md/security-model.md)
- Token generation/hash helpers: `packages/shared/src/api-tokens.ts`
- API token table: [shared/Baseout_PRD.md §21.3](../../../shared/Baseout_PRD.md)
