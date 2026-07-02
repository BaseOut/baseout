## Status

DONE + green. Removes the "re-provision required" caveat from the v3/v4/v5
per-Space features by upgrading existing Spaces in place (additive, idempotent,
lazy on access). INVARIANT: additive-only — a future ALTER needs a real migration.

---

## 1. Idempotent DDL — DONE

- [x] 1.1 `spacePgDdlStatementsIdempotent()` (`packages/db-schema/src/space/pg-ddl-upgrade.ts`) — rewrites CREATE TABLE/INDEX/UNIQUE INDEX → IF NOT EXISTS; exported as the lean `./space/pg-ddl-upgrade` subpath (no drizzle weight). Tests `pg-ddl-upgrade.test.ts` (4): all CREATEs rewritten, count + tables preserved, no double IF NOT EXISTS, 27 tables.

## 2. Upgrade helper — DONE

- [x] 2.1 `apps/server/src/lib/provisioning/upgrade.ts` — `needsUpgrade` (pure), `upgradeManagedPgSchema` (tx + SET LOCAL search_path + idempotent DDL), `ensureSpaceSchemaCurrent` (no-op when current; else upgrade + bump `space_databases.schema_version`). `resolveSpaceDb` returns `schemaVersion`. Tests `upgrade.test.ts` (5).

## 3. Lazy hooks + explicit route — DONE

- [x] 3.1 `ensureSpaceSchemaCurrent` wired into `health-overview`, `relationships-overview`, `chat-threads`, `chat-thread`, `chat-send` (before per-Space reads) + `schema-sync` (best-effort, never fails the sync).
- [x] 3.2 `POST /api/internal/spaces/:id/migrate-schema` (`migrate-schema.ts`) + `index.ts` wiring. Route-guard tests `spaces-migrate-schema-route.test.ts` (3).

## 4. Verification

- [x] 4.1 server `typecheck` + `build` green; `db-schema` build + tests (9) green; upgrade/migrate-schema/chat/relationships/schema-mirrors/runs-start batch green (63). No stray `console.*`.
- [ ] 4.2 Human smoke: take a Space provisioned at v2/v3, open Relationships/Health/Chat → tables auto-created, `space_databases.schema_version` bumps to 5, tabs work; `POST /migrate-schema` returns `{upgraded:true,...}` then `{upgraded:false}` on re-run.

## Notes / future

- Additive-only invariant documented in `pg-ddl-upgrade.ts` + `upgrade.ts`. A non-additive change (ALTER/type change) must add an explicit migration step in `upgradeManagedPgSchema`, not rely on IF NOT EXISTS.
- A one-shot backfill sweep (call `/migrate-schema` for every active managed_pg Space) can retire the lazy checks later; not needed now (lazy covers it).
