# api-write-foundation

## Why

Dan's 2026-08-27 directive: everything under Schema/Data/Reports should be doable from MCP
(backup management excluded — UI-only for now). `apps/api` today is read-only by construction:
the operation registry has never carried PATCH/DELETE, the auth layer knows only three read
scopes, and the MCP dispatch has growth footguns (a hardcoded path-param list that silently
drops unknown ids, hand-written tool JSON Schemas that can drift from the operations' Zod
schemas, `platform` hardcoded to `"at"`). Every feature phase of the app-parity plan
(`plans/2026-08-27-mcp-app-parity.md`) needs the same write plumbing — build it once, here.

The worker is also deploy-blocked (placeholder Hyperdrive id, no route, empty env blocks), so
nothing built on it is usable by a real MCP client until it runs somewhere.

## What Changes

- **Write-capable registry**: router + operation registry accept POST/PATCH/DELETE with
  Zod-validated JSON bodies; mutations return the canonical resource representation.
- **Scope vocabulary grows**: `documents:write`, `reports:write`, `views:read`, `views:write`,
  `data:read` join the three read scopes. `authorizeGrant` unchanged in shape; read scopes and
  existing tokens keep working untouched. Web's token-issuance surface gains the new scopes
  (checkbox list — `web-api-tokens` owns that UI; cross-ref, single-line change there).
- **Dispatch hardening** (the three footguns): path params derived from the operation's path
  template instead of the hardcoded `PATH_PARAMS` list; tool input schemas either generated
  from the operations' Zod schemas or locked by a schema-agreement contract test; `platform`
  stays `"at"` but moves to one named constant with the multi-platform TODO.
- **Mutation conventions**: attribution fields threaded from the token's issuing user (plan
  D3); Analytics Engine metering already tags every call — mutations add `surface`-consistent
  route templates so usage stays attributable.
- **First real deploy**: workers.dev with the dev Hyperdrive (usable by MCP clients
  immediately); `api.baseout.com` + production Hyperdrive explicitly deferred to Dan's env
  completion (flagged to him — apps/api needs a lane in the new setup).

## Capabilities

### New Capabilities
- `api-writes`: the public API/MCP can mutate resources under a write-scoped token, with
  validation, tenant guards, attribution, and metering identical in rigor to the read path.

### Modified Capabilities
- `api-rest-read` / `api-mcp` conventions extend to mutations; read behavior unchanged
  (contract tests must stay green without edits to read expectations).

## Impact

- `apps/api` only (router, auth, dispatch, catalog, tests, wrangler deploy). The §3.6 scope is
  single-app; consumers (server brokers) are untouched — feature phases wire them.
- Security review points (§3.3): new write scopes are opt-in per token; tenant-safety 404
  posture preserved on mutations; no new secret; rate limiting still shadow-mode (enforcement
  is Phase 5); backup mutations deliberately impossible (no such operations registered — plan D6).
- Blocked-by: nothing. Blocks: every other phase of the app-parity plan.
