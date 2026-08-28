# Tasks — api-write-foundation

TDD throughout (§3.4): every task's tests land red-first in the same commit.

## 1. Registry + router writes

- [x] 1.1 `bodySchema` on the operation type; router JSON parse + Zod validation for
      POST/PATCH/DELETE; 400 envelope with field issues (tests: happy, malformed JSON,
      schema violation, wrong content-type). → `src/lib/body.ts` (`parseValidatedBody`),
      method union grew PATCH/DELETE, `tests/body.test.ts`.
- [x] 1.2 A throwaway in-repo test operation (`PATCH /v1/_test/echo`, test-env only) proving
      the full write path incl. OpenAPI generation of requestBody — removed once Phase 1
      lands a real mutation, or kept behind `E2E_TEST_MODE` (decide at review).
      → `src/operations/_test.ts`; decision: NOT registered in the shipped `operations`
      array at all (tests compose it in) — stricter than an env gate.

## 2. Scopes + attribution

- [x] 2.1 Extend `SCOPES` (+ `authorizeGrant` tests for each new scope; write-scope-without-
      read-scope behavior asserted). → `SCOPES` const in `src/lib/auth.ts` (8 scopes).
- [x] 2.2 Auth SELECT joins the token's creating user id onto the grant (test: grant carries
      `createdByUserId`). → mirror column + pure `grantFromRow` (no second query; the column
      already exists canonically — `created_by_user_id`, core.ts).
- [x] 2.3 Cross-app one-liner: new scopes in web's token-creation scope list + copy
      (cite `web-api-tokens`; no other web change). → `ALLOWED_SCOPES` + SettingsBody
      scopeOptions + ApiTokensPanel warning copy; write scopes render UNCHECKED by default.

## 3. Dispatch hardening

- [x] 3.1 Path params derived from path templates; delete `PATH_PARAMS`; regression test:
      an operation with a novel `:whateverId` param round-trips through a tool call.
      → `pathParamNames()` in catalog.ts; `PATH_PARAMS` deleted; `tests/mcp-writes.test.ts`.
- [x] 3.2 Schema-agreement contract test (design D4) across ALL existing 18 tools — fix any
      drift it finds on day one. → `tests/schema-agreement.test.ts`; required declaring
      `querySchema` on all tool-backed ops + `searchBodySchema` on POST search (the real
      day-one fix — the shapes didn't exist); zero argProps drift found once declared.
- [x] 3.3 `platform` constant extraction with the multi-platform TODO comment.
      → `src/lib/platform.ts` (`DEFAULT_PLATFORM`), used by dispatch + requirePlatform.

## 4. MCP write conventions

- [x] 4.1 Tool-side body mapping: generalize `bodyTool` so a tool declares which args form
      the JSON body vs query/path (tests: mixed body+path tool). → `bodyArgs: "all" | string[]`;
      MCP-built bodies also pass the operation's bodySchema (same rigor as REST).
- [x] 4.2 Mutation results as MCP content: return the resource representation JSON; `isError`
      envelope on non-2xx (existing behavior, asserted for writes). → tests/mcp-writes.test.ts.
- [x] 4.3 `readOnlyHint` accuracy: write tools carry `readOnlyHint: false` +
      `destructiveHint` on deletes (catalog test). → method-derived `toolAnnotations()` with
      per-tool `readOnly` override (search_schema stays a read).

## 5. Deploy

- [x] 5.1 Deploy `baseout-api` to workers.dev (dev Hyperdrive + `.dev.vars` secret sync,
      same pipeline shape as the other workers); rewrite the wrangler DEPLOY-BLOCKED comment
      to name only the remaining gap (route + prod Hyperdrive = Dan's env lane).
      → `env.dev` block ("baseout-api-dev", shared dev Hyperdrive
      `ba2652f4…`, SERVER→`baseout-server` since `baseout-server-dev` no longer exists);
      `deploy:dev` + `secrets:sync:dev` scripts (sync-secrets.mjs copied from apps/server).
      LIVE at https://baseout-api-dev.openside.workers.dev (DATABASE_URL + INTERNAL_TOKEN synced).
- [x] 5.2 Live smoke: `initialize` + `tools/list` + one read tool call against the deployed
      worker with a real token (document the curl trio in this file when green).
      → GREEN 2026-08-27 with an org-wide read token (Openside org). The trio
      (`$TOKEN` = a `bo_live_…` token with the read scopes):
      ```
      BASE=https://baseout-api-dev.openside.workers.dev
      curl -X POST "$BASE/mcp" -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
      curl -X POST "$BASE/mcp" -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
        -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
      curl -X POST "$BASE/mcp" -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
        -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_org","arguments":{}}}'
      ```
      All three returned 200; get_org returned the org profile through Hyperdrive.
- [x] 5.3 Flag to Dan: apps/api needs a lane in the new env setup (route `api.baseout.com`,
      prod Hyperdrive id). → Recorded in the wrangler.jsonc DEPLOY-BLOCKED comment + here;
      Autumn to relay in the next Dan sync: **apps/api needs (1) the `api.baseout.com`
      route on the baseout.com zone, (2) the production "baseout live" Hyperdrive id for
      env.production, (3) a previews/staging decision for `baseout-api-staging`.**

## 6. Close

- [x] 6.1 `apps/api` lat.md refresh — the survey found it actively misleading (describes an
      inbound-ingest app + HMAC auth that never shipped); rewrite to the real architecture.
      `lat check` green. → lat.md/architecture.md/service-auth.md rewritten (registry
      pipeline, MCP mount, bearer+INTERNAL_TOKEN reality, dev deploy state); versioning.md
      updated; `scripts/lat-check-all.sh` exit 0.
- [x] 6.2 Gates: typecheck + full apps/api vitest + OpenAPI regen diff-clean.
      → apps/api `tsc --noEmit` green; 90/90 vitest green (8 files); `openapi:generate`
      re-run — only intended diff (requestBody on POST search), committed with the change.
      apps/web token tests 20/20 green; web `typecheck` failures are PRE-EXISTING
      (middleware.ts handleSsoAccountLinked + DataBrowse.astro — another session's WIP,
      verified by stash-compare; none in the files this change touched).
