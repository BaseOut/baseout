# admin-crm-ux

## Why

The admin console has grown into a set of flat, bounded tables: every listing hard-caps at 100–200 rows with no pagination, no column sorting, and only ad-hoc per-page filters, and mutation buttons (force backup, invalidate connection, force migration, acknowledge error) sit directly on listing rows. Staff workflows are CRM-shaped — find an account, drill into its command center, act from there — and the current surfaces can't support that once real customer volume arrives (thousands of orgs/runs would silently truncate). This change reimplements the admin UX around that CRM model: consistent server-side pagination + sorting + filtering on every listing, a dedicated per-Organization command center, actions only on drill-down pages, and a Stripe-style global search in the top bar.

## What Changes

- **Listing-table infrastructure (all listing pages).** A shared, URL-driven table convention — `?page=`, `?per=`, `?sort=`, `?dir=`, `?q=`, plus per-page filter params — implemented once as a pure query-plan lib + shared Astro table components (sortable column headers, pager, filter bar), then applied to every listing: `/organizations`, `/users`, `/spaces`, `/subscriptions`, `/backups`, `/restores`, `/connections`, `/databases`, `/errors`, `/audit`. Pagination is **server-side** (`LIMIT`/`OFFSET` + total count) — the existing bounded 100–200-row caps are superseded. Sorting is server-side per whitelisted column. All state lives in the query string (shareable, no-JS-required).
- **Organizations as the CRM entry point.** The org directory moves from `/customers` to `/organizations` (301 redirect kept; canonical naming dictionary uses *Organization*) — **BREAKING** for `/customers` bookmarks. It gains a search bar plus three first-class filters: **status** (subscription status), **platform**, and **subscription** (tier).
- **Organization command center at `/organizations/[id]`.** Reimplemented as the single per-account page: identity/billing header, then sectioned views of everything the org owns — subscriptions, spaces, backup runs, restore runs, databases (`space_databases`), connections, members/users, storage destinations, recent errors, audit entries. Every row links to the entity's own detail page; a back link returns to the listing **preserving its filter/sort/page state**.
- **Bidirectional drill-down interlinking.** Every entity detail page names its owning Organization as a link into the command center (spaces, users, and backup-run detail pages already exist; this change adds the missing `/connections/[id]` and `/errors/[id]` drill-ins). Listing → detail → owning org → command center → back is a closed navigation loop.
- **Actions move off listing pages.** Listing pages become strictly read-only. Force backup, invalidate connection, force migration, and error acknowledge/unacknowledge render only on the relevant detail page (`/spaces/[id]` / `/backups/[id]` / `/connections/[id]` / `/errors/[id]` / the org command center). The existing action API routes, audit writes, and confirm flows are unchanged — only their UI placement moves.
- **Global search in the top bar.** The omnisearch relocates from the sidebar to a persistent Stripe-style top-bar search across all pages, with a keyboard shortcut and a progressive-enhancement typeahead dropdown (grouped quick results that navigate directly to the entity). No-JS fallback remains a plain GET to the existing `/search` results page; query-shape detection and exact-match redirect behavior are reused as-is.

Out of scope: any new mutation, any change to action semantics or the audit trail, per-Space DB access (the `admin-data-boundary` guardrail applies unchanged), full-text search infrastructure (pg_trgm etc.), and web `/ops` retirement.

## Capabilities

### New Capabilities

- `admin-table-infra`: the URL-driven server-side pagination / sorting / filtering / search convention, its shared components, and its application to every admin listing page.
- `admin-org-command-center`: the `/organizations` CRM directory (search + status/platform/subscription filters) and the `/organizations/[id]` command-center page with list-state-preserving back navigation.
- `admin-action-placement`: the "listings are read-only; actions live on detail pages" rule, plus the `/connections/[id]` and `/errors/[id]` drill-ins that give every existing action a detail-page home.
- `admin-global-search-bar`: the persistent top-bar omnisearch — placement, keyboard shortcut, typeahead quick results, and no-JS fallback to `/search`.

### Modified Capabilities

_None in `openspec/specs/` — no admin capability is archived yet. This change supersedes requirements that live in un-archived sibling changes, in place: the bounded row-limit wording in `admin-entity-directories` / `admin-read-surfaces` (replaced by pagination), the sidebar search-box placement in `admin-support-search` (replaced by the top bar), the `/customers` route ownership in `admin-entity-directories` / `admin-nav-ia` (relocated to `/organizations`), and listing-row action buttons shipped by `shared-admin-actions` / `admin-error-triage` (relocated to detail pages)._

## Impact

- **`apps/admin` only** (single-app change, `admin-` prefix). No other app is touched.
- **Code:** new shared pure lib (`src/lib/table-query.ts` + Vitest) and shared components (sortable header, pager, filter bar); rewrites of the listing `.astro` pages and their lib modules to accept a table-query plan and return `{ rows, total }`; `/organizations/[id]` command-center rebuild on top of the existing `org-detail.ts`; new `/connections/[id]` + `/errors/[id]` pages and libs; `SidebarLayout.astro` top bar; action-button retrofits (remove from listings, add to detail pages).
- **DB:** read-only master-DB queries via the existing Hyperdrive binding; each paginated listing adds a `COUNT(*)` alongside its page query. No migrations (admin owns none); schema-mirror column additions only if a sort/filter needs a column not yet mirrored. Never `*_enc` columns.
- **Security:** no new auth paths, no new mutation surfaces, no new secrets. All new routes sit behind the existing staff-gate middleware. Sort/filter/pagination params are whitelist-validated server-side (no dynamic SQL identifiers). Action endpoints unchanged.
- **Coordination:** builds on un-archived siblings `admin-entity-directories`, `admin-entity-linking`, `admin-support-search`, `admin-operations-overview`, `admin-error-triage`, `shared-admin-actions` — documentation-level supersession noted above; no code dependency ordering (all are implemented).
