# admin-support-search — tasks

## 1. Schema mirror

- [x] 1.1 `at_bases` (id, space_id, at_base_id, name, +discovered_via/seen timestamps) already mirrored into `apps/admin/src/db/schema/core.ts` with the canonical-source header comment and barrel export (landed in admin-entity-linking). No FKs, no `*_enc`, no migrations. No new mirror needed.

## 2. Pure search lib (TDD)

- [x] 2.1 `src/lib/search.test.ts` first: `detectQuery` precedence table (UUID w/ whitespace+case, `cus_`, `sub_`, `app…`, too-short `app`, email, free text, empty, `<2`-char), `escapeLike`, `linkFor` matrix (+ base→space, base-without-space→null), `decideRedirect` (exact-single / exact-multi / text / none), `finalizeGroup` truncation, `orgContext`, `membershipContext`.
- [x] 2.2 `detectQuery(q): QueryPlan` per D1 (precedence-ordered shape tests, trimmed `normalized`, `exact` flag, shape-relevant `lookups`). 25 tests green.
- [x] 2.3 `linkFor(ref)` over the single route authority `entityHref` (admin-entity-linking landed → the D3 fallback matrix is moot; documented). Base → owning Space; base with no Space → unlinked.
- [x] 2.4 Redirect decision `decideRedirect(plan, exactMatches)` (exact-shape single → target; exact-multi + free-text → list) + `finalizeGroup` LIMIT-10 slice with the +1-probe truncation flag.
- [x] 2.5 `runSearch(db, plan)`: per-shape Drizzle (5 concurrent UUID PK probes via `Promise.all`; exact `cus_`/`sub_`/`app`/email; ILIKE free-text; per-group `LIMIT 11`). Context (org tier+status, user memberships, owning org/space) via one bounded query per group keyed by matched IDs (D6). All branching delegated to the tested pure fns.

## 3. Page + chrome

- [x] 3.1 `src/pages/search.astro`: trims `q`; empty → guidance state listing accepted shapes; else `detectQuery` → `runSearch` → 302 on the redirect decision, otherwise grouped results (labeled groups, disambiguating context column, per-group truncation notice, no-results state that re-lists accepted shapes). Read-only; existing middleware gate.
- [x] 3.2 GET search form added to `SidebarLayout.astro` under the brand block (`role="search"`, `action="/search"`), hidden on the collapsed rail; present in the mobile off-canvas sidebar (it IS the sidebar on <lg).

## 4. Verify

- [x] 4.1 `pnpm --filter @baseout/admin test` green (273; search 25 new); admin `astro check` 0 errors (126 files).
- [ ] 4.2 **DEFERRED (human smoke, baseout.local:4332):** run UUID → 302 to `/backups/[id]`; org name fragment → grouped list; `cus_`/`app…`/user email; empty + garbage queries; confirm non-staff still 403s on `/search`.
