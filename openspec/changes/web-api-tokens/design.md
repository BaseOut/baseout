# web-api-tokens — design

## D1. Route shape: org-implicit, not org-in-path

The web app's internal API routes resolve the Organization from the session (`getAccountContext`), not from the URL (`/api/spaces`, `/api/connections` set the pattern). Tokens follow suit:

- `POST /api/tokens` — create. Body: `{ name, scopes, spaceId?, expiresInDays? }`.
- `POST /api/tokens/[id]/revoke` — revoke. POST (not DELETE) to match the repo's mutating-route + CSRF-token convention.
- Listing is SSR on the Settings page (no `GET /api/tokens` in v1 — the page is the only consumer; add the GET when a second consumer exists, YAGNI).

Both routes 404 on a token id that exists but belongs to another Organization (same don't-leak-existence rule as the public API).

## D2. Authorization: owner/admin only

An API token grants read access to the whole Org (or a Space of it) with no further user attribution, so minting one is an org-administration act. Gate create + revoke on `membership.role ∈ {owner, admin}` from `getAccountContext`; `member` sees the token list read-only (prefix/name/status are not secrets) with actions disabled. This mirrors the `resolveCapabilities` owner/admin scoping already used for staff-access resolution.

## D3. Plaintext-once display

The create route responds `{ token, row }` where `token` is the full plaintext — the ONLY time it crosses the wire. The client shows it in a modal with a copy button and a "you won't see this again" warning; the SSR list renders `token_prefix` + `…` thereafter. The plaintext MUST NOT be logged (structured logger included), stored in a nanostore, or placed in the DOM outside the modal. `generateApiToken()` from `@baseout/shared` is the single mint path — no local crypto.

## D4. Soft revoke, no delete

Revoke = `UPDATE api_tokens SET is_active = false, modified_at = now()`. The row stays: `name`/`token_prefix`/`last_used_at` are the customer's audit trail of what the token was and when it last authenticated, and `apps/api` already rejects `is_active = false` on lookup, so revocation is effective on the next request with zero cross-app work. Hard delete is deliberately absent in v1 — an operator who wants the row gone can ask support; revisit if customers demand it.

Re-activation is also absent: revoke is terminal in the UI. A revoked token's hash stays unique-indexed, which is fine — plaintexts are never re-derivable, so no collision path exists.

## D5. Audit logging: structured logger now, audit table later

CLAUDE.md §3.3 wants auth-state changes in an audit table; the customer-facing auth/billing audit-log table does not exist yet (flagged as questions-2026-07-20 item 12, CC7.2/P0 in the SOC 2 evidence pack). Interim: create and revoke emit structured-logger events (`api_token.created`, `api_token.revoked` with org id, token id, acting user id — never the plaintext or hash). When the audit-table change lands, these two events move into it; noted there rather than blocking this change on it.

## D6. UI composition (governance: Storybook first, daisyUI second)

Settings page gains an "API tokens" `Card` section. Reuse cataloged components: `Card`, `TextInput`, `StatusBadge` (active/revoked/expired pill), `Modal` (plaintext-once + revoke confirm), the `.data-table` pattern for the list. Scope checkboxes and the expiry select are plain daisyUI form controls (no wrapper exists — document in `apps/design` `/styleguide` if a new pattern emerges). All server waits go through `setButtonLoading`; revoke asks for confirmation before firing. Any new component variant extends its story in the same change per the coverage test.

## D7. Validation rules (server-side)

- `name`: 1–100 chars after trim, required.
- `scopes`: non-empty subset of `['org:read', 'backups:read', 'schema:read']` — anything else 400s. (Write scopes are reserved; the shared helper's `bo_test_` prefix is likewise never minted here.)
- `spaceId`: when present, must be a Space of the current Organization (else 400) — enforces the FK at the authz layer, not just the DB.
- `expiresInDays`: optional, one of the offered presets (30, 90, 365); omitted = no expiry (`expires_at NULL`). Presets keep the surface small; arbitrary dates can come later if asked for.
- Create returns 201; revoke of an already-revoked token is idempotent 200.
