# Design — api-write-foundation

## D1 — Mutations are registry operations, nothing else

The existing shape (operation = `{method, path, scope, querySchema, handler}` assembled in
`src/operations/index.ts`, dispatched by the router and mirrored 1:1 into MCP tools) extends
rather than forks: add `bodySchema?: ZodType` to the operation type; the router validates
`content-type: application/json`, parses, Zod-validates, and hands `c.body` to the handler.
400 with field-level issues on validation failure (same error envelope as query validation).
The REST↔MCP parity contract tests (`tests/mcp-catalog.test.ts`) keep enforcing that every
eligible operation has a tool — mutations included, so a write endpoint can never ship
REST-only by accident.

## D2 — Scopes: additive vocabulary, same authorize path

`SCOPES` grows to eight. Mapping rule stays "operation declares one scope"; write operations
declare the `:write` scope of their area. A `:write` scope does NOT imply its `:read` (tokens
compose scopes explicitly — simpler to reason about in the token UI than implication rules).
`api_tokens.scopes` is already a free string array — no migration. The web token-creation
surface lists the new scopes with copy warning that write scopes let integrations modify
Space content (single-line addition; `web-api-tokens` cited, not reopened).

## D3 — Path params derived, not listed

`dispatch.ts` extracts `:param`-shaped segments from the operation's path template at
catalog-build time and forwards matching tool args automatically. The hardcoded `PATH_PARAMS`
array dies. Grant-aware elision (orgId/spaceId injection, platform constant) is unchanged —
it keys off param NAMES, which now come from the template.

## D4 — Tool schemas: agreement test over generation

Full JSON-Schema generation from Zod (zod-to-json-schema) is tempting but the hand-written
descriptions are part of the tool UX and worth keeping. Instead: a contract test walks every
tool's `argProps` against the operation's query+body+path Zod shape and fails on any missing/
extra/type-mismatched property. Drift becomes a red test instead of a silent lie. (If the test
proves brittle in practice, generation is the fallback — decided then, not now.)

## D5 — Attribution

`api_tokens` carries its creating user. Write handlers resolve `grant.tokenId → created_by`
once per request (join at auth time — one column added to the auth SELECT, no second query)
and thread it into broker payloads that want a user id (documents `createdByUserId`, reports
`created_by`). No service-ghost users; provenance in UI copy is the feature phases' concern.

## D6 — Deploy now on workers.dev, real domain later

`wrangler deploy` of `baseout-api` with dev Hyperdrive + secrets from `.dev.vars` (same
deploy+secret-sync shape as the other workers; secrets NEVER in wrangler.jsonc). The
production env block stays empty until Dan's env split gives apps/api its lane — recorded in
the wrangler DEPLOY-BLOCKED comment, which this change rewrites to describe the remaining gap
only (route + prod Hyperdrive). Rate limiting stays shadow; metering binds if the AE dataset
name resolves, else stays a no-op — both are Phase 5.

## D7 — What this change deliberately does NOT do

No feature operations (reports/documents/views land in their own phases); no OAuth 2.1; no
quota; no D1 read path for per-Space data (managed_pg-only stance unchanged, 501 elsewhere).
