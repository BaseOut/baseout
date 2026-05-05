# @opensided/openside-identity-schema

Drizzle schema and shared types for the **Openside-wide staff identity backplane**. Consumed by every Openside admin/ops surface — `baseout-admin`, `baseout-backup-engine`, future `osai-admin`, etc.

This package is the single source of truth for:

- The four BetterAuth tables that back staff sign-in (`users`, `sessions`, `accounts`, `verifications`).
- The RBAC grant table (`role_grants`) that scopes a staff identity to a `(role, product, environment)` tuple.
- The `audit_log` table that every staff-side action writes to.
- The `StaffRole`, `OpensideProduct`, `Environment` type unions used by every authorization helper.

## RBAC model in one paragraph

A staff identity (`staff_users` row) is one record per human, ever. Access is expressed as zero-or-more **grants** in `staff_role_grants`. A grant is the tuple `(user_id, role, product, environment, expires_at?)`. Wildcards: `product='*'` matches every Openside product, `environment='*'` matches every env. Authorization is *"find any non-expired grant where `product` matches the current product and `environment` matches the current env, and resolve the role."* Super-admin = `(role='super', product='*', environment='*')`.

## Why this lives in `vendor/@opensided/` (for now)

Same reason as `@opensided/theme` (see [feedback memory](../theme/README.md) — Cloudflare Workers Builds can't authenticate the private GitHub Packages registry). Each consumer repo vendors its own copy under `vendor/@opensided/openside-identity-schema/` and references it via `"@opensided/openside-identity-schema": "file:./vendor/@opensided/openside-identity-schema"` in its `package.json`. Updates are manual: bump here, copy into each consumer, bump consumer's lockfile.

When a second Openside product (e.g. OSAI) starts consuming this, that's the trigger to extract this folder into its own `Opensided/openside-identity-schema` repo and publish to a private npm registry that all consumers can auth against in CI. **Not yet.**

## Files

```
src/
├── index.ts        — package entry (re-exports schema + types)
├── schema.ts       — Drizzle table definitions (openside_identity schema)
└── types.ts        — StaffRole, OpensideProduct, Environment, allowlist constants
drizzle.config.ts   — drizzle-kit config; reads OPENSIDE_IDENTITY_URL
migrations/         — drizzle-kit generated SQL (committed; one per schema change)
```

## Generating migrations

After any change to `src/schema.ts`:

```sh
cd vendor/@opensided/openside-identity-schema
npm install                                   # first time only
OPENSIDE_IDENTITY_URL=postgres://placeholder npx drizzle-kit generate
```

The generated SQL is committed to `migrations/`. Consumers run them via:

```sh
# in baseout-admin or baseout-backup-engine
OPENSIDE_IDENTITY_URL=<env-specific-url> npx drizzle-kit migrate
```

(See each consumer's `scripts/migrate-identity.mjs` wrapper.)

## Versioning

- Patch: docs, type tweaks that don't change SQL.
- Minor: additive schema change (new column, new table, new index). Migration generated.
- Major: destructive schema change (drop column, rename table). Coordinate with all consumers; backfill plan goes in the PR.

## Used by

- [baseout-admin](../../../../../baseout-admin) — primary consumer, hosts the staff sign-in surface.
- [baseout-backup-engine](../../../../../baseout-backup-engine) — uses for `/ops` dashboard staff auth.
- (future) `osai-admin`, `osai-backup-engine`, etc.
