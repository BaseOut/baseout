## Overview

> Per [`system-r2-park`](../system-r2-park/proposal.md), this cleanup engine no longer issues destination-side `DELETE` requests. The Phase C work below simplifies to "decide which runs are expired → UPDATE `backup_runs.deleted_at`." References to "R2 delete," "deleted object count," and the R2 list-by-prefix pattern in earlier drafts of this file are kept for historical context with inline strike-through notes; a future `server-r2-revive` change would re-add the destination-side delete path.

Six phases. Phase A (schema) → Phase B (resolver) → Phase C (cleanup engine) are the load-bearing chain; D/E/F are layered on top. Phases A+B+C land first as one "engine works on hardcoded defaults" milestone before any user-editable UI. That lets us smoke the metadata-expiration path in isolation before adding the manual-trigger button and the settings page.

Hard architectural call: **cleanup runs on a Trigger.dev scheduled task, not a SpaceDO alarm.** Rationale:

- SpaceDO alarms are per-Space. With ~thousands of Spaces and most policies firing daily/weekly/monthly, the alarm topology is wasteful — N alarms doing the same thing.
- Trigger.dev v3 scheduled tasks already exist in [apps/workflows/trigger/tasks/](../../../apps/workflows/trigger/tasks/). Cron coverage, retries, observability come free.
- The cleanup task scans `backup_runs` once per hour across all Spaces in a single pass. At MVP scale (low hundreds of Spaces × ~10 retained runs each) this is a single sub-second query.
- The decision *which runs to keep/expire* is a pure function `decideDeletions(runs, policy, now)`. Easy to unit-test in isolation; the cron is a thin wrapper that UPDATEs `backup_runs.deleted_at` (no destination-side delete per [`system-r2-park`](../system-r2-park/proposal.md)).

If MVP scale ever grows past ~50k Spaces, the topology can flip to per-Space DO alarms without changing the pure function. Out of scope for this change.

## Phase A — Schema design

### `backup_retention_policies`

```sql
CREATE TABLE baseout.backup_retention_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id uuid NOT NULL UNIQUE REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  policy_tier text NOT NULL CHECK (policy_tier IN ('basic','time_based','two_tier','three_tier','custom')),
  keep_last_n integer,
  daily_window_days integer,
  weekly_window_days integer,
  monthly_indefinite boolean DEFAULT false,
  custom_rules jsonb,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now()
);
```

One row per Space. The fields are nullable because each policy tier only uses a subset:

| Tier | Fields used |
|---|---|
| `basic` | `keep_last_n` |
| `time_based` | `daily_window_days` |
| `two_tier` | `daily_window_days`, `weekly_window_days` |
| `three_tier` | `daily_window_days`, `weekly_window_days`, `monthly_indefinite` |
| `custom` | `custom_rules` (jsonb shape TBD per Features §6.9) |

CHECK constraint pinning the field-set per tier is omitted for MVP — validation lives in the PATCH route's capability resolver. Rationale: rules will probably evolve; pinning them at the DB layer is brittle.

### `backup_runs.deleted_at`

```sql
ALTER TABLE baseout.backup_runs
  ADD COLUMN deleted_at timestamp with time zone NULL;
```

Soft-delete marker. Set when the cleanup engine expires a run (the metadata is hidden from the history widget; per [`system-r2-park`](../system-r2-park/proposal.md), no destination-side delete is issued). Existing history-listing queries (`SELECT * FROM backup_runs WHERE space_id = $1 ORDER BY started_at DESC`) keep working unchanged; the new UI path filters or labels `deleted_at IS NOT NULL` rows.

## Phase B — Capability resolution

Lives in [apps/web/src/lib/billing/capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts) (existing — already houses `resolveFrequency`).

```ts
type RetentionPolicy =
  | { tier: 'basic'; keepLastN: number; knobs: { keepLastN: KnobShape } }
  | { tier: 'time_based'; dailyWindowDays: number; knobs: { dailyWindowDays: KnobShape } }
  | { tier: 'two_tier'; dailyWindowDays: number; weeklyWindowDays: number; knobs: { ... } }
  | { tier: 'three_tier'; ...; knobs: { ... } }
  | { tier: 'custom'; customRules: unknown; knobs: { customRules: KnobShape } }

type KnobShape = { editable: boolean; min?: number; max?: number; default: number }

resolveRetentionPolicy(tier: TierName): RetentionPolicy
```

Per-tier defaults derived from [Features §6.9 + §3](../../../shared/Baseout_Features.md):

| Tier | Default policy | Tier-cap |
|---|---|---|
| Trial | `basic`, `keepLastN=3`, knob non-editable | 30d window (cap on snapshot age) |
| Starter | `basic`, `keepLastN=10`, knob editable 1–30 | 30d window |
| Launch | `time_based`, `dailyWindowDays=30`, knob editable 7–90 | 90d window |
| Growth | `two_tier`, `daily=30`, `weekly=120`, knobs editable | 6mo window |
| Pro | `three_tier`, `daily=30`, `weekly=120`, `monthlyIndefinite=true` | 12mo window |
| Business | `custom`, free-form, default = three-tier shape | 24mo window |
| Enterprise | `custom`, free-form | unbounded |

The "tier-cap" column is enforced at decide-time, not at policy-edit-time — a Business user can write a Custom policy that keeps everything forever; the cleanup engine still respects the 24mo window as the upper bound. (Implementation: `decideDeletions` always expires runs older than `tier-cap` regardless of policy.)

## Phase C — Cleanup engine architecture

### `decideDeletions` pure function

`apps/server/src/lib/retention/decide-deletions.ts`. Pure; dep-injected `now()`.

```ts
type Run = { id: string; startedAt: Date; status: BackupRunStatus; deletedAt: Date | null }
type Decision = { keep: string[]; delete: string[] }

decideDeletions(
  runs: Run[],             // ordered by startedAt DESC, deleted_at IS NULL
  policy: RetentionPolicy, // from Phase B
  tierCapDays: number,     // tier-cap upper bound
  now: Date,
): Decision
```

Implementation per tier (in order):

1. **Tier-cap pass**: any run with `now - startedAt > tierCapDays` → DELETE regardless of policy. This is the safety net.
2. **Policy pass**:
   - `basic`: keep the first `keepLastN` runs (already sorted DESC); delete the rest.
   - `time_based`: keep all runs with `now - startedAt ≤ dailyWindowDays`; older → DELETE.
   - `two_tier`: keep all runs `≤ dailyWindowDays`. For runs `dailyWindowDays < age ≤ weeklyWindowDays`, keep the most-recent run from each ISO week; delete the rest within the window. Beyond `weeklyWindowDays` → DELETE.
   - `three_tier`: same as `two_tier` plus: for runs older than `weeklyWindowDays`, if `monthlyIndefinite`, keep the most-recent run from each calendar month; else DELETE.
   - `custom`: out of scope for first pass — the rules shape is TBD per Features §6.9. First pass: parse `customRules` as `{ tier: 'three_tier', ... }` and dispatch to the three_tier path. Future: rules engine.
3. **Failed-runs pass**: runs with `status IN ('failed', 'cancelled')` are governed by the same policy as successful runs. Trial runs (`is_trial=true`) are tier-capped at 7 days regardless of policy (their snapshots are tiny and ephemeral).

Test cases (all in vitest, time-injected):

| Case | Setup | Expected |
|---|---|---|
| basic — keep 3 of 5 | `keepLastN=3`, 5 runs | keep newest 3, delete oldest 2 |
| time_based — boundary | `dailyWindowDays=30`, runs at age 29d, 30d, 31d | keep 29 + 30, delete 31 |
| two_tier — weekly pruning | `daily=30`, `weekly=120`, 10 runs in week-6 (after daily cutoff) | keep one per ISO week |
| three_tier — monthly indefinite | runs at age 200d, 400d, 600d, monthlyIndefinite=true | keep one per calendar month |
| tier-cap override | policy says keep all; tier-cap = 30d | delete all > 30d regardless |
| trial run | `is_trial=true`, age > 7d | delete (overrides policy) |

### Cron task

`apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts`:

```ts
import { schedules } from '@trigger.dev/sdk/v3'
import { runCleanupPass } from '../../src/lib/retention/run-cleanup-pass'

export const cleanupExpiredSnapshots = schedules.task({
  id: 'cleanup-expired-snapshots',
  cron: '0 * * * *', // hourly
  run: async (payload, { ctx }) => {
    const result = await runCleanupPass({
      now: new Date(payload.timestamp),
      db: createMasterDb(),
      // Per system-r2-park, no StorageWriter is passed — runCleanupPass only
      // updates backup_runs.deleted_at. BYOS retention is the customer's
      // responsibility per Features §6.6.
      logger: ctx.logger,
    })
    return result
  },
})
```

`runCleanupPass` (apps/server/src/lib/retention/run-cleanup-pass.ts) is the integration layer:

1. SELECT all distinct `space_id` in `backup_runs` with `deleted_at IS NULL`.
2. For each Space:
   - LEFT JOIN `backup_retention_policies` to get the policy (NULL → use tier default from capability resolver — needs Stripe metadata lookup).
   - SELECT its non-deleted runs ordered by `started_at DESC`.
   - Resolve `tierCapDays` from the Space's organization's subscription tier.
   - Call `decideDeletions(runs, policy, tierCapDays, now)`.
   - For each expired runId: `UPDATE backup_runs SET deleted_at = now() WHERE id = $runId`. Per [`system-r2-park`](../system-r2-park/proposal.md), no destination-side `DELETE` is issued.
3. Aggregate counts + log structured event.

### Safety (metadata-only path)

Per [`system-r2-park`](../system-r2-park/proposal.md), the cleanup engine does NOT touch destination-side storage. The only mutation is `UPDATE backup_runs SET deleted_at = now()`, which is reversible via a simple UPDATE back to NULL. Failures during the UPDATE: log + skip; the next hour's pass picks up the same row (idempotent because the WHERE clause filters `deleted_at IS NULL`).

(Pre-`system-r2-park`, this section described R2 delete safety — list-by-prefix, R2 versioning, ordering of metadata-vs-bytes. A future `server-r2-revive` change re-introduces that content.)

## Phase D — Manual-cleanup trigger

### Routes

`apps/server/src/pages/api/internal/spaces/[spaceId]/cleanup.ts` (new):

```
POST /api/internal/spaces/:spaceId/cleanup
Headers: x-internal-token
Body:    { force?: boolean, charged?: boolean }
Returns: { expiredRunIds, creditsCharged? }
        | 404 { error: 'space_not_found' }
        | 402 { error: 'insufficient_credits' }
```

(Pre-`system-r2-park` the return included `deletedObjectCount` — removed because no destination-side delete occurs.)

`apps/web/src/pages/api/spaces/[spaceId]/cleanup.ts` (new):

- IDOR-guarded via `Astro.locals.account.organizationId`.
- Decides whether the user has credits available (depends on `server-manual-quota-and-credits`).
- Calls engine route via `BackupEngineClient.runCleanup(spaceId)`.
- Returns 200 / 402 / 404.

### Credit charge interlock

If `server-manual-quota-and-credits` has shipped:
- The apps/web route decrements credits BEFORE calling the engine. If decrement fails (insufficient credits), return 402 without calling the engine.
- The engine just sets `deleted_at`; the credit accounting is the frontend's concern.

If it hasn't shipped:
- The apps/web route logs a structured "would-charge-10-credits" event and proceeds. The button is feature-flagged off in production until the credits change lands.

## Phase E — Settings UI

`apps/web/src/pages/spaces/[spaceId]/retention.astro` is a per-Space settings page. Layout:

```
[ Space header ]

Retention policy
  [ tier-specific knobs rendered from capability resolver ]
  [ Save button ]

Cleanup
  Next automated pass: <relative time based on cron schedule>
  Last cleanup: <timestamp from logs> · <N> snapshots expired
  [ Run cleanup now (10 credits) ]
```

The "Next automated pass" line is computed client-side from `now() + ((60 - now().getMinutes()) * 60_000)` since the cron is hourly on the 00 minute. No server data needed.

The "Last cleanup" line is read from a new `backup_cleanup_passes` audit table — OR — from structured logs via the existing observability surface. Decision deferred to tasks.md: prefer the audit table if the tables-vs-logs cost is similar.

## Frontend ↔ engine wire shapes

| Direction | Path | Verb | Body | Status |
|---|---|---|---|---|
| apps/web → engine | `/api/internal/spaces/:spaceId/cleanup` | POST | `{ force?, charged? }` | new |
| apps/web → apps/web | `/api/spaces/:spaceId/retention-policy` | PATCH | `RetentionPolicy` shape | new |
| apps/web → apps/web | `/api/spaces/:spaceId/cleanup` | POST | `{}` | new |

No changes to existing wire shapes.

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `decideDeletions` — all five policy tiers + tier-cap + trial-cap edge cases. Time-injected. |
| Pure | `resolveRetentionPolicy` — all seven tiers × all knob bounds. |
| Pure | `parseRetentionPatchPayload` — validates incoming PATCH against tier capabilities. |
| Integration | `runCleanupPass` — uses real local Postgres only (no R2 / Miniflare bucket needed per [`system-r2-park`](../system-r2-park/proposal.md)). Seeds three Spaces with mixed policy tiers + a mix of run ages + statuses; asserts the right set has `deleted_at` set. Mock the absence of any storage-write call. |
| Integration | Engine cleanup route — 401 / 400 / 404 / 402 / 200. |
| Integration | apps/web cleanup route — 401 / 403 IDOR / 200 / 402. |
| Integration | apps/web retention-policy PATCH — 401 / 403 / 400 (knob OOB) / 200. |
| Cron | Trigger.dev scheduled-task harness — call the task `run()` directly with a fake `now`, assert it runs the pass exactly once. |
| Playwright | Settings page: edit `dailyWindowDays`, save, verify persisted. Click "Run cleanup now", verify the expired-count toast + the history widget greys out the expired rows. |

## Master DB migration

`apps/web/drizzle/0008_backup_retention_and_cleanup.sql`:

```sql
CREATE TABLE baseout.backup_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL UNIQUE REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  policy_tier text NOT NULL CHECK (policy_tier IN ('basic','time_based','two_tier','three_tier','custom')),
  keep_last_n integer,
  daily_window_days integer,
  weekly_window_days integer,
  monthly_indefinite boolean DEFAULT false,
  custom_rules jsonb,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now()
);

CREATE INDEX backup_retention_policies_space_id_idx
  ON baseout.backup_retention_policies (space_id);

ALTER TABLE baseout.backup_runs
  ADD COLUMN deleted_at timestamp with time zone NULL;

-- Partial index — most cleanup queries filter "WHERE deleted_at IS NULL".
CREATE INDEX backup_runs_undeleted_idx
  ON baseout.backup_runs (space_id, started_at DESC)
  WHERE deleted_at IS NULL;
```

The schema types update in `apps/web/src/db/schema/core.ts` (canonical) + new engine mirror file `apps/server/src/db/schema/backup-retention-policies.ts` (header comment naming the canonical migration).

## Operational concerns

- **Backfill**: on migration, all existing Spaces have `backup_retention_policies` row absent. The cleanup engine falls back to `resolveRetentionPolicy(tier)` defaults; no migration script needed for first pass. A separate one-time job (Phase C.6) inserts default policy rows for every existing Space so the PATCH UI has something to load.
- **Cron overlap**: Trigger.dev guards against overlapping runs of the same scheduled task. If a cleanup pass takes longer than an hour (unlikely at MVP scale), the next pass is queued; Trigger.dev v3's `cron` semantics drop missed fires if behind by more than one interval.
- **Observability**: structured `event: 'backup_cleanup_pass'` log per pass with aggregate counts; `event: 'backup_cleanup_space'` per Space with > 0 expirations. Tee to PostHog as a product analytics event so we can build a "snapshots expired" dashboard.
- **Cost**: zero direct destination-side cost (BYOS — customer pays for their own storage per [`system-r2-park`](../system-r2-park/proposal.md)). The cleanup engine's only mutation is a single UPDATE per expired row.

## What this design deliberately doesn't change

- The Trigger.dev v3 + Durable Object + ConnectionDO backup path. `runs/start`, `backup-base.task.ts`, `postCompletion` all stay as-is.
- The `server-schedule-and-cancel` SpaceDO alarm. Cleanup runs on its own cron, independent of the per-Space backup schedule.
- The history-widget polling logic. Polling already handles arbitrary status values via `statusLabel`/`statusBadgeClass`; rendering a "deleted" overlay is a UI-layer change in `BackupHistoryWidget.astro`, not a polling change.
