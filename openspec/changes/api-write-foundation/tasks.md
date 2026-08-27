# Tasks — api-write-foundation

TDD throughout (§3.4): every task's tests land red-first in the same commit.

## 1. Registry + router writes

- [ ] 1.1 `bodySchema` on the operation type; router JSON parse + Zod validation for
      POST/PATCH/DELETE; 400 envelope with field issues (tests: happy, malformed JSON,
      schema violation, wrong content-type).
- [ ] 1.2 A throwaway in-repo test operation (`PATCH /v1/_test/echo`, test-env only) proving
      the full write path incl. OpenAPI generation of requestBody — removed once Phase 1
      lands a real mutation, or kept behind `E2E_TEST_MODE` (decide at review).

## 2. Scopes + attribution

- [ ] 2.1 Extend `SCOPES` (+ `authorizeGrant` tests for each new scope; write-scope-without-
      read-scope behavior asserted).
- [ ] 2.2 Auth SELECT joins the token's creating user id onto the grant (test: grant carries
      `createdByUserId`).
- [ ] 2.3 Cross-app one-liner: new scopes in web's token-creation scope list + copy
      (cite `web-api-tokens`; no other web change).

## 3. Dispatch hardening

- [ ] 3.1 Path params derived from path templates; delete `PATH_PARAMS`; regression test:
      an operation with a novel `:whateverId` param round-trips through a tool call.
- [ ] 3.2 Schema-agreement contract test (design D4) across ALL existing 18 tools — fix any
      drift it finds on day one.
- [ ] 3.3 `platform` constant extraction with the multi-platform TODO comment.

## 4. MCP write conventions

- [ ] 4.1 Tool-side body mapping: generalize `bodyTool` so a tool declares which args form
      the JSON body vs query/path (tests: mixed body+path tool).
- [ ] 4.2 Mutation results as MCP content: return the resource representation JSON; `isError`
      envelope on non-2xx (existing behavior, asserted for writes).
- [ ] 4.3 `readOnlyHint` accuracy: write tools carry `readOnlyHint: false` +
      `destructiveHint` on deletes (catalog test).

## 5. Deploy

- [ ] 5.1 Deploy `baseout-api` to workers.dev (dev Hyperdrive + `.dev.vars` secret sync,
      same pipeline shape as the other workers); rewrite the wrangler DEPLOY-BLOCKED comment
      to name only the remaining gap (route + prod Hyperdrive = Dan's env lane).
- [ ] 5.2 Live smoke: `initialize` + `tools/list` + one read tool call against the deployed
      worker with a real token (document the curl trio in this file when green).
- [ ] 5.3 Flag to Dan: apps/api needs a lane in the new env setup (route `api.baseout.com`,
      prod Hyperdrive id).

## 6. Close

- [ ] 6.1 `apps/api` lat.md refresh — the survey found it actively misleading (describes an
      inbound-ingest app + HMAC auth that never shipped); rewrite to the real architecture.
      `lat check` green.
- [ ] 6.2 Gates: typecheck + full apps/api vitest + OpenAPI regen diff-clean.
