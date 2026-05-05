# Baseout — Implementation Plan
**Version:** 1.0
**Date:** March 31, 2026
**Status:** Draft
**Source:** BaseOut_PRD_v2.md (V1.4) + Baseout_Features.md (V1.0)

---

## Overview

This document defines the phased build order for Baseout V1. The goal is to sequence work so that:
1. Foundational infrastructure is in place before features are built on top of it
2. The backup engine is validated with real data before the full product is built around it
3. The On2Air migration path is unblocked before public launch
4. Repos can be worked on in parallel where there are no hard dependencies

---

## Repository Map

| Repo | Contents | Can start |
|---|---|---|
| `baseout-ui` | Shared component library (Astro + Tailwind + DaisyUI) | Phase 1 — immediately |
| `baseout-web` | Main Astro SSR app — frontend + web API | Phase 1 — after UI lib scaffolded |
| `baseout-backup-engine` | Backup/restore engine — Durable Objects + Trigger.dev | Phase 1 — immediately, in parallel |
| `baseout-background-services` | Webhook renewal, OAuth refresh, connection locks, notifications | Phase 2 — after backup engine is stable |
| `baseout-admin` | Super-admin Astro app — monitoring, DB management | Phase 3 — after core app is functional |

---

## Phase 0 — Foundation (Do First, Everything Depends On This)

**Goal:** Repository structure, CI/CD, environments, shared tooling, and database schema in place before any feature work begins.

| Task | Repo | Notes |
|---|---|---|
| Create all 5 repos with standard structure | All | README, `.gitignore`, Vitest config, Drizzle config, msw setup for API mocking |
| Set up GitHub Actions CI pipeline | All | Run Vitest (unit + integration) on every PR; block merge on failure; Docker PG + Miniflare D1 spun up in CI |
| Docker Compose for local dev | All backend repos | PostgreSQL + any other local services; used for integration tests |
| Configure Cloudflare Pages projects | `baseout-web`, `baseout-admin` | Production + staging accounts; branch → environment mapping |
| Configure Cloudflare Workers projects | `baseout-backup-engine`, `baseout-background-services` | Production + staging |
| Set up staging Cloudflare account | Infrastructure | Separate account; own API keys; own D1/R2/KV namespaces |
| Define and create master DB schema | `baseout-web` | Drizzle schema for all master DB tables (§21.3); run initial migration |
| Set up Cloudflare Secrets for all environments | All | Stripe, Mailgun, encryption key, OAuth secrets, DB strings |
| Scaffold `baseout-ui` package | `baseout-ui` | Astro + Tailwind + DaisyUI; basic layout, button, input, modal, table components |
| Set up Mailgun account + sending domain | Infrastructure | `mail.baseout.com`; DKIM/SPF configured |
| Set up Stripe account | Infrastructure | Products + prices created per §8.6 naming convention; webhook endpoint registered |

**Parallel work possible:** Repo setup, CI/CD, and DB schema can all proceed simultaneously.

---

## Phase 1 — Core Auth + Backup Engine (Build and Validate the Product Core)

**Goal:** A user can sign up, connect Airtable, configure a Space, and run a successful backup. This is the MVP slice — everything else layers on top.

### Phase 1A — Authentication (`baseout-web`)

| Task | Notes |
|---|---|
| Integrate better-auth | Magic link flow only for Phase 1 |
| Sign-up flow | Email entry → magic link sent → link clicked → account created |
| Organization + user creation on sign-up | Master DB records; Stripe $0 subscription created automatically |
| Session management | better-auth sessions; protect all app routes |
| Pre-registration schema visualization session | Temporary session ID; claim on registration |
| Trial state management | `trial_ends_at` set at sign-up; trial cap enforcement (1,000 records / 5 tables / 100 attachments) |

### Phase 1B — Backup Engine (`baseout-backup-engine`)

| Task | Notes |
|---|---|
| Airtable OAuth connection flow | Standard scope; Enterprise scope variant; store encrypted tokens |
| Durable Object per Space | Backup state controller; cron-like scheduler |
| DB-level connection locking | Prevent concurrent API calls on same connection; retry after 5s |
| Static backup — schema + records | CSV export to R2 (managed storage default) |
| Static backup — attachments | Dedup via composite ID; retry on failure |
| File path structure | `/{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv` |
| Backup run record | Write to master DB with unique run ID on start; update status on complete |
| Trial cap enforcement | Stop at limits; mark run as `trial_complete`; notify user |
| Trigger.dev job integration | One Trigger.dev job per base backup; parallel execution |
| Backup history | Run records accessible from master DB |

### Phase 1C — Onboarding Wizard (`baseout-web`)

| Task | Notes |
|---|---|
| Step 1: Connect Airtable | OAuth flow; scan and list bases |
| Step 2: Select bases | Multi-select; bulk add all; auto-add future bases toggle |
| Step 3: Pick backup frequency | Monthly / Weekly / Daily / Instant (gated by tier) |
| Step 4: Pick storage destination | Default: R2 managed; folder picker for BYOS options |
| Step 5: Confirm + run first backup | Kicks off Phase 1B engine; wizard locked until complete |
| Incomplete wizard state | Wizard resumes where left off on next login |

### Phase 1D — Storage Destinations (`baseout-backup-engine`)

| Task | Notes |
|---|---|
| R2 managed storage | Default; no user config needed |
| Google Drive | OAuth; folder picker |
| Dropbox | OAuth; proxy stream (no disk write on Baseout servers) |
| Box | OAuth; proxy stream |
| OneDrive | OAuth; folder picker |
| S3 | IAM / Access Key; bucket + path config (Growth+ only) |
| Frame.io | OAuth; TBD proxy requirements (Growth+ only) |

**Parallel work:** 1A and 1B can proceed simultaneously. 1C depends on 1A (auth) + 1B (engine can run). 1D is part of 1B.

---

## Phase 2 — Dashboard, Restore & Background Services

**Goal:** Users can see their backup history, restore data, and the system is self-maintaining (webhook renewal, OAuth refresh, notifications).

### Phase 2A — Dashboard (`baseout-web`)

| Task | Notes |
|---|---|
| Space selector | Sidebar nav; defaults to last viewed |
| Backup status widget | Live WebSocket progress if running; last run result if idle |
| Backup history list | Per-run: status, timestamp, record/table/attachment counts |
| Real-time progress | WebSocket via Durable Object; "X% complete" |
| Storage usage summary | Current R2 usage vs tier limit; link to upgrade |
| Notification/action items panel | Failures, quota warnings surfaced prominently |

### Phase 2B — Restore (`baseout-web` + `baseout-backup-engine`)

| Task | Notes |
|---|---|
| Point-in-time snapshot selection UI | List all backup snapshots for a Space |
| Base-level restore | Restore all tables in a snapshot to a new base |
| Table-level restore | Restore individual tables from a snapshot |
| Restore destination: existing base | Write new tables into user-selected existing base |
| Restore destination: new base | User provides Workspace ID; Baseout creates base via Airtable API |
| Post-restore verification (Growth+) | Record count validation; error audit log |

### Phase 2C — Background Services (`baseout-background-services`)

| Task | Notes |
|---|---|
| Webhook renewal service | Check all webhooks daily; renew at 6-day threshold |
| OAuth token refresh service | Check all connections; refresh before expiry |
| Dead connection detection + notification | 4-touch email cadence (send → 2d → send → 3d → send → 5d → final); mark invalidated after |
| Connection lock manager | DB-level locks for concurrent connection protection |
| Trial expiry monitor | Notify at day 5; expire subscription at day 7 |
| Quota usage monitor | Alert at 75%, 90%, 100% of tier limits |

### Phase 2D — Email Templates (`baseout-web`)

Build React Email templates for all V1 triggers (see §19.1). Integrate with Mailgun.

---

## Phase 3 — Schema, Health Score & Dynamic Backup

**Goal:** Launch+ and Growth+ capabilities — schema visualization, health scoring, and dynamic (database-backed) backup.

### Phase 3A — Schema Capability (`baseout-web` + `baseout-backup-engine`)

| Task | Notes |
|---|---|
| Schema capture during backup | Extract tables, fields, views, relationships during backup run |
| Schema changelog | Diff each backup against previous; store changes |
| Schema visualization UI | React Flow (or equivalent) node graph + ERD hybrid; field toggle; scrollable nodes |
| Schema health score | 0–100 weighted score; Green 90+, Yellow 60–89, Red <60; algorithm TBD |
| Health score display | Per-base on dashboard; configurable rules Pro+ |
| Diagram export | PNG: Growth; SVG: Pro; PDF: Business; embed widget: Enterprise |

### Phase 3B — Dynamic Backup (`baseout-backup-engine`)

| Task | Notes |
|---|---|
| D1 provisioning on first backup run | Schema-only on Launch; full on Growth+ |
| D1 → PostgreSQL migration tooling | Automated on upgrade; no backups during migration; validate before re-enabling |
| Shared PG provisioning (Pro+) | DigitalOcean; schema-level isolation |
| Dedicated PG provisioning (Business+) | Neon / Supabase / DigitalOcean; one DB per Space |
| BYODB support (Enterprise) | Accept customer connection string; validate + write |
| Webhook-based incremental backup | Airtable webhook ingestion; change log; fallback full re-read on gap |

---

## Phase 4 — Billing, Upgrade Flows & On2Air Migration

**Goal:** Paid plans work end-to-end; trial converts cleanly; On2Air users can migrate.

### Phase 4A — Stripe Billing (`baseout-web`)

| Task | Notes |
|---|---|
| Trial → paid upgrade flow | Credit card entry; swap Stripe subscription price |
| Plan upgrade / downgrade UI | Change tier; update Stripe subscription item |
| Overage tracking + billing | Monitor usage vs limits; apply overage charges via Stripe |
| Subscription webhook handler | Handle Stripe events: payment success, failure, cancellation, renewal |
| Capability resolution from Stripe metadata | Read `platform` + `tier` from Stripe product metadata; never parse name strings |

### Phase 4B — On2Air Migration (`baseout-web`)

| Task | Notes |
|---|---|
| Backend migration script | Map On2Air users to tiers; set `dynamic_locked`; create Baseout Organizations |
| "Complete Your Migration" screen | Shown on first login if `has_migrated = false`; guides re-auth of Airtable + storage connections |
| Migration complete confirmation | Set `has_migrated = true`; redirect to dashboard |
| Legacy encryption decryption | Decrypt On2Air data with legacy keys; re-encrypt under AES-256-GCM |

---

## Phase 5 — Advanced Capabilities & Pro+ Features

**Goal:** Data capability, Automations/Interfaces backup, Integrations, AI docs. These are Launch blockers for Pro/Business tiers.

| Task | Tier | Repo |
|---|---|---|
| Data capability — record metrics, changelog, growth trends | Growth+ | `baseout-web` |
| Automations backup — manual form intake UI | Growth+ | `baseout-web` |
| Interfaces backup — manual form intake UI | Growth+ | `baseout-web` |
| Inbound API endpoint (Automations/Interfaces programmatic submit) | Growth+ | `baseout-web` |
| Inbound API token management UI | Growth+ | `baseout-web` |
| SQL REST API — custom Cloudflare Worker | Pro+ | `baseout-backup-engine` |
| Direct SQL Access — connection string UI | Business+ | `baseout-web` |
| AI-Assisted Documentation (Cloudflare AI) | Pro+ | `baseout-web` |
| Slack notification integration | Pro+ | `baseout-web` |
| Airtable Enterprise connection variant | Enterprise | `baseout-backup-engine` |
| Community Restore Tooling (AI prompts for Automations/Interfaces) | Pro+ | `baseout-web` |

---

## Phase 6 — Admin App, Observability & Pre-Launch Hardening

**Goal:** Internal tooling in place; system observable; non-magic-link auth added; ready for public launch.

| Task | Repo | Notes |
|---|---|---|
| Super-admin app (`baseout-admin`) | `baseout-admin` | All capabilities per §16.1; uses shared UI library |
| Email + password auth | `baseout-web` | better-auth; added before public launch |
| 2FA (TOTP) | `baseout-web` | better-auth 2FA plugin |
| SSO (SAML) | `baseout-web` | better-auth SSO plugin; Enterprise only |
| Cloudflare observability setup | Infrastructure | Tail Workers, Logpush, Health Checks configured |
| E2E Playwright test suite | `baseout-web` | All critical paths covered (see §14.3) |
| Load/stress testing | `baseout-backup-engine` | Simulate concurrent backup runs; validate DO + lock behavior |
| Security review | All | Secrets audit; encryption validation; auth flows |
| dub.co referral tracking setup | Infrastructure | Rewardful migration; referral link plumbing in sign-up flow |
| PostHog setup | `baseout-web` | Web analytics, product analytics, session replay, feature flags — single PostHog SDK install; EU cloud for GDPR |
| Guided tours (Shepherd.js) | `baseout-web` | Onboarding, schema viz, restore, Space settings |
| Tooltips (Floating UI) | `baseout-web` | Contextual help on all major UI elements |
| Airtable Marketplace listing submission | External | Submission requirements + timeline |

---

## Parallel Work Summary

The following work streams can proceed simultaneously without blocking each other:

| Stream A | Stream B |
|---|---|
| `baseout-ui` component library | `baseout-backup-engine` core backup logic |
| Database schema + Drizzle setup | CI/CD + environment configuration |
| better-auth integration | Trigger.dev job scaffolding |
| Email template design (React Email) | Background services architecture |

---

## Definition of Done — V1 Public Launch

Before public launch, all of the following must be true:

- [ ] A new user can sign up, connect Airtable, configure a Space, and run a complete backup
- [ ] Trial caps enforced; trial → paid upgrade flow works end-to-end
- [ ] Restore to new base works for all tiers
- [ ] Schema visualization works for Launch+ customers
- [ ] Dynamic backup (D1) works for Growth+ customers
- [ ] Background services running: webhook renewal, OAuth refresh, dead connection notifications
- [ ] All V1 email templates functional via Mailgun
- [ ] On2Air backend migration script complete; "Complete Your Migration" flow tested
- [ ] Stripe billing: trials, upgrades, downgrades, overages all functional
- [ ] Email + password + 2FA auth working
- [ ] E2E Playwright tests passing for all critical flows
- [ ] Super-admin app deployed and accessible
- [ ] Staging environment validated; production deploy tested
- [ ] SOC 2 vendor selected; "SOC 2 in progress" badge on dynamic tier pages

---

*Version 1.0 — Created March 31, 2026. Phased build plan derived from PRD v1.4. See BaseOut_PRD_v2.md for full feature specifications and Baseout_Features.md for pricing and capability matrices.*
