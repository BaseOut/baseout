# DigitalOcean PostgreSQL Cluster Overview

> **Cluster:** openside-db-do-user-115703-0.d.db.ondigitalocean.com:25060  
> **Pulled:** 2026-04-16

## All Databases

| Database | Tables | Status | Schema File | Notes |
|----------|--------|--------|-------------|-------|
| **starter** | 9 | Has data | [schema-starter.md](schema-starter.md) | Better Auth + org/team management. Most complete schema. |
| **osai** | 5 (3 real) | Has data | [schema-osai.md](schema-osai.md) | Drizzle ORM, accounts/users/projects. Has tmp/test tables. |
| **baseout-dev** | 0 | Empty | -- | Target database for this project. No tables yet. |
| **boa** | 0 | Empty | -- | Only plpgsql extension. |
| **defaultdb** | 0 | Empty | -- | DigitalOcean default. Only plpgsql. |
| **okb-dev** | 0 | Empty | -- | Has `pgvector` 0.8.1 extension (vector similarity search). |

## Comparison: `starter` vs `osai`

| Feature | starter | osai |
|---------|---------|------|
| **ORM** | Unknown (likely Better Auth auto-generated) | Drizzle |
| **ID type** | text (uuid string) | uuid (native) |
| **Timestamps** | timestamptz (timezone-aware) | timestamp (no timezone) |
| **Auth** | Full auth system (sessions, identities, verifications) | Basic (password_hash on users) |
| **Multi-tenancy** | Organizations + Teams + Members + Invitations | Accounts only |
| **OAuth support** | Yes (identities table with tokens) | No |
| **Invitation system** | Yes (with status, roles, expiry) | No |
| **Session management** | Yes (token, ip, user_agent, org/team context) | No |
| **Total real tables** | 9 | 3 |

## Recommendation

**`starter`** is the more complete schema for a SaaS application — it has full authentication (Better Auth pattern), multi-tenant organization/team management, invitation flows, and session handling. This aligns well with the `baseout-starter` project structure.

**`osai`** is a simpler accounts/users/projects schema that could serve as a starting point but would need significant additions for auth, sessions, and org management.
