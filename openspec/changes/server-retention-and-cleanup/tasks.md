> **Blocked tasks**: The cleanup-execution path (`StorageWriter.delete` call sites) depends on [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0 landing first (R2 binding + `StorageWriter` interface). Phase A (schema) is independent and can ship before that.

## Phase A — Master DB schema

Ship + smoke + commit before Phase B starts.

### A.1 — Migration

- [ ] A.1.1 Generate `apps/web/drizzle/0008_backup_retention_and_cleanup.sql` per the SQL in design.md. Use `pnpm --filter @baseout/web db:generate` so Drizzle authors the SQL.
- [ ] A.1.2 Apply via `pnpm --filter @baseout/web db:migrate` against the dev DB. Verify via `psql $DATABASE_URL -c "\d baseout.backup_retention_policies"` and `\d baseout.backup_runs`.
- [ ] A.1.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts):
  - Add `backupRetentionPolicies` table definition.
  - Add `deletedAt: timestamp(...).nullable()` to the `backupRuns` table definition.
  - Add the `policyTier` literal union type `'basic' | 'time_based' | 'two_tier' | 'three_tier' | 'custom'`.

### A.2 — Engine schema mirror

- [ ] A.2.1 New file `apps/server/src/db/schema/backup-retention-policies.ts`. Mirrors only what the engine reads (full table). Header comment naming the canonical migration `apps/web/drizzle/0008_backup_retention_and_cleanup.sql`.
- [ ] A.2.2 Update [apps/server/src/db/schema/backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts) — add `deletedAt`.
- [ ] A.2.3 Update the engine's schema barrel to export the new types.

## Phase B — Capability resolution

### B.1 — `resolveRetentionPolicy` pure function

- [ ] B.1.1 TDD red: `apps/web/src/lib/billing/capabilities.test.ts` — extend with `resolveRetentionPolicy` cases. Pin every (tier × default-knob × min/max bound). Trial: knob non-editable. Starter `keepLastN` editable 1–30. Launch `dailyWindowDays` editable 7–90. Etc.
- [ ] B.1.2 Implement `resolveRetentionPolicy(tier)` in [apps/web/src/lib/billing/capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts). Returns the `RetentionPolicy` shape from design.md §Phase B. Watch green.
- [ ] B.1.3 Export the shape from `apps/web/src/lib/types.ts` so the engine can re-import via cross-app type pattern.

### B.2 — Engine-side resolver

- [ ] B.2.1 The engine needs `tierCapDays` per Space to enforce the safety net. New helper `apps/server/src/lib/retention/tier-cap.ts` — `getTierCapDays(tier): number`. Pin per Features §3.
- [ ] B.2.2 Vitest in `tier-cap.test.ts` — all seven tiers.

## Phase C — Cleanup engine

Independent of D/E/F. Ship + smoke before any UI work.

### C.1 — `decideDeletions` pure function

- [ ] C.1.1 TDD red: `apps/server/tests/integration/retention/decide-deletions.test.ts` (new). Cases per design.md §Phase C.1: basic-keep-3-of-5; time_based boundary; two_tier weekly pruning; three_tier monthly indefinite; tier-cap override; trial-run 7d cap.
- [ ] C.1.2 Implement `apps/server/src/lib/retention/decide-deletions.ts` — `decideDeletions(runs, policy, tierCapDays, now)` pure function. Dispatch table per `policy.tier`. Watch green.
- [ ] C.1.3 Add a fuzz-ish test: generate 1000 random runs over 2 years × random policy; assert the keep set is non-empty and the delete set respects the policy + tier cap.

### C.2 — `runCleanupPass` integration

- [ ] C.2.1 TDD red: `apps/server/tests/integration/retention/run-cleanup-pass.test.ts` (new). Uses real local Postgres + Miniflare R2. Seeds three Spaces with mixed policy tiers + run-age fixtures. Asserts the expected R2 keys are deleted + `deleted_at` is set on the expected rows.
- [ ] C.2.2 Implement `apps/server/src/lib/retention/run-cleanup-pass.ts` per design.md §Phase C.2. Watch green.
- [ ] C.2.3 Verify idempotency: re-run the same pass against the post-state. Assert no further R2 deletes, no further `deleted_at` updates.

### C.3 — Trigger.dev scheduled task (owned by sibling)

Moved to [`workflows-retention-and-cleanup`](../workflows-retention-and-cleanup/tasks.md). The server side exposes whatever entry point the task hits (`runCleanupPass` invocation over `/api/internal` or via direct import — keep the surface stable and document it here when implemented).

- [ ] C.3.1 Confirm the workflows-side task's engine-callback hook points at the documented internal endpoint (or that the cron task can import `runCleanupPass` directly when `apps/workflows` depends on `@baseout/server` orchestration — TBD with the workflows-side change).

### C.4 — Default-policy backfill

- [ ] C.4.1 New script `apps/server/scripts/bootstrap-retention-policies.mjs`. Iterates `spaces`, INSERTs default `backup_retention_policies` row from `resolveRetentionPolicy(space.tier)` (defaults only — no per-knob customization). Idempotent — `ON CONFLICT (space_id) DO NOTHING`.
- [ ] C.4.2 Add npm script `"bootstrap:retention": "node --env-file-if-exists=.env scripts/bootstrap-retention-policies.mjs"` to [apps/server/package.json](../../../apps/server/package.json).

### C.5 — Human checkpoint (destructive path)

- [ ] C.5.1 Seed dev DB with ~5 Spaces each with 20 fake backup runs spanning 2 years. Run the bootstrap script. Run the cron task once. Assert R2 keys + `deleted_at` flips match expectation.
- [ ] C.5.2 Capture the structured log output. Confirm the per-Space counts add up. Pause for human approval before any prod deploy.

### C.6 — Phase C verification

- [ ] C.6.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] C.6.2 On approval: stage by name, commit locally.

## Phase D — Manual-cleanup trigger + credit charge

Depends on Phase C (engine path) + optionally `server-manual-quota-and-credits` for the credit-charge side.

### D.1 — Engine route

- [ ] D.1.1 TDD red: `apps/server/tests/integration/cleanup-route.test.ts`. Cases: 401 missing token; 400 invalid UUID; 404 space-not-found; 200 happy (returns `{ deletedRunIds, deletedObjectCount }`).
- [ ] D.1.2 Implement `apps/server/src/pages/api/internal/spaces/[spaceId]/cleanup.ts` per design.md §Phase D. Wire into `apps/server/src/index.ts` with `CLEANUP_RE = /^\/api\/internal\/spaces\/([^/]+)\/cleanup$/`.

### D.2 — apps/web client + route

- [ ] D.2.1 Extend [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts): add `runCleanup(spaceId): Promise<EngineCleanupResult>`. Mirror the `cancelRun` shape (added by `server-schedule-and-cancel`).
- [ ] D.2.2 TDD red: `apps/web/src/pages/api/spaces/[spaceId]/cleanup.test.ts`. Cases: 401 unauth; 403 IDOR; 200 happy with credit decrement; 402 insufficient_credits if the credits change has shipped.
- [ ] D.2.3 Implement `apps/web/src/pages/api/spaces/[spaceId]/cleanup.ts`. Inner `handlePost(input, deps)` pure-function shape per the existing pattern.
- [ ] D.2.4 Credit interlock: gate the engine call on `chargeCredits(orgId, 10, 'cleanup_manual_trigger')` per [Features §5.2](../../../shared/Baseout_Features.md). If `server-manual-quota-and-credits` hasn't shipped, log a stub `would_charge_10_credits` event + proceed; feature-flag the UI button off in prod.

### D.3 — UI button

- [ ] D.3.1 Add a "Run cleanup now (10 credits)" button under the per-Space backup config card. Renders a confirmation dialog with the count of currently-undeleted snapshots older than the policy window. Uses `setButtonLoading` per apps/web CLAUDE.md §4.5.
- [ ] D.3.2 On success, toast `"<N> snapshots deleted · <M> credits charged"`. Refresh the BackupHistoryWidget so the deleted rows appear with the new style.
- [ ] D.3.3 Vitest for the button render gate + click-to-POST behavior.

## Phase E — Retention configuration UI

### E.1 — Settings page

- [ ] E.1.1 New page `apps/web/src/pages/spaces/[spaceId]/retention.astro`. Layout per design.md §Phase E.
- [ ] E.1.2 Server-side data load: SELECT `backup_retention_policies` + resolve `tier` via existing `Astro.locals.account.subscriptionTier`. Compose a `RetentionPolicy` shape using `resolveRetentionPolicy(tier)` and overlay any DB values.
- [ ] E.1.3 Per-tier knob renderers — `BasicKnobs.astro`, `TimeBasedKnobs.astro`, `TwoTierKnobs.astro`, `ThreeTierKnobs.astro`, `CustomKnobs.astro` (textarea). All in `apps/web/src/components/backups/retention/`.

### E.2 — PATCH route

- [ ] E.2.1 TDD red: `apps/web/src/pages/api/spaces/[spaceId]/retention-policy.test.ts`. Cases: 401 / 403 IDOR / 400 knob-out-of-range / 200.
- [ ] E.2.2 Implement `PATCH /api/spaces/[spaceId]/retention-policy`. Validates incoming payload against `resolveRetentionPolicy(tier)` per design.md §Phase B; UPSERTs `backup_retention_policies`.

### E.3 — History widget update

- [ ] E.3.1 [BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) — grey-out / collapse rows where `deletedAt !== null`. Show a "(snapshot pruned)" footer label.
- [ ] E.3.2 Update [format.ts](../../../apps/web/src/lib/backups/format.ts) — `formatDeletedAt(d): string` helper. Vitest case.

## Phase F — Documentation scope-lock

- [ ] F.1 Update [PRD §5.6 line 425](../../../shared/Baseout_PRD.md): replace `prune every 6th interval (plan-dependent)` with `cleanup follows the per-tier policy ladder defined in Features §6.9`.
- [ ] F.2 Update [Backlog MVP](../../../shared/Baseout_Backlog_MVP.md): tick the retention/cleanup row(s).
- [ ] F.3 Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) "Out of Scope" table — add a row linking this change as the resolved follow-up.

## Phase G — Final verification

- [ ] G.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] G.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] G.3 Human checkpoint smoke: with seeded dev DB, edit a Space's policy via the settings page, save, observe the cron pass an hour later (or trigger manually via Trigger.dev dashboard). Confirm the expected runs were pruned.
- [ ] G.4 On approval: stage by name (no `git add -A`), commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `server-retention-custom-editor` — Rich GUI editor for Business/Enterprise Custom policy. First-pass MVP renders a JSON textarea with schema validation.
- [ ] OUT-2 `server-cold-storage-tier` — Lifecycle rules that move snapshots older than X to a cheaper R2 / S3 storage class instead of deleting outright.
- [ ] OUT-3 `server-restore-from-soft-deleted` — 7-day grace window before R2 objects are unrecoverable. Today: R2 delete is immediate.
- [ ] OUT-4 `server-byos-cleanup` — Cleanup of BYOS destinations. Today: BYOS-destination retention is the customer's responsibility per Features §6.6.
- [ ] OUT-5 `audit-history-retention` — Schema-changelog retention per Features §7.2. Different table (`audit_history`), different cleanup loop.
