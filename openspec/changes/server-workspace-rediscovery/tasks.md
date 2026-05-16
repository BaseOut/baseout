## Phase 1 — Schema (DONE — commit `3eeedfb`)

- [x] 1.1 Canonical migration [apps/web/drizzle/0008_workspace_rediscovery.sql](../../../apps/web/drizzle/0008_workspace_rediscovery.sql).
- [x] 1.2 Canonical schema edits in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) for `at_bases`, `backup_configurations`, `backup_configuration_bases`.
- [x] 1.3 Canonical schema for new `space_events` table.
- [x] 1.4 Engine mirrors under [apps/server/src/db/schema/](../../../apps/server/src/db/schema/) with header comments naming the canonical migration.
- [x] 1.5 Engine schema-mirrors integration test updated to pin the new column shapes.

## Phase 2 — Manual rescan path (THIS CHANGE)

### 2.1 — Pure orchestrator

- [x] 2.1.1 New file [apps/server/src/lib/rediscovery/run.ts](../../../apps/server/src/lib/rediscovery/run.ts) — exports `runWorkspaceRediscovery`, `RediscoveryInput`, `WorkspaceRediscoveryDeps`, `RediscoveryResult`, `SpaceEventInsert`, `AtBaseId`, `RediscoveryTrigger`.
- [x] 2.1.2 Header comment explaining single-writer guarantee + Phase 3 alarm boundary.
- [ ] 2.1.3 Verify all six algorithm branches (no-fresh, toggle-off, toggle-on-within-cap, toggle-on-over-cap, null-cap enterprise, Airtable-error) match the design doc.

### 2.2 — Production dep wiring

- [x] 2.2.1 New file [apps/server/src/lib/rediscovery/run-deps.ts](../../../apps/server/src/lib/rediscovery/run-deps.ts) — exports `buildRediscoveryDeps`, discriminated union result.
- [x] 2.2.2 Resolves Space → Config → Connection (active, latest) → decrypts OAuth token → constructs Airtable client.
- [x] 2.2.3 Implements all 9 deps functions returning a `WorkspaceRediscoveryDeps` bag.
- [ ] 2.2.4 Confirm the structured stderr log lines use the `eslint-disable-next-line no-console` annotation pattern per [CLAUDE.md §3.5](../../../CLAUDE.md) — no raw `console.*` lands.

### 2.3 — Capability resolver mirror

- [x] 2.3.1 New file [apps/server/src/lib/capabilities/tier-capabilities.ts](../../../apps/server/src/lib/capabilities/tier-capabilities.ts) — mirror of [apps/web/src/lib/capabilities/tier-capabilities.ts](../../../apps/web/src/lib/capabilities/tier-capabilities.ts) with header comment.
- [x] 2.3.2 New file [apps/server/src/lib/capabilities/resolve.ts](../../../apps/server/src/lib/capabilities/resolve.ts) — `resolveCapabilities(db, organizationId, platformSlug)`. Mirror header comment.
- [ ] 2.3.3 Diff the two `tier-capabilities.ts` files — values MUST match exactly. Add a CI guard in [apps/server/tests/integration/schema-mirrors.test.ts](../../../apps/server/tests/integration/schema-mirrors.test.ts) (or a new `capability-mirrors.test.ts`) that imports both files and asserts equality. (Deferred to a follow-up if not in this change's smoke-test scope.)

### 2.4 — Manual rescan route

- [x] 2.4.1 New file [apps/server/src/pages/api/internal/spaces/rescan-bases.ts](../../../apps/server/src/pages/api/internal/spaces/rescan-bases.ts) — `spacesRescanBasesHandler`.
- [x] 2.4.2 Method check (POST), UUID check (400), 4 resolved errors mapped to 404/404/409, AirtableError → 502.
- [x] 2.4.3 Route entry wired in [apps/server/src/index.ts](../../../apps/server/src/index.ts) under `SPACES_RESCAN_BASES_RE`.

### 2.5 — Tests

- [x] 2.5.1 New file [apps/server/tests/integration/rediscovery-run.test.ts](../../../apps/server/tests/integration/rediscovery-run.test.ts) — six pure-fn branches.
- [x] 2.5.2 New file [apps/server/tests/integration/spaces-rescan-bases-route.test.ts](../../../apps/server/tests/integration/spaces-rescan-bases-route.test.ts) — route shape coverage.
- [ ] 2.5.3 Run both with `pnpm --filter @baseout/server test`; expect green.
- [ ] 2.5.4 Run [apps/server/tests/integration/schema-mirrors.test.ts](../../../apps/server/tests/integration/schema-mirrors.test.ts) to confirm the new column shapes still match the canonical migration.

### 2.6 — Typecheck + lint

- [ ] 2.6.1 `pnpm --filter @baseout/server typecheck` — green.
- [ ] 2.6.2 `git diff --staged | grep -E '(console\\.|debugger)'` — empty (per [CLAUDE.md §3.5](../../../CLAUDE.md)). The structured-log lines under `run-deps.ts` carry `eslint-disable-next-line no-console` annotations.

## Phase 3 — Scheduled rescan via SpaceDO alarm (DEFERRED)

Out of scope. Tracked separately. Will pick up after [`server-schedule-and-cancel`](../server-schedule-and-cancel/proposal.md) archives.

- [ ] 3.1 Inside `SpaceDO.alarm()`, invoke `runWorkspaceRediscovery` with `triggeredBy: 'alarm'`.
- [ ] 3.2 Decide cadence (per-Space vs per-tier).
- [ ] 3.3 Retry-with-backoff design for transient Airtable errors.
- [ ] 3.4 Tests covering the alarm + backup-run interleaving (rediscovery should not race a running backup; ordering inside `SpaceDO.alarm()` matters).

## Verification

- Both rediscovery test files pass: `pnpm --filter @baseout/server test rediscovery-run spaces-rescan-bases-route`.
- Schema mirrors test pass: `pnpm --filter @baseout/server test schema-mirrors`.
- Typecheck green: `pnpm --filter @baseout/server typecheck`.
- `git status` — no spurious untracked files left from scratch work.
- Smoke (covered in the paired [`web-workspace-rediscovery`](../web-workspace-rediscovery/proposal.md)): click Rescan → banner appears with correct counts → dismiss removes banner → server log shows rediscovery counts.
