# admin-entity-directories

> **Partly superseded by `admin-crm-ux` (2026-08-03):** the bounded 100–200-row caps on these directories are replaced by server-side pagination, and `/customers` is relocated to `/organizations` (301 kept). This change's assembly libs are reused; only the row-cap wording and the route are superseded.

## Why

Staff answering account-level questions have no global entity lists: `/` shows an Organizations → Spaces tracker, but there is no way to see all users (only per-org via `/organizations/[id]`), no standalone spaces table, and no customers directory with billing context. Support workflows start from "who is this customer / user / space?" — today that requires knowing the org first. This change adds the three directory pages that make every core entity findable.

## What Changes

- **`/customers`** — directory of all Organizations: name/slug (linked to `/organizations/[id]`), subscription status + tier badges, space count, member count, MRR estimate, migration flags, last activity (latest backup run `created_at`). Absorbs the org-tracker role of `/` — the sibling change [`admin-operations-overview`](../admin-operations-overview/proposal.md) later repurposes `/` as an ops dashboard; this change only *adds* `/customers` and leaves `/` untouched so the two changes can land in either order.
- **`/users`** — directory of all users: email, name, role (`customer`/`super`), email-verified flag, org memberships (each linked to `/organizations/[id]`), last session activity, created date.
- **`/spaces`** — directory of all Spaces: name, owning Organization (linked), status, platform, backup-configuration summary (frequency / scope / mode / storage type), last run outcome, per-Space DB backend + status (`space_databases`), created date.
- All three pages: `?q=` substring search, targeted filters (`?status=` on customers/spaces, `?role=` on users), bounded result limits consistent with existing surfaces (100–200 rows), and attention-worthy rows surfaced (e.g. spaces whose last run failed or whose DB is in `error` sort first under an errors-first toggle-free ordering, matching `/databases`).
- Every cell that references another entity renders as a link. Targets `/spaces/[id]` and `/users/[id]` are created by the sibling change [`admin-entity-linking`](../admin-entity-linking/proposal.md); until it lands, space and user name cells link to their owning org drill-in (which already exists) rather than dead routes.
- Schema-mirror additions in `apps/admin/src/db/schema/core.ts` only as needed (e.g. `backup_configurations.mode`, `users`/`sessions` stay re-exported from `@baseout/db-schema`). No `*_enc` columns, ever.

## Capabilities

### New Capabilities

- `admin-entity-directories`: global read-only directory pages (`/customers`, `/users`, `/spaces`) in `apps/admin` with search, filters, bounded limits, cross-entity links, and the master-DB-only access constraint.

### Modified Capabilities

<!-- none — existing admin surfaces are unchanged; /customers is additive -->

## Impact

- `apps/admin` only: three new `.astro` pages, three pure lib modules + Vitest suites (`src/lib/customers.ts`, `src/lib/users-directory.ts`, `src/lib/spaces-directory.ts`), nav additions in the sidebar layout, small schema-mirror column additions.
- No master-DB migrations (admin owns none). No engine calls. No mutations — all three pages are read-only.
- Reads only the master DB via the existing Hyperdrive binding; never dereferences `space_databases` locators; never selects `*_enc` columns (they are absent from the mirror by rule).
- Coordination: `admin-operations-overview` (repurposes `/`), `admin-entity-linking` (adds `/spaces/[id]` + `/users/[id]` link targets). Both are documentation-level cross-references, not code dependencies.
