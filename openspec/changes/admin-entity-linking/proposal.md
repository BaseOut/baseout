# admin-entity-linking

## Why

The staff console has list surfaces and two drill-ins (`/organizations/[id]`, `/backups/[id]`), but navigation between entities is one-directional and incomplete: Spaces, users, and connections render as dead-end names/UUIDs on most pages, so answering a support question ("which account owns this space, who are its users, why did its backup fail?") means manual ID-copying across pages. There is also no written rule keeping admin out of per-Space customer data — the boundary exists in code (master-DB-only, no `*_enc` mirrors) but no spec owns it, so a future surface could erode it silently.

Sibling change [`admin-entity-directories`](../admin-entity-directories/proposal.md) adds the `/customers`, `/users`, `/spaces` list pages that link into the detail pages specced here. This change owns the detail pages, the linking conventions, and the data-boundary guardrail.

## What Changes

- **`/spaces/[id]` detail page** — owning Organization (linked), members with access (via org membership), connections serving the Space, backup configuration + schedule + retention policy, registered Airtable bases (`at_bases`), run history (linked to `/backups/[id]`), per-Space database provisioning status, storage destinations.
- **`/users/[id]` detail page** — profile fields, staff/customer role, org memberships (linked, with member role), recent session metadata (read-only), connections created by the user, admin audit entries where the user is the actor.
- **Peek sidebar** — a reusable right-hand summary panel: clicking a linked entity anywhere in admin shows key fields + stats + an "open full page" link without navigating away; falls back to plain navigation without JS.
- **Universal linking convention** — any admin page rendering an entity reference (organization, space, user, connection, backup run, restore run) MUST render it as a link to that entity's page; no dead-end IDs. `/organizations/[id]` is brought into compliance (its member, space, connection, and run references become links).
- **Data-boundary guardrail (codified)** — admin reads only the master DB via Hyperdrive; no per-Space DB clients or bindings; `space_databases` locators are inert display strings; the `*_enc` mirror exclusion is absolute; drill-downs bottom out at run/base/table metadata, never record-level customer content. Phase-two staff access to per-Space data is explicitly out of scope.
- Schema-mirror additions in `apps/admin/src/db/schema/core.ts` (read-only, canonical source unchanged): `at_bases`, `backup_retention_policies`, plus missing columns on existing mirrors (`connections.created_by_user_id`, `connections.space_id`, `spaces.space_type`, `organization_members.invited_by_user_id`).

## Capabilities

### New Capabilities

- `admin-detail-pages`: Space and user detail pages, plus consistency requirements for the existing organization detail page.
- `admin-entity-links`: the universal entity-linking convention and the peek-sidebar interaction.
- `admin-data-boundary`: the master-DB-only / metadata-only guardrail for all admin surfaces, present and future.

### Modified Capabilities

_None — no archived admin capability specs exist yet in `openspec/specs/`._

## Impact

- **`apps/admin` only** (single-app change): new pages `src/pages/spaces/[id].astro`, `src/pages/users/[id].astro`; new pure libs `src/lib/space-detail.ts`, `src/lib/user-detail.ts`, `src/lib/entity-link.ts`, `src/lib/peek.ts` + Vitest; new summary endpoint(s) under `src/pages/api/peek/`; link retrofits across existing pages; read-only schema-mirror additions.
- **No migrations** (admin owns none), **no new writes**, no engine calls — everything here is read-only; the audit/rate-limit machinery from `shared-admin-actions` is untouched.
- **Security surface:** peek summary endpoints are staff-gated by the existing middleware like every other admin route and return metadata only (no `*_enc`-adjacent values, no record content). Session metadata on `/users/[id]` exposes ip/user-agent/expiry to staff — read-only, no token values.
- Coordinates with `admin-entity-directories` (list pages link here) and `admin-operations-overview` (dashboard rows link here); no ordering dependency — links degrade to existing pages until both land.
