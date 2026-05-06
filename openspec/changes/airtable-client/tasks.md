## 1. Pre-flight

- [ ] 1.1 Confirm `connections.is_enterprise` column exists in master DB schema. If absent, pause and create `baseout-db-schema-airtable-enterprise` change first (one-line: ADD COLUMN; document migration).
- [ ] 1.2 Confirm `apps/web` test suite is green on `main` before starting (`pnpm --filter @baseout/web test:unit && pnpm --filter @baseout/web test:integration`).
- [ ] 1.3 Verify apps/web `BASEOUT_ENCRYPTION_KEY` and apps/server `BASEOUT_ENCRYPTION_KEY` resolve to the same secret value in dev (`.dev.vars` for each app).

## 2. Extraction (apps/web → packages/shared)

- [ ] 2.1 Create `packages/shared/airtable/` directory; create `packages/shared/airtable/index.ts` (empty barrel for now).
- [ ] 2.2 `git mv apps/web/src/lib/airtable/oauth.ts → packages/shared/airtable/oauth.ts`.
- [ ] 2.3 `git mv apps/web/src/lib/airtable/cookie.ts → packages/shared/airtable/cookie.ts`.
- [ ] 2.4 `git mv apps/web/src/lib/airtable/config.ts → packages/shared/airtable/config.ts`.
- [ ] 2.5 `git mv apps/web/src/lib/airtable/client.ts → packages/shared/airtable/client.ts`.
- [ ] 2.6 `git mv apps/web/src/lib/crypto.ts → packages/shared/crypto.ts`.
- [ ] 2.7 Update `packages/shared/package.json` exports map: add `./airtable`, `./airtable/oauth`, `./airtable/client`, `./airtable/config`, `./crypto` subpath exports.
- [ ] 2.8 Update `packages/shared/airtable/index.ts` to re-export public surface from the moved files.
- [ ] 2.9 In `apps/web/src/`, replace all `@/lib/airtable/*` imports with `@baseout/shared/airtable/*` (script: `grep -rln "@/lib/airtable" apps/web/src apps/web/tests | xargs sed -i '' 's|@/lib/airtable|@baseout/shared/airtable|g'` — verify with grep that nothing is left).
- [ ] 2.10 In `apps/web/src/`, replace all `@/lib/crypto` imports with `@baseout/shared/crypto`.
- [ ] 2.11 Move existing tests for these modules: `git mv apps/web/tests/.../airtable* packages/shared/airtable/` (preserve test file paths; update test imports to relative).
- [ ] 2.12 `pnpm --filter @baseout/web exec astro check` → 0 errors.
- [ ] 2.13 `pnpm --filter @baseout/web test:unit` → green.
- [ ] 2.14 `pnpm --filter @baseout/shared test` → green (new test target if not present).
- [ ] 2.15 `pnpm --filter @baseout/web build` → exits 0.

## 3. New shared modules (server-side capabilities)

- [ ] 3.1 Create `packages/shared/airtable/records.ts` — Records API client. Public surface: `listRecords(baseId, tableId, opts)` returning `{ records: AirtableRecord[]; offset?: string }`.
- [ ] 3.2 Implement pagination: parse `offset` from response; pass to next `listRecords` call until response has no `offset`.
- [ ] 3.3 Implement 429 handling: parse `Retry-After` header (seconds); sleep + retry up to N times (default 5).
- [ ] 3.4 Implement exponential-backoff with jitter for transient failures (5xx, network errors); cap 60 s.
- [ ] 3.5 Define typed errors: `RateLimitError(retryAfter: number)`, `TokenExpiredError`, `InvalidBaseError`, `PermissionDeniedError`. Export from `packages/shared/airtable/errors.ts`.
- [ ] 3.6 Unit tests with `msw` for: pagination cursor advancement, 429 with Retry-After, 5xx backoff, 401 → TokenExpiredError, 403 → PermissionDeniedError, 404 → InvalidBaseError.
- [ ] 3.7 Create `packages/shared/airtable/attachments.ts` — attachment URL refresh.
- [ ] 3.8 Implement `refreshAttachmentUrls(baseId, tableId, recordId, attachmentField)` — re-fetches the record, returns refreshed URLs from the named field.
- [ ] 3.9 Implement expiry detection helper `isUrlExpiringSoon(url, withinMinutes = 60)` — parses Airtable URL TTL convention.
- [ ] 3.10 Unit tests for attachment URL refresh: fresh URL skip, near-expiry refresh, expired URL refresh, refresh failure.
- [ ] 3.11 Create `packages/shared/airtable/enterprise.ts` — Enterprise scope variant.
- [ ] 3.12 Implement `detectEnterpriseScopes(grantedScopes: string[])` returning `{ isEnterprise: boolean; capabilities: ('webhooks' | 'metadata-extended' | …)[] }`.
- [ ] 3.13 Unit tests for Enterprise detection: standard scopes only, single Enterprise scope, mixed scopes, malformed scope strings.
- [ ] 3.14 Create `packages/shared/airtable/refresh.ts` — pure token-refresh helper.
- [ ] 3.15 Implement `refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string)` returning `{ accessToken: string; refreshToken?: string; expiresIn: number; scope: string }` — calls Airtable token endpoint, parses response.
- [ ] 3.16 Unit tests for refresh: successful refresh, invalid refresh token, network failure, malformed response.
- [ ] 3.17 Update `packages/shared/airtable/index.ts` barrel to export the four new modules.

## 4. Server wiring (apps/server)

- [ ] 4.1 Create `apps/server/src/lib/airtable.ts` — `Connection` accessor.
- [ ] 4.2 Implement `getAirtableClient(connectionId, masterDb)` — reads `connections` row, decrypts tokens via `@baseout/shared/crypto`, returns a typed `AirtableClient` instance bound to the connection.
- [ ] 4.3 The returned `AirtableClient` exposes: `listBases()`, `listTables(baseId)`, `listFields(baseId, tableId)`, `listRecords(baseId, tableId, opts)`, `refreshAttachmentUrls(...)`, `getConnectionState()`.
- [ ] 4.4 Implement integration test (workers-pool harness already in apps/server): `getAirtableClient` → `listBases` → mocked Airtable response → returns parsed bases.
- [ ] 4.5 Add `AIRTABLE_OAUTH_CLIENT_ID` and `AIRTABLE_OAUTH_CLIENT_SECRET` to `apps/server/.dev.vars.example` and `apps/server/wrangler.jsonc`.
- [ ] 4.6 Document the `AirtableClient` interface shape in `apps/server/src/lib/airtable.ts` JSDoc — engine-core (future change) reads this as its contract.

## 5. Verification

- [ ] 5.1 `pnpm install` from root succeeds; postinstall symlinks repaired.
- [ ] 5.2 `pnpm typecheck` across the workspace exits 0.
- [ ] 5.3 `pnpm test` across the workspace exits 0 (or all targeted suites green).
- [ ] 5.4 `apps/web` dev server boots and `/login`, `/integrations` (the OAuth start flow), `/connections/airtable/callback` (callback) work end-to-end (smoke test against the existing stub harness).
- [ ] 5.5 `apps/server` dev server boots; `getAirtableClient` integration test green.
- [ ] 5.6 `grep -r "@/lib/airtable\|@/lib/crypto" apps/web` returns nothing — extraction is complete.
- [ ] 5.7 `grep -r "apps/web/src/lib/airtable\|apps/web/src/lib/crypto" .` (excluding node_modules, .git) returns nothing — no stale references.

## 6. PR + handoff

- [ ] 6.1 Open PR against `main` with title `airtable-client: extract apps/web Airtable code to @baseout/shared; add records, attachments, Enterprise, refresh helpers`.
- [ ] 6.2 PR body links to `openspec/changes/airtable-client/`.
- [ ] 6.3 Request review from someone who can validate: (a) the extraction is faithful (apps/web behavior unchanged), (b) the new server-side modules respect Workers runtime constraints (no Node primitives, no `cloudflare:workers` import in code shared with Node tooling).
- [ ] 6.4 On merge, hand off to next agent picking up `baseout-server-engine-core` — the `AirtableClient` interface in `apps/server/src/lib/airtable.ts` is their consumption point.

## 7. Operational follow-ups (outside this change)

- [ ] 7.1 If `connections.is_enterprise` was added in pre-flight, run the migration in dev / staging / prod.
- [ ] 7.2 When Enterprise customer is onboarded, run end-to-end Enterprise OAuth test against the real Airtable Enterprise endpoint (currently mocked only).
- [ ] 7.3 Post-merge, file `baseout-server-cron-oauth-refresh` issue to schedule the refresh cadence (this change only provides the helper; not the schedule).
