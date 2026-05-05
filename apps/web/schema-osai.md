# Database Schema: `osai`

> **Cluster:** openside-db-do-user-115703-0.d.db.ondigitalocean.com  
> **Database:** osai  
> **Schema:** osai (+ drizzle migrations)  
> **Extensions:** plpgsql 1.0  
> **Pulled:** 2026-04-16

## Summary

5 tables (3 meaningful + 2 scaffolding). Uses Drizzle ORM for migrations. Uses `uuid` IDs with `gen_random_uuid()`. Timestamps are `timestamp without time zone`.

| Table | Rows (columns) | Description |
|-------|----------------|-------------|
| accounts | 4 cols | Tenant/org accounts |
| users | 8 cols | User accounts scoped to an account |
| projects | 5 cols | Projects scoped to an account |
| tmp | 1 col | Temporary/test table |
| newtable | 1 col | Empty scaffold table |

---

## Tables

### `osai.accounts`

Tenant/organization accounts.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | `gen_random_uuid()` | PK |
| name | text | NO | | |
| created_at | timestamp | NO | `now()` | |
| updated_at | timestamp | NO | `now()` | |

---

### `osai.users`

Users scoped to an account.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | `gen_random_uuid()` | PK |
| account_id | uuid | NO | | FK -> accounts.id |
| email | text | NO | | UNIQUE |
| name | text | NO | | |
| password_hash | text | NO | | |
| is_active | boolean | NO | `true` | |
| created_at | timestamp | NO | `now()` | |
| updated_at | timestamp | NO | `now()` | |

---

### `osai.projects`

Projects scoped to an account.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | `gen_random_uuid()` | PK |
| account_id | uuid | NO | | FK -> accounts.id |
| name | text | NO | | |
| created_at | timestamp | NO | `now()` | |
| updated_at | timestamp | NO | `now()` | |

---

### `osai.tmp`

Temporary/test table.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | `gen_random_uuid()` | PK |

---

### `osai.newtable`

Empty scaffold table.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| column1 | character varying | YES | | |

---

### `drizzle.__drizzle_migrations`

Drizzle ORM migration tracking.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | integer | NO | `nextval(...)` | PK |
| hash | text | NO | | |
| created_at | bigint | YES | | |

---

## Relationships

```
accounts
  |-- users.account_id
  |-- projects.account_id
```

## Indexes

| Table | Index | Definition |
|-------|-------|------------|
| accounts | accounts_pkey | UNIQUE btree (id) |
| projects | projects_pkey | UNIQUE btree (id) |
| tmp | tmp_pkey | UNIQUE btree (id) |
| users | users_email_unique | UNIQUE btree (email) |
| users | users_pkey | UNIQUE btree (id) |
| __drizzle_migrations | __drizzle_migrations_pkey | UNIQUE btree (id) |
