# admin-operations-overview

## Why

The admin app's home page (`/`) is the Organizations → Spaces tracker — a directory, not a status surface. Staff opening the console to answer "what is going on right now?" (running backups, failures, overdue schedules, broken connections) must visit five separate pages and mentally join them. PRD §16.1's "general overview of everything going on" has no single surface, and the flat 9-item sidebar gives no structure as sibling changes ([`admin-entity-directories`](../admin-entity-directories/proposal.md), [`admin-error-triage`](../admin-error-triage/proposal.md), [`admin-support-search`](../admin-support-search/proposal.md)) add more pages.

## What Changes

- **`/` becomes an operational dashboard** (read-only, master DB only, top-level status — no schema/data depth, no per-Space DB access):
  - **Active runs** — backup runs in `queued | running | cancelling` with Space + Organization (linked), elapsed time, `triggered_by`, `kind`.
  - **KPI tiles** — 24h/7d: runs succeeded/failed, success rate, active-run count, restore runs, spaces with activity.
  - **Attention items** — overdue schedules (`backup_configurations.next_scheduled_at`/`schema_next_scheduled_at` in the past for active Spaces), Connections needing attention (`status != 'active'`), `space_databases` rows in `error`, and a recent-failures feed (last N failed runs with error excerpt, linked to `/backups/[id]` and the Organization).
  - Every entity named on the dashboard links to its detail page; attention sections link onward to `/errors` (owned by `admin-error-triage`) with graceful fallback while that page doesn't exist.
- **The Organizations → Spaces tracker relocates from `/` to `/customers`** — page ownership of `/customers` sits with [`admin-entity-directories`](../admin-entity-directories/proposal.md). Sequencing: this change lands after (or together with) that one; if `/customers` is absent at implementation time, this change ships the tracker at `/customers` unchanged as a stopgap move so no surface is lost. **BREAKING** for bookmarks: `/` no longer lists Organizations.
- **Sidebar nav restructured into grouped sections** replacing the flat list: **Operations** (Dashboard, Backups, Restores, Errors, Services), **Directory** (Customers, Users, Spaces, Connections, Databases), **Billing** (Subscriptions, Migration), **System** (Audit). Entries for pages owned by sibling changes appear only once those pages exist.

## Capabilities

### New Capabilities

- `admin-operations-dashboard`: the `/` dashboard — active runs, KPI windows, attention items, linking rules, and the master-DB-only / no-customer-content boundary.
- `admin-nav-ia`: grouped sidebar information architecture, active-state rules, and the tracker's relocation to `/customers`.

### Modified Capabilities

_None — `openspec/specs/` contains no archived admin capability; the tracker requirement lives in the un-archived `admin-foundation` change and is superseded in place by this change's relocation requirement._

## Impact

- **Code:** `apps/admin` only — `src/pages/index.astro` (rewritten), `src/pages/customers.astro` (stopgap move if `admin-entity-directories` hasn't landed), `src/layouts/SidebarLayout.astro` (grouped nav), new pure lib `src/lib/dashboard.ts` (+ Vitest), small additions to the existing schema mirror (no new tables; reuses `backup_runs`, `restore_runs`, `backup_configurations`, `connections`, `space_databases`, `spaces`, `organizations`).
- **DB:** read-only queries against existing master-DB tables; no migrations (admin owns none).
- **Dependencies:** soft dependency on `admin-entity-directories` (`/customers`) and `admin-error-triage` (`/errors`) — both degrade gracefully; no service-binding or cross-app changes.
- **Out of scope:** any mutation, per-Space DB access, `service_runs` instrumentation (see [`shared-service-runs`](../shared-service-runs/proposal.md)), error acknowledgement workflow (see `admin-error-triage`).
