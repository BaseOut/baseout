## Context

`baseout-admin` is the internal operator surface. Astro SSR pages served by a standalone Cloudflare Workers project at `apps/admin/`, deployed independently of every other Baseout repo. It uses the same component library (`@baseout/ui`) as `baseout-web` for visual consistency, and consumes the same master-DB schema (`@baseout/db-schema`), but it has its own auth (Google Workspace SSO) and its own deploy cadence. It does NOT share runtime, sessions, or secrets with `baseout-web`.

Stakeholders: Baseout staff (operators, on-call), `baseout-backup` team (downstream of force-backup / force-migration / invalidate-connection actions), legal/compliance (audit trail correctness, retention).

Constraints carried in from product:
- **Customers must never reach admin pages** — Google SSO middleware rejects non-Baseout identities.
- **Every admin action is auditable** — append-only log, immutable, written before action execution.
- **Independent deploy + uptime tolerance** — admin can be down briefly without customer impact; deploy cadence is whatever the admin team needs.
- **Reuses customer-facing UI primitives** — same Table/Modal/Form components from `@baseout/ui` for visual consistency and faster build.

## Goals / Non-Goals

**Goals:**
- Operators can find any Org, any backup run, any client DB, any background-service status across all environments in <30 seconds.
- Every manual admin action is recorded in the immutable audit log BEFORE execution.
- Admin auth never overlaps with customer auth (no shared sessions, no shared `users` namespace).
- Admin redeploys do not affect customer-facing surfaces.
- Audit retention covers compliance asks (24 months default).

**Non-Goals:**
- Customer-facing UI of any kind (`baseout-web`).
- Public APIs of any kind.
- Email sending (admin reads logs and triggers backend actions; emails come from the side detecting the trigger).
- Stripe webhook handling (`baseout-web`).
- Direct execution of long-running workflows (admin invokes backend endpoints; the workflow runs in `baseout-backup`).

## Decisions

### Standalone Cloudflare Workers project (vs. routes inside `baseout-backup`)
Earlier consolidation considered hosting admin as Astro routes inside `baseout-backup` with hostname-based routing. The current decision splits admin out into its own Workers project because:
- Different audience and auth model (Google SSO vs. better-auth).
- Independent deploy cadence (admin features don't follow data-plane release schedule).
- Reduced deploy blast radius (an admin-feature bug doesn't need the backup engine to redeploy).
- Cleaner principle of least privilege (admin Workers don't need DO bindings or Trigger.dev secrets).

Trade: small duplication of master-DB connection setup and email-send helpers (the Cloudflare Workers `send_email` binding wrapper repeats across apps); mitigated by shared `@baseout/ui` and `@baseout/db-schema` packages.

### Google Workspace SSO via better-auth (or equivalent)
Authenticate via Google Workspace OAuth restricted to Baseout's domain. SSO middleware rejects any non-allowed domain. Sessions are short-lived; no remember-me.

### Append-only audit table
Audit log uses a dedicated Postgres role with INSERT-only privileges (no UPDATE, no DELETE). Application code cannot mutate audit rows — even with a code bug or malicious deploy. Older rows archived to R2 after 24 months via a periodic job (could live in `baseout-backup`'s background services, or a small admin-side worker entry — TBD pre-launch).

### Manual admin actions invoke `baseout-backup` internal endpoints
Admin doesn't run long workflows. Force-backup writes the `backup_runs` row and POSTs to `baseout-backup`'s `/runs/{id}/start`, same path `baseout-web` uses (different caller, same contract). Force-migration triggers the migration script via an admin-only endpoint in `baseout-backup`. Invalidate-connection writes the `connections.status='invalid'` directly (audit row first).

### Reuse `@baseout/ui` component library
Admin uses the same Table, Modal, Form, Tooltip primitives as `baseout-web`. Visual consistency, faster build, single styling system.

## Risks / Trade-offs

- **[Risk] Google SSO outage blocks all admin access** → Have a documented break-glass procedure (Cloudflare Access bypass with hardware key) for incident response.
- **[Risk] Audit log table grows unbounded** → 24-month retention with R2 archive policy; revisit at one year of data based on actual growth rate.
- **[Risk] Manual admin actions cause customer-facing incidents** → Every action is rate-limited, requires explicit confirmation, and is logged before execution. Risky actions (mass credit grants, mass migrations) require a second-operator approval (V1.1+).
- **[Trade-off] Separate Workers project = small duplication** → Master-DB connection setup and a few helpers duplicated vs. living inside `baseout-backup`. Accepted; the deploy independence is worth it.

## Migration Plan

### Build sequence

1. **Phase 0 — Foundation**: `apps/admin/` repo, CI/CD, Cloudflare Workers project per env with route binding for `admin.baseout.com`, secrets, `@baseout/db-schema` and `@baseout/ui` consumption.
2. **Phase 1 — Auth**: Google Workspace SSO middleware, session management, integration test that customer hostnames cannot reach admin handlers.
3. **Phase 2 — Capability surfaces (read-only)**: Organization browser, Subscription dashboard, Backup run viewer, DB provisioning tracker, Connection health dashboard, Background-service monitor, On2Air migration status, Error log search.
4. **Phase 3 — Manual admin actions**: force backup, invalidate connection, reset trial, adjust plan, grant credits, force migration completion. Each writes an audit row before execution.
5. **Phase 4 — Audit trail hardening**: append-only role enforcement, retention policy + R2 archive job, integration tests asserting no UPDATE/DELETE path exists.
6. **Phase 5 — Pre-launch hardening**: SSO break-glass documented, security review, on-call runbook.

### Rollback strategy
- Deploy rollback: `wrangler rollback` in <2 minutes.
- Worker disable: route binding can be temporarily disabled to return 503 if a critical bug ships, without affecting any customer surface.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| A1 | Audit log archive owner | V1: implement archive job in `baseout-admin` itself (dedicated cron entry); revisit if it gets complex. |
| A2 | Mass-action approval (V1.1+) | V1: single-operator with confirmation; V1.1+: two-operator approval for risky actions (mass credit grants, mass migrations). |
| A3 | Break-glass auth path | Cloudflare Access with hardware key; documented in security runbook. |
