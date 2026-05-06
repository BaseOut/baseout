# Baseout Front — Implementation Plan
**Version:** 1.0
**Date:** May 1, 2026
**Status:** Draft
**Source:** `Front_PRD.md` (V1.0) + `../shared/Baseout_Features.md` + `../shared/Master_DB_Schema.md`

> **Companion plan:** `../back/Back_Implementation_Plan.md`. Phase numbers are coordinated so cross-side dependencies line up by phase number.

---

## Overview

Sequence the front build so that:
1. The master DB schema, auth, and capability resolver are in place before any feature surface.
2. The cross-service contract (§17 of Front PRD) is locked early, so back can build against a stable interface.
3. Pages can layer on a stable API + UI library without rework.

---

## Repository Map

| Repo | Contents | Can start |
|---|---|---|
| `baseout-ui` | Shared component library (Astro + Tailwind + DaisyUI) | Phase 0 |
| `baseout-web` | Astro SSR app — frontend + web API | Phase 0 (after `baseout-ui` scaffolded) |

`baseout-admin` is in the back plan even though it is also Astro — it consumes `baseout-ui` as a dependency.

---

## Phase 0 — Foundation

**Goal:** Repos, CI/CD, master DB schema, shared UI scaffolded.

| Task | Repo | Notes |
|---|---|---|
| Create `baseout-ui` and `baseout-web` repos | both | README, Vitest, Drizzle, msw, basic dir layout |
| GitHub Actions CI | both | Vitest on every PR; Docker PG + Miniflare D1 spun up in CI |
| Cloudflare Pages projects | `baseout-web` | Production + staging accounts |
| Master DB schema (Drizzle) | `baseout-web` | All tables per `../shared/Master_DB_Schema.md`; initial migration; published as `@baseout/db-schema` for back to consume |
| Cloudflare Secrets | `baseout-web` | Stripe, Mailgun, encryption key, OAuth secrets, DB connection string, service-to-back HMAC |
| `baseout-ui` package scaffold | `baseout-ui` | Layout, Button, Input, Modal, Table, Form primitives, Tooltip wrapper (Floating UI) |
| Mailgun account + sending domain | infra | `mail.baseout.com`; DKIM/SPF/DMARC |
| Stripe account | infra | Products + prices per `../shared/Baseout_Features.md` §5.6; webhook endpoint registered |
| PostHog setup | infra | EU cloud; project key |
| dub.co setup | infra | Replace Rewardful; migration plan for existing affiliate links |

**Cross-side dependency:** Back's Phase 0 imports `@baseout/db-schema` from this repo. Coordinate package publication early.

---

## Phase 1 — Auth + Marketing + Pre-Reg Schema Viz

**Goal:** A visitor can land, OAuth their Airtable, see their schema, and sign up.

### 1A — better-auth Integration

| Task | Notes |
|---|---|
| better-auth installation | Magic link flow only initially |
| Sign-up flow | Email → magic link → account created → Org + Stripe trial subscription |
| Session management | better-auth sessions; protect all app routes |
| Pre-registration session | Temporary client-side ID (per Front PRD §6); claim on registration |

### 1B — Public Pages

| Task | Notes |
|---|---|
| Landing page | Hero CTA: "Visualize your Airtable schema in 30 seconds" |
| Pricing page | Reads from `plan_definitions` + `plan_credit_config` — never hardcoded |
| Pre-registration schema visualization | Airtable OAuth → fetch metadata → React Flow graph |

### 1C — Stripe Sign-Up Wiring

| Task | Notes |
|---|---|
| Stripe Customer creation on sign-up | Linked to Org via `stripe_customer_id` |
| Trial subscription item | Created at $0 for the platform (`Baseout — Airtable — Trial`) |
| Stripe webhook receiver | `/api/webhooks/stripe`; signature verification; idempotency table |

---

## Phase 2 — Onboarding Wizard + Capability Resolver

**Goal:** A signed-up user can finish onboarding and trigger their first backup.

### 2A — Capability Resolver

| Task | Notes |
|---|---|
| `GET /api/me/capabilities` endpoint | Reads Stripe metadata + `plan_limits`; returns full capability set |
| Cache layer | 5-minute TTL keyed on `(organization_id, subscription_items.modified_at)` |
| `enforceCapability` middleware | Wraps tier-gated endpoints; returns 402 with upgrade hint on failure |

### 2B — Onboarding Wizard

| Task | Notes |
|---|---|
| Step 1: Connect Airtable | Airtable OAuth flow; persists encrypted token in `connections` |
| Step 2: Select bases | Multi-select; auto-add toggle; persists `bases` rows |
| Step 3: Backup frequency | Capability-gated dropdown |
| Step 4: Storage destination | R2 default; OAuth/IAM flows for each BYOS option |
| Step 5: Confirm + run first backup | Writes `backup_runs` row; calls back's `/runs/{id}/start` per cross-service contract |
| Wizard resume state | `spaces.onboarding_step` is the source of truth |

### 2C — Storage Destination OAuth Flows

| Task | Notes |
|---|---|
| Google Drive | OAuth client; folder picker UI |
| Dropbox | OAuth |
| Box | OAuth |
| OneDrive | OAuth; folder picker |
| S3 | IAM access key form (Growth+) |
| Frame.io | OAuth (Growth+) |
| Custom / BYOS | Generic config form (Pro+) |

> The actual write logic to these destinations lives in `baseout-backup-engine`. Front only handles auth + config persistence.

---

## Phase 3 — Dashboard + Live Progress

**Goal:** User can see backup history, live progress, and core capabilities.

### 3A — Dashboard

| Task | Notes |
|---|---|
| Space selector | Last viewed persisted per user |
| Backup status widget | WebSocket to back DO; falls back to last `backup_runs` row |
| Backup history list | `backup_runs` query; pagination |
| Storage usage card | R2 + DB usage from cached size in `space_databases` |
| Notifications panel | `notifications` table |
| Health score card | Per-Base; reads from client DB via back read endpoint |

### 3B — Live Progress

| Task | Notes |
|---|---|
| WebSocket client | Connects to `wss://{BACKUP_ENGINE_URL}/spaces/{id}/progress` |
| Progress component | Renders events per cross-service contract (§17.2 Front PRD) |
| Reconnection handling | Auto-reconnect with backoff; resume from last run state |

### 3C — Restore UI

| Task | Notes |
|---|---|
| Snapshot picker | Timeline of `backup_runs` per Space |
| Restore scope picker | Base / table / point-in-time |
| Destination chooser | New base (workspace ID input) or new table in existing base |
| Submit | Writes `restore_runs` row → calls back's `/restores/{id}/start` |
| Status polling | Subscribes to `restore_runs` updates via WebSocket or poll |
| Verification result | Reads `verification_status` after completion (Growth+) |

---

## Phase 4 — Schema, Data, Automations, Interfaces UI

**Goal:** Tier-appropriate UIs for the data-intelligence capabilities.

### 4A — Schema UI

| Task | Notes |
|---|---|
| Schema visualization | React Flow graph; field-type filtering |
| Schema changelog | Renders human-readable diffs from back-computed data |
| Schema health score | Score display + rule configuration UI (Pro+) |
| Diagram export | PNG/SVG/PDF/embed widget per tier |

### 4B — Data UI (Growth+)

| Task | Notes |
|---|---|
| Record metrics | Per-table/per-base counts |
| Data changelog | From back-computed diffs |
| Growth trend charts | Recharts or equivalent |

### 4C — Automations / Interfaces UI (Growth+)

| Task | Notes |
|---|---|
| List view | Reads from client DB |
| Manual entry form | Submit Automations/Interfaces metadata via Inbound API path |
| Changelog view | From back-computed diffs |

### 4D — AI Documentation (Pro+)

| Task | Notes |
|---|---|
| "Generate description" button | On schema fields/tables |
| Cloudflare AI call | Synchronous; updates schema description in client DB via back endpoint |
| Credit deduction | 10 credits per generation; logged to `credit_transactions` |

---

## Phase 5 — Inbound API + Stripe Webhook Hardening

**Goal:** Programmatic submission for external scripts and AI agents; full Stripe lifecycle handled.

### 5A — Inbound API

| Task | Notes |
|---|---|
| Token CRUD UI | `api_tokens` table; show plaintext once at creation |
| `/api/v1/inbound/automations` | Validate + forward to back |
| `/api/v1/inbound/interfaces` | Same pattern |
| `/api/v1/inbound/synced-tables` | Same pattern |
| `/api/v1/inbound/custom-metadata` | Same pattern |
| Rate limiting | Tier-based; per-token monthly counter |
| Credit consumption | 1 credit per 100 calls; `credit_transactions` |
| OpenAPI spec | Hosted at `docs.baseout.com` |

### 5B — Stripe Webhook Hardening

| Task | Notes |
|---|---|
| All event types per Front PRD §11.2 | Idempotent; replay-safe |
| `invoice.paid` → credit bucket creation | Per `../shared/Pricing_Credit_System.md` §8.5 |
| `customer.subscription.trial_will_end` | Triggers Trial Expiry Warning email (front) |
| Multi-platform discount automation | Apply Stripe coupon when 2nd platform item is added |
| Dunning flow | `payment_failed` → past_due state + Payment Failed email |

### 5C — Billing UI

| Task | Notes |
|---|---|
| Plan picker | Reads `plan_definitions`; hides hidden plans (Starter, On2Air Bridge) |
| Upgrade flow | Stripe Elements; subscription item swap |
| Add-on management | Recurring credit add-ons (subscription item) + one-time credit packs |
| Overage cap configuration | `organization_billing_settings` UI |
| Invoice history | Stripe API + cached `invoices` if needed |

---

## Phase 6 — Email Templates + In-App Notifications

**Goal:** All front-owned email templates functional; in-app notifications surface.

### 6A — React Email Templates (Front-Owned)

Per Front PRD §14:

- Magic Link
- Password Reset
- 2FA setup confirmation
- Trial Welcome
- Migration Welcome
- Upgrade Confirmation
- Payment Failed
- Team Invitation

Each template: React Email component → renders to HTML/text → sent via Mailgun SDK.

### 6B — In-App Notifications

| Task | Notes |
|---|---|
| `notifications` table reader | Per Org, sorted by recency |
| Notification panel | Dashboard top-right dropdown |
| Mark-as-read | Per notification |
| Channel preferences | Per-type, per-channel toggle UI |

---

## Phase 7 — On2Air Migration UX

**Goal:** Migrating users complete their re-auth and resume backups.

| Task | Notes |
|---|---|
| "Complete Your Migration" screen | Shown when `has_migrated = false` on first login |
| Re-auth Airtable | OAuth flow; replace legacy connection |
| Re-auth storage destinations | Per-destination OAuth |
| `has_migrated = true` on completion | Redirect to dashboard |
| Migration Welcome email | Sent on first login if migrated user |

> The actual migration script (one-time, scripted backend job) lives in back's plan.

---

## Phase 8 — Airtable Extension Embedding

| Task | Notes |
|---|---|
| Embedded-context detection | URL param + frame check |
| `window.postMessage` framework | Receive base/table/view context from wrapper |
| Compact embedded layout | Single-base focus, smaller sidebar |
| Auth popup flow | First-use auth without breaking iframe |

The Airtable extension wrapper itself is a separate small artifact; this phase only owns the messaging contract on the Baseout side.

---

## Phase 9 — Mobile, Tooltips, Guided Tours

| Task | Notes |
|---|---|
| Mobile responsive audit | All dashboard surfaces |
| Schema viz mobile mode | Simplified scrollable view |
| Floating UI tooltips | Major UI elements |
| Shepherd.js guided tours | Onboarding, schema viz, restore, Space settings |

---

## Phase 10 — Pre-Launch Hardening

| Task | Notes |
|---|---|
| Email + password auth | better-auth password strategy |
| 2FA (TOTP) | better-auth 2FA plugin |
| SSO (SAML) | better-auth SSO plugin (Enterprise only) |
| E2E Playwright suite | All critical paths from Front PRD §18 |
| Security review | Secrets audit; encryption validation; auth flow review |
| PostHog instrumentation | Web + product analytics; session replay; feature flags |
| Performance audit | Page load, time-to-interactive |
| Accessibility audit | WCAG AA target |

---

## Cross-Side Dependencies Summary

| Front Phase | Depends on Back Phase | Reason |
|---|---|---|
| 0 | 0 | Both must agree on `@baseout/db-schema` package shape |
| 2 (Onboarding wizard) | 1 (Backup engine MVP) | Step 5 triggers a backup; back must accept the trigger |
| 3 (Live progress) | 2 (DO progress events) | WebSocket contract |
| 3 (Restore UI) | 2 (Restore engine) | Submission contract |
| 4 (Schema/Data UI) | 3 (Schema diff + client DB reads) | Read endpoints for schema metadata |
| 4D (AI Docs) | — | Self-contained on front |
| 5A (Inbound API) | 4 (Inbound ingestion endpoint on back) | Forwarding contract |
| 6A (Email templates) | — | Independent — back owns its own templates |
| 7 (Migration UX) | 4 (Migration script) | Needs `has_migrated` flag set by script |
| 10 (E2E suite) | All back phases | Tests touch the full stack |

---

## Definition of Done — Front V1 Launch

- [ ] Sign-up + magic link + password + 2FA all functional
- [ ] Pre-registration schema visualization works without auth
- [ ] Onboarding wizard completes end-to-end and triggers a real backup
- [ ] Dashboard shows live progress and backup history
- [ ] Restore UI submits restore jobs and shows results
- [ ] Schema visualization, changelog, health score render for Launch+
- [ ] Inbound API: token CRUD, all endpoints, rate limiting, credit consumption
- [ ] Stripe webhook handles all V1 events idempotently
- [ ] Billing UI: plan picker, upgrade, add-ons, overage cap
- [ ] All front-owned React Email templates send via Mailgun
- [ ] In-app notifications work
- [ ] On2Air migration UX works for migrated users
- [ ] Airtable extension embedding works in compact mode
- [ ] Mobile responsiveness validated on all dashboard surfaces
- [ ] PostHog + dub.co instrumented
- [ ] Playwright E2E suite passes
- [ ] Security review complete

---

*Version 1.0 — Front Implementation Plan created May 1, 2026. Split from Baseout_Implementation_Plan.md (V1.0). Coordinate phase progress with `../back/Back_Implementation_Plan.md`.*
