## Why

The `baseout-backup-schedule-and-cancel` change lights up the cron half of the lifecycle. The other half — **when to delete old backups** — has no implementation yet. R2 is the source of cost-per-GB for managed-storage Spaces; without an automated cleanup loop, every scheduled backup adds to the bill forever.

[PRD §5.6](../../../shared/Baseout_PRD.md) lists three retention requirements:

> - Retain all backups for the tier's changelog retention period (30 days on Starter, up to 24 months on Business, Custom on Enterprise)
> - Beyond the retention period: prune every 6th interval (plan-dependent)
> - Smart cleanup exposed as user-configurable settings in V1 dashboard

[Features §6.9](../../../shared/Baseout_Features.md) makes the policy matrix concrete:

| Tier | Policy | Schedule | Manual Trigger |
|---|---|---|---|
| Trial | Basic (keep last N) | Monthly | ✗ |
| Starter | Basic | Monthly | ✓ (10 cr) |
| Launch | Time-based | Weekly | ✓ (10 cr) |
| Growth | Two-tier | Weekly | ✓ (10 cr) |
| Pro | Three-tier | Daily | ✓ (10 cr) |
| Business | Custom | Daily | ✓ (10 cr) |
| Enterprise | Custom | Continuous | ✓ (10 cr) |

And [Features §3 Tier Limits](../../../shared/Baseout_Features.md) specifies the per-tier retention window: Trial 30d · Starter 30d · Launch 90d · Growth 6mo · Pro 12mo · Business 24mo · Enterprise custom.

[PRD §7.3 V1 Must-Haves](../../../shared/Baseout_PRD.md) row 713 lists `Retention / smart cleanup (user-configurable)` as a Must-Have for V1. Today it has no openspec change, no DB schema, no engine code, and no UI — every R2 object the backup engine writes lives forever.

This change is the natural pair to `baseout-backup-schedule-and-cancel`. Both ride the SpaceDO alarm pattern (or a sibling Trigger.dev cron) and both share the per-Space cadence model. Filing them together would have inflated the schedule-and-cancel scope; filing them apart keeps each change reviewable. This proposal assumes `baseout-backup-schedule-and-cancel` has shipped or will ship before this one.

**One PRD conflict to flag**, per CLAUDE.md "v1.1 PRD authoritative when it disagrees":

- [PRD §5.6 line 425](../../../shared/Baseout_PRD.md): `prune every 6th interval`.
- [Features §6.9](../../../shared/Baseout_Features.md): per-tier policy ladder (Basic → Time-based → Two-tier → Three-tier → Custom).

These describe the same thing at different fidelities. This change commits to **the Features §6.9 ladder** as the implemented contract — it's the more specific and more recently-edited reading, and "prune every 6th interval" is a reasonable shorthand for the Basic policy (`keep last N` ≈ prune at the Nth interval). The PRD §5.6 wording is updated in Phase D to point at the §6.9 ladder.

## What Changes

### Phase A — Master-DB schema for retention policies

- **New table `backup_retention_policies`** in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts):
  - `id uuid PK`
  - `space_id uuid FK → spaces.id, unique` (one policy per Space)
  - `policy_tier text` — one of `'basic' | 'time_based' | 'two_tier' | 'three_tier' | 'custom'`. Derived from the Space's tier on PATCH; stored so the cleanup job doesn't have to re-resolve Stripe metadata per pass.
  - `keep_last_n int` (Basic only — used for Trial/Starter)
  - `daily_window_days int` (Time-based / Two-tier / Three-tier — how many days of daily snapshots to keep)
  - `weekly_window_days int` (Two-tier / Three-tier — how many days of weekly snapshots to keep)
  - `monthly_indefinite bool` (Three-tier — keep monthly snapshots forever)
  - `custom_rules jsonb` (Custom only — Business+ free-form rules)
  - `created_at`, `modified_at` timestamps
- **New column on `backup_runs`**: `deleted_at timestamp with time zone NULL`. The cleanup engine sets this when it deletes the R2 object so the history widget can grey-out / hide expired rows. Rows are NOT hard-deleted — the metadata stays for audit; only the R2 blob is removed.
- **Schema mirror** in [apps/server/src/db/schema/](../../../apps/server/src/db/schema/) following CLAUDE.md §2 (engine mirrors only what it reads — needs `backup_retention_policies` for the cleanup job and `backup_runs.deleted_at` to write).

### Phase B — Capability resolution

- Extend the existing capability resolver (the one that resolves `frequency` against tier in `PATCH /api/spaces/:id/backup-config`) with a new `resolveRetentionPolicy(tier) → RetentionPolicyShape` function in `apps/web/src/lib/billing/capabilities.ts` (file already used by FrequencyPicker tier gating per Phase 10a).
- Output: the default policy + the editable knobs available at this tier (e.g. Trial returns `{ tier: 'basic', keepLastN: 3, knobs: { keepLastN: { editable: false } } }`; Launch returns `{ tier: 'time_based', dailyWindowDays: 30, knobs: { dailyWindowDays: { editable: true, min: 7, max: 90 } } }`).
- Tests pin every tier × every knob.

### Phase C — Cleanup engine

- **Decision**: cleanup runs on a Trigger.dev scheduled task, not a SpaceDO alarm. Rationale in design.md (one DO per Space × thousands of Spaces × per-tier cadence makes the alarm topology heavy; Trigger.dev v3 scheduled tasks already exist in `apps/workflows/trigger/tasks/`).
- **New task** `apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts`:
  - Cron schedule: hourly (so the worst-case clock skew between policy edits and pruning is ≤ 1 hour).
  - Per pass: SELECT `backup_runs` WHERE `deleted_at IS NULL AND status IN ('succeeded', 'cancelled', 'trial_complete', 'trial_truncated', 'failed')` ORDER BY `space_id, started_at DESC`.
  - Group rows by `space_id`. For each Space, load its `backup_retention_policies` row and decide which runs are KEEP vs DELETE per the policy shape.
  - For each DELETE row: list R2 objects under `r2://baseout-backups/<spaceId>/<runId>/`, delete them, then UPDATE `backup_runs.deleted_at = now()`.
  - Idempotent — if `deleted_at` is already set, skip.
- **Pure function** in `apps/server/src/lib/retention/decide-deletions.ts`: `decideDeletions(runs[], policy, now): { keep: runId[], delete: runId[] }`. Dep-injected `now()` for tests. Handles all 5 policy tiers.
- **Trigger.dev cron** configured in [trigger.config.ts](../../../apps/workflows/trigger.config.ts). Runs as `@trigger.dev/sdk schedules.task(...)` per Trigger.dev v3 conventions.

### Phase D — Manual-cleanup trigger + credit charge

- **New engine route** `POST /api/internal/spaces/:spaceId/cleanup`. Body: `{ force?: boolean }` (force ignores the per-policy schedule). Auth: `INTERNAL_TOKEN`. Calls the same `decideDeletions` + R2-delete path as the scheduled cron.
- **New apps/web route** `POST /api/spaces/:spaceId/cleanup`. IDOR-guarded. Returns the count of objects deleted + the credit charge applied (10 credits per [Features §5.2](../../../shared/Baseout_Features.md)).
- **Credit charge**: routes through whatever credit-charge surface exists at the time. If `baseout-backup-manual-quota-and-credits` hasn't shipped yet, this change blocks on it OR ships a temporary "no-charge" stub with a TODO referencing the credits change. The proposal records the dependency explicitly.
- **UI**: a "Run cleanup now (10 credits)" button under the existing per-Space backup config card. Uses `setButtonLoading` per apps/web CLAUDE.md §4.5. Confirmation dialog shows "Will delete N expired snapshots; cost: 10 credits".

### Phase E — Retention configuration UI

- **New settings page** `apps/web/src/pages/spaces/[spaceId]/retention.astro`. Reads `backup_retention_policies` for the Space, renders the per-tier editable knobs via the capability resolver from Phase B.
- **Per-tier UI shapes**:
  - Basic (Trial/Starter): `Keep last N` slider, hardcoded N for Trial, editable for Starter within capability bounds.
  - Time-based (Launch): `Keep daily snapshots for X days, then prune to weekly` — single number input.
  - Two-tier (Growth): `Daily for X days, then weekly for Y days, then prune`.
  - Three-tier (Pro): `Daily for X days, then weekly for Y days, monthly indefinitely`.
  - Custom (Business/Enterprise): JSON-shaped rule editor (out of scope for first pass — render `<textarea>` with JSON validation; rich editor is a follow-up).
- **PATCH route** `PATCH /api/spaces/:spaceId/retention-policy`. Validates the payload against `resolveRetentionPolicy(tier)` — rejects edits that exceed the tier's `max`/`min` knobs. Writes to `backup_retention_policies`.

### Phase F — PRD/Features doc sync

- Update [PRD §5.6](../../../shared/Baseout_PRD.md) line 425 to reference Features §6.9 by name instead of the loose "prune every 6th interval" wording.
- Update [Backlog MVP](../../../shared/Baseout_Backlog_MVP.md) — tick the retention/cleanup row.
- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) "Out of Scope" table — link this change as the resolved follow-up.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-backup-retention-custom-editor` | Rich GUI editor for Business/Enterprise Custom policy. First-pass MVP renders a `<textarea>` with JSON validation. |
| Future change `baseout-backup-cold-storage-tier` | Lifecycle rules that move snapshots older than X to a cheaper R2 / S3 storage class instead of deleting outright. Out of MVP scope per PRD. |
| Future change `baseout-backup-restore-from-soft-deleted` | Treat `deleted_at`-set rows as "soft-deleted" with a 7-day grace window before R2 objects are unrecoverable. Today: R2 delete is immediate. |
| Future change | Schema-changelog retention (per Features §7.2). That table is `audit_history`, not `backup_runs`. Separate cleanup loop. |
| Future change | BYOS destination cleanup. The R2 delete path here only operates on managed R2. BYOS-destination retention is the customer's responsibility per Features §6.6. |
| Bundled blockingly with `baseout-backup-manual-quota-and-credits` | The 10-credit charge for the manual-cleanup trigger. Implementation depends on the credit-charge surface from that change. |

## Capabilities

### New capabilities

- `backup-retention-policy` — per-Space retention policy persistence + capability-resolved knobs. Owned by `apps/web` (resolver + PATCH + UI) and read by `apps/server` (cleanup job).
- `backup-cleanup-engine` — automated R2 + metadata pruning per policy. Owned by `apps/server`. Both scheduled cron and on-demand manual trigger paths.

### Modified capabilities

- `backup-engine` — gains awareness of `deleted_at` on `backup_runs`. New runs are unaffected; history-listing queries filter or label `deleted_at IS NOT NULL` rows.
- `capability-resolution` (the existing `apps/web` resolver) — gains `resolveRetentionPolicy(tier)`. No external API shape change; new shape is purely internal.
- `backups-history-ui` — `BackupHistoryWidget` greys out / collapses rows where `deleted_at IS NOT NULL`. Existing polling logic untouched.

## Impact

- **Master DB**: one additive migration. New `backup_retention_policies` table; new nullable `backup_runs.deleted_at` column. Existing rows: `deleted_at = NULL` until the cleanup engine touches them.
- **R2**: cleanup engine issues `DELETE` requests. R2 billing is per-operation; at MVP scale (hundreds of Spaces × hourly cron × ~10 expired runs per Space per hour worst case) = single-digit dollars/month in R2 ops. Worth noting only at scale.
- **Trigger.dev**: one new scheduled task. Hourly cron is well within Trigger.dev's scheduler limits.
- **Cost surface**: R2 storage savings dominate the equation. At MVP scale, retention deletes are pure cost reduction.
- **Observability**: cleanup task writes a structured `event: 'backup_cleanup_pass'` log per pass with `{ spacesProcessed, runsKept, runsDeleted, r2ObjectsDeleted, durationMs }`. Per-Space `event: 'backup_cleanup_space'` log when a Space has > 0 deletions.
- **Security**: cleanup engine reads `backup_retention_policies` + writes R2 + writes `backup_runs.deleted_at`. No new auth surface (cron is internal). Manual-trigger route is INTERNAL_TOKEN-gated.
- **Cross-app contract** (new wire shapes):
  - apps/web → engine: `POST /api/internal/spaces/:spaceId/cleanup` → `200 { deletedRunIds, deletedObjectCount, creditsCharged }` or `404 { error: 'space_not_found' }` or `402 { error: 'insufficient_credits' }`.
  - apps/web ← apps/web (PATCH retention-policy): `PATCH /api/spaces/:spaceId/retention-policy` → `200 { policy }` or `400 { error: 'knob_out_of_range', field: 'dailyWindowDays' }`.

## Reversibility

- **Phase A** (schema): additive. Reverting means leaving the table empty / `deleted_at` NULL; cleanup engine without policies finds no Spaces to act on and no-ops.
- **Phase B** (resolver): pure-function addition; reverting removes the resolver call from the PATCH/UI paths.
- **Phase C** (cleanup engine): the Trigger.dev cron can be disabled via the project dashboard or by removing the schedule export. Already-deleted R2 objects cannot be recovered — this is forward-only at the data level (deliberately, per the soft-delete deferral above). If R2 versioning is enabled on the bucket, recovery is per-object via the R2 console; otherwise a follow-up `baseout-backup-restore-from-soft-deleted` adds a grace window.
- **Phase D** (manual trigger + credits): roll-forward; removing the button + route stops the charge. Credit charges already applied are not auto-refunded.
- **Phase E** (UI): pure UI removal.
- **Phase F** (docs): `git revert`.

The R2 delete path is the only irreversible step. Tasks include a smoke checkpoint (Phase C.5) where a human watches the FIRST cron pass on a seeded dev DB to confirm the policy decision matches expectation before any prod deploy.
