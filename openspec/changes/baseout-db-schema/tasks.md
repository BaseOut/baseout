## 1. Phase 0 — Setup

- [ ] 1.1 Create `packages/db-schema/` directory with `package.json` (name `@baseout/db-schema`, version 0.1.0)
- [ ] 1.2 Add Drizzle ORM + drizzle-kit + tsup as dependencies
- [ ] 1.3 Add `drizzle.config.ts` pointing at master DB connection (env-based)
- [ ] 1.4 Set up build pipeline (`tsup` to emit ESM + types)
- [ ] 1.5 Set up publish pipeline (GitHub Packages or private npm) gated on `main` merge
- [ ] 1.6 Configure GitHub Actions CI: typecheck, build, schema-vs-migration verification

## 2. Phase 1 — Schema Authoring

- [ ] 2.1 Author schema for `organizations`, `organization_members`, `users`
- [ ] 2.2 Author schema for `connections` (with `_enc` token columns)
- [ ] 2.3 Author schema for `spaces`, `bases`, `backup_configurations`
- [ ] 2.4 Author schema for `subscriptions`, `subscription_items`, `plan_definitions`, `plan_limits`, `plan_credit_config`
- [ ] 2.5 Author schema for `backup_runs`, `backup_run_bases`, `restore_runs`, `cleanup_runs`
- [ ] 2.6 Author schema for `space_databases` (with `pg_connection_string_enc`), `airtable_webhooks`
- [ ] 2.7 Author schema for `storage_destinations` (with `_enc` token columns)
- [ ] 2.8 Author schema for `api_tokens` (token hash storage)
- [ ] 2.9 Author schema for `notification_channels`, `notification_preferences`, `notification_log`, `notifications`
- [ ] 2.10 Author schema for `credit_buckets`, `credit_transactions`, `organization_credit_balance`, `credit_addon_subscriptions`, `organization_billing_settings`, `organization_restore_usage`
- [ ] 2.11 Author schema for `health_score_rules`, `static_snapshots`, admin audit log table
- [ ] 2.12 Author schema for `stripe_events_processed` (idempotency table)
- [ ] 2.13 Verify all tables follow naming conventions (snake_case, UUID PKs, `created_at`/`modified_at`, `_enc` suffix)
- [ ] 2.14 Cross-check against `../shared/Master_DB_Schema.md` for any tables missed

## 3. Phase 2 — Initial Migration

- [ ] 3.1 Run `drizzle-kit generate` to produce initial migration SQL
- [ ] 3.2 Review generated SQL for any drizzle-kit limitations (complex constraints, special indexes); supplement with hand-written if needed
- [ ] 3.3 Commit migration alongside schema source
- [ ] 3.4 Apply to staging master DB; verify Drizzle queries work end-to-end with test fixtures

## 4. Phase 3 — CI + Publish

- [ ] 4.1 Implement CI step: assert `drizzle-kit generate` produces no diff (i.e., schema and migrations are in sync)
- [ ] 4.2 Implement CI step: typecheck builds across consumer repo simulations
- [ ] 4.3 Wire publish-on-merge: `main` merge bumps version + publishes
- [ ] 4.4 Document semver policy in CHANGELOG.md (patch / minor / major rules)
- [ ] 4.5 Document migration runbook (staging auto-apply; production manual approval)
- [ ] 4.6 Implement production migration approval gate

## 5. Phase 4 — Runtime-Repo Consumption

- [ ] 5.1 Lock the package's v1.0.0 release; coordinate with all six runtime repos to consume
- [ ] 5.2 Each consumer's CI runs schema-sync check (consumed types match deployed schema)

## 6. Definition of Done — `packages/db-schema/` V1 Launch

- [ ] 6.1 All master DB tables defined in Drizzle source
- [ ] 6.2 Initial migration applied to staging and production
- [ ] 6.3 Naming conventions enforced (lint or test-based check)
- [ ] 6.4 Production migration approval gate enforced in CI/CD
- [ ] 6.5 v1.0.0 published; consumed by all six runtime repos
- [ ] 6.6 Schema-vs-migration sync check passes in CI
- [ ] 6.7 Migration runbook documented
