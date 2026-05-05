## Context

`packages/db-schema/` is the single source of truth for the master DB schema. It's a small, deliberately minimal package — Drizzle schema files, generated migrations, and a publishing pipeline. Every runtime repo (`baseout-web`, `baseout-backup`, `baseout-admin`, `baseout-inbound-api`, `baseout-sql-rest-api`, `baseout-webhook-ingestion`) consumes it as `@baseout/db-schema` at a pinned version. Schema changes are coordinated events: a schema change typically requires runtime-repo updates, deployed in order.

Stakeholders: every runtime-repo team (consumers of types and migrations), DBA / on-call (production migration approver), product (schema changes often follow product changes).

Constraints carried in from product:
- **Single source of truth** — no runtime repo redefines tables.
- **Naming conventions** — snake_case tables/columns, UUID PKs, `created_at`/`modified_at` timestamps, `_enc` suffix for AES-256-GCM-encrypted columns.
- **Manual production migration approval** — never auto-apply schema changes to production.

## Goals / Non-Goals

**Goals:**
- One package, one schema, one published version timeline.
- Schema changes generate SQL migrations automatically via `drizzle-kit generate`.
- Runtime repos can pin to a known-good version and upgrade deliberately.
- Production migrations cannot run without explicit human approval.
- Type safety: every consumer gets full TypeScript types for the schema.

**Non-Goals:**
- Client DB schema (per-Space client DBs are managed by `baseout-backup` at runtime via dynamic schema-evolving DDL — out of scope for this package).
- Drizzle query helpers or repository layer (consumers each manage their own).
- Seed data (handled per-runtime repo).
- Connection pool configuration (each runtime repo brings its own connection).

## Decisions

### Internal npm package
Publish via private npm registry or GitHub Packages. Each runtime repo lists it as a dependency at a specific version. Resolved (F2 from earlier baseout-front design).

### Schema source in TypeScript Drizzle
Schema lives in `src/schema/*.ts` files, organized by domain (e.g., `organizations.ts`, `connections.ts`, `backups.ts`, `credits.ts`, etc.). Migrations are generated SQL, committed to `migrations/`. Consumers import named tables (e.g., `import { organizations } from '@baseout/db-schema'`).

### `drizzle-kit generate` for migrations
The package owns migration generation. PRs that change schema must include the generated SQL. CI verifies that schema source matches generated SQL.

### Manual production migration approval
Production migration application requires a human approval step on the `main` deploy pipeline. Staging migrations apply automatically on merge. Reason: schema changes have higher blast radius than code changes; deliberate gating prevents accidents.

### Semver
- Patch: bug fixes (e.g., correcting a column type that was wrong)
- Minor: additive (new columns, new tables, new indexes)
- Major: breaking (column rename, column drop, table rename, table drop)
Major bumps require coordinated runtime-repo updates; document each major in CHANGELOG.

### Encryption convention
Columns storing AES-256-GCM ciphertext use the `_enc` suffix. The package defines the column as `text` (or `bytea`) with a runtime helper for encrypt/decrypt; consumers handle encryption/decryption at write/read time using the master encryption key from their Cloudflare Secrets.

## Risks / Trade-offs

- **[Risk] Schema change without coordinated runtime upgrade** → A consumer pinned to v1.5 keeps working when the schema is bumped to v1.6 (additive); breaking changes require coordinated upgrade. CI in each runtime repo runs against the pinned version + the latest minor to catch incompatibilities early.
- **[Risk] Published version diverges from production schema** → Production migration approval ensures the deployed schema matches the version on `main`; staging always tracks `main`.
- **[Trade-off] Internal npm package vs. monorepo path import** → Internal npm chosen for clean version pinning; monorepo path import would couple all repos' versions. Resolved (F2).
- **[Trade-off] Drizzle-kit limitations** → Drizzle-kit doesn't support every PG feature (e.g., complex constraints, certain index types) automatically; complex schema changes may require hand-written migrations. Accept; document in runbook.

## Migration Plan

### Build sequence

1. **Phase 0 — Setup**: `packages/db-schema/` directory, `package.json`, `drizzle.config.ts`, build pipeline, publish pipeline.
2. **Phase 1 — Schema authoring**: write schema source for every table in `../shared/Master_DB_Schema.md` organized by domain.
3. **Phase 2 — Initial migration**: `drizzle-kit generate` produces the initial SQL migration; commit.
4. **Phase 3 — CI + publish**: CI runs schema/migration verification; on merge to `main`, publish a new version to the internal registry.
5. **Phase 4 — Runtime-repo consumption**: each runtime repo lists `@baseout/db-schema@^1.0.0` (or specific pin) and runs schema sync in CI to ensure consumed types match deployed schema.

### Migration runbook
- Schema PR includes both schema source change AND generated migration SQL.
- CI verifies migration SQL is up to date.
- Merge to `main` → staging migrates automatically → manual approval gate → production migrates.
- Runtime repos upgrade `@baseout/db-schema` version on their own cadence (additive changes are safe; breaking changes require coordination).

### Rollback strategy
- Drizzle revert: each migration has a corresponding revert SQL committed alongside.
- Production rollback: revert the migration in master DB; consumers stay on prior schema version until coordinated upgrade.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| S1 | Registry: private npm vs. GitHub Packages | GitHub Packages (lowest setup cost). Confirm before launch. |
| S2 | Encryption helper location | Inside `@baseout/db-schema` as a small utility module, OR as a separate `@baseout/encryption` package shared with consumers. Decide pre-launch. |
| S3 | Hand-written migration policy | Drizzle-kit primary; hand-written allowed for complex constraint migrations with code review. |
