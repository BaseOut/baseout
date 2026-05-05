# Database Schema: `starter`

> **Cluster:** openside-db-do-user-115703-0.d.db.ondigitalocean.com  
> **Database:** starter  
> **Schema:** public  
> **Extensions:** plpgsql 1.0  
> **Pulled:** 2026-04-16

## Summary

9 tables covering auth, organizations, teams, and invitations. This looks like a **Better Auth + organization/team management** schema. Uses `text` IDs with `gen_random_uuid()` defaults. All timestamps are `timestamptz`.

| Table | Rows (columns) | Description |
|-------|----------------|-------------|
| users | 8 cols | Core user accounts |
| organizations | 6 cols | Multi-tenant organizations |
| members | 5 cols | User-to-organization membership with roles |
| teams | 5 cols | Teams within organizations |
| team_members | 4 cols | User-to-team membership |
| invitations | 9 cols | Org/team invitations with status & expiry |
| identities | 13 cols | OAuth/credential identity providers |
| sessions | 10 cols | Active user sessions |
| verifications | 6 cols | Email/phone verification tokens |

---

## Tables

### `users`

Core user accounts.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| name | text | NO | | |
| email | text | NO | | UNIQUE |
| email_verified | boolean | NO | | |
| image | text | YES | | |
| is_anonymous | boolean | NO | | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

---

### `organizations`

Multi-tenant organizations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| name | text | NO | | |
| slug | text | NO | | UNIQUE |
| logo | text | YES | | |
| metadata | text | YES | | |
| created_at | timestamptz | NO | `now()` | |

---

### `members`

User-to-organization membership with roles.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| user_id | text | NO | | FK -> users.id |
| organization_id | text | NO | | FK -> organizations.id |
| role | text | NO | | |
| created_at | timestamptz | NO | `now()` | |

---

### `teams`

Teams within organizations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| name | text | NO | | |
| organization_id | text | NO | | FK -> organizations.id |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

---

### `team_members`

User-to-team membership.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| team_id | text | NO | | FK -> teams.id |
| user_id | text | NO | | FK -> users.id |
| created_at | timestamptz | NO | `now()` | |

---

### `invitations`

Organization and team invitations with status tracking.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| email | text | NO | | |
| inviter_id | text | NO | | FK -> users.id |
| organization_id | text | NO | | FK -> organizations.id |
| role | text | NO | | |
| status | text | NO | | |
| team_id | text | YES | | FK -> teams.id |
| expires_at | timestamptz | NO | | |
| created_at | timestamptz | NO | `now()` | |

---

### `identities`

OAuth and credential identity providers linked to users.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| account_id | text | NO | | |
| provider_id | text | NO | | |
| user_id | text | NO | | FK -> users.id |
| access_token | text | YES | | |
| refresh_token | text | YES | | |
| id_token | text | YES | | |
| access_token_expires_at | timestamptz | YES | | |
| refresh_token_expires_at | timestamptz | YES | | |
| scope | text | YES | | |
| password | text | YES | | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

---

### `sessions`

Active user sessions with org/team context.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| expires_at | timestamptz | NO | | |
| token | text | NO | | UNIQUE |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |
| ip_address | text | YES | | |
| user_agent | text | YES | | |
| user_id | text | NO | | FK -> users.id |
| active_organization_id | text | YES | | |
| active_team_id | text | YES | | |

---

### `verifications`

Email/phone verification tokens.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | text | NO | `gen_random_uuid()` | PK |
| identifier | text | NO | | |
| value | text | NO | | |
| expires_at | timestamptz | NO | | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

---

## Relationships

```
users
  |-- members.user_id
  |-- team_members.user_id
  |-- invitations.inviter_id
  |-- identities.user_id
  |-- sessions.user_id

organizations
  |-- members.organization_id
  |-- teams.organization_id
  |-- invitations.organization_id

teams
  |-- team_members.team_id
  |-- invitations.team_id
```

## Indexes

| Table | Index | Definition |
|-------|-------|------------|
| identities | identities_pkey | UNIQUE btree (id) |
| invitations | invitation_pkey | UNIQUE btree (id) |
| members | member_pkey | UNIQUE btree (id) |
| organizations | organization_pkey | UNIQUE btree (id) |
| organizations | organization_slug_unique | UNIQUE btree (slug) |
| sessions | sessions_pkey | UNIQUE btree (id) |
| sessions | sessions_token_unique | UNIQUE btree (token) |
| team_members | team_member_pkey | UNIQUE btree (id) |
| teams | team_pkey | UNIQUE btree (id) |
| users | users_email_unique | UNIQUE btree (email) |
| users | users_pkey | UNIQUE btree (id) |
| verifications | verifications_pkey | UNIQUE btree (id) |
