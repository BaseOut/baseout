## ADDED Requirements

### Requirement: Hourly automated cleanup pass

A Trigger.dev v3 scheduled task `cleanup-expired-snapshots` SHALL run on an hourly cron (`0 * * * *`) and execute a single full cleanup pass across every Space. The task SHALL be defined in `apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts` and registered in `apps/workflows/trigger.config.ts`.

#### Scenario: Cron fires successfully

- **WHEN** the hourly cron fires
- **THEN** the task SHALL invoke `runCleanupPass({ now, db, r2, logger })`, iterate every distinct `space_id` in `backup_runs WHERE deleted_at IS NULL`, decide deletions per policy, delete the R2 objects, and update `backup_runs.deleted_at`

#### Scenario: Cron pass exceeds one hour

- **WHEN** a cleanup pass takes longer than the cron interval (60 minutes)
- **THEN** Trigger.dev's scheduling SHALL queue the next invocation without overlapping; missed fires older than one interval SHALL be dropped per Trigger.dev v3 cron semantics

### Requirement: Pure decision function

The cleanup engine's keep-vs-delete decision logic SHALL live in a pure function `decideDeletions(runs, policy, tierCapDays, now)` at `apps/server/src/lib/retention/decide-deletions.ts`. The function SHALL accept dependency-injected inputs only; no DB or R2 calls.

#### Scenario: Tier-cap pass runs first

- **WHEN** `decideDeletions` is called with any policy and `tierCapDays=30` and a run aged 45 days
- **THEN** the run SHALL appear in `delete` regardless of what the policy says

#### Scenario: Trial run is 7-day capped

- **WHEN** `decideDeletions` is called with a run where `is_trial=true` and age > 7 days
- **THEN** the run SHALL appear in `delete` regardless of policy

#### Scenario: Basic policy keeps last N

- **WHEN** `decideDeletions` is called with `policy.tier='basic'`, `keepLastN=3`, and 5 runs (newest first)
- **THEN** the first 3 runs by `startedAt DESC` SHALL appear in `keep` and the remaining 2 SHALL appear in `delete`

#### Scenario: Two-tier weekly pruning

- **WHEN** `decideDeletions` is called with `policy.tier='two_tier'`, `dailyWindowDays=30`, `weeklyWindowDays=120`, and 10 runs all within ISO week 6 of the year (age 30–37 days)
- **THEN** exactly one run from that ISO week (the most-recent) SHALL appear in `keep` and the rest SHALL appear in `delete`

#### Scenario: Three-tier monthly indefinite

- **WHEN** `decideDeletions` is called with `policy.tier='three_tier'`, `monthlyIndefinite=true`, and runs at ages 200d, 400d, 600d (different calendar months)
- **THEN** all three runs SHALL appear in `keep` (one per calendar month)

### Requirement: R2 delete is prefix-scoped

The cleanup engine SHALL always list and delete R2 objects under the prefix `<spaceId>/<runId>/`. The engine SHALL NOT delete R2 objects by run-ID alone or by any other key shape.

#### Scenario: Run from another Space coincidentally shares a runId hash collision

- **WHEN** two `backup_runs` rows in different Spaces have keys whose plain-string lookup would collide
- **THEN** the prefix-scoped list/delete SHALL operate only on the target Space's prefix and SHALL NOT touch the other Space's objects

### Requirement: Idempotent re-runs

A cleanup pass SHALL be safe to run repeatedly. Re-running an already-completed pass SHALL produce zero additional R2 deletes and zero additional `deleted_at` writes.

#### Scenario: Same pass runs twice in a row

- **WHEN** a cleanup pass completes successfully, then the same pass is invoked again immediately
- **THEN** the second invocation SHALL log `event: 'backup_cleanup_pass'` with `r2ObjectsDeleted: 0` and `runsDeleted: 0`

### Requirement: Manual-trigger route

The cleanup engine SHALL expose `POST /api/internal/spaces/:spaceId/cleanup` for on-demand cleanup. The route SHALL be `INTERNAL_TOKEN`-gated and SHALL return `{ deletedRunIds, deletedObjectCount }` on success.

#### Scenario: Manual trigger on a Space with no expired runs

- **WHEN** the manual-trigger route is called for a Space whose runs all fall within their policy windows
- **THEN** the route SHALL return 200 `{ deletedRunIds: [], deletedObjectCount: 0 }`

#### Scenario: Manual trigger on an unknown Space

- **WHEN** the manual-trigger route is called with a spaceId that does not exist
- **THEN** the route SHALL return 404 `{ error: 'space_not_found' }`

### Requirement: Structured observability

Every cleanup pass SHALL emit a structured `event: 'backup_cleanup_pass'` log with `{ spacesProcessed, runsKept, runsDeleted, r2ObjectsDeleted, durationMs }`. Per-Space cleanups with > 0 deletions SHALL additionally emit `event: 'backup_cleanup_space'` with `{ spaceId, runsDeleted, r2ObjectsDeleted, policyTier }`.

#### Scenario: Empty pass still logs

- **WHEN** a cleanup pass finds nothing to delete
- **THEN** a single `event: 'backup_cleanup_pass'` log SHALL be written with zero counts
