# Tasks — api-search-tools

TDD throughout (§3.4).

## 1. Server broker additions (D3)

- [x] 1.1 Documents list broker: `?q=` ILIKE over title/excerpt (lib + handler + tests).
- [x] 1.2 Media broker: `q` filename filter (EXISTS over asset_refs) + handler param (tests).

## 2. Scope + sources (D2, D3)

- [x] 2.1 `reports:read` joins SCOPES (auth tests; web ALLOWED_SCOPES + UI + token test).
- [x] 2.2 `report_definitions` mirrored (read-only columns) into apps/api db/schema.

## 3. Operations + tools (D1, D3)

- [x] 3.1 serverClient: `dataSearch`, `mediaList`, documents list `q`.
- [x] 3.2 `src/operations/search.ts` — four search operations with querySchemas; registered.
      Tests: query validation, envelope shaping, report ILIKE scoping (mocked db).
- [x] 3.3 Four MCP tools + EXPECTED_TOOLS; schema-agreement + catalog green.

## 4. appUrl (D4)

- [x] 4.1 `PUBLIC_APP_URL` env + wrangler vars (top-level local + env.dev; production
      stays unset until Dan's lane).
- [x] 4.2 `src/mcp/app-urls.ts` pure enrichment + dispatch wiring (tests: per-hit on the
      search tools + search_schema, top-level on schema/document gets, no-op without the var).

## 5. Close

- [x] 5.1 Deploy `baseout-api-dev`; live smoke via the local wrangler pair: search_records
      against real captured data + appUrl presence (transcript here).
- [x] 5.2 Gates: apps/api tsc + full vitest; server targeted suites + tsc; OpenAPI regen;
      lat check green (scope list → ten).

## Session notes (2026-08-27)

- Live smoke (local wrangler pair, Staging space): `search_records q=a` → 2 base groups of
  REAL captured records, every hit carrying `appUrl=/data?record=<rec>&table=<tbl>`;
  `search_reports q=e` → "Full Staging Report" with `/reports/<id>`; `search_schema` hits +
  `get_table` carry `/schema?entity=<id>`; documents/attachments empty-but-200 (Space has
  none). Deployed to baseout-api-dev (36 OpenAPI operations, 30 MCP tools;
  PUBLIC_APP_URL dev var → the dev console).
- search_schema hit shape is `{ type, entity: { <type>Id } }` — the enrichment maps
  base/table/field/view to their id keys (caught live; the first cut assumed a flat `id`).
- Server broker q-filters (documents title/excerpt, media filename) ride the api op tests +
  live smoke; the engine test pool hosts no Postgres for lib-level ILIKE assertions.
