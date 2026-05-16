## Why

`@baseout/db-schema` is intended to be the canonical Drizzle schema for the master DB — the package every Baseout runtime app (`apps/web`, `apps/server`, `apps/admin`, `apps/api`, `apps/sql`, `apps/hooks`, `apps/workflows`) consumes by `import`. It would own the migration workflow, the conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix for AES-256-GCM-encrypted columns), and the published-version contract that downstream apps pin against.

**Current reality (2026-05):** the package exists as scaffolding only ([`packages/db-schema/src/index.ts`](../../../packages/db-schema/src/index.ts) is a single `export {}` with documentation comments). The actual schema lives in two places:

1. **`apps/web/src/db/schema/`** — canonical. Drizzle source + migrations under `apps/web/drizzle/`. apps/web owns generation, application, and the master DB lifecycle.
2. **`apps/server/src/db/schema/`** — read/write **mirror** of the subset apps/server needs. Each mirror file carries a header comment naming the canonical apps/web migration. Today this includes `connections`, `spaces`, `at_bases`, `platforms`, `backup_runs`, `backup_configurations`, `backup_configuration_bases`, and grows as the server reads/writes more tables.

The mirror approach was a deliberate stopgap so apps/server could start without waiting on the extraction. It carries an ongoing tax: every schema migration in apps/web requires a paired mirror update in apps/server, with no compile-time safety net catching drift. As more tables migrate (forthcoming: `attachments`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `restore_runs`, `backup_retention_policies`, `audit_history`, `space_databases`, `cleanup_runs`, ...), the drift surface compounds.

This change is the extraction: turn `packages/db-schema/` into the real canonical source, drop the apps/server mirror layer, and shift migration ownership from apps/web's tight coupling to a versioned package consumed by every app.

## What Changes

- Promote `packages/db-schema/src/` to hold the actual Drizzle schema. Migrate definitions from `apps/web/src/db/schema/` into the package, file-by-file (one per domain — `organizations.ts`, `spaces.ts`, `connections.ts`, `backups.ts`, `restores.ts`, `attachments.ts`, `quota.ts`, ...).
- Move the `drizzle/` migrations folder from `apps/web/drizzle/` to `packages/db-schema/drizzle/`. `drizzle-kit generate` and `drizzle-kit migrate` run against the package.
- Replace `apps/server/src/db/schema/*` mirror files with type-only imports from `@baseout/db-schema` plus a thin per-app barrel that re-exports the tables the engine touches.
- Update `apps/web/src/db/schema/` to do the same — re-export from `@baseout/db-schema`. apps/web keeps its DB client construction but stops owning the schema files.
- Apply naming conventions consistently (snake_case tables/columns, UUID PKs, `created_at`/`modified_at`, `_enc` suffix for AES-256-GCM-encrypted columns).
- Production migrations gain a manual approval step on `main` merge (script runs migrations against staging on PR, against production on tagged release with manual approval — the workflow exists in apps/web today; this change moves the workflow to the package).
- `@baseout/db-schema` stays a `workspace:*` dependency across the monorepo. No external publishing; the workspace symlink is the version contract.

## Capabilities

### New Capabilities

- `master-db-schema`: Drizzle schema definition for the master DB owned by `packages/db-schema/`. Conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix). `drizzle-kit` migration workflow with manual production approval. Single source of truth consumed by every runtime app via `workspace:*` linkage.

### Modified Capabilities

- The `backup-engine`, `restore-engine`, `airtable-webhook-coalescing`, `backup-credit-consumption`, `dead-connection-cadence`, and `direct-sql-access` capabilities currently call out engine-side schema mirroring; after this change lands, those capabilities stop carrying mirror-maintenance obligations.

## Status note (2026-05)

This change is **not started**. The extraction is recommended by `specreview/03-reconciliation.md` §4 ("extract now") and the case has only gotten stronger as the mirror count has grown. Two reasons to wait:

1. **In-flight backup MVP**: the data plane is mid-buildout. A schema-package extraction touching every mirror file at once would conflict with feature branches.
2. **No pressing pain**: the 7-table mirror set today is annoying but tractable. The pain becomes acute once attachments, restore_runs, and the credit ledger land — all in flight.

**Recommendation**: schedule this change immediately after the next batch-ship to `main` and before the attachments + restore + credits changes land. That's the cheapest extraction point: minimal in-flight branch conflicts, biggest payoff before the mirror count doubles.

## Impact

- **`packages/db-schema/`** — populated with real Drizzle source files.
- **`apps/web/`** — `src/db/schema/*` files become re-export shims pointing at `@baseout/db-schema`. `drizzle/` migrations folder moves to the package. `drizzle.config.ts` updates.
- **`apps/server/`** — `src/db/schema/*` mirror files deleted, replaced with re-export shims (or direct imports at call sites — TBD during implementation).
- **`apps/admin/`, `apps/api/`, `apps/sql/`, `apps/hooks/`, `apps/workflows/`** — each picks up a `workspace:*` dep on `@baseout/db-schema` if/when it needs schema awareness. `apps/workflows` does NOT need it today (the Trigger.dev tasks read/write via engine-callback POSTs, not direct DB).
- **External dependencies**: Drizzle ORM, drizzle-kit, PostgreSQL (target).
- **Cross-app contracts**: schema migrations become a single change against the package; consumers get atomic updates.
- **Operational**: migration runbook (test in staging; require manual approval for prod) moves to the package's repository entry. Existing apps/web migration GitHub Action moves to a package-level action.

## Out of Scope

- **External npm registry publishing**. The workspace symlink is the version contract for now. Revisit only if Baseout splits into multiple repositories.
- **Cross-version pinning between apps**. All apps in the monorepo pin via `workspace:*` and use the same version at any commit. Multi-version coexistence (one app on schema v3, another on v4) is not a goal — it would defeat the purpose of the extraction.
