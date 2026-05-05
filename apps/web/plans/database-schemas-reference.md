# Baseout Database Schemas — Full Reference

**Created:** 2026-04-16
**Source:** PRD v1.4 + Baseout_Features.md + existing cluster schemas

---

## Existing Cluster Context

**Cluster:** openside-db-do-user-115703-0.d.db.ondigitalocean.com:25060

| Database | Tables | Status | Notes |
|----------|--------|--------|-------|
| **starter** | 9 | Has data | Better Auth + org/team management reference |
| **osai** | 5 (3 real) | Has data | Drizzle ORM, accounts/users/projects |
| **baseout-dev** | 0 | Empty | Target database for this project |
| **boa** | 0 | Empty | Only plpgsql extension |
| **defaultdb** | 0 | Empty | DigitalOcean default |
| **okb-dev** | 0 | Empty | Has pgvector 0.8.1 extension |

---

## Schema A: Starter (10 tables)

### Goal
Minimum tables for: sign up, authenticate, create an org, connect to Airtable. The `spaces` table is deferred to a separate iteration.

### Better Auth Managed Tables (9 tables)

These match the existing `starter` database. Better Auth owns them via its `migrate()` function. Drizzle schema files reference them read-only for joins. All use `text` IDs with `gen_random_uuid()`, `timestamptz` timestamps, `updated_at` convention.

#### `users`
Core user accounts.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| name | text | NOT NULL | | |
| email | text | NOT NULL | | UNIQUE |
| email_verified | boolean | NOT NULL | `false` | |
| image | text | NULL | | |
| is_anonymous | boolean | NOT NULL | `false` | |
| created_at | timestamptz | NOT NULL | `now()` | |
| updated_at | timestamptz | NOT NULL | `now()` | |

Indexes: `users_pkey (id)`, `users_email_unique (email)`

#### `organizations`
Multi-tenant organizations (billing entity).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| name | text | NOT NULL | | |
| slug | text | NOT NULL | | UNIQUE |
| logo | text | NULL | | |
| metadata | text | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

Indexes: `organization_pkey (id)`, `organization_slug_unique (slug)`

#### `members`
User-to-organization membership with roles.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| user_id | text | NOT NULL | | FK → users.id |
| organization_id | text | NOT NULL | | FK → organizations.id |
| role | text | NOT NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

Indexes: `member_pkey (id)`. Add `idx_members_user_org (user_id, organization_id)` as Baseout customization.

#### `teams`
Teams within organizations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| name | text | NOT NULL | | |
| organization_id | text | NOT NULL | | FK → organizations.id |
| created_at | timestamptz | NOT NULL | `now()` | |
| updated_at | timestamptz | NOT NULL | `now()` | |

Indexes: `team_pkey (id)`

#### `team_members`
User-to-team membership.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| team_id | text | NOT NULL | | FK → teams.id |
| user_id | text | NOT NULL | | FK → users.id |
| created_at | timestamptz | NOT NULL | `now()` | |

Indexes: `team_member_pkey (id)`

#### `invitations`
Organization and team invitations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| email | text | NOT NULL | | |
| inviter_id | text | NOT NULL | | FK → users.id |
| organization_id | text | NOT NULL | | FK → organizations.id |
| role | text | NOT NULL | | |
| status | text | NOT NULL | | |
| team_id | text | NULL | | FK → teams.id |
| expires_at | timestamptz | NOT NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

Indexes: `invitation_pkey (id)`

#### `identities`
OAuth and credential identity providers for *login* (NOT for Airtable data connections).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| account_id | text | NOT NULL | | |
| provider_id | text | NOT NULL | | |
| user_id | text | NOT NULL | | FK → users.id |
| access_token | text | NULL | | |
| refresh_token | text | NULL | | |
| id_token | text | NULL | | |
| access_token_expires_at | timestamptz | NULL | | |
| refresh_token_expires_at | timestamptz | NULL | | |
| scope | text | NULL | | |
| password | text | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |
| updated_at | timestamptz | NOT NULL | `now()` | |

Indexes: `identities_pkey (id)`

#### `sessions`
Active user sessions with org/team context.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| expires_at | timestamptz | NOT NULL | | |
| token | text | NOT NULL | | UNIQUE |
| created_at | timestamptz | NOT NULL | `now()` | |
| updated_at | timestamptz | NOT NULL | `now()` | |
| ip_address | text | NULL | | |
| user_agent | text | NULL | | |
| user_id | text | NOT NULL | | FK → users.id |
| active_organization_id | text | NULL | | |
| active_team_id | text | NULL | | |

Indexes: `sessions_pkey (id)`, `sessions_token_unique (token)`

#### `verifications`
Email/phone verification tokens.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| identifier | text | NOT NULL | | |
| value | text | NOT NULL | | |
| expires_at | timestamptz | NOT NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |
| updated_at | timestamptz | NOT NULL | `now()` | |

Indexes: `verifications_pkey (id)`

### Baseout Application Table (1 table)

#### `connections`
OAuth connections to external platforms (Airtable). Separate from Better Auth `identities` — these are for data access, not login.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| platform | text | NOT NULL | `'airtable'` | |
| auth_method | text | NOT NULL | `'oauth2'` | |
| access_token_enc | text | NULL | | |
| refresh_token_enc | text | NULL | | |
| token_expires_at | timestamptz | NULL | | |
| scopes | text | NULL | | |
| external_account_id | text | NULL | | |
| label | text | NULL | | |
| status | text | NOT NULL | `'active'` | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

Indexes: `connections_pkey (id)`, `idx_connections_org_id (organization_id)`, `idx_connections_org_platform (organization_id, platform)`

### Schema A Relationships

```
Better Auth managed:
  users.id          ← members.user_id
  users.id          ← team_members.user_id
  users.id          ← invitations.inviter_id
  users.id          ← identities.user_id
  users.id          ← sessions.user_id
  organizations.id  ← members.organization_id
  organizations.id  ← teams.organization_id
  organizations.id  ← invitations.organization_id
  teams.id          ← team_members.team_id
  teams.id          ← invitations.team_id

Baseout application:
  organizations.id  ← connections.organization_id  (CASCADE)
```

### Schema A Key Design Decisions

1. **`text` IDs** everywhere — matches Better Auth convention (not native `uuid`)
2. **`modified_at`** on Baseout tables vs `updated_at` on auth tables — visual ownership signal
3. **`_enc` suffix** on token columns signals app-layer AES-256-GCM encryption
4. **Airtable OAuth in `connections`, NOT in `identities`** — different purpose, scope, and rotation policy
5. **Companion table pattern** — don't modify Better Auth tables; extend via separate tables (e.g., `organization_profiles` in Schema B)

---

## Schema B: Full V1 (24 tables)

### Goal
Everything needed for V1 launch. All of Schema A plus 14 additional Baseout application tables.

### Additional Tables (14 beyond Schema A)

#### `spaces`
A backup target — maps to an Airtable base. Deferred from Schema A.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| connection_id | text | NULL | | FK → connections.id SET NULL |
| name | text | NOT NULL | | |
| platform | text | NOT NULL | `'airtable'` | |
| external_id | text | NULL | | |
| space_type | text | NOT NULL | `'base'` | |
| status | text | NOT NULL | `'pending'` | |
| is_trial | boolean | NOT NULL | `false` | |
| last_backup_at | timestamptz | NULL | | |
| table_count | integer | NULL | | |
| record_count | integer | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

Indexes: `idx_spaces_org_id`, `idx_spaces_connection_id`, `idx_spaces_external_id`, `idx_spaces_org_status`

Notes: `connection_id` uses SET NULL so space survives if connection revoked. `last_backup_at`, `table_count`, `record_count` are denormalized cache columns for dashboard.

#### `organization_profiles`
Companion to Better Auth's `organizations` — Baseout-specific org settings.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE, UNIQUE |
| stripe_customer_id | text | NULL | | UNIQUE |
| has_migrated | boolean | NOT NULL | `false` | |
| is_dynamic_locked | boolean | NOT NULL | `false` | |
| default_storage_destination_id | text | NULL | | FK → storage_destinations.id SET NULL |
| default_retention_days | integer | NOT NULL | `30` | |
| timezone | text | NOT NULL | `'UTC'` | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

Indexes: UNIQUE on `organization_id`, UNIQUE on `stripe_customer_id`

#### `storage_destinations`
Where backup files are stored (R2, Google Drive, S3, etc.).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| name | text | NOT NULL | | |
| provider | text | NOT NULL | `'r2'` | |
| bucket_name | text | NOT NULL | | |
| region | text | NULL | | |
| path_prefix | text | NULL | | |
| credentials_enc | text | NULL | | |
| is_default | boolean | NOT NULL | `false` | |
| is_verified | boolean | NOT NULL | `false` | |
| status | text | NOT NULL | `'active'` | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

#### `backup_schedules`
When backups run. 1:1 with spaces.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| space_id | text | NOT NULL | | FK → spaces.id CASCADE, UNIQUE |
| is_enabled | boolean | NOT NULL | `true` | |
| frequency | text | NOT NULL | `'daily'` | |
| cron_expression | text | NULL | | |
| preferred_hour_utc | integer | NULL | | |
| next_run_at | timestamptz | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

Partial index: `next_run_at` WHERE `is_enabled = true`

#### `backup_runs`
Each backup execution. High-volume, append-mostly.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| space_id | text | NOT NULL | | FK → spaces.id CASCADE |
| schedule_id | text | NULL | | FK → backup_schedules.id SET NULL |
| trigger_type | text | NOT NULL | `'scheduled'` | |
| status | text | NOT NULL | `'pending'` | |
| started_at | timestamptz | NULL | | |
| completed_at | timestamptz | NULL | | |
| is_trial | boolean | NOT NULL | `false` | |
| record_count | integer | NULL | | |
| table_count | integer | NULL | | |
| attachment_count | integer | NULL | | |
| size_bytes | bigint | NULL | | |
| storage_destination_id | text | NULL | | FK → storage_destinations.id SET NULL |
| storage_path | text | NULL | | |
| error_message | text | NULL | | |
| duration_ms | integer | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

Partial index: `status` WHERE `status IN ('pending', 'running')` for worker polling

#### `backup_snapshots`
Per-table records within a backup run.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| backup_run_id | text | NOT NULL | | FK → backup_runs.id CASCADE |
| table_external_id | text | NOT NULL | | |
| table_name | text | NOT NULL | | |
| record_count | integer | NOT NULL | `0` | |
| attachment_count | integer | NOT NULL | `0` | |
| size_bytes | bigint | NOT NULL | `0` | |
| storage_path | text | NULL | | |
| checksum | text | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

#### `restore_runs`
Restore operations from a backup snapshot back to Airtable.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| space_id | text | NOT NULL | | FK → spaces.id CASCADE |
| backup_run_id | text | NOT NULL | | FK → backup_runs.id RESTRICT |
| initiated_by_user_id | text | NOT NULL | | FK → users.id RESTRICT |
| restore_type | text | NOT NULL | `'full'` | |
| target_table_external_id | text | NULL | | |
| status | text | NOT NULL | `'pending'` | |
| started_at | timestamptz | NULL | | |
| completed_at | timestamptz | NULL | | |
| record_count | integer | NULL | | |
| error_message | text | NULL | | |
| duration_ms | integer | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

Notes: `backup_run_id` RESTRICT — cannot delete a backup used for restore.

#### `schema_snapshots`
Point-in-time Airtable schema captures.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| space_id | text | NOT NULL | | FK → spaces.id CASCADE |
| backup_run_id | text | NULL | | FK → backup_runs.id SET NULL |
| snapshot_version | integer | NOT NULL | | |
| captured_at | timestamptz | NOT NULL | `now()` | |
| table_count | integer | NOT NULL | `0` | |
| field_count | integer | NOT NULL | `0` | |
| schema_hash | text | NULL | | |
| has_changes | boolean | NOT NULL | `false` | |
| raw_schema_json | jsonb | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

UNIQUE index: `(space_id, snapshot_version)`

#### `schema_fields`
Denormalized per-field records for schema intelligence.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| schema_snapshot_id | text | NOT NULL | | FK → schema_snapshots.id CASCADE |
| table_external_id | text | NOT NULL | | |
| table_name | text | NOT NULL | | |
| field_external_id | text | NOT NULL | | |
| field_name | text | NOT NULL | | |
| field_type | text | NOT NULL | | |
| field_options | jsonb | NULL | | |
| is_primary | boolean | NOT NULL | `false` | |
| is_computed | boolean | NOT NULL | `false` | |

Immutable — no timestamps needed.

#### `subscriptions`
Stripe billing state.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| stripe_subscription_id | text | NULL | | UNIQUE |
| stripe_price_id | text | NULL | | |
| platform | text | NOT NULL | `'airtable'` | |
| tier | text | NOT NULL | `'starter'` | |
| status | text | NOT NULL | `'trialing'` | |
| trial_ends_at | timestamptz | NULL | | |
| current_period_start | timestamptz | NULL | | |
| current_period_end | timestamptz | NULL | | |
| cancel_at | timestamptz | NULL | | |
| cancelled_at | timestamptz | NULL | | |
| space_limit | integer | NOT NULL | `1` | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

#### `api_tokens`
Programmatic access tokens.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| space_id | text | NULL | | FK → spaces.id CASCADE |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| user_id | text | NOT NULL | | FK → users.id CASCADE |
| name | text | NOT NULL | | |
| token_prefix | text | NOT NULL | | |
| token_hash | text | NOT NULL | | |
| scopes | text | NOT NULL | `'read'` | |
| is_active | boolean | NOT NULL | `true` | |
| expires_at | timestamptz | NULL | | |
| last_used_at | timestamptz | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

`token_prefix` stores first 8 chars for UI display. `token_hash` is SHA-256. Full token shown once at creation.

#### `notification_rules`
Configurable notification preferences.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| notification_type | text | NOT NULL | | |
| channel | text | NOT NULL | `'email'` | |
| is_enabled | boolean | NOT NULL | `true` | |
| config | jsonb | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |
| modified_at | timestamptz | NOT NULL | `now()` | |

UNIQUE index: `(organization_id, notification_type)`

#### `notification_log`
Records of notifications sent. Append-only.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| notification_rule_id | text | NULL | | FK → notification_rules.id SET NULL |
| connection_id | text | NULL | | FK → connections.id SET NULL |
| space_id | text | NULL | | FK → spaces.id SET NULL |
| notification_type | text | NOT NULL | | |
| channel | text | NOT NULL | | |
| recipient | text | NOT NULL | | |
| subject | text | NULL | | |
| status | text | NOT NULL | `'sent'` | |
| error_message | text | NULL | | |
| sent_at | timestamptz | NOT NULL | `now()` | |

#### `audit_log`
User and system action tracking.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NOT NULL | `gen_random_uuid()` | PK |
| organization_id | text | NOT NULL | | FK → organizations.id CASCADE |
| user_id | text | NULL | | FK → users.id SET NULL |
| action | text | NOT NULL | | |
| entity_type | text | NOT NULL | | |
| entity_id | text | NULL | | |
| metadata | jsonb | NULL | | |
| ip_address | text | NULL | | |
| user_agent | text | NULL | | |
| created_at | timestamptz | NOT NULL | `now()` | |

`action` uses `verb.entity` format: `backup.started`, `space.created`, `connection.revoked`

### Schema B Complete Foreign Key Map

```
Better Auth managed (same as Schema A):
  users.id             ← members.user_id
  users.id             ← team_members.user_id
  users.id             ← invitations.inviter_id
  users.id             ← identities.user_id
  users.id             ← sessions.user_id
  organizations.id     ← members.organization_id
  organizations.id     ← teams.organization_id
  organizations.id     ← invitations.organization_id
  teams.id             ← team_members.team_id
  teams.id             ← invitations.team_id

Baseout application:
  organizations.id     ← organization_profiles.organization_id  (CASCADE)
  organizations.id     ← connections.organization_id             (CASCADE)
  organizations.id     ← spaces.organization_id                  (CASCADE)
  organizations.id     ← subscriptions.organization_id           (CASCADE)
  organizations.id     ← api_tokens.organization_id              (CASCADE)
  organizations.id     ← notification_rules.organization_id      (CASCADE)
  organizations.id     ← notification_log.organization_id        (CASCADE)
  organizations.id     ← audit_log.organization_id               (CASCADE)
  organizations.id     ← storage_destinations.organization_id    (CASCADE)
  connections.id       ← spaces.connection_id                    (SET NULL)
  connections.id       ← notification_log.connection_id          (SET NULL)
  spaces.id            ← backup_schedules.space_id               (CASCADE)
  spaces.id            ← backup_runs.space_id                    (CASCADE)
  spaces.id            ← restore_runs.space_id                   (CASCADE)
  spaces.id            ← schema_snapshots.space_id               (CASCADE)
  spaces.id            ← api_tokens.space_id                     (CASCADE)
  spaces.id            ← notification_log.space_id               (SET NULL)
  backup_schedules.id  ← backup_runs.schedule_id                 (SET NULL)
  backup_runs.id       ← backup_snapshots.backup_run_id          (CASCADE)
  backup_runs.id       ← restore_runs.backup_run_id              (RESTRICT)
  backup_runs.id       ← schema_snapshots.backup_run_id          (SET NULL)
  schema_snapshots.id  ← schema_fields.schema_snapshot_id        (CASCADE)
  storage_destinations.id ← backup_runs.storage_destination_id   (SET NULL)
  storage_destinations.id ← organization_profiles.default_storage_destination_id (SET NULL)
  notification_rules.id   ← notification_log.notification_rule_id (SET NULL)
  users.id             ← restore_runs.initiated_by_user_id       (RESTRICT)
  users.id             ← api_tokens.user_id                      (CASCADE)
  users.id             ← audit_log.user_id                       (SET NULL)
```

---

## Migration Strategy

Schema B is delivered incrementally. Schema A is "deploy through Phase 2 only."

| Phase | Migration | Tables | Depends On |
|-------|-----------|--------|------------|
| 1 | Better Auth bootstrap | 9 auth tables | Nothing — runs via `auth.migrate()` |
| 2 | Core connections | connections | Phase 1 |
| 3 | Spaces + org profiles + storage | spaces, organization_profiles, storage_destinations | Phase 2 |
| 4 | Backup system | backup_schedules, backup_runs, backup_snapshots | Phase 3 |
| 5 | Restore + schema intelligence | restore_runs, schema_snapshots, schema_fields | Phase 4 |
| 6 | Billing + access | subscriptions, api_tokens | Phase 3 |
| 7 | Notifications + audit | notification_rules, notification_log, audit_log | Phase 3 |

---

## Drizzle File Structure

```
src/db/
  index.ts                     -- Drizzle client init, connection pool
  schema/
    index.ts                   -- Re-exports all
    auth.ts                    -- Read-only Better Auth table defs (for joins)
    enums.ts                   -- Shared enum constants
    connections.ts
    spaces.ts
    organization-profiles.ts
    backup-schedules.ts
    backup-runs.ts
    backup-snapshots.ts
    restore-runs.ts
    schema-snapshots.ts
    schema-fields.ts
    storage-destinations.ts
    subscriptions.ts
    api-tokens.ts
    notification-rules.ts
    notification-log.ts
    audit-log.ts
drizzle.config.ts
```

---

## Key Design Decisions

1. **`text` IDs with `gen_random_uuid()`** — Matches Better Auth convention. Avoids type mismatch when joining Baseout tables against auth tables.
2. **`timestamptz` everywhere** — Matches Better Auth. Timezone-aware avoids silent bugs.
3. **`modified_at` vs `updated_at`** — Baseout tables use `modified_at`; Better Auth tables use `updated_at`. Visual signal of table ownership.
4. **Companion `organization_profiles` pattern** — Don't modify Better Auth tables; extend via separate tables joined on `organization_id`.
5. **CHECK constraints over PG ENUM types** — Easier to extend (ALTER TABLE vs ALTER TYPE). Drizzle handles them well.
6. **Partial indexes for worker queues** — `backup_runs` and `restore_runs` have partial indexes on status for active rows.
7. **`_enc` suffix for encrypted columns** — Application-layer AES-256-GCM. Key in env config.
8. **Explicit ON DELETE for every FK** — CASCADE for parent-child, SET NULL for optional refs, RESTRICT for integrity.
9. **Airtable OAuth in `connections`, not `identities`** — Different purpose (data access vs login), scope, and rotation.
