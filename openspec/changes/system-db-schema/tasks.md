## 1. Phase 0 — Setup

- [x] 1.1 `packages/db-schema/` directory exists with `package.json` (name `@baseout/db-schema`, version 0.1.0, `private: true`).
- [x] 1.2 Drizzle ORM (`^0.45.2`) + drizzle-kit (`^0.31.10`) + tsup (`^8.3.0`) declared. Versions aligned with apps/web during the auth-tables tracer-bullet so workspace consumers and the package resolve to the same drizzle-orm instance (mismatched majors caused 732 nominal type errors in the first attempt). See proposal §"Lesson 1" for the policy.
- [x] 1.3 Workspace consumption model wired: package `main`/`types` and `exports.types`/`exports.import`/`exports.default` all point at `./src/index.ts`. Astro/Vite, `@cloudflare/vitest-pool-workers`, and `drizzle-kit` (including the CJS `bin` for `generate` / `migrate`) all read source through pnpm symlinks. See proposal §"Lesson 2" for why the `default` condition is required.
- [x] 1.4 apps/web (the schema's canonical owner) declares `"@baseout/db-schema": "workspace:*"` in its `dependencies` block. See proposal §"Lesson 3" for why this was conspicuously absent before.
- [ ] 1.5 Add a CI guard that fails the build if `packages/db-schema/package.json`'s `drizzle-orm` or `drizzle-kit` ranges drift from `apps/web/package.json`'s. Implementation: a small `scripts/check-drizzle-version-pin.mjs` invoked from the root CI workflow. Captures Lesson 1 as enforceable policy.
- [ ] 1.6 Add a CI guard that fails the build if `packages/db-schema/package.json`'s `exports.` block lacks the `default` condition. Captures Lesson 2 as enforceable policy. May be combined with 1.5 in one script.
- [ ] 1.7 Add a CI guard that asserts every app that imports from `@baseout/db-schema` in its source tree also declares the dep in its `package.json`. Captures Lesson 3 as enforceable policy. Reuses the existing grep-for-imports approach.
- [ ] 1.8 (Deferred indefinitely under workspace model) Set up tsup build pipeline emitting ESM + types to `./dist/`. Only needed if Baseout splits into multiple repos again. The Phase 0 build/publish path described in the original design.md is preserved as fallback documentation, not actionable today.
- [ ] 1.9 (Deferred — depends on Phase 1 completion) Move `drizzle.config.ts` from `apps/web/` to `packages/db-schema/`. Today the canonical config stays in apps/web because the bulk of the schema is still there; drizzle-kit reads through the auth.ts shim to the package. The cutover happens once Phase 1 §§ 2.2–2.12 land and the package owns more tables than apps/web.
- [ ] 1.10 (Deferred indefinitely) Set up publish pipeline (GitHub Packages or private npm) gated on `main` merge. Workspace consumption replaces this. Revisit only on multi-repo split.
- [ ] 1.11 Configure GitHub Actions CI: typecheck + schema-vs-migration verification (`drizzle-kit check`). Build is not needed under the workspace model.

## 2. Phase 1 — Schema Authoring

The auth tables landed individually as a tracer (2.1). The remaining slices should land in larger cohesive batches — interlinked tables (e.g., `connections` ↔ `spaces` ↔ `backup_configurations`) move better together than serially, and each batch produces one drizzle-kit-confirmed "no diff" gate rather than 11 of them.

Each batch is a single commit with the shape: move the schema file(s) → leave shims in `apps/web/src/db/schema/` (and delete the corresponding mirrors in `apps/server/src/db/schema/`, replacing with re-exports from `@baseout/db-schema`) → run typecheck + db:check + vitest + drizzle-kit check + drizzle-kit generate → confirm no migration diff → commit.

- [x] 2.1 Authored schema for `users` (also `sessions`, `accounts`, `verifications` — the Better Auth quartet) in [packages/db-schema/src/schema/auth.ts](../../../packages/db-schema/src/schema/auth.ts). Re-exported from the package barrel. `organizations` and `organization_members` are still in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — they FK into `users.id` from the canonical side, which works fine through the package import; their own move is part of the org-tier batch below.
- [ ] 2.2 **Batch A — Org + access tier**: `organizations`, `organization_members`, `user_preferences`, `api_tokens` (token-hash storage). Smallest cluster after auth; FKs only into `users` and `organizations`. Targets [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) lines for those tables.
- [ ] 2.3 **Batch B — Platforms + connections + spaces**: `platforms`, `connections` (with `_enc` token columns), `space_platforms`, `spaces`. The "every Org/Connection/Space" foundation. Connections carries the AES-encrypted access token + refresh token columns; verify the `_enc` suffix convention end to end on this batch.
- [ ] 2.4 **Batch C — Airtable record-layer**: `at_bases`, `backup_configurations`, `backup_configuration_bases`, `space_events`. The workspace-rediscovery surface added in commit `3eeedfb` lives here. apps/server's mirrors for these tables (currently under [apps/server/src/db/schema/](../../../apps/server/src/db/schema/)) become re-exports from the package.
- [ ] 2.5 **Batch D — Subscriptions**: `subscriptions`, `subscription_items`, `plan_definitions`, `plan_limits`, `plan_credit_config`. Engine reads `subscription_items.tier` during workspace rediscovery; apps/server mirrors `subscriptions` + `subscription_items` today. After this batch, the capability-resolver tier lookup pattern simplifies.
- [ ] 2.6 **Batch E — Backup + restore run state**: `backup_runs`, `backup_run_bases`, `restore_runs`, `cleanup_runs`. apps/server actively reads/writes `backup_runs` and `backup_configuration_bases`; their mirrors become re-exports. Coordinate with any in-flight Phase 3 work on `server-schedule-and-cancel` / `server-workspace-rediscovery` that touches these tables.
- [ ] 2.7 **Batch F — Storage destinations**: `storage_destinations` (with `_enc` token columns), `space_databases` (with `pg_connection_string_enc`), `airtable_webhooks`. Probably arrives alongside the in-flight `server-byos-destinations` and `server-instant-webhook` proposals; coordinate to avoid mirror churn.
- [ ] 2.8 **Batch G — Notifications + credits**: `notification_channels`, `notification_preferences`, `notification_log`, `notifications`, `credit_buckets`, `credit_transactions`, `organization_credit_balance`, `credit_addon_subscriptions`, `organization_billing_settings`, `organization_restore_usage`. Largest batch by table count; lowest engine-side coupling (apps/server doesn't currently mirror any of these).
- [ ] 2.9 **Batch H — Observability + idempotency**: `health_score_rules`, `static_snapshots`, admin audit log table, `stripe_events_processed`.
- [ ] 2.10 After all batches: verify naming conventions (snake_case, text/UUID PKs, `created_at`/`modified_at`, `_enc` suffix) with a test-based check that walks every exported table via Drizzle's `getTableColumns`.
- [ ] 2.11 Cross-check the moved tables against [shared/Baseout_Implementation_Plan.md](../../../shared/Baseout_Implementation_Plan.md) §"Master DB tables" for any tables missed. If `../shared/Master_DB_Schema.md` referenced by the original task list exists, also cross-check there.
- [ ] 2.12 Once the bulk of Phase 1 lands, delete the now-redundant `apps/web/src/db/schema/auth.ts` + `core.ts` shims and update `apps/web/drizzle.config.ts` to point at the package source paths directly (or relocate the config to the package per task 1.9).

## 3. Phase 2 — Migration ownership cutover

Migrations stay in `apps/web/drizzle/` until enough of the schema has relocated to make a single owning `drizzle/` directory under the package the cheapest move. This phase is the cutover.

- [ ] 3.1 Trigger condition: Phase 1 §§ 2.2 → 2.9 are all ticked. Until then, every new migration continues to live in `apps/web/drizzle/`.
- [ ] 3.2 Relocate `apps/web/drizzle/` → `packages/db-schema/drizzle/`. Update `apps/web/drizzle.config.ts` `out` path (or move the config wholesale per task 1.9).
- [ ] 3.3 Apply migrations to a fresh staging master DB via `drizzle-kit migrate`; verify queries from apps/web + apps/server still resolve.
- [ ] 3.4 Update [apps/web/scripts/migrate.mjs](../../../apps/web/scripts/migrate.mjs) + [apps/web/scripts/check-migrations.mjs](../../../apps/web/scripts/check-migrations.mjs) to point at the package's drizzle/ directory (or move the scripts into the package).

## 4. Phase 3 — CI guards

- [ ] 4.1 Implement CI step: assert `drizzle-kit check` is clean (schema and migrations are in sync). Currently a manual gate; this turns it into a hard CI failure.
- [ ] 4.2 Implement CI step: `pnpm -r typecheck` continues to pass after every schema change. Already enforced via the workspace's existing CI; flag here to confirm coverage extends to the package.
- [ ] 4.3 Document the migration runbook in [packages/db-schema/README.md](../../../packages/db-schema/README.md): how to add a column, regenerate, apply to dev, apply to staging, apply to production.
- [ ] 4.4 Implement the production migration approval gate (manual step on the `main` deploy pipeline before any `drizzle-kit migrate` runs against production). This replaces the publish-pipeline gate from the original design.

## 5. Phase 4 — Slim placeholder workspace:* deps from non-consuming apps

Five apps (`admin`, `api`, `hooks`, `sql`, `workflows`) declare `"@baseout/db-schema": "workspace:*"` as forward-declarations from the May 2026 monorepo scaffold but don't yet import from the package. The dep adds dependency-graph noise (every `pnpm install` and CI typecheck resolves an unused symlink) for zero functional value today. Removing them sharpens the rule from Lesson 3: "any app that imports from the package MUST declare the dep." Apps re-add the dep the moment they need it; nobody re-edits five package.json files just to set up the placeholder.

- [ ] 5.1 Remove `"@baseout/db-schema": "workspace:*"` from `apps/admin/package.json`.
- [ ] 5.2 Remove `"@baseout/db-schema": "workspace:*"` from `apps/api/package.json`.
- [ ] 5.3 Remove `"@baseout/db-schema": "workspace:*"` from `apps/hooks/package.json`.
- [ ] 5.4 Remove `"@baseout/db-schema": "workspace:*"` from `apps/sql/package.json`.
- [ ] 5.5 Remove `"@baseout/db-schema": "workspace:*"` from `apps/workflows/package.json`. (Per [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md): the Trigger.dev tasks read/write via engine-callback POSTs, not direct DB. They don't need schema awareness.)
- [ ] 5.6 Keep `"@baseout/db-schema": "workspace:*"` on `apps/server/package.json` — apps/server mirrors schema today (and will import from the package as Phase 1 Batches B–E land).
- [ ] 5.7 Keep `"@baseout/db-schema": "workspace:*"` on `apps/web/package.json` — added in commit `590015a` when the auth shim started importing.
- [ ] 5.8 Run `pnpm install` to refresh the workspace; verify `pnpm -r typecheck` still passes.
- [ ] 5.9 Stage the five package.json files by name + a single commit.

## 6. Definition of Done — `packages/db-schema/` V1 Launch (workspace edition)

- [ ] 6.1 All master DB tables defined in Drizzle source under `packages/db-schema/src/schema/`.
- [ ] 6.2 Migrations owned by the package (Phase 2 cutover complete).
- [ ] 6.3 Naming conventions enforced via a test-based check (Phase 1 §2.10).
- [ ] 6.4 Production migration approval gate enforced in the deploy pipeline (Phase 3 §4.4).
- [ ] 6.5 CI guards from Phase 0 §§1.5–1.7 (version pin, exports conditions, declared-dep audit) green.
- [ ] 6.6 `drizzle-kit check` clean in CI.
- [ ] 6.7 Migration runbook documented in the package README.
- [ ] 6.8 Apps that import from the package declare the workspace dep; apps that don't have it removed (Phase 4 slim half).
