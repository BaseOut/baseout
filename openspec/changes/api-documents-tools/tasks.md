# Tasks — api-documents-tools

TDD throughout (§3.4): every task's tests land red-first in the same commit.

## 1. Scope + converter groundwork

- [x] 1.1 `documents:read` joins `SCOPES` (auth tests: grantable, write≠read both ways);
      web `ALLOWED_SCOPES` + SettingsBody scopeOptions + token test updated (D2).
- [x] 1.2 `src/lib/markdown-plate.ts` — pure markdown→Plate converter per D3 (tests:
      paragraphs, bold/italic/underline-safe marks, headings→bold-p, lists keep prefixes,
      blank-line splitting, empty input → empty-p document).

## 2. Server tag broker (D5)

- [x] 2.1 `removeTagByTarget` in apps/server documents lib + document-existence helper;
      pure request-validation logic tested.
- [x] 2.2 `document-tags.ts` internal handler (POST add / DELETE remove) + route regex in
      apps/server index.ts, mirroring the existing broker files.

## 3. apps/api operations (D1, D3, D4, D6)

- [x] 3.1 serverClient grows documents calls (list/create/get/update/delete/byEntity/tag/untag).
- [x] 3.2 `src/operations/documents.ts` — eight operations with query/body Zod schemas,
      markdown→Plate on create/update, attribution on create, D6 error mapping;
      registered in the operations index. Tests: body-schema validation (markdown XOR body),
      error mapping, response shaping (pure pieces).

## 4. MCP tools (D7)

- [x] 4.1 Eight tool defs + EXPECTED_TOOLS snapshot extension; schema-agreement +
      catalog contract tests green (drift-free argProps).
- [x] 4.2 Dispatch-level tests: tag_document (body mapping), untag_document (DELETE with
      query args), create_document markdown body validated end-to-end via callTool.

## 5. Close

- [x] 5.1 Deploy `baseout-api-dev` + live smoke: tools/list shows document tools under a
      documents-scoped token; create→get→tag→untag→delete round-trip against a real Space
      (document the transcript here). → Deployed 2026-08-27; a documents-only token's
      tools/list correctly shows JUST the 8 document tools.
      **Env-split caveat discovered:** the deployed `baseout-api-dev` brokers to the
      PRODUCTION `baseout-server` (its `baseout-server-dev` is gone), which reads Dan's
      LIVE master DB — while api-dev auths tokens against the DEV DB, so any deployed
      per-Space call correctly returns 502 (`space_db_not_ready` on the engine, tenant ids
      don't cross DBs). Same limitation as web-dev's engine binding; dissolves in Dan's
      env split. The full round-trip was therefore smoked with BOTH workers under local
      `wrangler dev` on the dev DB (server at top-level config so the local service
      registry matches the `baseout-server` binding, api via `node scripts/dev.mjs
      --port 8788`): create (markdown→Plate + excerpt verified) → update → tag →
      list_entity_documents (`entityRemoved: true` for a fake field — correct) → untag →
      re-untag (404 `tag_not_found`) → delete → get (404 `document_not_found`). ALL GREEN.
      The new tag broker routes are live only locally until the next apps/server deploy
      (NOT deployed here — baseout-server is the production script).
- [x] 5.2 Gates: apps/api tsc + full vitest; apps/server targeted suites + tsc; OpenAPI
      regen committed; lat check green (update apps/api lat.md scope list).
      → api 123/123 + tsc green; server documents suites 30/30 + tsc green (full server
      suite still has the known DO-teardown hang — targeted per the auto-memory); web
      token tests 20/20; openapi.json regenerated (27 operations, +8); lat check exit 0
      (service-auth.md now documents nine scopes).
