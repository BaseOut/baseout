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

## Status note (updated 2026-05-18)

**Started.** First tracer slice landed in commit `590015a` on 2026-05-18 — the Better Auth quartet (`users`, `sessions`, `accounts`, `verifications`) plus the shared `baseout` pgSchema declaration moved from `apps/web/src/db/schema/auth.ts` into `packages/db-schema/src/schema/auth.ts`. apps/web's `auth.ts` is now a re-export shim so every existing consumer (`core.ts`, the barrel, `profile.astro`, the last-verification test route, `drizzle.config.ts`) keeps its import path unchanged.

The tracer validated the workspace consumption model end-to-end (typecheck, vitest, db:check, drizzle-kit check, drizzle-kit generate). Remaining Phase 1 work (organizations, connections, spaces, subscriptions, backups, restores, storage, attachments, credits, notifications, audit log, idempotency) is the bulk of the lift and is best done in one or two cohesive slices rather than 11 small ones.

## Lessons from the auth-tables tracer (2026-05-18)

Three surprises caught us mid-extraction. Each is now documented policy so the next slice avoids them.

### 1. Pin drizzle-orm + drizzle-kit to apps/web's versions, not independent ranges

The package originally declared `drizzle-orm: ^0.36.0`; apps/web declared `^0.45.2`. pnpm dutifully resolved two separate copies, and TypeScript saw two nominally distinct `PgColumn<...>` type universes for the same table shapes. Result: 732 phantom type errors in apps/web, all on `db.insert(...).values({ ... })` and similar shapes. Bumping the package to match apps/web (`0.45.2` / `0.31.10`) eliminated them.

**Policy**: `packages/db-schema/package.json` MUST pin drizzle-orm and drizzle-kit to the same exact ranges apps/web declares. When apps/web bumps, the package bumps in the same commit. The dep ranges in apps/web's `dependencies` block are the source of truth.

### 2. The `exports` field needs a `default` condition for drizzle-kit's CJS bin

A package pointing `main`/`types`/`exports.types`/`exports.import` at `./src/index.ts` works for Astro/Vite, vitest-pool-workers, and `drizzle-kit check`. But `drizzle-kit generate` and `drizzle-kit migrate` shell into a CJS `bin.cjs` script that asks Node's resolver for `require`/`default` conditions — neither of which was present — and fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Policy**: the `exports.` block MUST declare `types`, `import`, AND `default` (in that order; `default` is the CJS fallback). All three point at `./src/index.ts` while we're on the workspace-source-import model. If we ever flip to dist-based publication, `default` becomes the `require` entry pointing at `./dist/index.cjs` and `import` points at `./dist/index.js`.

### 3. The owner of the schema needs an explicit workspace dep too

`packages/db-schema/` was scaffolded in May with six apps (admin, api, hooks, server, sql, workflows) declaring `"@baseout/db-schema": "workspace:*"` as forward-declarations. apps/web was deliberately omitted because *it owned the schema*. The moment the auth-tables shim tried to import from `@baseout/db-schema`, the resolver failed: apps/web's package.json didn't list the dep, so pnpm hadn't symlinked it into `apps/web/node_modules/@baseout/`.

**Policy**: any app whose source imports from `@baseout/db-schema` MUST declare `"@baseout/db-schema": "workspace:*"` in its `dependencies` block. apps/web now does. The remaining five forward-declarations are addressed in the slim-half phase below.

## Workspace consumption model (replaces the original "Internal npm package" plan)

The original design assumed each runtime repo would consume a published npm version. The monorepo split changed that. Today:

- The package is consumed via `workspace:*` symlinks. No external publishing.
- The package's `main`/`types`/`exports` point at `./src/index.ts`. No build step required for workspace use.
- Astro/Vite, `@cloudflare/vitest-pool-workers`, and drizzle-kit all read source through the symlink. Each toolchain handles TypeScript natively.
- Migrations stay in the consumer side (`apps/web/drizzle/`) until enough of the schema has relocated to make a single owning `drizzle/` directory under the package the cheapest move. That cutover is its own task; it's not implicit in any single Phase 1 slice.

If Baseout ever splits into multiple repos again, flip the package.json `main`/`types`/`exports` back to `./dist/*`, add the tsup build to CI, and stand the publish pipeline back up. The Phase 0 "build pipeline" and "publish pipeline" tasks describe that path; they're intentionally not blocking the workspace-only adoption.

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
