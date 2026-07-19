## 1. Query Layer

- [ ] 1.1 Shared schema-query helpers over the per-Space DB dispatch layer: scoped selects for bases/tables/fields/views, ancestry joins, derived plain-text options string for matching (dual-backend safe)
- [ ] 1.2 Keyset cursor utility (opaque base64, deterministic tie-break ordering) with gap/duplicate tests
- [ ] 1.3 Dual-backend test rig (Miniflare D1 + Docker PG) seeding identical fixture schemas — reuse existing server test infra if present, else stand up

## 2. Endpoints

- [ ] 2.1 `POST /api/internal/spaces/:spaceId/schema-search` — config re-validation, LIKE matching with wildcard escaping, ancestry-joined hits, pagination (tests first, both backends)
- [ ] 2.2 Additive params on `schema-read` (`entity`, `baseId`, `tableId`, `ids`, `limit`, `cursor`) + regression test locking the parameterless web contract
- [ ] 2.3 `GET /api/internal/spaces/:spaceId/schema-versions?baseId=` (no `schema_json` in listings)
- [ ] 2.4 Additive filters + pagination on `schema-changelog` + parameterless regression test
- [ ] 2.5 Per-base `schemaHash` included in every schema-read/search response

## 3. Contract & Verification

- [ ] 3.1 Recorded response-shape fixtures shared with the `api-rest-read` integration suite (drift between internal and public contracts fails tests)
- [ ] 3.2 Internal-token gate tests for every new/extended route (401 before client-DB access)
- [ ] 3.3 Cross-reference check: update `api-rest-read` specs if any shape diverged during implementation; both changes edited together per proposal
