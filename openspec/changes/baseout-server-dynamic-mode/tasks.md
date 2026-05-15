## Phase A — Schema

- [ ] A.1 Generate `apps/web/drizzle/0012_space_databases.sql` per design.md §Phase A.
- [ ] A.2 Apply via `pnpm --filter @baseout/web db:migrate`.
- [ ] A.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — add `spaceDatabases` table + literal types.
- [ ] A.4 New engine mirror `apps/server/src/db/schema/space-databases.ts`. Header comment names canonical migration.

## Phase B — Provisioner (incremental, one tier at a time)

### B.1 — D1 Schema Only (smallest surface, ship first)

- [ ] B.1.1 Create the shared D1 database (`baseout-shared-schema-only`) via Cloudflare dashboard. Capture `database_id` to env.
- [ ] B.1.2 New file `apps/server/src/lib/dynamic/provisioner.ts` with the dispatch + `provisionD1SchemaOnly` function. UPSERTs `space_databases` row with `tier='d1_schema_only'` + `status='ready'`.
- [ ] B.1.3 Run the schema-only DDL once against the shared D1 to create `_baseout_tables`, `_baseout_fields`. Script under `apps/server/scripts/bootstrap-d1-schema-only.mjs`.
- [ ] B.1.4 TDD: provisioner test.

### B.2 — D1 Full

- [ ] B.2.1 `provisionD1Full(spaceId, deps)` — calls Cloudflare D1 create-database API. Wires the new database ID into `space_databases`.
- [ ] B.2.2 Schema DDL runs against the new D1 immediately after creation.
- [ ] B.2.3 TDD: mock the Cloudflare API; assert correct request + retry on 5xx.

### B.3 — Shared PG

- [ ] B.3.1 `provisionSharedPg(spaceId, deps)` — connects with admin creds, creates schema + role + grants. Builds + encrypts the connection string.
- [ ] B.3.2 Tests: provisioner runs SQL via a dockerized PG; assert schema + role exist.

### B.4 — Dedicated PG

- [ ] B.4.1 `provisionDedicatedPg(spaceId, deps)` — calls Neon or Supabase API per env config.
- [ ] B.4.2 Schema DDL.
- [ ] B.4.3 Tests against mock provider API.

### B.5 — BYODB

- [ ] B.5.1 `provisionByodb(spaceId, connectionString, deps)` — validates with probe + runs DDL.
- [ ] B.5.2 New apps/web route `POST /api/spaces/:id/byodb-connect` that accepts a connection string from the user, persists encrypted, enqueues provisioner.
- [ ] B.5.3 Tests.

### B.6 — Trigger.dev task (moved to workflows sibling)

Owned by [`baseout-workflows-dynamic-mode`](../baseout-workflows-dynamic-mode/tasks.md). Server side owns the dispatcher endpoint the task hits.

- [ ] B.6.1 New `apps/server/src/pages/api/internal/spaces/:id/provision-database.ts`. POST → dispatches per-tier provisioning. INTERNAL_TOKEN-gated. Idempotent on `space_databases.status` (no-op if already `ready`).

## Phase C — Engine write path

### C.1 — Dynamic-write helpers

- [ ] C.1.1 New module `apps/server/src/lib/dynamic/upsert-records.ts` — pure-ish; injectable client per tier (D1/PG). Builds upsert SQL per dialect.
- [ ] C.1.2 New module `apps/server/src/lib/dynamic/upsert-schema.ts` — UPSERTs the `_baseout_tables` + `_baseout_fields` metadata.
- [ ] C.1.3 TDD red: per-dialect upsert tests against Miniflare D1 and dockerized PG.

### C.2 — Wire into backup-base.task.ts (workflows sibling)

Owned by [`baseout-workflows-dynamic-mode`](../baseout-workflows-dynamic-mode/tasks.md). Server side guarantees `upsert-records` + `upsert-schema` module API stability.

### C.3 — Tests (workflows sibling)

Dynamic-mode integration test for the backup-base task lives in workflows-side tests.

## Phase D — Schema diff

- [ ] D.1 New module `apps/server/src/lib/dynamic/schema-differ.ts` per design.md §Phase D.
- [ ] D.2 Tests: added field, removed field, renamed field, retyped field.
- [ ] D.3 Workflows-side wiring (compute diff per table, POST `audit_history` row) — owned by [`baseout-workflows-dynamic-mode`](../baseout-workflows-dynamic-mode/tasks.md). Server side owns the diff helper module + the `audit_history` route handler.

## Phase E — Capability resolver

- [ ] E.1 TDD red: `resolveBackupMode(tier)` + `resolveDatabaseTier(tier)` — all seven tiers per [Features §4.3](../../../shared/Baseout_Features.md).
- [ ] E.2 Implement in `apps/web/src/lib/billing/capabilities.ts`.
- [ ] E.3 Update PATCH validation in `apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts`. Auto-flip `dynamic` to schema-only for lower tiers.

## Phase F — Provisioning triggers

- [ ] F.1 Stripe webhook handler (`subscription.updated`): enqueue provisioner for each Space in the Org when tier upgrades to dynamic-supporting.
- [ ] F.2 Defensive fallback in `apps/server/src/lib/runs/start.ts`: if `space_databases` missing and config.mode='dynamic', enqueue inline.
- [ ] F.3 Downgrade handler: `status='suspended'` on tier downgrade.

## Phase G — Dashboard

- [ ] G.1 Per-Space card showing `space_databases.status`, tier, last_sync timestamps.
- [ ] G.2 Re-provision button for `status='error'` rows.
- [ ] G.3 BYODB connect-form for `status='provisioning'` Enterprise Spaces.

## Phase H — Doc sync

- [ ] H.1 Update [openspec/changes/baseout-server/specs/backup-engine/spec.md](../baseout-server/specs/backup-engine/spec.md).
- [ ] H.2 Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) Out-of-Scope.
- [ ] H.3 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Phase I — Final verification

- [ ] I.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] I.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] I.3 Human checkpoint smoke per tier (one D1, one PG):
  - Upgrade a Trial Space to Launch (Stripe webhook). Watch `space_databases` progress provisioning → ready.
  - Run a backup. Confirm dynamic DB has expected schema + record tables.
  - Make a schema change in the source Airtable. Run again. Confirm `audit_history` row.
- [ ] I.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-direct-sql-api` — sql.baseout.com read endpoint (already in `openspec/changes/baseout-sql`).
- [ ] OUT-2 `baseout-schema-changelog-ui` — Diff browser UI.
- [ ] OUT-3 `baseout-dynamic-db-decommission` — Hard-delete suspended dynamic DBs after retention.
- [ ] OUT-4 `baseout-restore-engine` — Reads from dynamic DB and writes back to Airtable.
- [ ] OUT-5 `baseout-backup-byodb-validation` — Connection-string allowlist + cert pinning for Enterprise BYODB.
