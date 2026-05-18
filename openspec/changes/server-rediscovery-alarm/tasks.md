## Phase 1 — Design

- [ ] 1.1 Write `design.md` settling the cadence choice (Option A/B/C in `proposal.md` §What Changes).
- [ ] 1.2 Settle retry-with-backoff: in-tick retry vs next-tick retry; `space_events` surfaced after how many consecutive failures.
- [ ] 1.3 Settle ordering inside `SpaceDO.alarm()`: rediscovery before backup dispatch (preferred — backup sees fresh `at_bases`) vs after (cheaper if alarm tick is tight). Document the race scenarios.

## Phase 2 — Alarm wiring

- [ ] 2.1 Inside `SpaceDO.alarm()` in [apps/server/src/durable-objects/SpaceDO.ts](../../../apps/server/src/durable-objects/SpaceDO.ts), invoke `runWorkspaceRediscovery` with `triggeredBy: 'alarm'`.
- [ ] 2.2 Implement chosen cadence (per-Space / per-tier / coupled).
- [ ] 2.3 Implement chosen retry-with-backoff for transient Airtable errors.

## Phase 3 — Tests

- [ ] 3.1 Test alarm + backup-run interleaving: rediscovery does not race a running backup; ordering is the contract.
- [ ] 3.2 Test retry path on transient Airtable error.
- [ ] 3.3 Test happy path: alarm fires → rediscovery upserts → backup dispatch sees fresh `at_bases`.

## Verification

- `pnpm --filter @baseout/server test` — green.
- `pnpm --filter @baseout/server typecheck` — green.
- Smoke (paired with the manual-path smoke from `server-workspace-rediscovery`): force-set a Space's next-alarm to ~now, add a base to Airtable, wait for alarm, confirm `at_bases` upsert + `space_events` row appear.
