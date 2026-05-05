# Baseout — Master Database Schema

**Version:** 0.1 (Draft)
**Date:** April 4, 2026
**Status:** Draft — Pending review of open questions at end of document
**Source:** BaseOut_PRD_v2.md (V1.4) + Baseout_Features.md (V1.0) + Implementation Plan (V1.0)

---

## Overview

This document defines the Drizzle schema for the **master PostgreSQL database** hosted on DigitalOcean. The master DB stores all organizational, billing, configuration, and operational metadata. It does **not** store customer Airtable record data — that lives in the per-Space client DBs (D1 / Shared PG / Dedicated PG / BYODB).

**What lives in the master DB:**
- Organizations, users, membership, roles
- Spaces and connections (OAuth tokens encrypted)
- Subscriptions and billing state (Stripe)
- Backup configuration and run history (metadata/counts only)
- Storage destination configuration (OAuth tokens encrypted)
- Provisioned client database registry
- Airtable webhook registrations
- Inbound API tokens
- Notification configuration and delivery log
- Health score rules (user-configured)

**What does NOT live in the master DB:**
- Airtable record data (lives in client DB)
- Schema snapshots / field/table structure (lives in client DB)
- Schema changelogs (lives in client DB)
- Automation / Interface backup content (lives in client DB)

**ORM:** Drizzle ORM — schema defined in TypeScript, migrations via `drizzle-kit`

---

## Conventions

| Convention | Rule | Example |
|---|---|---|
| Table names | Plural, snake_case | `organizations`, `backup_runs` |
| Column names | Singular, lowercase, snake_case | `organization_id`, `created_at` |
| Primary keys | `id`, UUID | `id uuid primary key default gen_random_uuid()` |
| Foreign keys | `{singular_table}_id` | `organization_id`, `space_id` |
| Timestamps | `created_at`, `modified_at` — auto-managed | Set on insert; `modified_at` updated via ORM hook |
| Booleans | `is_` or `has_` prefix | `is_active`, `has_migrated` |
| Status enums | snake_case string literals | `'pending' \| 'running' \| 'success' \| 'failed'` |
| Encrypted fields | `_enc` suffix | `access_token_enc`, `pg_connection_string_enc` |

---

## better-auth Managed Tables

[better-auth](https://better-auth.com) manages the following tables automatically. **Do not manually define these in the Baseout Drizzle schema** — they are owned by better-auth's migration system:

| Table | Purpose |
|---|---|
| `users` | Core user identity: `id`, `email`, `name`, `email_verified`, `image`, `created_at`, `updated_at` |
| `sessions` | Active login sessions: `id`, `user_id`, `token`, `expires_at`, `created_at` |
| `accounts` | OAuth provider accounts linked to users (for login methods) |
| `verifications` | Magic link / email verification tokens |

> **Note:** The Baseout `organization_members` table references `users.id` from better-auth's `users` table. All user lookups go through better-auth's user ID.

---

## Table Definitions

---

### `organizations`

Top-level billing entity. One per customer company. Maps to a single Stripe customer and billing relationship.

```sql
organizations
├── id                    uuid        PK, default gen_random_uuid()
├── name                  text        NOT NULL
├── slug                  text        NOT NULL, UNIQUE  -- URL-safe identifier (e.g. "acme-corp")
├── stripe_customer_id    text        UNIQUE            -- Stripe customer object ID
├── has_migrated          boolean     NOT NULL, default true   -- false = On2Air migrated user; show "Complete Your Migration" screen on first login
├── dynamic_locked        boolean     NOT NULL, default false  -- true = On2Air user; dynamic features shown as upgrade CTAs
├── overage_mode          text        NOT NULL, default 'cap'  -- 'auto' | 'cap'
├── monthly_overage_cap   integer     NULL              -- max overage spend in cents per month; NULL = no cap (only applies when overage_mode = 'auto')
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `organization_members`

Links better-auth users to Organizations with a role. A user may belong to only one Organization in V1.

```sql
organization_members
├── id                    uuid        PK
├── organization_id       uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── user_id               text        NOT NULL             -- references better-auth users.id
├── role                  text        NOT NULL             -- 'owner' | 'admin' | 'member'
├── invited_by_user_id    text        NULL                 -- better-auth user ID of the inviter
├── invited_at            timestamptz NULL
├── accepted_at           timestamptz NULL
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()

UNIQUE (organization_id, user_id)
```

---

### `connections`

Authenticated links between an Organization and an external Platform (Airtable OAuth). One Connection can serve multiple Spaces. Tokens are stored encrypted (AES-256-GCM).

```sql
connections
├── id                       uuid        PK
├── organization_id          uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── platform                 text        NOT NULL  -- 'airtable' (extensible for V2 platforms)
├── display_name             text        NULL      -- user-given label (e.g. "Main Airtable Account")
├── airtable_user_id         text        NULL      -- Airtable user ID returned from OAuth
├── airtable_workspace_id    text        NULL      -- Airtable workspace ID (top-level scope)
├── access_token_enc         text        NOT NULL  -- encrypted AES-256-GCM
├── refresh_token_enc        text        NULL      -- encrypted; NULL if no refresh token
├── token_expires_at         timestamptz NULL
├── scopes                   text        NULL      -- space-delimited OAuth scopes granted
├── is_enterprise_scope      boolean     NOT NULL, default false  -- Airtable Enterprise OAuth variant
├── status                   text        NOT NULL  -- 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
├── invalidated_at           timestamptz NULL      -- set when status moves to 'invalid' after dead-connection cadence completes
├── last_used_at             timestamptz NULL
├── created_at               timestamptz NOT NULL, default now()
└── modified_at              timestamptz NOT NULL, default now()
```

---

### `spaces`

A container within an Organization bound to a single Platform. Has its own backup config, storage destination, and database. The primary billing and quota unit.

```sql
spaces
├── id                    uuid        PK
├── organization_id       uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── connection_id         uuid        NULL, FK → connections.id ON DELETE SET NULL  -- linked after onboarding step 1
├── name                  text        NOT NULL
├── platform              text        NOT NULL, default 'airtable'  -- 'airtable' (V2: 'notion', 'hubspot', etc.)
├── space_type            text        NOT NULL, default 'single_platform'  -- 'single_platform' | 'multi_platform' (V2)
├── status                text        NOT NULL  -- 'setup_incomplete' | 'active' | 'paused' | 'error'
├── onboarding_step       integer     NOT NULL, default 1  -- current wizard step (1–5); NULL = completed
├── onboarding_completed_at timestamptz NULL
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `bases`

Airtable bases discovered or configured within a Space. Tracks which bases are included in backup runs and their discovery state.

```sql
bases
├── id                    uuid        PK
├── space_id              uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── airtable_base_id      text        NOT NULL  -- Airtable's base ID (e.g. "appXXXXXXXXX")
├── name                  text        NOT NULL  -- cached from last API scan
├── is_included           boolean     NOT NULL, default true   -- user can exclude individual bases from backup
├── is_auto_discovered    boolean     NOT NULL, default false  -- discovered by OAuth meta scan vs. manually added
├── last_seen_at          timestamptz NULL      -- last time base appeared in Airtable API scan
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()

UNIQUE (space_id, airtable_base_id)
```

---

### `subscriptions`

One Stripe subscription per Organization. Created at sign-up as a $0 trial; modified (never replaced) as tiers change.

```sql
subscriptions
├── id                        uuid        PK
├── organization_id           uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── stripe_subscription_id    text        NOT NULL, UNIQUE
├── status                    text        NOT NULL  -- 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'incomplete_expired'
├── created_at                timestamptz NOT NULL, default now()
└── modified_at               timestamptz NOT NULL, default now()

UNIQUE (organization_id)  -- one subscription per org
```

---

### `subscription_items`

One row per active Platform within an Organization's subscription. Capabilities and limits are resolved by reading `platform` + `tier` from Stripe product metadata — never from these fields directly. These are cached for quick lookups.

```sql
subscription_items
├── id                              uuid        PK
├── subscription_id                 uuid        NOT NULL, FK → subscriptions.id ON DELETE CASCADE
├── platform                        text        NOT NULL  -- 'airtable'
├── stripe_subscription_item_id     text        NOT NULL, UNIQUE
├── stripe_product_id               text        NOT NULL
├── stripe_price_id                 text        NOT NULL
├── tier                            text        NOT NULL  -- 'starter' | 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'
├── billing_period                  text        NOT NULL  -- 'monthly' | 'annual'
├── trial_ends_at                   timestamptz NULL
├── trial_backup_run_used           boolean     NOT NULL, default false  -- true after trial's 1 backup run is consumed
├── trial_ever_used                 boolean     NOT NULL, default false  -- one trial per platform per org, ever
├── current_period_start            timestamptz NULL
├── current_period_end              timestamptz NULL
├── cancelled_at                    timestamptz NULL
├── created_at                      timestamptz NOT NULL, default now()
└── modified_at                     timestamptz NOT NULL, default now()

UNIQUE (subscription_id, platform)
```

---

### `backup_configurations`

One backup configuration per Space. Controls schedule, mode, and auto-discovery behavior.

```sql
backup_configurations
├── id                        uuid        PK
├── space_id                  uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── frequency                 text        NOT NULL  -- 'monthly' | 'weekly' | 'daily' | 'instant'
├── is_active                 boolean     NOT NULL, default true
├── auto_add_new_bases        boolean     NOT NULL, default false  -- automatically include newly discovered bases
├── include_attachments       boolean     NOT NULL, default true
├── next_scheduled_run_at     timestamptz NULL      -- computed by backup engine scheduler
├── last_run_at               timestamptz NULL
├── created_at                timestamptz NOT NULL, default now()
└── modified_at               timestamptz NOT NULL, default now()

UNIQUE (space_id)
```

---

### `backup_runs`

One row per backup execution. Records are written on job start with `status = 'pending'` and updated on completion. Aggregate metrics only — per-entity detail lives in the client DB audit logs.

```sql
backup_runs
├── id                    uuid        PK
├── space_id              uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── trigger_type          text        NOT NULL  -- 'scheduled' | 'manual' | 'webhook' | 'trial'
├── status                text        NOT NULL  -- 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'trial_complete' | 'cancelled'
├── is_trial              boolean     NOT NULL, default false
├── record_count          integer     NULL      -- total records captured
├── table_count           integer     NULL
├── attachment_count      integer     NULL
├── base_count            integer     NULL
├── error_message         text        NULL      -- top-level error if status = 'failed'
├── trigger_dev_run_id    text        NULL      -- Trigger.dev job run ID for log lookup
├── started_at            timestamptz NOT NULL
├── completed_at          timestamptz NULL
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `backup_run_bases`

Per-base status and metrics within a backup run. Used for the per-entity verification feature.

```sql
backup_run_bases
├── id                    uuid        PK
├── backup_run_id         uuid        NOT NULL, FK → backup_runs.id ON DELETE CASCADE
├── base_id               uuid        NULL, FK → bases.id ON DELETE SET NULL  -- NULL if base was deleted
├── airtable_base_id      text        NOT NULL  -- denormalized for historical record
├── base_name             text        NOT NULL  -- denormalized snapshot at time of run
├── status                text        NOT NULL  -- 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'skipped'
├── record_count          integer     NULL
├── table_count           integer     NULL
├── attachment_count      integer     NULL
├── error_message         text        NULL
├── started_at            timestamptz NULL
└── completed_at          timestamptz NULL
```

---

### `restore_runs`

One row per restore operation initiated by a user.

```sql
restore_runs
├── id                            uuid        PK
├── space_id                      uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── initiated_by_user_id          text        NOT NULL  -- better-auth user ID
├── source_backup_run_id          uuid        NULL, FK → backup_runs.id ON DELETE SET NULL
├── restore_scope                 text        NOT NULL  -- 'base' | 'table'
├── source_airtable_base_id       text        NULL
├── source_airtable_table_id      text        NULL      -- populated for table-level restores
├── destination_type              text        NOT NULL  -- 'new_base' | 'existing_base_new_table'
├── destination_workspace_id      text        NULL      -- Airtable workspace ID (for 'new_base')
├── destination_base_id           text        NULL      -- target Airtable base ID (for 'existing_base_new_table')
├── status                        text        NOT NULL  -- 'pending' | 'running' | 'success' | 'partial_success' | 'failed'
├── records_restored              integer     NULL
├── error_message                 text        NULL
├── trigger_dev_run_id            text        NULL
├── started_at                    timestamptz NOT NULL
├── completed_at                  timestamptz NULL
├── created_at                    timestamptz NOT NULL, default now()
└── modified_at                   timestamptz NOT NULL, default now()
```

---

### `storage_destinations`

External file storage destinations configured per Space. Multiple destinations allowed; one is marked default. OAuth tokens and IAM credentials are encrypted.

```sql
storage_destinations
├── id                    uuid        PK
├── space_id              uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── destination_type      text        NOT NULL  -- 'google_drive' | 'dropbox' | 'box' | 'onedrive' | 'amazon_s3' | 'cloudflare_r2' | 'frame_io'
├── display_name          text        NOT NULL  -- user-given label
├── is_default            boolean     NOT NULL, default false
├── -- OAuth credentials (Google Drive, Dropbox, Box, OneDrive, Frame.io):
├── access_token_enc      text        NULL      -- encrypted
├── refresh_token_enc     text        NULL      -- encrypted
├── token_expires_at      timestamptz NULL
├── -- Config blob (destination-specific):
├── config_json           jsonb       NULL
│   -- google_drive: { folder_id, folder_name }
│   -- dropbox / box: { folder_path }
│   -- onedrive: { folder_id, folder_name, drive_id }
│   -- amazon_s3: { bucket, region, path_prefix, access_key_id_enc, secret_access_key_enc }
│   -- cloudflare_r2: { bucket, path_prefix }  (internal — no user credentials needed)
│   -- frame_io: { folder_id, team_id }
├── status                text        NOT NULL  -- 'active' | 'invalid' | 'pending_auth'
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `space_databases`

Registry of provisioned client databases per Space. One row per Space with a Dynamic backup mode. Tracks connection details (encrypted) and provisioning state.

```sql
space_databases
├── id                            uuid        PK
├── space_id                      uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── database_tier                 text        NOT NULL  -- 'd1_schema_only' | 'd1_full' | 'shared_pg' | 'dedicated_pg' | 'byodb'
├── -- D1 (Cloudflare):
├── d1_database_id                text        NULL  -- Cloudflare D1 database ID
├── d1_database_name              text        NULL
├── -- PostgreSQL (all PG tiers):
├── pg_connection_string_enc      text        NULL  -- encrypted full connection string (shared/dedicated/byodb)
├── pg_schema_name                text        NULL  -- schema-level isolation name on shared PG (e.g. "org_abc123")
├── -- Provisioning state:
├── provisioning_status           text        NOT NULL  -- 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
├── provisioned_at                timestamptz NULL
├── last_migration_at             timestamptz NULL  -- last D1→PG or PG tier migration
├── size_bytes                    bigint      NULL  -- cached from last utilization check
├── size_checked_at               timestamptz NULL
├── created_at                    timestamptz NOT NULL, default now()
└── modified_at                   timestamptz NOT NULL, default now()

UNIQUE (space_id)
```

---

### `airtable_webhooks`

Webhook registrations for Spaces with Instant Backup (Pro+). Each row represents one webhook registered with Airtable for a specific base. Renewed by the background service at the 6-day threshold (Airtable webhooks expire at ~7 days).

```sql
airtable_webhooks
├── id                            uuid        PK
├── space_id                      uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── connection_id                 uuid        NOT NULL, FK → connections.id ON DELETE CASCADE
├── base_id                       uuid        NULL, FK → bases.id ON DELETE SET NULL
├── airtable_base_id              text        NOT NULL  -- denormalized
├── airtable_webhook_id           text        NOT NULL, UNIQUE  -- ID returned by Airtable
├── cursor                        text        NULL  -- incremental event fetch cursor
├── expires_at                    timestamptz NULL  -- Airtable's expiry; renewed before this
├── is_active                     boolean     NOT NULL, default true
├── last_successful_renewal_at    timestamptz NULL
├── created_at                    timestamptz NOT NULL, default now()
└── modified_at                   timestamptz NOT NULL, default now()
```

---

### `api_tokens`

Inbound API tokens per Space, used by external scripts and AI agents to submit data (Automations, Interfaces, custom metadata). Token plaintext is shown once at creation — only the hash is stored.

```sql
api_tokens
├── id                uuid        PK
├── space_id          uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── user_id           text        NOT NULL  -- better-auth user ID of creator
├── name              text        NOT NULL  -- user-given label (e.g. "Airtable Script Token")
├── token_hash        text        NOT NULL, UNIQUE  -- SHA-256 hash of the full token
├── token_prefix      text        NOT NULL  -- first 8 chars for display (e.g. "bsot_ab12")
├── scopes            text        NULL      -- space-delimited scope list (reserved for future use)
├── is_active         boolean     NOT NULL, default true
├── expires_at        timestamptz NULL      -- NULL = no expiry
├── last_used_at      timestamptz NULL
├── created_at        timestamptz NOT NULL, default now()
└── modified_at       timestamptz NOT NULL, default now()
```

---

### `notification_channels`

Configured delivery channels for an Organization (Slack, Teams, outbound webhook, PagerDuty). Email and in-app are implicit — no configuration row needed.

> ⚠️ **Open Question #1:** Are notification channels configured at the **Organization** level (one Slack channel for all alerts) or at the **Space** level (per-Space Slack channels)? This table currently scopes to the Organization — revise to Space if per-Space config is needed.

```sql
notification_channels
├── id                    uuid        PK
├── organization_id       uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── channel_type          text        NOT NULL  -- 'slack' | 'teams' | 'webhook' | 'pagerduty'
├── display_name          text        NOT NULL  -- user-given label
├── is_active             boolean     NOT NULL, default true
├── config_enc            text        NOT NULL  -- encrypted JSON blob:
│   -- slack:      { webhook_url }
│   -- teams:      { webhook_url }
│   -- webhook:    { url, secret }
│   -- pagerduty:  { integration_key }
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `notification_preferences`

Per-Organization configuration of which notification types are enabled and on which channels. Overage/quota thresholds also stored here.

```sql
notification_preferences
├── id                            uuid        PK
├── organization_id               uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── notification_type             text        NOT NULL
│   -- 'backup_success' | 'backup_failure' | 'backup_partial'
│   -- 'quota_75' | 'quota_90' | 'quota_100' | 'overage'
│   -- 'schema_change' | 'health_score_change'
│   -- 'data_alert' | 'restore_complete'
│   -- 'monthly_audit' | 'trial_expiry'
│   -- 'connection_dead_1' | 'connection_dead_2' | 'connection_dead_3' | 'connection_dead_final'
├── is_email_enabled              boolean     NOT NULL, default true
├── is_in_app_enabled             boolean     NOT NULL, default true
├── is_slack_enabled              boolean     NOT NULL, default false
├── is_teams_enabled              boolean     NOT NULL, default false
├── is_webhook_enabled            boolean     NOT NULL, default false
├── is_pagerduty_enabled          boolean     NOT NULL, default false
├── created_at                    timestamptz NOT NULL, default now()
└── modified_at                   timestamptz NOT NULL, default now()

UNIQUE (organization_id, notification_type)
```

---

### `notification_log`

Tracks delivery state for stateful notification sequences (dead-connection 4-touch cadence, trial expiry, quota warnings). Prevents duplicate sends and enforces cadence timing.

```sql
notification_log
├── id                    uuid        PK
├── organization_id       uuid        NOT NULL, FK → organizations.id ON DELETE CASCADE
├── connection_id         uuid        NULL, FK → connections.id ON DELETE CASCADE  -- populated for connection-related notifications
├── space_id              uuid        NULL, FK → spaces.id ON DELETE CASCADE        -- populated for space/quota notifications
├── notification_type     text        NOT NULL  -- matches types from notification_preferences
├── sent_count            integer     NOT NULL, default 0
├── last_sent_at          timestamptz NULL
├── next_send_at          timestamptz NULL  -- computed by background service for cadence-based types
├── is_resolved           boolean     NOT NULL, default false  -- e.g. connection re-authenticated, quota reduced
├── resolved_at           timestamptz NULL
├── created_at            timestamptz NOT NULL, default now()
└── modified_at           timestamptz NOT NULL, default now()
```

---

### `health_score_rules`

Per-Space configurable rules for the Schema Health Score (Pro+). Default rules are seeded on Space creation; users can toggle and configure them.

```sql
health_score_rules
├── id                uuid        PK
├── space_id          uuid        NOT NULL, FK → spaces.id ON DELETE CASCADE
├── rule_type         text        NOT NULL
│   -- 'naming_convention' | 'missing_descriptions' | 'orphaned_fields'
│   -- 'circular_lookups' | 'formula_errors' | 'duplicate_field_names'
│   -- 'unused_linked_records' | 'empty_tables'
├── is_enabled        boolean     NOT NULL, default true
├── weight            integer     NOT NULL, default 1   -- relative weight (1–10); affects 0–100 score calculation
├── config_json       jsonb       NULL  -- rule-specific config (e.g. { "pattern": "Title Case" } for naming_convention)
├── created_at        timestamptz NOT NULL, default now()
└── modified_at       timestamptz NOT NULL, default now()

UNIQUE (space_id, rule_type)
```

---

## Entity Relationship Summary

```
organizations
├── organization_members (→ better-auth users.id)
├── connections
├── subscriptions
│   └── subscription_items
├── notification_channels
├── notification_preferences
└── spaces
    ├── bases
    ├── backup_configurations
    ├── backup_runs
    │   └── backup_run_bases (→ bases)
    ├── restore_runs
    ├── storage_destinations
    ├── space_databases
    ├── airtable_webhooks (→ connections, bases)
    ├── api_tokens
    ├── notification_log (→ connections)
    └── health_score_rules
```

---

## Indexes (Recommended)

Beyond primary keys and unique constraints, these indexes are expected to be high-frequency:

| Table | Index | Reason |
|---|---|---|
| `organization_members` | `(user_id)` | Look up org by logged-in user |
| `spaces` | `(organization_id)` | List all spaces for an org |
| `connections` | `(organization_id, platform)` | Find active connection for org+platform |
| `bases` | `(space_id, is_included)` | Backup engine: list included bases per space |
| `backup_runs` | `(space_id, started_at DESC)` | Dashboard: recent runs per space |
| `backup_run_bases` | `(backup_run_id)` | Per-run base status listing |
| `airtable_webhooks` | `(space_id, is_active)` | Background service: find webhooks to renew |
| `airtable_webhooks` | `(expires_at)` | Renewal threshold scan |
| `notification_log` | `(connection_id, notification_type)` | Cadence check: has this connection been notified? |
| `subscription_items` | `(subscription_id, platform)` | Capability resolution |

---

## Open Questions

The following questions need answers before this schema can be finalized. I'm less than 95% confident in the design choice and need your input.

---

### Q1 — Notification channels: org-level or space-level?

**Current design:** `notification_channels` and `notification_preferences` are scoped to the Organization.

**The question:** Should a user be able to configure different Slack channels (or other channels) per Space? For example:
- Space A (Production) → `#baseout-prod-alerts`
- Space B (Client Work) → `#baseout-client-alerts`

Or is one Slack configuration per Organization sufficient for V1?

**Impact:** If per-Space, both tables need a `space_id` FK instead of (or in addition to) `organization_id`.

---

### Q2 — Pre-registration sessions: master DB or ephemeral?

**Context:** PRD §13.2 describes a "temporary session" for pre-registration schema visualization. A visitor can visualize a schema before signing up; on registration, the session is "claimed" and linked to the new Organization.

**The question:** Does this session state need to be persisted in the master DB (so a user can close a browser tab and return later), or is it ephemeral (lives only in better-auth's session / Cloudflare KV / browser local storage)?

**Impact:** If it needs to survive a browser close/refresh, we need a `pre_registration_sessions` table:
```
pre_registration_sessions
├── id              uuid  PK
├── session_token   text  UNIQUE  -- stored client-side
├── payload_json    jsonb         -- schema data submitted
├── claimed_by_org  uuid  NULL FK → organizations.id
├── claimed_at      timestamptz NULL
├── expires_at      timestamptz NOT NULL
└── created_at      timestamptz NOT NULL
```
If it's browser-session-only, no DB table is needed.

---

### Q3 — Onboarding wizard state: column on `spaces` or separate table?

**Current design:** `spaces.onboarding_step` (integer 1–5) tracks the last completed wizard step; `spaces.onboarding_completed_at` marks completion.

**The question:** Is a single integer step counter sufficient, or do we need to store richer state per step (e.g. which bases were selected in step 2, whether auto-add was toggled in step 2, etc.) that can be recovered if the user leaves mid-wizard?

**Impact:** If rich step state is needed, consider a `jsonb` column on `spaces` (e.g. `onboarding_state_json`) or a separate `onboarding_states` table. If the integer step is sufficient (each step re-derives its content from other tables), the current design is fine.

---

### Q4 — Storage destination: one default per space or one per backup mode?

**Current design:** `storage_destinations.is_default boolean` — one default per Space.

**The question:** Static backup (CSV files) and Dynamic backup potentially use different storage. Does a Space ever need separate default destinations for static vs dynamic, or is a single "default" destination per Space sufficient?

**Impact:** If separate defaults are needed, the column becomes `is_default_static` and `is_default_dynamic`. Most likely one default is fine for V1 since Dynamic backup goes to the provisioned DB (tracked in `space_databases`), not a storage destination. Just confirming this understanding.

---

*Version 0.1 — Draft created April 4, 2026. Pending answers to open questions above before finalization.*
