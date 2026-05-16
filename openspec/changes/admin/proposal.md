## Why

`admin` is the internal operator surface for Baseout staff: organization browser, subscription dashboard, backup-run viewer, database-provisioning tracker, connection-health dashboard, background-service monitor, On2Air migration status, manual admin actions, error log search, and an immutable audit trail. It has a different audience (Baseout staff, not customers), different auth (Google Workspace SSO), and a different deploy/uptime tolerance than the customer-facing `apps/web`. This change establishes `apps/admin/` as a standalone runtime app in the monorepo.

## Status note (2026-05)

**Deferred per `specreview/03-reconciliation.md` §8 recommendation B.** The staff console currently lives at `/ops/*` inside `apps/web` (admin-gated by `users.user_role = 'admin'`). `apps/admin/` exists as a placeholder Worker that returns 200 text. Promote this change from deferred to active when *either* condition holds:

1. The `/ops` UI in apps/web reaches >5 distinct pages (today: 1-2), OR
2. The staff console needs an auth shape that the customer auth boundary can't host (e.g., Google Workspace SSO without polluting the customer login flow).

Until then, `apps/admin/` is a stub and its tasks are inert. Don't archive — the requirements still describe the eventual shape; only the timing slips.

## What Changes

- Establish `admin` as a standalone Cloudflare Workers project at `apps/admin/`, deployed independently of every other Baseout repo.
- Public hostname (e.g., `admin.baseout.com`) bound to the Astro Cloudflare adapter.
- Authenticate exclusively via Google Workspace SSO; reject any non-Baseout-staff visitor.
- Build the operator surfaces: Organization browser (search/filter/per-Org drill-in), Subscription dashboard (all subs, MRR view), Backup run viewer (cross-Org filter), Database provisioning tracker (all client DBs, utilization, health), Connection health dashboard (OAuth status, webhook renewal state), Background-service monitor (last run + status per service), On2Air migration status (migrated vs. pending counts), Manual admin actions (force backup, invalidate connection, reset trial, adjust plan, grant credits, force migration completion), Error log search (Logpush destination query).
- Each manual admin action SHALL write an immutable audit row before executing.
- Audit trail SHALL be append-only (no UPDATE/DELETE permissions for app role) and retained for 24 months by default; older rows MAY be archived to R2.
- UI stack: Astro SSR + Tailwind + DaisyUI + the shared `@baseout/ui` component library; consume `@baseout/db-schema` for Drizzle queries.

## Capabilities

### New Capabilities

- `super-admin-app`: Astro SSR routes served by `admin` Cloudflare Workers project on a distinct hostname with Google SSO; capability surfaces (org browser, subscription dashboard, run viewer, DB tracker, connection health, background-service monitor, migration status, manual admin actions, error log search); manual admin actions write immutable audit rows; audit trail append-only with 24-month default retention.

### Modified Capabilities

None — this is the initial `admin` implementation.

## Impact

- **New repo**: `apps/admin/` — Cloudflare Workers project for the internal admin surface.
- **Consumed packages**: `@baseout/db-schema` (Drizzle), `@baseout/ui` (shared component library).
- **External dependencies**: Cloudflare Workers, DigitalOcean PostgreSQL (master DB reads + audit log writes), Google Workspace OAuth (SSO), Logpush destination for error log search.
- **Cross-repo contracts**:
  - With `server`: invokes internal endpoints for manual admin actions (force backup, invalidate connection, reset trial, etc.) and reads operational tables and audit endpoints.
  - With `web`: shares the `@baseout/ui` component library; otherwise no direct call.
- **Master DB access**: reads all operational tables; writes the admin audit log table; writes `credit_transactions` of type `manual_grant` (when an admin grants credits).
- **Secrets**: master DB string, master encryption key (decrypt connection strings if displayed for support), Google SSO client secret, service-to-`server` HMAC.
- **Operational**: a `wrangler.jsonc` per environment with one route binding (`admin.baseout.com`), Logpush + tail Workers, audit-log retention policy (24 months → R2 archive).
