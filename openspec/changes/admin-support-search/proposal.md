# admin-support-search

## Why

Support work almost always starts from a single identifier — a customer email, an org name, an Airtable base ID, a run UUID from an error report — and today staff must guess which admin surface to open and hunt through per-page filters to find the entity. A global omnisearch turns any identifier a staff member holds into a direct jump to the right record, which is the single highest-leverage step toward "answer account-level questions fast."

## What Changes

- Add an always-visible search box to the admin chrome (`SidebarLayout.astro`) that submits to a new `/search?q=` results page.
- Add a `/search` results page that detects the query's shape (email, UUID, Airtable base ID `app…`, Stripe `cus_…`/`sub_…` ID, or free-text name/slug) and looks it up across Organizations, Users, Spaces, Airtable bases, Connections, backup runs, and restore runs.
- Results are grouped by entity type with disambiguating context per row (org → tier/status; user → org memberships; space → owning org) and link to the entity's admin page.
- A single unambiguous exact match (full UUID, exact email, exact Stripe ID, exact base ID) redirects straight to the entity's page instead of rendering a one-row results list.
- Extend the admin schema mirror with the `at_bases` registry (id, space_id, at_base_id, name) — needed to resolve `app…` base IDs. No `*_enc` columns, no migrations (admin owns none).
- Read-only throughout: plain exact/ILIKE SQL against the master DB, per-type result limits, staff-gated by the existing middleware. No new search infrastructure (pg_trgm noted as a future option only).

## Capabilities

### New Capabilities

- `support-search`: staff global omnisearch — query-shape detection, cross-entity lookup, grouped results, exact-match redirect, and its read-only/master-DB-only bounds.

### Modified Capabilities

<!-- none — no existing spec's requirements change; admin middleware gating and the *_enc mirror rule apply as-is -->

## Impact

- `apps/admin` only (single-app change, `admin-` prefix):
  - `src/layouts/SidebarLayout.astro` — search box in the sidebar chrome.
  - `src/pages/search.astro` — new results page.
  - `src/lib/search.ts` (+ Vitest) — pure query-shape detection + per-entity lookup planning, following the existing pure-lib pattern (`tracker.ts`, `org-detail.ts`).
  - `src/db/schema/core.ts` — mirror `at_bases` (partial, no FKs, canonical source header comment).
- Links point at `/organizations/[id]`, `/backups/[id]`, and — once sibling change `admin-entity-linking` lands — `/spaces/[id]` and `/users/[id]`; until then space/user rows fall back to the owning org's detail page. Soft dependency only; no code coupling.
- No new secrets, no new auth paths, no cross-app touches, no migrations. Read-only SQL via Drizzle (parameterized).
