# admin-entity-directories — design

## Context

`apps/admin` is an Astro SSR app (Cloudflare adapter) reading the master DB per-request via Hyperdrive. Existing surfaces follow one proven pattern (`admin-read-surfaces`): partial schema mirror in `src/db/schema/core.ts` → pure lib module taking flat query rows + `now: Date` → Vitest suite → read-only `.astro` page gated by the existing middleware. `/organizations/[id]` already exists as the org drill-in; `/spaces/[id]` and `/users/[id]` arrive with `admin-entity-linking`.

## Goals / Non-Goals

**Goals:**
- Three global directories (`/customers`, `/users`, `/spaces`) with search, filters, bounded limits, cross-links.
- Zero new access surface: master DB only, read-only, no `*_enc`, no locator dereferencing.

**Non-Goals:**
- Repurposing `/` (owned by `admin-operations-overview`).
- Detail pages `/spaces/[id]` / `/users/[id]` (owned by `admin-entity-linking`).
- Full pagination (offset/cursor); bounded limits + search match the existing house pattern.
- Any mutation or admin action.

## Decisions

**D1 — One pure lib module per page, mirroring `tracker.ts`.**
`src/lib/customers.ts`, `src/lib/users-directory.ts`, `src/lib/spaces-directory.ts` each export row interfaces + a pure assembly function (`buildCustomersDirectory(...)` etc.) that joins flat query-result arrays in memory. Rationale: matches every existing surface; testable without a DB. Alternative (single SQL query with json_agg per page) rejected — house style keeps SQL trivial and logic pure/tested.

**Queries per page** (each a small set of `select`s, joined in the lib):
- `/customers`: `organizations` (search/status-filtered, limit) + per-org aggregates via `GROUP BY organization_id` counts on `spaces` and `organization_members` + `subscriptions`/`subscription_items` (reuse the MRR-estimate derivation already in `src/lib/subscriptions.ts` — export it rather than duplicating) + latest run per org (`backup_runs` join `spaces`, `max(created_at)` grouped by org).
- `/users`: `users` (search/role-filtered, limit) + `organization_members` join `organizations` (names) for those user ids + latest `sessions.updated_at` grouped by `user_id`.
- `/spaces`: `spaces` join `organizations` (name) (search/status-filtered, limit) + `space_platforms`/`platforms` + `backup_configurations` + `space_databases` + latest run per space (`DISTINCT ON (space_id)` ordered by `created_at desc`).

**D2 — Attention-first ordering is computed in the lib, not SQL.**
`spaces-directory.ts` assigns each row an attention rank (last run failed / space `error` / DB `error` → 0, else 1) and sorts (rank, name). Same approach `/databases` uses; keeps the SQL orderings simple and the rule unit-tested.

**D3 — Link-target fallback is a lib-level helper.**
A tiny `entityHref(kind, id, orgId)` helper in `src/lib/ui.ts` returns `/organizations/[orgId]` for `space`/`user` kinds until the detail routes exist, then flips to `/spaces/[id]` / `/users/[id]` in `admin-entity-linking` (one-line change, guard-tested there). Avoids scattering the fallback rule across three pages.

**D4 — Schema mirror additions are minimal.**
Add `mode` to the mirrored `backup_configurations` (canonical column exists; needed for the config summary) and `scope`(already present)/nothing else. `users`, `sessions` stay re-exported from `@baseout/db-schema`; `organization_members` is already mirrored. No new tables needed — everything the directories read is already mirrored except that one column.

**D5 — Limits and filters via querystring, same as existing pages.**
`?q=` ILIKE on the driving table only (org name/slug; user email/name; space name + org name), `?status=` / `?role=` as exact-match filters, `limit 200` with an on-page "showing first 200" note when hit (matches `/subscriptions`). Search is applied in SQL (not post-filter) so the limit doesn't starve results.

**D6 — Nav placement.** Three entries added to the sidebar under a "Directory" group heading (Customers, Users, Spaces), ahead of the operational group — anticipates the IA grouping the ops-overview change formalizes, without depending on it.

## Risks / Trade-offs

- [Aggregate queries over `backup_runs` scan per page load] → All grouped aggregates are bounded by the driving-table limit (ids passed via `inArray`); `backup_runs` is indexed on status and the per-org/space latest-run lookups filter on the limited id set.
- [`/users` exposes every customer email to any staff member] → Acceptable and intended for a staff console; the gate (staff-only) is unchanged, sessions are read-only, and no auth tokens are ever selected.
- [Fallback links (space → org drill-in) may briefly confuse staff before `admin-entity-linking` lands] → The `entityHref` helper centralizes the flip; land entity-linking soon after.
- [MRR estimate is a derivation, not Stripe truth] → Reuse the existing `subscriptions.ts` derivation verbatim and label the column "est.", as `/subscriptions` already does.

## Migration Plan

Additive only: new pages, new libs, one mirrored column, nav edits. No master-DB migrations, no changes to existing routes; safe to deploy independently of (before or after) `admin-operations-overview` and `admin-entity-linking`. Rollback = revert the commit.

## Open Questions

- None blocking. If `admin-entity-linking` lands first, implement D3's helper there and consume it here.
