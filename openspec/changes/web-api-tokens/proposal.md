# web-api-tokens

## Why

`api-rest-read` shipped the public read-only REST API (`apps/api`, `4414893`) and `api-mcp` shipped the MCP server on top of it (`8e74141`). Both authenticate with Bearer tokens from the `api_tokens` master table (canonical schema in `apps/web/src/db/schema/core.ts`, landed `0ed647d`), and `api-rest-read`'s proposal explicitly assigns the other half of the contract: "**`web` owns `api_tokens` CRUD UI (create/revoke, plaintext-once display); `api` only reads for auth.**" That half was never filed as a change. Today there is no way for a customer to obtain a token — the public API is live-but-unusable except by hand-inserting rows. This change closes the loop: a settings surface in `apps/web` to create, view, and revoke API tokens.

PRD §21.3 sets the storage rule ("store hash not plaintext"); the shipped table refines the PRD's indicative column list to the org-owned model documented in `api-rest-read` (org-owned, Space-nullable, scoped) — that supersession is already recorded there and is not re-litigated here.

## What Changes

- **API tokens section on the Settings page** (`apps/web/src/pages/settings.astro`, currently a stub): list the current Organization's tokens (name, `token_prefix`, scopes, Space binding, created/last-used/expires, active status) and provide Create + Revoke actions.
- **Create flow**: name (required), read scopes (`org:read`, `backups:read`, `schema:read` — default all), optional Space binding (NULL = all Spaces in the Org), optional expiry preset. Server mints via the existing `@baseout/shared` `generateApiToken()` helper and persists ONLY `token_prefix` + `token_hash` (SHA-256). The plaintext `bo_live_…` token is displayed exactly once in a copy-to-clipboard modal and is never retrievable again.
- **Revoke flow**: sets `is_active = false` (soft revoke — row retained so the list keeps the audit trail of name/prefix/last-used). No hard delete in v1.
- **Mutating routes** under `apps/web/src/pages/api/tokens/`: `POST /api/tokens` (create), `POST /api/tokens/[id]/revoke`. Session-authenticated via middleware, scoped to the current Organization from `getAccountContext`, restricted to `owner`/`admin` membership roles, CSRF-protected, server-side validated.
- **Not in scope**: write scopes (reserved, `apps/api` is read-only), tier gating of token counts (no quota exists in Features §5.5 yet — flagged, not invented), token editing/rotation (revoke + recreate covers v1), hard delete, `apps/api` changes of any kind, the inbound `api` change's one-token-per-Space reconciliation (owned by that change's disposition, questions-2026-07-20 item 1).

## Capabilities

### New Capabilities

- `api-token-management`: Settings UI + session-authenticated web routes for creating (plaintext-once), listing, and revoking `api_tokens` rows, org-scoped and membership-role-gated.

### Modified Capabilities

None — no existing `openspec/specs/` capability covers token CRUD. The consuming auth behavior (`rest-read-api` requirement "Bearer token auth") is unchanged.

## Impact

- **`apps/web`**: new API routes (`src/pages/api/tokens/`), Settings page section + island script, co-located route tests. No schema change — `api_tokens` and migration `0027` already shipped via `api-rest-read`.
- **`packages/shared`**: consumed as-is (`generateApiToken`, `hashApiToken`); no changes.
- **`apps/api`**: none. Revoked tokens already fail its auth lookup (`is_active` check).
- **Security review points (CLAUDE.md §3.3)**: new mutating surface (create/revoke) — CSRF via better-auth helpers, owner/admin role gate, org-scoping so no cross-org token access, plaintext never persisted or logged, token value never re-displayed. Token create/revoke should eventually write an audit row — the auth/billing audit-log table is a known gap (questions-2026-07-20 item 12); until it exists these events go through the structured logger, noted in design.md D5.
- **Cross-references**: `openspec/changes/api-rest-read/` (token model, D4 helper contract), `openspec/changes/api-mcp/` (same tokens configure MCP clients), PRD §21.3 (hash-at-rest), Features §1 naming (Organization, Space).
