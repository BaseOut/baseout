## ADDED Requirements

### Requirement: Independent deployment

The super-admin surface SHALL be served by `baseout-admin`, a standalone Cloudflare Workers project deployed from its own repo at `apps/admin/`. It SHALL bind a distinct hostname (e.g., `admin.baseout.com`) and SHALL authenticate exclusively via Google Workspace SSO for Baseout staff. It SHALL NOT share runtime, auth, or session storage with `baseout-web` or any other repo.

#### Scenario: Customer attempts admin access

- **WHEN** a customer visits the admin hostname
- **THEN** the Google SSO middleware rejects them and no admin pages render

#### Scenario: Independent deploy cadence

- **WHEN** an admin-only feature ships
- **THEN** only `baseout-admin` redeploys; `baseout-web`, `baseout-backup`, and the public-API repos are unaffected

### Requirement: Capability surfaces

The surface SHALL expose the following pages: Organization browser (search/filter/drill-in), Subscription dashboard, Backup run viewer (cross-Org filter), Database provisioning tracker, Connection health dashboard, Background-service monitor, On2Air migration status, Manual admin actions, Error log search, Audit trail.

#### Scenario: Cross-Org backup search

- **WHEN** an admin filters backup runs by `status='failed'` across all Orgs
- **THEN** the run viewer returns the matching set with timestamps, Org links, and error reasons

### Requirement: Manual admin actions

The surface SHALL support: force backup run, invalidate connection, reset trial, adjust plan, grant credits, force migration completion. Each action SHALL write an immutable audit row before executing.

#### Scenario: Grant credits

- **WHEN** an admin grants 1,000 credits to an Org via the manual action
- **THEN** an audit row records (admin_user, action='grant_credits', target=org_id, amount=1000), then a `credit_transactions` row of type `manual_grant` is created

### Requirement: Audit trail immutability

The audit table SHALL be append-only (no UPDATE / DELETE permissions for the app role) and retained for 24 months by default. Older rows MAY be archived to R2.

#### Scenario: Audit row never updated

- **WHEN** an admin attempts to alter an existing audit row through any UI path
- **THEN** the request is rejected; no path exists in the surface to do so

### Requirement: UI stack

The surface SHALL be Astro SSR (via the Astro Cloudflare adapter) + Tailwind + DaisyUI + the shared `@baseout/ui` component library (consumed by both `baseout-web` and `baseout-admin`), and SHALL consume `@baseout/db-schema` for Drizzle queries (no schema redefinition).

#### Scenario: Component reuse

- **WHEN** the admin Org table is rendered
- **THEN** it uses the same Table primitive from `baseout-ui` that the customer dashboard uses
