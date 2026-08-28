# Tasks — api-views-tools

Design is inherited from the documents pattern (api-documents-tools D1/D6/D7) + the two
view-specific rules in proposal.md (opaque config, create-only tableId); no separate design.md.

- [x] 1.1 serverClient grows views calls (list/create/get/update/delete).
- [x] 1.2 `src/operations/views.ts` — five operations (views:read / views:write), Zod body
      schemas (create: name+tableId+config required; patch: no tableId key), attribution,
      documents-style broker error mapping (404 view_not_found passthrough; broker 400
      incl. table_locked → public 400). Registered in the operations index. Tests.
- [x] 1.3 Five MCP tools + EXPECTED_TOOLS extension; schema-agreement + catalog tests green.
- [x] 1.4 Deploy `baseout-api-dev`; live smoke via the LOCAL wrangler pair (create → list →
      update → table_locked rejection → delete); transcript recorded here.
- [x] 1.5 Gates: apps/api tsc + full vitest; OpenAPI regen committed; lat check green.

## Session notes (2026-08-27)

- Deployed to baseout-api-dev (32 OpenAPI operations, 26 MCP tools). Live smoke via the
  LOCAL wrangler pair (deployed per-Space calls stay blocked by the env split): create →
  list → rename+unpin (updatedAt bumps) → delete → 404, all green.
- **updateViewBody is `.passthrough()` on purpose**: the live smoke caught Zod's default
  unknown-key stripping silently DROPPING a `tableId` in a REST PATCH (rename applied,
  move ignored, 200). Passthrough lets the broker's table_locked enforcement answer with
  the right code — verified live: PATCH with tableId → 400 `table_locked`.
- Gates: apps/api 138/138 + tsc green; OpenAPI regen committed; lat check exit 0.
