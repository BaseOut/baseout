# admin-entity-linking — Design

## Context

The admin app (Astro SSR, `@astrojs/cloudflare`, daisyUI via `@web` alias, per-request Hyperdrive Postgres) has 13 pages built on a proven pattern: partial schema mirror → pure lib module (takes rows + `now: Date`, returns view models) → Vitest → `.astro` page. Cross-entity navigation is patchy: `/organizations/[id]` and `/backups/[id]` exist, but Spaces and users have no pages, and most references render as plain text. This change adds the two missing detail pages, a repo-wide linking convention, a peek sidebar, and codifies the master-DB-only data boundary.

## Goals / Non-Goals

**Goals:**
- `/spaces/[id]` and `/users/[id]` detail pages on the existing lib+page pattern.
- One shared `entityHref()` helper; retrofit all existing pages to use it.
- A peek sidebar that works as progressive enhancement over normal links.
- Spec-owned data boundary with a mechanical guard test.

**Non-Goals:**
- No mutations, no new admin actions, no session revocation or role editing.
- No per-Space DB reads (explicitly the boundary this change codifies).
- No list pages (`/customers`, `/users`, `/spaces` indexes) — sibling `admin-entity-directories`.
- No Google SSO, no prod deploy.

## Decisions

### D1. Schema-mirror additions (read-only)

Add to `apps/admin/src/db/schema/core.ts`, following the existing header rules (no FKs, no `*_enc`, canonical-source comments):

- `at_bases`: id, space_id, at_base_id, name, discovered_via, first_seen_at, last_seen_at.
- `backup_retention_policies`: id, space_id, policy_tier, keep_last_n, daily_window_days, weekly_window_days, monthly_indefinite.
- Existing-mirror column additions: `connections.created_by_user_id`, `connections.space_id`, `connections.scopes` stays out (not needed); `spaces.space_type`; `organization_members.invited_by_user_id`, `organization_members.is_default` already present.
- `users`/`sessions` continue to come from `@baseout/db-schema` re-exports (sessions: select ip_address, user_agent, created_at, expires_at — never `token`).

### D2. Detail-page libs follow the org-detail pattern

`src/lib/space-detail.ts` and `src/lib/user-detail.ts` are pure modules: the page runs the Drizzle queries, passes row arrays + `now` in, gets a typed view model out (status classification reuses `connection-health.ts` classifier and `run` badge helpers from `ui.ts`). Space detail is ~8 queries keyed on one space id (space+org join; members; connections where org matches and (`scope='organization'` or `space_id` matches); backup_configurations (+ bases joined to at_bases); backup_retention_policies; last 25 backup_runs; restore_runs; space_databases; storage_destinations). User detail is ~5 queries (user; memberships joined to orgs; sessions ordered by created_at desc limit 10; connections by created_by_user_id; admin_audit_log where actor_user_id or (target_type='user' and target_id) matches, limit 50). All limits stated on-page.

### D3. `entityHref()` as the single route authority

`src/lib/entity-link.ts` exports `entityHref(type: EntityType, id: string): string` plus an `EntityLink.astro` component (label, type, id, optional peek). Connections and restores have no `[id]` pages; they map to `/connections#<id>` and `/restores#<id>` anchors with row `id=` attributes — good enough for v1 and centralized for later upgrades. Retrofit = mechanical replacement across the 10 existing pages.

### D4. Peek sidebar: one island + JSON summary endpoints

Mechanism: a single `PeekSidebar.astro` island (vanilla TS, no framework — matches admin's zero-island status quo; a `<script>` module + `<aside>` drawer using daisyUI `drawer-end`). `EntityLink` renders `<a href=...>` plus a small peek button (`data-peek-type/data-peek-id`); the island event-delegates on `[data-peek-type]`, fetches `/api/peek/<type>/<id>`, renders a typed summary card. Chosen over HTML-fragment endpoints because JSON keeps the render logic in one client module and the endpoints trivially testable as pure shapers; chosen over full framework island to avoid adding React to admin for one drawer.

Endpoints: `src/pages/api/peek/[type]/[id].ts` — one route, a `switch` over five summarizers in `src/lib/peek.ts` (org, space, user, connection, backup run). Each summarizer returns `{ title, subtitle, href, badges: [{label, tone}], stats: [{label, value}] }` — a closed shape so the client renderer never branches per type. Gated by existing middleware (it covers `/api/*` already, returning JSON 401/403); GET-only, no CSRF concerns, no caching headers (always fresh).

Progressive enhancement: the `<a>` navigates without JS; the peek button is rendered `hidden` and un-hidden by the island on hydrate.

### D5. Data-boundary enforcement

- Guard test `src/lib/data-boundary.test.ts`: imports the schema-mirror module, asserts no column's SQL name ends `_enc` and no table outside the approved master-DB set is present; greps `src/` (via `import.meta.glob` or a small fs walk in the test) for `d1_database_id`/`pg_locator` usage outside display contexts is overkill — instead assert `package.json`/`wrangler.jsonc.example` declare no D1 bindings and no second Hyperdrive.
- The spec (not just code comments) now owns the rule; PR review + guard test are the enforcement pair.

### D6. Testing

Plain Vitest (node) per house pattern: `space-detail.test.ts`, `user-detail.test.ts` (view-model shaping incl. empty states and 404 signaling), `entity-link.test.ts` (route map exhaustive over EntityType), `peek.test.ts` (all five summarizers; secret-free output asserted by serializing and grepping for token-like keys), `data-boundary.test.ts`. Target ≥ the existing lib coverage bar (80%).

## Risks / Trade-offs

- [Anchor links for connections/restores are weak targets] → centralized in `entityHref`; upgrading to real detail pages later is a one-line route change.
- [Space detail fans out ~8 queries per view] → acceptable for a staff tool (single-digit RPS); queries are indexed by space_id; no N+1 loops.
- [Peek endpoints add a new read surface] → same gate as every route; closed summary shape; summarizers unit-tested to emit metadata only.
- [Mirror drift vs web canonical schema] → same standing risk as all mirrors; header comments name canonical migrations; guard test catches `_enc` regressions.
- [Vanilla-TS island grows unwieldy if peek scope expands] → acceptable at 5 types; revisit framework island only if peek becomes interactive beyond render.

## Migration Plan

Pure additive app change: new routes + retrofits behind no flags. Deploy via the existing `pnpm --filter @baseout/admin run deploy` dev pipeline. Rollback = revert commit; no schema, no data.

## Open Questions

- None blocking. Whether `/connections` should get a real `[id]` page is deferred to a future change; `entityHref` isolates the decision.
