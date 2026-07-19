# admin-entity-linking — Tasks

## 1. Schema mirror + data boundary

- [ ] 1.1 Add read-only mirrors `at_bases`, `backup_retention_policies` and missing columns (`connections.created_by_user_id`, `connections.space_id`, `spaces.space_type`) to `apps/admin/src/db/schema/core.ts` with canonical-source header comments
- [ ] 1.2 Write `src/lib/data-boundary.test.ts` guard: no mirrored column name ends `_enc`; wrangler config declares no D1 binding and exactly one Hyperdrive; sessions mirror never selects `token`
- [ ] 1.3 Run guard test red→green against the mirror additions

## 2. Entity-link helper + retrofit

- [ ] 2.1 TDD `src/lib/entity-link.ts`: `entityHref(type, id)` exhaustive over org/space/user/connection/backup-run/restore-run (connections + restores as anchor links)
- [ ] 2.2 Create `EntityLink.astro` (link + hidden peek affordance with `data-peek-*` attributes)
- [ ] 2.3 Retrofit all existing pages (`/`, `/backups`, `/backups/[id]`, `/restores`, `/connections`, `/databases`, `/subscriptions`, `/migration`, `/audit`, `/organizations/[id]`) to render entity references via `EntityLink`; add row `id=` anchors on `/connections` and `/restores`

## 3. Space detail page

- [ ] 3.1 TDD `src/lib/space-detail.ts` view model: org header, members, connections serving the space, backup config + retention, at_bases with inclusion flags, run history, space_databases, storage destinations; explicit empty states; not-found signal
- [ ] 3.2 Create `src/pages/spaces/[id].astro` running the queries from design D2 and rendering the view model with linked entities; 404 on unknown id
- [ ] 3.3 Verify locators render as inert text (no connect/browse affordance) per data-boundary spec

## 4. User detail page

- [ ] 4.1 TDD `src/lib/user-detail.ts` view model: profile + role, memberships, session metadata (ip/user-agent/expiry only), connections created, audit entries as actor/target; not-found signal
- [ ] 4.2 Create `src/pages/users/[id].astro`; assert no session token or `_enc`-adjacent value can appear (serialize view model in test, grep for token keys)

## 5. Peek sidebar

- [ ] 5.1 TDD `src/lib/peek.ts` summarizers (org, space, user, connection, backup run) emitting the closed `{title, subtitle, href, badges, stats}` shape; metadata-only assertion
- [ ] 5.2 Create `src/pages/api/peek/[type]/[id].ts` GET route (existing middleware gate; 400 unknown type, 404 unknown id) + route tests
- [ ] 5.3 Build `PeekSidebar.astro` vanilla-TS island (daisyUI drawer-end, event delegation on `data-peek-*`, loading + error states, `setButtonLoading`-equivalent spinner); mount in `SidebarLayout.astro`
- [ ] 5.4 Verify progressive enhancement: with JS disabled, links navigate and peek buttons stay hidden

## 6. Verification

- [ ] 6.1 `pnpm --filter @baseout/admin test` green (all new libs + guard) and typecheck/build green
- [ ] 6.2 Human smoke on local dev: from `/backups`, peek an org, open its Space page, walk org → space → user → run without touching a bare UUID
- [ ] 6.3 Human smoke on deployed dev (`baseout-admin-dev`) after `pnpm --filter @baseout/admin run deploy`
