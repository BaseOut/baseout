## Why

[`server-workspace-rediscovery`](../server-workspace-rediscovery/proposal.md) shipped the manual rescan path: `POST /api/internal/spaces/:id/rescan-bases` calls `runWorkspaceRediscovery(input, deps)` with `triggeredBy: 'manual'`. The pure orchestrator's input already types `triggeredBy: 'manual' | 'alarm'` — the alarm seam is intentional, but the alarm caller doesn't exist yet.

This change adds the second caller: `SpaceDO.alarm()` invokes `runWorkspaceRediscovery` with `triggeredBy: 'alarm'`, so workspaces are periodically rediscovered without the customer clicking Rescan.

This was Phase 3 of `server-workspace-rediscovery`, lifted into its own change because it is gated on `server-schedule-and-cancel` archiving (that change owns the SpaceDO alarm wiring; introducing a second alarm consumer before its primary path stabilizes is the wrong order).

**Depends on:** [`server-schedule-and-cancel`](../server-schedule-and-cancel/proposal.md) — must archive first.

## What Changes

- **`SpaceDO.alarm()` integration** — call `runWorkspaceRediscovery({ spaceId, triggeredBy: 'alarm' }, buildRediscoveryDeps(...))` from inside the alarm handler in [apps/server/src/durable-objects/SpaceDO.ts](../../../apps/server/src/durable-objects/SpaceDO.ts). Ordering relative to scheduled backup dispatch is a design decision (see Phase 1 of `tasks.md`).
- **Cadence** — open question, settled in this change's `design.md` when picked up:
  - **Option A — per-Space**: every 24h independent of backup cadence. Simpler.
  - **Option B — per-tier**: e.g. Business+ every 6h, Pro every 24h, Starter every 7d. Mirrors how `basesPerSpace` already varies by tier.
  - **Option C — coupled to backup cadence**: rediscovery fires once before each scheduled backup. Cheapest alarm churn; couples two concerns.
- **Retry-with-backoff** for transient Airtable errors during alarm-triggered rediscovery. The manual path returns 502 and lets the customer retry; the alarm path needs an internal policy (next-tick retry vs in-tick retry) and a failure-surface threshold (`space_events` row after N consecutive failures).
- **Tests** covering the alarm + backup-run interleaving: rediscovery must not race a running backup; ordering inside `SpaceDO.alarm()` is the contract under test.

## Capabilities

### Modified capabilities

- `backup-workspace-rediscovery` — extends to alarm trigger. No new policy decisions; if the manual path is correct, the alarm path is correct.
- `spacedo-alarm-scheduler` (from `server-schedule-and-cancel`) — extends to include a rediscovery step alongside scheduled-backup dispatch.

## Impact

- **`apps/server/src/durable-objects/SpaceDO.ts`** — alarm handler extension.
- **`apps/server/src/lib/rediscovery/run-deps.ts`** — possibly extended with an alarm-friendly deps constructor (or alarm reuses the manual constructor unchanged — design choice).
- **`apps/server/tests/integration/spacedo-alarm-rediscovery.test.ts`** — new integration test.
- Optional: `space_events.kind` extended with `'rediscovery_failed'` if we adopt the "surface after N consecutive failures" path. Would require a canonical migration in `apps/web`.

## Out of Scope

- **Manual rescan path** — shipped in `server-workspace-rediscovery` Phase 2.
- **Tier-cap policy / auto-add policy** — owned by the pure orchestrator and unchanged here.
- **Auto-pruning of bases removed from the workspace** — separate future change; this one only bumps `last_seen_at`.
- **Webhook-driven real-time drift** — owned by [`server-instant-webhook`](../server-instant-webhook/proposal.md).

## Reversibility

Additive. Reverting removes the alarm-handler branch in `SpaceDO.ts` and the test file. The pure orchestrator is unchanged. No data migration unless we add the `'rediscovery_failed'` event kind (additive, low-risk).
