## 1. Phase 0 — Foundation

- [ ] 1.1 Create `apps/admin/` repo with README, Vitest, Drizzle, Astro Cloudflare adapter, Tailwind + DaisyUI, msw, Wrangler config
- [ ] 1.2 Wire GitHub Actions CI (Vitest)
- [ ] 1.3 Provision Cloudflare Workers project (production + staging) with route binding for `admin.baseout.com`
- [ ] 1.4 Consume `@baseout/db-schema` (pinned version)
- [ ] 1.5 Consume `@baseout/ui` (pinned version)
- [ ] 1.6 Populate Cloudflare Secrets (master DB string, master encryption key, Google SSO client secret, service-to-`baseout-backup` HMAC)

## 2. Phase 1 — Auth

- [ ] 2.1 Implement Google Workspace SSO middleware restricted to Baseout's domain
- [ ] 2.2 Reject all non-allowed-domain identities with a clear error
- [ ] 2.3 Session management (short-lived; no remember-me)
- [ ] 2.4 Integration test asserting customer-facing hostnames cannot reach admin handlers (in case of deploy mishap)
- [ ] 2.5 Document break-glass auth path (Cloudflare Access + hardware key)

## 3. Phase 2 — Read-Only Capability Surfaces

- [ ] 3.1 Build Organization browser (search/filter/per-Org drill-in)
- [ ] 3.2 Build Subscription dashboard (all subs, MRR view)
- [ ] 3.3 Build Backup run viewer (cross-Org filter, status/time-window filter)
- [ ] 3.4 Build DB provisioning tracker (all client DBs, utilization, health)
- [ ] 3.5 Build Connection health dashboard (OAuth status, webhook renewal state)
- [ ] 3.6 Build Background-service monitor (last run + status per service)
- [ ] 3.7 Build On2Air migration status (migrated vs. pending counts)
- [ ] 3.8 Build Error log search (Logpush destination query)

## 4. Phase 3 — Manual Admin Actions

- [ ] 4.1 Implement audit log table with append-only role
- [ ] 4.2 Implement audit-write-then-execute pattern (every action writes audit row before invoking backend)
- [ ] 4.3 Build "Force backup" action (writes `backup_runs`; calls `baseout-backup`'s `/runs/{id}/start`)
- [ ] 4.4 Build "Invalidate connection" action (sets `connections.status='invalid'`; cancels in-flight runs)
- [ ] 4.5 Build "Reset trial" action (resets `subscription_items.trial_*` flags; audit-logged)
- [ ] 4.6 Build "Adjust plan" action (modifies `subscription_items` tier; coordinates with Stripe)
- [ ] 4.7 Build "Grant credits" action (writes `credit_transactions` of type `manual_grant`; audit-logged)
- [ ] 4.8 Build "Force migration completion" action (sets `organizations.has_migrated=true`; audit-logged)
- [ ] 4.9 Each action requires explicit confirmation step in UI

## 5. Phase 4 — Audit Trail Hardening

- [ ] 5.1 Enforce append-only at the DB role level (no UPDATE / DELETE privileges)
- [ ] 5.2 Implement 24-month retention + R2 archive job (cron entry within `baseout-admin` worker)
- [ ] 5.3 Integration tests asserting no UPDATE/DELETE path exists in the app for audit rows
- [ ] 5.4 Build audit log search/filter UI

## 6. Phase 5 — Pre-Launch Hardening

- [ ] 6.1 Security review of admin auth flow
- [ ] 6.2 Security review of manual admin actions for blast radius
- [ ] 6.3 Document on-call runbook for admin-side incidents
- [ ] 6.4 Wire Logpush + tail Workers
- [ ] 6.5 Configure on-call alerts for admin auth failures (potential probing) and audit-log write failures

## 7. Definition of Done — `baseout-admin` V1 Launch

- [ ] 7.1 Google SSO restricts access to Baseout staff only
- [ ] 7.2 All read-only capability surfaces functional
- [ ] 7.3 All manual admin actions functional and audit-logged
- [ ] 7.4 Audit log is provably append-only (no app path can UPDATE/DELETE)
- [ ] 7.5 24-month retention + R2 archive verified end-to-end on staging
- [ ] 7.6 Independent deploy verified — admin redeploys without affecting any customer-facing surface
- [ ] 7.7 Break-glass auth documented and tested
- [ ] 7.8 Security review passed
