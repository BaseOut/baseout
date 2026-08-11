# admin-entity-linking — Tasks

## 1. Schema mirror + data boundary

- [x] 1.1 Added read-only mirrors `at_bases`, `backup_retention_policies` + columns `connections.created_by_user_id`, `connections.space_id`, `spaces.space_type`, `backup_configurations.auto_add_future_bases`, `backup_configuration_bases.is_auto_discovered` to `apps/admin/src/db/schema/core.ts` (canonical-source headers; no *_enc).
- [x] 1.2/1.3 `data-boundary.test.ts` guard (green): no mirrored column ends `_enc`; wrangler declares no D1 + exactly one Hyperdrive; no source selects `sessions.token` into output (WHERE-by-token lookups allowed).

## 2. Entity-link helper + retrofit

- [x] 2.1 `src/lib/entity-link.ts` — `entityHref` exhaustive over org/space/user/connection/backup_run/restore_run (connections + restores as `#id` anchors) + `isPeekable`; `entity-link.test.ts`. ui.ts re-exports it (flip of the C.2 interim helper).
- [x] 2.2 `EntityLink.astro` (link + hidden peek button with `data-peek-*`).
- [x] 2.3 Retrofit landed additively across the pre-existing pages: `/backups`, `/backups/[id]`, `/databases`, `/subscriptions`, `/migration`, `/audit`, `/organizations/[id]` now link org/space/user/backup_run refs via `EntityLink` (join `/`, `/users`, `/spaces`, `/spaces/[id]`, `/users/[id]` were already done). `astro check` clean. Two pages deliberately NOT converted (documented): `/connections` (its hardcoded `/connections/${id}?ret=` link is strictly better than the helper's `#anchor`) and `/restores` (no detail page; `entityHref` returns a self-anchor). **FOLLOW-UP:** fix `entityHref('connection', id)` → `/connections/${id}` (a real detail page now exists), then link the connection refs in `/backups/[id]`, `/audit`, `/organizations/[id]`; and add `id=` row anchors on `/connections`+`/restores` that the helper's `#anchor` form assumes.

## 3. Space detail page

- [x] 3.1 `src/lib/space-detail.ts` view model (green): org header, members, connections serving the space, config + retention, at_bases w/ inclusion flags, run history, databases, storage; empty states; not-found signal. `space-detail.test.ts` (3).
- [x] 3.2 `src/pages/spaces/[id].astro` — queries per D2, linked entities via EntityLink, 404 on unknown id.
- [x] 3.3 DB locators are NOT exposed at all (view model omits pg_locator/d1_database_id) — stronger than inert text.

## 4. User detail page

- [x] 4.1 `src/lib/user-detail.ts` view model (green): profile + role, memberships, session metadata (ip/user-agent/expiry only), connections created, audit as actor/target; not-found. `user-detail.test.ts` (4).
- [x] 4.2 `src/pages/users/[id].astro`; the test serializes the view model + asserts no `token` key + sessions expose only metadata keys.

## 5. Peek sidebar

- [x] 5.1 `src/lib/peek.ts` — org/space/user/connection/backup_run summarizers, closed `{title, subtitle, href, badges, stats}` shape; `peek.test.ts` asserts secret-free serialized output.
- [x] 5.2 `src/pages/api/peek/[type]/[id].ts` GET route (400 unknown type, 404 unknown id) under the existing `/api/*` gate.
- [x] 5.3 `PeekSidebar.astro` vanilla-TS island (fixed drawer, event delegation on `data-peek-*`, loading/error states); mounted once in `SidebarLayout.astro`.
- [x] 5.4 Progressive enhancement: peek buttons render `hidden`, un-hidden on hydrate; links navigate with JS off.

## 6. Verification

- [x] 6.1 `pnpm --filter @baseout/admin` astro-check 0 errors + full Vitest 242 (entity-link 2, space-detail 3, user-detail 4, peek 4, data-boundary 3).
- [ ] 6.2 **DEFERRED (human smoke, local):** from `/backups`, peek an org, open its Space page, walk org → space → user → run without touching a bare UUID.
- [ ] 6.3 **DEFERRED (deploy):** `baseout-admin-dev` deploy + repeat.
