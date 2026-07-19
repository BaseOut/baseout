# admin-entity-directories — tasks

## 1. Schema mirror + shared helpers

- [ ] 1.1 Add `mode` to the mirrored `backup_configurations` in `apps/admin/src/db/schema/core.ts` (verify against canonical `apps/web/src/db/schema/core.ts`; header-comment rules unchanged; confirm no `*_enc` columns in the diff)
- [ ] 1.2 Export the MRR-estimate derivation from `apps/admin/src/lib/subscriptions.ts` for reuse (no behavior change; existing tests stay green)
- [ ] 1.3 Add `entityHref(kind, id, orgId)` to `apps/admin/src/lib/ui.ts` returning `/organizations/[orgId]` fallback for `space`/`user` kinds + `/organizations/[id]` for orgs; Vitest in `ui.test.ts`

## 2. Customers directory

- [ ] 2.1 Write failing Vitest for `buildCustomersDirectory` in `apps/admin/src/lib/customers.test.ts`: row assembly (counts, tiers, MRR, migration flags, last activity), orgs with no subs/spaces/members, name/slug search semantics, status filter, limit-note flag
- [ ] 2.2 Implement pure `apps/admin/src/lib/customers.ts` (green)
- [ ] 2.3 Create `apps/admin/src/pages/customers.astro`: queries per design D1, `?q=`/`?status=` handling, limit 200 + on-page note, tier badges, org links via `entityHref`; read-only
- [ ] 2.4 Leave `/` untouched (assert no diff outside new files + nav)

## 3. Users directory

- [ ] 3.1 Write failing Vitest for `buildUsersDirectory` in `users-directory.test.ts`: membership grouping + org links, latest-session pick, never-signed-in users, role filter, email/name search, limit-note flag
- [ ] 3.2 Implement pure `apps/admin/src/lib/users-directory.ts` (green)
- [ ] 3.3 Create `apps/admin/src/pages/users.astro`: users + memberships + latest-session queries, `?q=`/`?role=`, role/verified badges, read-only sessions access

## 4. Spaces directory

- [ ] 4.1 Write failing Vitest for `buildSpacesDirectory` in `spaces-directory.test.ts`: config summary (incl. "not configured"), last-run outcome + error surfacing, DB backend/status ("not provisioned"), attention-first ordering rule, search, status filter
- [ ] 4.2 Implement pure `apps/admin/src/lib/spaces-directory.ts` (green)
- [ ] 4.3 Create `apps/admin/src/pages/spaces.astro`: queries per design D1 (latest-run via `DISTINCT ON`), locators rendered inert (plain text, no links), org links via `entityHref`

## 5. Nav + verification

- [ ] 5.1 Add "Directory" nav group (Customers, Users, Spaces) to the sidebar layout with active-state handling
- [ ] 5.2 Full suite green: `pnpm --filter @baseout/admin test` + `typecheck` + `build`
- [ ] 5.3 Human smoke on baseout.local: all three directories render with real dev data; search/filters work; org links land on drill-ins; space/user cells fall back to org links (no 404s); no mutation issued (verify via read-only review of new pages)
