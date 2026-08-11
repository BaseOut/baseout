# admin-entity-directories — tasks

## 1. Schema mirror + shared helpers

- [x] 1.1 Added `mode` to the mirrored `backup_configurations` in `apps/admin/src/db/schema/core.ts` (canonical column verified; no `*_enc` in the diff).
- [x] 1.2 `estimateMrr` in `subscriptions.ts` is already exported — reused directly (per-org) by the customers lib; no behavior change.
- [x] 1.3 `entityHref(kind, id, orgId)` added to `src/lib/ui.ts` (org → drill-in; space/user → owning-org fallback until detail routes exist) + `ui.test.ts` coverage.

## 2. Customers directory

- [x] 2.1 Failing-first Vitest `customers.test.ts`: counts/tiers/MRR/migration/last-activity assembly, no-subs/spaces/members, unpriceable enterprise, derived-status filter (4 tests).
- [x] 2.2 Pure `src/lib/customers.ts` (green).
- [x] 2.3 `src/pages/customers.astro`: per-D1 queries (`?q=` ilike name/slug, `?status=` derived filter), limit 200 + truncation note, tier/status badges, org links via `entityHref`; read-only.
- [x] 2.4 `/` untouched (only new files + nav entry).

## 3. Users directory

- [x] 3.1 Failing-first `users-directory.test.ts`: membership grouping (org-name sorted) + org links, latest-session pick, never-signed-in, no-membership (2 tests).
- [x] 3.2 Pure `src/lib/users-directory.ts` (green).
- [x] 3.3 `src/pages/users.astro`: users + memberships + latest-session (2-phase query scoped by user ids), `?q=`/`?role=`, role/verified badges, read-only sessions.

## 4. Spaces directory

- [x] 4.1 Failing-first `spaces-directory.test.ts`: config/db/last-run summary incl. "not configured"/"not provisioned", attention-first ordering, error surfacing (3 tests).
- [x] 4.2 Pure `src/lib/spaces-directory.ts` (green) — attention rank computed in the lib (D2).
- [x] 4.3 `src/pages/spaces.astro`: per-D1 queries (latest run via `selectDistinctOn(space_id)`), DB locators rendered inert (plain text), org links via `entityHref`.

## 5. Nav + verification

- [x] 5.1 Added Customers / Users / Spaces to the sidebar NAV (grouped ahead of the operational surfaces; formal group-heading refinement rides with admin-operations-overview's IA restructure).
- [x] 5.2 `pnpm --filter @baseout/admin` astro-check 0 errors + full Vitest suite 211 (incl. the 4 new lib/ui test files, +12 tests).
- [ ] 5.3 **DEFERRED (human smoke):** open the three directories on baseout.local with real dev data — search/filters, org links land on drill-ins, space/user cells fall back to org links, no mutation issued.
