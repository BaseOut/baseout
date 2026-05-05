## Why

`@baseout/db-schema` is the canonical Drizzle schema for the master DB and the package every Baseout runtime repo (`baseout-web`, `baseout-backup`, `baseout-admin`, `baseout-inbound-api`, `baseout-sql-rest-api`, `baseout-webhook-ingestion`) consumes. It owns the migration workflow, the conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix for encrypted columns), and the published-version contract that downstream repos pin against. It has its own version cadence — schema changes are deliberate coordination events across all six runtime repos. None of it exists yet. This change establishes `packages/db-schema/` as a first-class package with its own OpenSpec coverage so the contract between schema and consumers is explicit.

## What Changes

- Establish `packages/db-schema/` as a standalone npm package at `packages/db-schema/`, published as `@baseout/db-schema` for runtime repos to consume at pinned versions.
- Define the master DB schema in TypeScript Drizzle source files covering every table called out in `../shared/Master_DB_Schema.md`.
- Apply naming conventions (snake_case tables/columns, UUID PKs, `created_at`/`modified_at`, `_enc` suffix for AES-256-GCM-encrypted columns).
- Generate SQL migrations via `drizzle-kit generate`, commit them alongside schema changes, and apply via `drizzle-kit migrate`.
- Production migrations require a manual approval step on `main` merge.
- Publish `@baseout/db-schema` semantically versioned; each runtime repo pins to a specific minor version.

## Capabilities

### New Capabilities

- `master-db-schema`: Drizzle schema definition for the master DB with all tables, conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix), `drizzle-kit` migration workflow with manual production approval, and `@baseout/db-schema` package publishing for the six runtime repos to consume at pinned versions.

### Modified Capabilities

None — this is the initial `packages/db-schema/` setup.

## Impact

- **New package**: `packages/db-schema/` — internal npm package consumed by all runtime repos.
- **External dependencies**: Drizzle ORM, drizzle-kit, PostgreSQL (target), tsup or equivalent build tool.
- **Cross-repo contracts**: every runtime repo pins `@baseout/db-schema` at a specific version; schema migrations are coordinated upgrade events.
- **Migration workflow**:
  - Developer changes schema source → `drizzle-kit generate` produces SQL → committed in same PR
  - PR review → merge to main → CI publishes new package version → runtime repos can opt-in to upgrade
  - Production migration: manual approval step on `main` merge; not auto-applied
- **Operational**: package publish pipeline (private npm registry or GitHub Packages); migration runbook (test in staging; require manual approval for prod).
