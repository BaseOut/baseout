# airtable-client — design

## Overview

Single cross-cutting change introducing the shared Airtable client library. Three workstreams in one change folder:

1. **Extraction** — `apps/web/src/lib/airtable/* + apps/web/src/lib/crypto.ts → packages/shared/airtable/* + packages/shared/crypto.ts`. Pure refactor; tests stay green; no behavior change in `apps/web`.
2. **Server-side additions** — Records API, attachments, Enterprise variant, refresh helper. All net-new; lives in `packages/shared/airtable/`.
3. **Server consumption** — `apps/server/src/lib/airtable.ts` exposes a typed `AirtableClient` accessor that engine-core (a future change) will use.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Crypto | Web Crypto API (AES-256-GCM) | Pure; works in browser + Workers + Node 18+. Already in apps/web. |
| HTTP | `fetch` | Native everywhere. |
| Pagination | Airtable cursor (`offset`) | Per Airtable Records API spec. |
| Backoff | Exponential + jitter, cap 60 s, parses `Retry-After` | Matches existing apps/web `client.ts` pattern; extends cap from 8 s → 60 s for server long-running jobs. |
| Token refresh | Pure function in shared; cadence in cron change | Keeps shared library scheduling-free. |
| Enterprise detection | Inspect granted-scopes list at exchange + on every API call | Matches existing apps/web runtime detection. |

## Decisions

### D1: One change owns extraction + new features (vs. two-change split)
**Decision:** Single `airtable-client` change.
**Why:** Extraction without consumption is YAGNI; consumption without extraction creates a duplicate. The "second call site triggers extraction" rule says do them together. One agent, one PR, one verification gate.

### D2: New code lives in `packages/shared/airtable/`, not `packages/airtable/` or per-app duplication
**Decision:** `packages/shared/airtable/` (subfolder of the existing `packages/shared` package).
**Why:** `packages/shared` is already the home for cross-app utilities (encryption, HMAC tokens, errors, Zod helpers per the README). The Airtable client fits the same description. Creating a new top-level `packages/airtable/` package is over-abstraction for one library.

### D3: OAuth route handlers stay in `apps/web`
**Decision:** Only the helper modules move; `apps/web/src/pages/api/connections/airtable/{start,callback}.ts` stay in `apps/web`.
**Why:** Route handlers depend on `apps/web` middleware (better-auth session, CSRF, redirect handling). Moving them would require introducing a route framework to the shared package — out of scope.

### D4: Server reads `connections` rows; doesn't write them
**Decision:** apps/server reads `connections.access_token_enc / refresh_token_enc / token_expires_at / scopes / is_enterprise` per request. Writes happen only via apps/web (OAuth callback) or via `baseout-server-cron-oauth-refresh` (refresh cadence — separate change).
**Why:** Master-DB schema ownership rule (CLAUDE.md §2): apps/web owns the schema. apps/server mirrors specific tables. Two writers risk drift.

### D5: 60-second backoff cap (vs. 8 s in apps/web today)
**Decision:** 60 s cap with jitter for the shared library.
**Why:** apps/web's 8 s cap is fine for interactive OAuth flows. Server backups are long-running jobs; longer backoff is safer when Airtable rate-limits a high-throughput run. apps/web's behavior is unchanged because its caller still uses default options.

### D6: `connections.is_enterprise` column add — verify before this change
**Decision:** Before authoring this change tomorrow, grep `apps/web/src/db/schema/` and `packages/db-schema/` for `is_enterprise`. If absent, defer the column add to a one-line `baseout-db-schema-airtable-enterprise` follow-up; this change writes against the column once it lands.
**Why:** Modifying `packages/db-schema/` is serialized (only one change at a time per the parallel-agent rules). Don't bundle schema work into this change unless necessary.

## Risks / Trade-offs

- **Mass import-path change in apps/web** could break unrelated tests if a path is missed. Mitigation: `grep -r "@/lib/airtable\|@/lib/crypto" apps/web` to enumerate exhaustively before refactor; run `apps/web` test suite after.
- **Server-side rate-limit coordination is deferred** to `baseout-server-durable-objects`. Until that lands, server backup runs share Airtable's per-base 30 req/sec budget cooperatively (each request retries on 429 independently). Acceptable for PoC; insufficient for production-scale concurrent runs.
- **Enterprise scope variant requires real Enterprise OAuth credentials to fully test.** Standard scope path can be tested against the existing apps/web stub harness (`apps/web/src/pages/api/stub/airtable/`); Enterprise path is unit-tested only until a real Enterprise customer is onboarded. Tracked as a known gap.

## Migration Plan

Single-phase change (no live migration):
1. Move files (preserve history via `git mv` where possible).
2. Update `packages/shared/package.json` to expose the new subpath exports.
3. Update apps/web imports.
4. Add new server-side modules to `packages/shared/airtable/`.
5. Wire `apps/server/src/lib/airtable.ts`.
6. Run typecheck + test for both apps.
7. Open PR linking this change folder.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| Q1 | PRD-11 — which Enterprise customers get webhook API access? | Default to "all Enterprise-scope tokens that include `enterprise.webhooks:manage`"; confirm before `baseout-server-cron-webhook-renewal` lands. |
| Q2 | Does `connections.is_enterprise` exist in the master DB schema today? | Verify before kickoff (see D6). If absent, add via a one-line `baseout-db-schema-airtable-enterprise` change first. |
| Q3 | Is the existing apps/web stub harness moving with the OAuth helpers, or staying behind? | Stays in apps/web. The stub routes live under `apps/web/src/pages/api/stub/airtable/` and are dev-only middleware; out of scope for the shared library. |
