# Baseout — Front PRD (Web App + Web API)
**Version:** 1.0
**Date:** May 1, 2026
**Status:** Draft — Split from BaseOut_PRD_v2.md (V1.4)
**Scope:** Repos `baseout-web` (Astro SSR + web API) and `baseout-ui` (shared component library)

> **Companion docs (cross-cutting, both PRDs reference):**
> - `../shared/Baseout_Features.md` — feature/capability matrix, naming dictionary, tier limits
> - `../shared/Master_DB_Schema.md` — Drizzle schema for the master DB
> - `../shared/Pricing_Credit_System.md` — pricing tiers, credit ledger, On2Air migration policy
>
> **Companion PRD:** `../back/Back_PRD.md` — backup engine, background services, super-admin, SQL REST API.

---

## Table of Contents

1. [Vision & Boundary](#1-vision--boundary)
2. [Repos & Service Boundary](#2-repos--service-boundary)
3. [Architecture & Tech Stack](#3-architecture--tech-stack)
4. [UX & Design Principles](#4-ux--design-principles)
5. [Authentication](#5-authentication)
6. [Pre-Registration Schema Visualization](#6-pre-registration-schema-visualization)
7. [Onboarding Wizard](#7-onboarding-wizard)
8. [Dashboard & Navigation](#8-dashboard--navigation)
9. [Feature Surfaces (UI)](#9-feature-surfaces-ui)
10. [Inbound API](#10-inbound-api)
11. [Stripe Billing & Webhook Handler](#11-stripe-billing--webhook-handler)
12. [Capability Resolution & Trial Enforcement](#12-capability-resolution--trial-enforcement)
13. [Notifications (In-App)](#13-notifications-in-app)
14. [Email Templates (Front-Owned)](#14-email-templates-front-owned)
15. [Airtable Extension Embedding](#15-airtable-extension-embedding)
16. [Mobile & Responsiveness](#16-mobile--responsiveness)
17. [Cross-Service Contract](#17-cross-service-contract)
18. [Testing](#18-testing)
19. [Git Branching, Environments & CI/CD](#19-git-branching-environments--cicd)
20. [Security, Secrets & Encryption](#20-security-secrets--encryption)
21. [Database Access (Master DB)](#21-database-access-master-db)
22. [Open Questions](#22-open-questions)

---

## 1. Vision & Boundary

> **"Baseout is the backup, restore, and data intelligence layer for Airtable — giving platform admins real-time protection, schema visibility, and direct SQL access to their own data."**

This PRD covers everything a user touches in a browser, plus the HTTP endpoints the browser (and external scripts) call. **It does not cover** the backup engine, restore engine, cron-based background services, the Airtable webhook ingestion endpoint, the SQL REST API, or the super-admin app — those live in the back PRD.

**The boundary in one sentence:** if it has to respond to a user click within 1–2 seconds and live inside an Astro page, it is front. If it runs on a schedule, processes a queue, or executes a long workflow, it is back.

See `../shared/Baseout_Features.md` §1 for the canonical naming dictionary (Organization, Space, Connection, Base, etc.) and §1.2 for V1 positioning.

---

## 2. Repos & Service Boundary

| Repo | Description | Deploy Target |
|---|---|---|
| `baseout-web` | Astro SSR app — public pages, dashboard, settings, admin-area UI for the customer's Org, plus all web API endpoints (auth, Stripe webhook, Inbound API, etc.) | Cloudflare Pages + Workers |
| `baseout-ui` | Shared component library — buttons, modals, tables, layout, schema-viz primitives. Consumed by `baseout-web` and `baseout-admin` | Internal npm package |

> `baseout-admin` (super-admin app) lives in the **back** PRD even though it is also Astro — it consumes the same `baseout-ui` package but its operational concerns (DB provisioning oversight, error log search, migration status, force-trigger admin actions) align with backend ownership. `baseout-ui` is therefore consumed by both sides.

**Owned by front:**
- All HTML pages, Astro components, client-side React/Astro islands
- All web API endpoints (Astro endpoints / Cloudflare Workers under `/api/...`)
- Stripe webhook receiver (`/api/webhooks/stripe`)
- Inbound API (`/api/v1/inbound/*`) — public, token-authorized, used by Airtable Scripts and AI agents
- WebSocket clients connecting to backup-engine Durable Objects for live progress (the DOs themselves are in back)
- React Email templates for the email categories listed in §14

**Not owned by front:**
- Backup/restore execution
- Background cron services
- Airtable webhook ingestion endpoint
- SQL REST API
- Database provisioning
- The super-admin app

---

## 3. Architecture & Tech Stack

| Layer | Decision |
|---|---|
| Framework | Astro.js (SSR mode) |
| CSS / UI | Tailwind + DaisyUI |
| Component lib | `baseout-ui` (internal npm) |
| Server runtime | Cloudflare Workers / Pages Functions |
| Auth | better-auth |
| ORM | Drizzle (master DB only — see §21) |
| Forms / validation | Zod for all API input validation |
| Real-time client | Native WebSocket → DO endpoint published by `baseout-backup-engine` |
| Schema visualization | React Flow (or equivalent) for node-graph + ERD hybrid |
| Tooltips | Floating UI |
| Guided tours | Shepherd.js |
| Email rendering | React Email (templates owned by front per §14) |
| Email send | Mailgun SDK |
| Analytics | PostHog (web + product analytics + session replay + feature flags; EU cloud) |
| Referral tracking | dub.co |
| Testing | Vitest, Miniflare via `@cloudflare/vitest-pool-workers`, Playwright |

**Service architecture from the front's point of view:**

```
[Browser]
   │
   ▼
[Astro SSR / Cloudflare Pages]   ← public pages, dashboard, settings
   │
   ├── [Web API endpoints (Workers)]  ← REST endpoints for the SPA
   │     ├── auth (better-auth)
   │     ├── Stripe webhook receiver
   │     ├── Inbound API (token-auth)
   │     ├── capability resolver
   │     └── trial enforcement gate
   │
   ├── [Master DB — DigitalOcean PostgreSQL]   ← reads + writes via Drizzle
   │
   ├── [Mailgun]   ← front-owned email categories (§14)
   │
   └── [Backup-engine DO endpoint]  ← WebSocket only, for live progress
         (the DOs themselves live in baseout-backup-engine)
```

The front never speaks directly to client DBs (D1 / Shared PG / Dedicated PG / BYODB). Anything that touches client data goes through the SQL REST API, which is back-owned. The front only touches the **master DB**.

---

## 4. UX & Design Principles

Baseout is a **utility admin tool**, not a lifestyle product:

- **Functional over decorative** — information density, clear status indicators, fast access to controls.
- **Trust signals first** — backup status, last run time, success/failure, storage health visible at a glance.
- **Power over simplicity** — expose configuration; this audience can handle it.
- **Airtable-aware but distinct** — Airtable field-type iconography where it aids recognition, but a distinct Baseout brand identity rather than mimicking Airtable's consumer aesthetic.
- **Platform-agnostic foundation** — even though V1 is Airtable-only, the UI framework must be built so platform context-switching is built in from day one.

Brand spelling: **Baseout** (capital B, rest lowercase) in all written copy. Logo / brand mark: **baseout** all lowercase.

---

## 5. Authentication

Baseout uses **better-auth** for all authentication flows. Auth is exclusively a front concern — back services never log a user in; they validate session/API tokens minted by front.

### 5.1 V1 Methods

| Method | Status | Notes |
|---|---|---|
| Magic Link | ✅ V1 launch | Passwordless, simplest onboarding path |
| Email + Password | ✅ V1 (pre-launch) | better-auth handles hashing (bcrypt) |
| 2FA (TOTP) | ✅ V1 (pre-launch) | better-auth 2FA plugin |
| SSO (SAML) | ✅ V1 — Enterprise tier | better-auth SSO plugin |
| Google OAuth | ❓ Evaluate pre-launch | Native better-auth support |
| Airtable OAuth | 🚫 Never for login | Airtable OAuth is exclusively a Connection auth flow (a Space connecting to an Airtable account) — it is never a login method |

### 5.2 Sessions

- Sessions managed by better-auth — JWT or DB-backed (decide during integration spike).
- Pre-registration uses a **temporary, client-side session ID** (see §6); when the user registers, the session is claimed and linked to the new Organization.

### 5.3 Cross-Service Authentication

Back services that need to read the master DB authenticate via:
- **Service-to-service tokens** signed with a shared secret in Cloudflare Secrets, OR
- **Direct DB access** with their own connection string (recommended — simpler than service tokens for trusted Workers in the same account).

Front does not call back. Back may call front internal API endpoints (e.g., trigger an email — see §17), authenticated with a service-token header.

---

## 6. Pre-Registration Schema Visualization

A user can OAuth their Airtable account **before signing up**, view their schema visualization, and use that as the conversion hook.

| Step | Behavior |
|---|---|
| Visitor lands on landing page | "Visualize your Airtable schema in 30 seconds — no signup" CTA |
| Clicks CTA | Airtable OAuth flow initiated; access token held in a temporary session |
| OAuth completes | Front fetches schema metadata from Airtable REST API directly (no record data); renders the visualizer |
| Visitor explores schema | All schema viz features available; no backup runs possible |
| Visitor clicks "Start backing up your data" | Sign-up flow; on registration, the temporary session is **claimed** → connection persisted under the new Organization |

> ⚠️ **Open Question:** Whether the temporary session needs to survive a browser close/refresh. If yes, a `pre_registration_sessions` table is added to master DB (see `../shared/Master_DB_Schema.md` Q2). If no, browser session/local storage is sufficient. **Recommended: ephemeral-only for V1** to avoid storing OAuth tokens for unauthenticated users.

---

## 7. Onboarding Wizard

After sign-up, the user goes through a 5-step wizard. State is tracked on `spaces.onboarding_step` (1–5). The wizard resumes where left off on next login.

| Step | UI | Server Behavior |
|---|---|---|
| 1. Connect Airtable | OAuth flow if not already connected from pre-reg | Persists `connections` row; encrypted tokens |
| 2. Select bases | Multi-select list of bases discovered via Airtable OAuth meta scan; "Auto-add new bases" toggle | Persists `bases` rows for selected; sets `backup_configurations.auto_add_new_bases` |
| 3. Pick backup frequency | Monthly / Weekly / Daily / Instant — gated by tier resolved from Stripe metadata | Writes `backup_configurations.frequency` |
| 4. Pick storage destination | Default: R2 managed (no config). BYOS options: Google Drive, Dropbox, Box, OneDrive, S3 (Growth+), Frame.io (Growth+) | Each destination type has its own OAuth/IAM flow on this step; persists `storage_destinations` |
| 5. Confirm + run first backup | Summary panel; "Run first backup" button enqueues a job in `baseout-backup-engine` via the cross-service trigger contract (§17) | Writes a `backup_runs` row with `trigger_type='manual'`; back picks it up |

The wizard is **locked** between starting the first backup and its completion. When the back engine completes the first run (status update on `backup_runs`), the dashboard becomes accessible.

---

## 8. Dashboard & Navigation

### 8.1 Layout

```
[Space Selector — sidebar or top nav, defaults to last viewed per user]
Dashboard
  ├── Backups       (history, status, run-now button, restore CTA, audit reports)
  ├── Schema        (visualization, history, change log, health score)
  ├── Data          (record metrics, alerts, insights — Growth+)
  ├── Automations   (backup, changelog, insights — Growth+)
  ├── Interfaces    (backup, changelog, insights — Growth+)
  ├── AI            (documentation gen — Pro+; MCP/RAG = V2)
  ├── Analytics     (usage metrics, reports, dashboards)
  ├── Governance    (rules, compliance — Business+; V2)
  ├── Integrations  (Inbound API tokens, SQL REST connection details, Direct SQL connection string)
  └── Settings      (schedule, storage, connections, notifications, team, billing)
```

### 8.2 Dashboard Top-Level Cards

- **Current backup status** — live WebSocket progress if a run is active; last run result if idle.
- **Backup history** — most recent N runs with status, timestamp, record/table/attachment counts.
- **Storage usage** — R2 + DB usage vs. tier limit; link to upgrade.
- **Notifications / action items** — failures, schema changes, health alerts.
- **Health score** — per Base, with link to drill-in.

### 8.3 Real-Time Progress

A running backup pushes progress events via a Durable Object hosted in `baseout-backup-engine`. The front opens a WebSocket to a stable URL and renders progress. The DO emits structured events (`base_started`, `base_completed`, `progress_pct`, `error`). Front does not invent these — they are part of the cross-service contract (§17).

---

## 9. Feature Surfaces (UI)

The front owns the **UI surface** for every capability. The actual data computation (backup capture, schema diff, health-score calculation, AI doc generation, etc.) happens elsewhere. Each surface below references the back PRD for the corresponding execution.

> **Tier-gating, capability availability, and the full feature matrix live in `../shared/Baseout_Features.md` §6–§14.** Front reads the user's resolved capability set via §12 and renders / hides accordingly — never hardcodes tier checks.

### 9.1 Backups

| Surface | Front Owns | Back Owns |
|---|---|---|
| Backup history list | Reads `backup_runs` + `backup_run_bases` from master DB; renders | Writes those rows |
| Run-now button | POSTs to `/api/spaces/:id/backup` → enqueues job | Picks up job, executes |
| Live progress | WebSocket client to DO | DO emits events |
| Audit report (per-run) | Renders details from master DB + a fetch to back-served audit log | Writes audit log to client DB |
| Run configuration UI | Edits `backup_configurations` | Reads configuration on next scheduled run |

### 9.2 Restore

The user picks a snapshot, scope (base / table), and destination (new base / new table in existing base) in the front UI. Front writes a `restore_runs` row with `status='pending'`. Back picks it up and executes.

| Restore type | UI affordance | Tier |
|---|---|---|
| Base-level restore | "Restore this snapshot to a new base" → workspace ID input | All |
| Table-level restore | "Restore this table" → choose new base or existing base | Starter+ |
| Point-in-time selection | Snapshot timeline picker | All |
| Post-restore verification | Read verification result from `restore_runs.verification_status` | Growth+ |
| Community Restore Tooling | UI for AI-prompt-based manual restore of Automations/Interfaces; front renders the prompt + instructions | Pro+ |

### 9.3 Schema

- **Visualization** — front renders React Flow node graph from schema metadata stored in the client DB by the back. Front fetches schema via the SQL REST API (back) or via a dedicated read-endpoint provided by back.
- **Changelog** — front renders human-readable diffs ("Field X deleted on March 12"); diffs are computed and persisted by back during/after each backup run.
- **Health Score** — front displays the score and rule details. The score is computed by back; rule configuration UI is front (writes `health_score_rules`).
- **Diagram export** — PNG (Growth) / SVG (Pro) / PDF (Business) / embed widget (Enterprise). Render handled client-side from the React Flow diagram.

### 9.4 Data, Automations, Interfaces (Growth+)

For each, front provides:
- A list view fed from the client DB
- A changelog view (computed by back)
- A manual entry form for entities Airtable's REST API does not expose (Automations, Interfaces) — submitted to back via the Inbound API or directly written to client DB through a dedicated front endpoint

### 9.5 AI (Pro+)

- **AI-Assisted Documentation** — front exposes the "Generate description for this field/table" button. The Cloudflare AI call is made from a front endpoint (it is short-lived and synchronous, not a long-running job). Generated text is written back to the schema metadata and persisted in client DB via back's write path (or directly to the schema description column if exposed).
- **MCP Server, RAG, Chatbot, Vector DB** — V2; not in this PRD.

### 9.6 Analytics

V1 analytics are placeholder "coming soon" UI. Metrics are collected from day one (in master DB and client DB) for future rendering. No custom reports / dashboards in V1.

### 9.7 Governance

V2. Front reserves the navigation slot but renders an "Available on Business+ in V2" placeholder.

### 9.8 Integrations

| Item | Front Surface |
|---|---|
| Inbound API tokens | Token CRUD UI; full token shown once at creation, hash stored — see §10 |
| SQL REST API | Front displays the Space's SQL REST endpoint URL + token; user copies. Actual API is served by back. |
| Direct SQL Access | Front displays the read-only PG connection string (decrypted on-page request, never logged). Business+ only. |
| Zapier / Make.com / HyperDB | V2 — not in this PRD |
| Airtable Writeback | V2 |

### 9.9 Settings

| Section | What |
|---|---|
| Space settings | Name, status, onboarding state |
| Schedule | Backup frequency, auto-add-new-bases, attachment inclusion |
| Storage | Storage destinations CRUD; default selection |
| Connections | Airtable connections list, status, re-auth flow |
| Notifications | Notification channels (Slack, Teams, webhook, PagerDuty); per-type preferences |
| Team | Member invite, role assignment |
| Billing | Plan selector, credit add-ons, one-time credit purchase, payment method, invoice history, overage cap configuration |

---

## 10. Inbound API

A documented public API for submitting data Airtable's REST API does not expose (Automations, Interfaces, Synced Tables, custom metadata). Owned by front.

| Aspect | Detail |
|---|---|
| Base path | `/api/v1/inbound/*` |
| Auth | Bearer token — `api_tokens` table (token hash stored, plaintext shown once at creation) |
| Scope | One token per Space (V1) |
| Rate limits | 10K calls/mo (Growth), 50K (Pro), 200K (Business), Unlimited (Enterprise) |
| Endpoints | `POST /automations`, `POST /interfaces`, `POST /synced-tables`, `POST /custom-metadata` (extensible) |
| Validation | Zod schema per endpoint; rejected payloads return structured errors |
| Persistence | Front writes to client DB via the back's write path (Inbound API does **not** write directly to client DB; it delegates) — keeps client DB ownership clean |
| Versioning | URL-versioned (`/v1/`); never break v1 |
| Credit consumption | 1 credit per 100 inbound API calls — see §12 and `../shared/Pricing_Credit_System.md` |
| Documentation | OpenAPI spec hosted at `docs.baseout.com` (separate project) |

> **Decision:** Inbound API is a thin HTTP layer that authenticates, rate-limits, validates, and forwards to a back service endpoint that owns the actual client DB write. This avoids two services writing to the same client DB independently.

---

## 11. Stripe Billing & Webhook Handler

### 11.1 Billing UX (Front)

- **At sign-up** — Stripe Customer + Subscription created via Stripe API. The subscription is $0 (Trial subscription item for the platform). No credit card collected.
- **Trial → paid upgrade** — credit card form (Stripe Elements); on submit, swap the subscription item's price to the chosen paid tier. Trial flag clears when the period rolls over.
- **Plan upgrade / downgrade** — same flow; modify the platform's subscription item.
- **Adding a platform** (V2) — adds a new subscription item to the existing subscription.
- **Add-ons** — credit add-ons (recurring) and one-time credit blocks; each add-on is a separate Stripe subscription item or invoice line.
- **Overage cap configuration** — UI for `organization_billing_settings` (overage_mode, dollar cap, alert thresholds).

### 11.2 Stripe Webhook Handler

`POST /api/webhooks/stripe`

Handled events:

| Event | Action |
|---|---|
| `customer.subscription.created` | Persist `subscriptions` row; one trial subscription item per platform |
| `customer.subscription.updated` | Update `subscription_items` rows (tier swap, cancellation, etc.) |
| `customer.subscription.deleted` | Mark cancelled |
| `invoice.paid` | Open new `plan_monthly` and `addon_monthly` credit buckets per `../shared/Pricing_Credit_System.md` §8.5 |
| `invoice.payment_failed` | Mark subscription `past_due`; trigger dunning email |
| `customer.subscription.trial_will_end` | Trigger Trial Expiry Warning email (front-owned) |

Webhook authenticity is verified using the Stripe signing secret from Cloudflare Secrets. Replay protection via Stripe's standard `idempotency_key` + a `stripe_events_processed` table (event ID → processed_at).

### 11.3 Trial Implementation

- Trial duration: **7 days** AND **1 successful backup run**, whichever comes first.
- Trial caps: 1,000 records, 5 tables, 100 attachments. Backup engine enforces the data caps; the run record is marked `status='trial_complete'` when it hits a cap.
- Trial scope: per platform, per Organization, ever. Cannot retrial the same platform after the trial converts or expires.
- Trial state flags live on `subscription_items` (`trial_ends_at`, `trial_backup_run_used`, `trial_ever_used`).
- The **detection** of trial expiry (day-7) is in back's `baseout-background-services`. Back updates state and calls the front's internal email-dispatch endpoint to send the Trial Expired email.

### 11.4 Multi-Platform Discount

Applied automatically when a second platform subscription item is added. Discount rate TBD when the second platform launches. Implemented as a Stripe coupon on the additional subscription item(s), triggered automatically by the webhook handler.

See `../shared/Baseout_Features.md` §5.6 for the full Stripe product structure (`Baseout — [Platform] — [Tier]` naming, metadata schema).

---

## 12. Capability Resolution & Trial Enforcement

A first-class concern in front: every page, button, and feature toggle must read from a single resolver.

### 12.1 Capability Resolver

```
GET /api/me/capabilities
```

Returns:
```json
{
  "organization_id": "...",
  "platforms": {
    "airtable": {
      "tier": "pro",
      "trial": false,
      "trial_ends_at": null,
      "limits": { "max_spaces": -1, "max_bases_per_space": -1, ... },
      "capabilities": { "schema": true, "data": true, "ai_docs": true, ... }
    }
  }
}
```

- Always read from Stripe product metadata (`platform` + `tier`), never parse the product name string.
- Limits read from `plan_limits` (master DB) by `tier`.
- Cached per session (5-minute TTL); invalidated on any `subscription_items` write.

### 12.2 Trial Enforcement

Every endpoint that consumes credits or unlocks a tier-gated capability calls a single `enforceCapability(userId, capability)` middleware that:

1. Loads the resolved capability set (cached).
2. Checks if the capability is permitted at the user's tier.
3. Checks if a trial cap or overage cap blocks the operation.
4. If blocked, returns 402 with a structured upgrade hint.

This logic exists only in front. Back trusts that front-issued tokens have already passed enforcement; back's only enforcement responsibility is to refuse a backup run when the trial cap (records/tables/attachments) is hit during execution.

---

## 13. Notifications (In-App)

In-app notifications surface on the dashboard. Channels (Email, Slack, Teams, webhook, PagerDuty) are configured by the user and stored in `notification_channels` + `notification_preferences`.

| Notification | Trigger | Email Owner |
|---|---|---|
| Backup success / failure / warning | Backup run completes | **Back** (§14 of back PRD) |
| Credit warning (50/75/90/100%) | Credit consumption crosses threshold | **Back** (background service detects) |
| Schema change | Backup completes with schema diff | **Back** |
| Health score change | Score moves between bands | **Back** |
| Data alert | User-configured rule fires | **Back** |
| Restore complete | Restore engine finishes | **Back** |
| Monthly audit | Cron | **Back** |
| Magic link / password reset | User action | **Front** |
| Trial welcome | Sign-up | **Front** |
| Trial expiry warning / expired | Day-5 / Day-7 detection | **Back** triggers; sent by **Back** |
| Migration welcome | First login as migrated user | **Front** |
| Upgrade confirmation | Stripe webhook | **Front** |
| Connection dead (×4 cadence) | Background service cadence | **Back** |
| Quota warning | Background service detects | **Back** |

The **in-app surface** for all of the above is front (rendered from a `notifications` table, written by whichever side owns the trigger).

---

## 14. Email Templates (Front-Owned)

All templates use **React Email** + **Mailgun**. Front owns and sends the following:

| Template | Trigger |
|---|---|
| Magic Link | User requests login |
| Password Reset | User requests reset |
| 2FA setup confirmation | User enables 2FA |
| Trial Welcome | User completes sign-up |
| Migration Welcome | First login as migrated On2Air user (`has_migrated = false`) |
| Upgrade Confirmation | Stripe `invoice.paid` for a subscription change |
| Payment Failed (dunning) | Stripe `invoice.payment_failed` |
| Team Invitation | Org owner invites a member |

**Sending domain:** `mail.baseout.com` (DKIM/SPF/DMARC configured). Region: EU or US per GDPR consideration.

Back-owned templates are listed in the back PRD. The two sides share Mailgun credentials (separate API keys per environment) but maintain their own template directories. **There is no internal "send-email" endpoint** — both sides call Mailgun directly. The previous design had front as the only Mailgun caller; that has been revised since back has its own operational email categories (backup audit, dead connection, quota warnings, etc.) that benefit from being owned by the system that detects the trigger.

---

## 15. Airtable Extension Embedding

Baseout must support being embedded as an Airtable interface/extension.

| Aspect | Detail |
|---|---|
| Detection | The web app detects when it is in an embedded context (URL param + `window.parent !== window`) |
| Messaging | A `window.postMessage` framework communicates with a thin wrapper running inside the Airtable extension |
| Wrapper | Embeds the Baseout URL in an iframe; passes context (current base, table, view) to Baseout |
| Behavior | Embedded mode renders a compact, context-aware layout — different from the standalone dashboard |
| Auth | The embedded context still requires a logged-in Baseout user; the wrapper opens a popup for the auth flow on first use |

The wrapper itself (the Airtable extension code) is a separate small artifact, not in this repo, but the messaging contract is owned and documented here.

---

## 16. Mobile & Responsiveness

- Full mobile responsiveness required. V1 is web-only; no native iOS/Android.
- Backup status, notifications, and dashboard views must be fully usable on mobile.
- Schema visualization on mobile renders a simplified, scrollable view (full graph is desktop-only).

---

## 17. Cross-Service Contract

Between front (`baseout-web`) and back (`baseout-backup-engine` + `baseout-background-services`):

### 17.1 Triggering Backups

Front never executes a backup itself. To trigger one:

1. Front writes a `backup_runs` row with `status='pending'`, `trigger_type='manual'`, and the `space_id`.
2. Front POSTs to a back endpoint: `POST {BACKUP_ENGINE_URL}/runs/{run_id}/start` with a service-token header.
3. Back acknowledges (200), enqueues the Trigger.dev job, and updates `status='running'`.

Same pattern for restore: front writes `restore_runs`, calls back's `/restores/{id}/start`.

### 17.2 Live Progress (WebSocket)

Front opens a WebSocket to `wss://{BACKUP_ENGINE_URL}/spaces/{space_id}/progress`. The DO authenticates via a session cookie or short-lived token. Events:

| Event | Payload |
|---|---|
| `run_started` | `{ run_id, base_count }` |
| `base_started` | `{ run_id, base_id, base_name }` |
| `progress_pct` | `{ run_id, base_id, pct, records_done, records_total }` |
| `base_completed` | `{ run_id, base_id, status, record_count, attachment_count }` |
| `run_completed` | `{ run_id, status, totals }` |
| `error` | `{ run_id, base_id?, error_message }` |

### 17.3 Schema / Data Reads

Schema metadata and record-level reads from the client DB go through the back's read endpoint or the SQL REST API — front never opens its own connection to a client DB.

### 17.4 Email Sends

Each side calls Mailgun directly. There is no front email-dispatch endpoint exposed to back. (See §14.)

### 17.5 Service Authentication

Service-to-service traffic uses a shared HMAC token in `Authorization: Bearer {SERVICE_TOKEN}` header. Token rotated via Cloudflare Secrets. Both repos validate it on every internal call.

---

## 18. Testing

Testing philosophy: **test as you build**. Every PR requires passing tests.

| Layer | Tool |
|---|---|
| Unit + integration | [Vitest](https://vitest.dev) |
| Cloudflare runtime | Miniflare via `@cloudflare/vitest-pool-workers` |
| Database | Local PG via Docker + Drizzle (real DB, not mocked) |
| API handlers | Vitest + `Request`/`Response` mocks |
| UI components | Vitest + `@testing-library/dom` |
| E2E | [Playwright](https://playwright.dev) — staging environment |
| External APIs | mocked at HTTP boundary via [msw](https://mswjs.io) |

**Front-specific test areas:**

| Area | What is tested |
|---|---|
| Auth flows | Magic link, password, 2FA, SSO |
| Sign-up + trial creation | Stripe customer + subscription mock |
| Capability resolver | Given Stripe metadata, assert correct capability set |
| Trial enforcement | All capped paths block at limit |
| Onboarding wizard | Each step persists correct state; resume mid-wizard |
| Stripe webhook handler | Each event type with fixture payloads |
| Inbound API | Auth, validation, rate limit, credit consumption, forwarding to back |
| Email templates | Render snapshots; Mailgun call verification |

**Coverage targets:**
- API handlers: 75%
- UI components: 60%
- E2E (Playwright): all critical flows per §14.5 of the original PRD

---

## 19. Git Branching, Environments & CI/CD

| Branch | Environment | Cloudflare Account | Database |
|---|---|---|---|
| `main` | Production | Production CF account | Production DB |
| `staging` | Staging | Staging CF account | Staging DB |
| `feature/*` | Preview URLs | Production CF (preview) | Staging DB |

- `main` is protected; merges only via PR with passing tests.
- `staging` is the integration branch; auto-deploys to staging.
- Hotfixes: `hotfix/*` cut from `main`, merged back to both.
- CI (GitHub Actions) runs Vitest + Playwright on every PR; blocks merge on failure.

---

## 20. Security, Secrets & Encryption

| Secret (front-owned) | Where Stored |
|---|---|
| Stripe API key (publishable + secret) | Cloudflare Secrets |
| Stripe webhook signing secret | Cloudflare Secrets |
| Mailgun API key (front-scoped) | Cloudflare Secrets |
| better-auth secret | Cloudflare Secrets |
| Master encryption key (AES-256-GCM) | Cloudflare Secrets — used for OAuth token + Inbound API token at-rest encryption in master DB |
| Airtable OAuth client secret | Cloudflare Secrets |
| Storage destination OAuth client secrets (Google, Dropbox, Box, OneDrive, Frame.io) | Cloudflare Secrets — used for the OAuth flows initiated from the wizard |
| Service-to-back HMAC key | Cloudflare Secrets |
| PostHog project key | Cloudflare Secrets |
| dub.co API key | Cloudflare Secrets |

| Data | Encryption |
|---|---|
| OAuth tokens (Airtable, storage) | AES-256-GCM at rest in master DB |
| Inbound API tokens | SHA-256 hash stored — plaintext shown once |
| Passwords | bcrypt via better-auth |
| Sessions | better-auth managed |

**On2Air encryption compatibility:** On2Air uses bcrypt for passwords and a legacy scheme for backup data encryption. The migration script (covered in this PRD §22 / Open Q) decrypts with legacy keys, re-encrypts under AES-256-GCM, and stores the new key reference.

---

## 21. Database Access (Master DB)

The master DB schema is defined and migrated by **front** (`baseout-web` owns the Drizzle schema files). The schema is canonical at `../shared/Master_DB_Schema.md`.

| Concern | Detail |
|---|---|
| ORM | Drizzle |
| Schema definition | TypeScript in `baseout-web/src/db/schema/` |
| Migrations | `drizzle-kit generate` → committed SQL files; applied via `drizzle-kit migrate` |
| Production migrations | Manual approval step on `main` merge |
| Schema package | Front exports the schema as a `@baseout/db-schema` internal package; back imports it (does not redefine) |
| Connection | DigitalOcean PostgreSQL; connection string in Cloudflare Secrets |

**Tables front writes to:**
`organizations`, `organization_members`, `connections`, `spaces`, `bases`, `subscriptions`, `subscription_items`, `backup_configurations`, `restore_runs` (insert only — back updates), `storage_destinations`, `api_tokens`, `notification_channels`, `notification_preferences`, `health_score_rules`, `credit_buckets` (insert via Stripe webhook), `credit_addon_subscriptions`, `organization_billing_settings`.

**Tables front only reads:**
`backup_runs`, `backup_run_bases`, `space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`.

Conventions: snake_case tables/columns, UUID PKs, `created_at`/`modified_at` timestamps, `_enc` suffix for encrypted columns. See `../shared/Master_DB_Schema.md` for full conventions.

---

## 22. Open Questions

| # | Question | Impact | Default Answer |
|---|---|---|---|
| F1 | Pre-registration session: ephemeral or persisted? | Whether to add a `pre_registration_sessions` table | Recommend ephemeral-only (browser session) for V1; revisit if conversion data shows users dropping mid-flow |
| F2 | Schema-package distribution: workspace path import vs. published internal npm? | Affects monorepo vs. multi-repo layout | Recommend internal npm (`@baseout/db-schema`) — keeps repos independent |
| F3 | Inbound API write path: front writes to client DB directly via SQL REST, or POSTs to a back ingestion endpoint? | Coupling between front and back | **Recommend POST to back** — keeps client DB ownership clean |
| F4 | Capability cache TTL — 5 minutes or shorter? | Latency between Stripe upgrade and unlocked features | 5 min default; invalidate on any subscription_items write |
| F5 | Notification channels: org-level or space-level config? | `notification_channels` schema choice (mirrors `Master_DB_Schema.md` Q1) | Recommend org-level for V1; per-space if user demand emerges |
| F6 | Onboarding wizard rich state: integer step or jsonb? | Wizard recovery fidelity | Integer step + re-derive content from existing tables (current schema is fine) |
| F7 | Storage destination default: one per Space, or split static vs. dynamic? | `storage_destinations.is_default` shape | One per Space — dynamic backup writes to provisioned DB, not a destination |
| F8 | Trial cap interaction with overage cap | UX when both caps fire | Trial cap takes precedence; show "trial limit hit, upgrade to continue" not "overage cap hit" |
| F9 | Multi-platform Space (V2) — does front render placeholder nav now? | UI scaffolding cost | Recommend yes — prevents nav redesign at V2 launch |

---

*Version 1.0 — Front PRD created May 1, 2026. Split from BaseOut_PRD_v2.md (V1.4). See `../back/Back_PRD.md` for backup engine, background services, super-admin, and SQL REST API specs. See `../shared/` for cross-cutting Features, DB Schema, and Pricing/Credit specs.*
