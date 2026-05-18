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
- [x] 2.1.3 Verify all six algorithm branches (no-fresh, toggle-off, toggle-on-within-cap, toggle-on-over-cap, null-cap enterprise, Airtable-error) match the design doc.

### 2.2 — Production dep wiring

- [x] 2.2.1 New file [apps/server/src/lib/rediscovery/run-deps.ts](../../../apps/server/src/lib/rediscovery/run-deps.ts) — exports `buildRediscoveryDeps`, discriminated union result.
- [x] 2.2.2 Resolves Space → Config → Connection (active, latest) → decrypts OAuth token → constructs Airtable client.
- [x] 2.2.3 Implements all 9 deps functions returning a `WorkspaceRediscoveryDeps` bag.
- [x] 2.2.4 Confirm the structured stderr log lines use the `eslint-disable-next-line no-console` annotation pattern per [CLAUDE.md §3.5](../../../CLAUDE.md) — no raw `console.*` lands.

### 2.3 — Capability resolver mirror

- [x] 2.3.1 New file [apps/server/src/lib/capabilities/tier-capabilities.ts](../../../apps/server/src/lib/capabilities/tier-capabilities.ts) — mirror of [apps/web/src/lib/capabilities/tier-capabilities.ts](../../../apps/web/src/lib/capabilities/tier-capabilities.ts) with header comment.
- [x] 2.3.2 New file [apps/server/src/lib/capabilities/resolve.ts](../../../apps/server/src/lib/capabilities/resolve.ts) — `resolveCapabilities(db, organizationId, platformSlug)`. Mirror header comment.
- [x] 2.3.3 Diff the two `tier-capabilities.ts` files — `basesPerSpace` value per Tier MUST match across the mirror boundary (the web canonical also carries `frequencies`, which the engine intentionally omits per its header comment). CI guard added at [apps/server/tests/integration/capability-mirrors.test.ts](../../../apps/server/tests/integration/capability-mirrors.test.ts): asserts Tier-union equality + per-Tier `basesPerSpace` equality.

### 2.4 — Manual rescan route

- [x] 2.4.1 New file [apps/server/src/pages/api/internal/spaces/rescan-bases.ts](../../../apps/server/src/pages/api/internal/spaces/rescan-bases.ts) — `spacesRescanBasesHandler`.
- [x] 2.4.2 Method check (POST), UUID check (400), 4 resolved errors mapped to 404/404/409, AirtableError → 502.
- [x] 2.4.3 Route entry wired in [apps/server/src/index.ts](../../../apps/server/src/index.ts) under `SPACES_RESCAN_BASES_RE`.

### 2.5 — Tests

- [x] 2.5.1 New file [apps/server/tests/integration/rediscovery-run.test.ts](../../../apps/server/tests/integration/rediscovery-run.test.ts) — six pure-fn branches.
- [x] 2.5.2 New file [apps/server/tests/integration/spaces-rescan-bases-route.test.ts](../../../apps/server/tests/integration/spaces-rescan-bases-route.test.ts) — route shape coverage.
- [x] 2.5.3 Run both with `pnpm --filter @baseout/server test`; green — `rediscovery-run` + `spaces-rescan-bases-route` + new `capability-mirrors` all pass in the same `pnpm --filter @baseout/server exec vitest run` invocation (20 passing across the four files).
- [x] 2.5.4 Ran [apps/server/tests/integration/schema-mirrors.test.ts](../../../apps/server/tests/integration/schema-mirrors.test.ts) alongside the rediscovery files; column shapes still match the canonical migration.

### 2.6 — Typecheck + lint

- [x] 2.6.1 `pnpm --filter @baseout/server typecheck` — green.
- [x] 2.6.2 New `capability-mirrors.test.ts` contains no `console.*` / `debugger`; the annotated `run-deps.ts` lines are unchanged.

## Phase 3 — Scheduled rescan via SpaceDO alarm

Split into its own change: [`server-rediscovery-alarm`](../server-rediscovery-alarm/proposal.md). Picks up after `server-schedule-and-cancel` archives.

## Verification

- Both rediscovery test files pass: `pnpm --filter @baseout/server test rediscovery-run spaces-rescan-bases-route`.
- Schema mirrors test pass: `pnpm --filter @baseout/server test schema-mirrors`.
- Typecheck green: `pnpm --filter @baseout/server typecheck`.
- `git status` — no spurious untracked files left from scratch work.
- Smoke (covered in the paired [`web-workspace-rediscovery`](../web-workspace-rediscovery/proposal.md)): click Rescan → banner appears with correct counts → dismiss removes banner → server log shows rediscovery counts.
