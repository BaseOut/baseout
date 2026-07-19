# admin-support-search — tasks

## 1. Schema mirror

- [ ] 1.1 Mirror `at_bases` (id, space_id, at_base_id, name) into `apps/admin/src/db/schema/core.ts` with the canonical-source header comment; export from `src/db/schema/index.ts`. No FKs, no `*_enc` columns, no migrations.

## 2. Pure search lib (TDD)

- [ ] 2.1 Write `src/lib/search.test.ts` first: `detectQuery` shape table (UUID, `cus_`, `sub_`, `app…`, email exact/prefix, free text, trim/case/ILIKE-escape, <2-char and empty inputs → no lookups).
- [ ] 2.2 Implement `detectQuery(q): QueryPlan` in `src/lib/search.ts` per design D1 (precedence-ordered shape tests, normalized query, planned lookups).
- [ ] 2.3 Extend tests then implement `linkFor(entity)` with the D3 fallback matrix (spaces/users → owning-org detail until `admin-entity-linking` lands; membership-less user unlinked).
- [ ] 2.4 Extend tests then implement the redirect decision (exact-shape single match → target URL; exact multi-match and free-text → grouped list) and the LIMIT-11 truncation flag.
- [ ] 2.5 Implement `runSearch(db, plan)`: per-shape Drizzle queries (PK probes via `Promise.all`, joined context per group per D6, per-group LIMIT 10+1). Keep it thin; all branching lives in the tested pure functions.

## 3. Page + chrome

- [ ] 3.1 Add `src/pages/search.astro`: trim `q`; empty → guidance state listing accepted shapes; else `detectQuery` → `runSearch` → 302 on redirect decision, otherwise grouped results (labeled groups, disambiguating context columns, truncation notice, no-results state). Read-only, existing middleware gate.
- [ ] 3.2 Add the GET search form to `SidebarLayout.astro` under the brand block (hidden in rail-collapsed mode; present in the mobile off-canvas sidebar).

## 4. Verify

- [ ] 4.1 `pnpm --filter @baseout/admin test` green; `npm run typecheck` + build green for apps/admin.
- [ ] 4.2 Human smoke on baseout.local:4332: paste a run UUID (→ direct redirect to `/backups/[id]`), an org name fragment (→ grouped list), a `cus_` ID, an `appXXX` base ID, a user email, an empty query, and a garbage query; confirm non-staff still 403s on `/search`.
