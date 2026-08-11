> **Depends on**: [`system-r2-stance`](../system-r2-stance/proposal.md). The cleanup-execution path (any task that calls `StorageWriter.delete` against R2) is **blocked on [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0** (R2 binding + `StorageWriter` interface). Phases A (schema), B (capability resolver), C.1 (`decideDeletions` pure function), C.4 (backfill script), and F (docs) are R2-independent and can ship before Phase 0 lands. Tasks blocked on Phase 0 are flagged inline below with `[blocked on byos-destinations Phase 0]`.

---

## Implementation status — 2026-06-27 (Phases A + B + C + cron)

Landed the **auto-sweep milestone** (schema → resolver → cleanup engine → hourly cron) per the
`docs/superpowers/plans/2026-06-26-backend-functional-wiring.md` Phase-3 scope decision
("A+B+C + cron; defer D/E/F"). Deferred: Phase D (manual trigger + 10-credit charge — blocked on
`server-manual-quota-and-credits`), Phase E (settings UI + web `resolveRetentionPolicy` knobs
resolver), Phase F (doc scope-lock).

**Stale-doc corrections made during implementation:**
- Migration is **`0021_backup_retention_and_cleanup.sql`** (tree was at 0020), not `0008`.
- Capability resolver lives in `apps/web/src/lib/capabilities/` + `apps/server/src/lib/capabilities/resolve.ts`,
  not `apps/web/src/lib/billing/capabilities.ts`.
- `StorageWriter.deletePrefix` + the whole `delete-run-files` task path already shipped
  (`shared-backup-run-delete`), so the "blocked on byos-destinations Phase 0" flags are moot — the
  destructive delete path is reused, not built.
- **Trial is not a tier** (it's a `trialing` subscription status → inherits Starter). The design's
  "Trial keepLastN=3" row collapses into Starter; trial aggressiveness lives at the run level
  (`is_trial` → 7-day cap in `decideDeletions`).

**Architecture resolution (load-bearing):** the design's `runCleanupPass({ db, makeWriter })`
running inside the workflows cron is impossible — Workers can't reach R2 *and* `apps/workflows` has
no DB layer. So the pass is split: the **engine** owns the decision (`POST /api/internal/cleanup-plan`
→ `buildCleanupPlan`, Worker-safe DB reads only) and the soft-delete (`POST /api/internal/cleanup-complete`
→ sets `deleted_at`); the **workflows cron** (`workflows-retention-and-cleanup`) does the actual
`StorageWriter.deletePrefix` in Node, then posts completions back.

---

## Phase A — Master DB schema

Ship + smoke + commit before Phase B starts.

### A.1 — Migration

- [x] A.1.1 Generated `apps/web/drizzle/0021_backup_retention_and_cleanup.sql` (NOT 0008 — tree at 0020) via `drizzle-kit generate --name backup_retention_and_cleanup`.
- [ ] A.1.2 Apply via `pnpm --filter @baseout/web db:migrate` against the dev DB — **pending human smoke** (remote dev DB; my Phase C tests use injected deps, not the remote DB).
- [x] A.1.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts):
  - Add `backupRetentionPolicies` table definition.
  - Add `deletedAt: timestamp(...).nullable()` to the `backupRuns` table definition.
  - Add the `policyTier` literal union type `'basic' | 'time_based' | 'two_tier' | 'three_tier' | 'custom'`.

### A.2 — Engine schema mirror

- [x] A.2.1 New file `apps/server/src/db/schema/backup-retention-policies.ts` (full-table mirror; header names `apps/web/drizzle/0021_backup_retention_and_cleanup.sql`).
- [x] A.2.2 Update [apps/server/src/db/schema/backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts) — added `deletedAt`.
- [x] A.2.3 Updated the engine's schema barrel to export the new mirror.

## Phase B — Capability resolution

### B.1 — `resolveRetentionPolicy` pure function — **DONE with Phase E (2026-06-27)**

Built when Phase E gave it a consumer (the deferral paid off). Lives at
`apps/web/src/lib/capabilities/retention.ts` (NOT `lib/billing/capabilities.ts`). Defaults match the
engine's `getDefaultPolicy`. Also added `parseRetentionPatchPayload` (the PATCH validator).

- [x] B.1.1 `apps/web/src/lib/capabilities/retention.test.ts` — every tier × knob bounds + parse cases (15 tests).
- [x] B.1.2 `resolveRetentionPolicy(tier)` with editable-knob (`NumericKnob`) metadata + `parseRetentionPatchPayload`.
- [ ] B.1.3 (deferred) Export the `RetentionPolicy` shape for the UI.

### B.2 — Engine-side resolver

- [x] B.2.1 `apps/server/src/lib/retention/tier-cap.ts` — `getTierCapDays(tier)` (Features §3: 30/90/180/365/730/∞; null→starter).
- [x] B.2.2 `tests/integration/retention/tier-cap.test.ts` — all tiers + null.
- [x] B.2.x (added) `policy-defaults.ts` `getDefaultPolicy(tier)` — the engine's value-resolver fallback when a Space has no policy row + `policy-defaults.test.ts`. Plus `types.ts` (`RetentionPolicyValues`).

## Phase C — Cleanup engine

Independent of D/E/F. Ship + smoke before any UI work.

### C.1 — `decideDeletions` pure function

- [x] C.1.1 `tests/integration/retention/decide-deletions.test.ts` — basic-keep-3-of-5; time_based boundary; two_tier weekly pruning; three_tier monthly indefinite (+ monthly-off); custom→three_tier default; tier-cap override; trial 7d cap.
- [x] C.1.2 `apps/server/src/lib/retention/decide-deletions.ts` — `decideDeletions(runs, policy, tierCapDays, now)`, two-pass (cap → policy ladder), dispatch per `policy.tier`.
- [x] C.1.3 Fuzz test (50 iters × 200 random runs over 2y × random policy/cap) asserting partition + cap/trial-cap invariants.

### C.2 — `runCleanupPass` integration

> **Re-architected** (see status block): split into an engine PLAN half + a workflows EXECUTE half +
> an engine COMPLETE half (Workers can't reach R2; workflows has no DB). The "real PG + Miniflare R2"
> harness was replaced by the codebase's injected-deps unit-test pattern (the DB 200-paths are
> human-smoked via curl, per runs-detail-route.test.ts).

- [x] C.2.1 `tests/integration/retention/build-cleanup-plan.test.ts` (injected `vi.fn()` deps) — per-space policy/default-fallback/cap-override/multi-space aggregation; `tests/integration/retention/cleanup-routes.test.ts` (routing layer 401/405/400/200-empty).
- [x] C.2.2 `apps/server/src/lib/retention/build-cleanup-plan.ts` (+ `cleanup-deps.ts` prod wiring, reusing `buildRunDeleteDeps.computeRunPrefixes` + `resolveCapabilities`) + routes `pages/api/internal/cleanup-plan.ts` & `cleanup-complete.ts`, wired in `index.ts`.
- [x] C.2.3 Idempotency: `cleanup-complete` soft-deletes `WHERE deleted_at IS NULL` (re-running is a no-op); `deletePrefix` is itself idempotent; a failed prefix → run reported `ok:false` → `deleted_at` stays NULL → retried next pass.

### C.3 — Trigger.dev scheduled task (owned by sibling)

Moved to [`workflows-retention-and-cleanup`](../workflows-retention-and-cleanup/tasks.md). The server side exposes whatever entry point the task hits (`runCleanupPass` invocation over `/api/internal` or via direct import — keep the surface stable and document it here when implemented).

- [x] C.3.1 Resolved: the workflows cron POSTs `/api/internal/cleanup-plan` then `/api/internal/cleanup-complete` (no direct `@baseout/server` import). See `workflows-retention-and-cleanup`.

### C.4 — Default-policy backfill

- [x] C.4.1 `apps/server/scripts/bootstrap-retention-policies.mjs` — resolves each Space's tier via SQL (org's active/trialing Airtable subscription_items.tier), INSERTs the `getDefaultPolicy`-mirrored row `ON CONFLICT (space_id) DO NOTHING`.
- [x] C.4.2 Added npm script `"bootstrap:retention"` to [apps/server/package.json](../../../apps/server/package.json).

### C.5 — Human checkpoint (destructive path)

- [ ] C.5.1 `[blocked on byos-destinations Phase 0]` Seed dev DB with ~5 Spaces each with 20 fake backup runs spanning 2 years. Run the bootstrap script. Run the cron task once. Assert R2 keys + `deleted_at` flips match expectation.
- [ ] C.5.2 `[blocked on byos-destinations Phase 0]` Capture the structured log output. Confirm the per-Space counts add up. Pause for human approval before any prod deploy.

### C.6 — Phase C verification

- [ ] C.6.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] C.6.2 On approval: stage by name, commit locally.

## Phase D — Manual-cleanup trigger + credit charge

Depends on Phase C (engine path) + optionally `server-manual-quota-and-credits` for the credit-charge side.

### D.1 — Engine route

- [ ] D.1.1 `[blocked on byos-destinations Phase 0]` TDD red: `apps/server/tests/integration/cleanup-route.test.ts`. Cases: 401 missing token; 400 invalid UUID; 404 space-not-found; 200 happy (returns `{ deletedRunIds, deletedObjectCount }`).
- [ ] D.1.2 `[blocked on byos-destinations Phase 0]` Implement `apps/server/src/pages/api/internal/spaces/[spaceId]/cleanup.ts` per design.md §Phase D. Wire into `apps/server/src/index.ts` with `CLEANUP_RE = /^\/api\/internal\/spaces\/([^/]+)\/cleanup$/`.

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

- [x] E.1.1 New page `apps/web/src/pages/retention.astro` (top-level, current-Space from account context — matches the redesigned routing, NOT `/spaces/[id]/`).
- [x] E.1.2 Server-side load: `resolveCapabilities → tier`, `resolveRetentionPolicy(tier)`, overlay the persisted `backup_retention_policies` row onto the defaults.
- [x] E.1.3 Single `RetentionView.astro` renders the knobs generically from the resolved policy (TextInput type=number per editable knob; daisyUI textarea for Custom) — cleaner + more governance-friendly than 5 per-tier `*Knobs.astro` components. Pure composition of `ui/*` primitives (no new ui component → no story needed; `audit:components` gate green).

### E.2 — PATCH route

- [x] E.2.1 `apps/web/src/pages/api/spaces/[spaceId]/retention-policy.test.ts` — 401 / 400 invalid / 403 not-found / 403 IDOR / 400 knob_out_of_range / 200 + 405 (7 tests).
- [x] E.2.2 `PATCH /api/spaces/[spaceId]/retention-policy` — testable `handlePatch(input)` validates via `parseRetentionPatchPayload(tier)`, UPSERTs `backup_retention_policies`.

### E.3 — History widget update

- [ ] E.3.1 **Deferred (small follow-up).** Grey/collapse pruned rows in `BackupHistoryWidget.astro`. Threads `deletedAt` through `BackupRunSummary` + `list.ts` + a governed Pattern; pruned rows only appear in prod after the cleanup cron runs (not observable in current dev), so deferred over rushing a Pattern edit. `formatDeletedAt` (the helper it needs) is ready.
- [x] E.3.2 `apps/web/src/lib/backups/format.ts` — `formatDeletedAt(iso)` ("Pruned <date>", '' when null/invalid) + 3 vitest cases.

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
