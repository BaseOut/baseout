## Why

The umbrella `openspec/changes/baseout-backup/` is one ~13 KB tasks list spanning the whole server engine — Trigger.dev jobs, Durable Objects, six storage destinations, restore, dynamic backup, schema diff, background services. As-is, it is not parallelizable: at most one agent can work it at a time. Per the parallel-agent enablement in [plans/2026-05-07-monorepo-cutover-day.md](/Users/autumnshakespeare/baseout/plans/2026-05-07-monorepo-cutover-day.md) Block 6.2, the umbrella is decomposed into per-feature changes so multiple agents can run concurrently in their own worktrees.

This change is the bootstrapping vehicle for that decomposition: it does the folder moves and folder creations as a single reviewable PR.

## What Changes

- Move `openspec/changes/baseout-backup/` → `openspec/changes/archive/baseout-backup/` (preserve as historical reference).
- Create `openspec/changes/airtable-client/` with full content (proposal.md, design.md, tasks.md, specs/airtable-client/spec.md, README.md, .openspec.yaml). Sourced from the plan.
- Create 15 stub change folders for the remaining server features (each: `.openspec.yaml`, 2-line `README.md`, 1-paragraph `proposal.md` describing scope and dependencies, placeholder `design.md`, placeholder `tasks.md`).
- Update `scripts/fix-symlinks.js` to support target rotation for `apps/server/openspec`. Set the day-1 target to `airtable-client`.

## Capabilities

### New Capabilities
None. This is an infrastructure change. Each per-feature change folder this bootstraps will declare its own capabilities when fleshed out.

### Modified Capabilities
None.

## Impact

- **OpenSpec surface**: 16 new active change folders; 1 newly archived. `openspec validate --all` exits 0 after the change.
- **Symlink**: `apps/server/openspec` resolves to `airtable-client` (was `baseout-backup`).
- **Source code**: not modified. The new `airtable-client` change, when subsequently applied, will modify `apps/web`, `packages/shared`, and `apps/server`.
- **Documentation**: `README.md` "Working in parallel" section (added in tomorrow's Block 6.5) references the rotating-symlink convention this change introduces.

## Reversibility

`git revert <commit>` restores the umbrella under `openspec/changes/baseout-backup/` and removes all 16 new folders. The symlink target reverts as part of the file-restore.
