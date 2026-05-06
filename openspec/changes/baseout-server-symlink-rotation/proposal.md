## Why

The May 7, 2026 cutover plan ([plans/2026-05-07-monorepo-cutover-day.md](../../../plans/2026-05-07-monorepo-cutover-day.md) §6.2) decomposes the monolithic `baseout-backup` change into ~16 per-feature server changes. To support this:

1. The legacy `baseout-backup/` change folder must be archived (historical reference only — not live work).
2. `apps/server/openspec` symlink must rotate as different per-feature changes become "currently active" — without forcing all server agents into the same change.

This change ships the in-tree infrastructure for both: the rename, plus a lightweight rotating-symlink scheme keyed off a gitignored marker file.

The implementation already exists on disk; this change folder is the proposal/spec/tasks documentation that the diff lacks.

## What Changes

- **Move** `openspec/changes/baseout-backup/` → `openspec/changes/archive/baseout-backup/` (15 files renamed). Preserves all historical content as reference; removes it from the live changes list.
- **Add** `apps/server/.openspec-target` mechanism in [scripts/fix-symlinks.js](../../../scripts/fix-symlinks.js):
  - `apps/server/openspec` symlink points at whatever the file `apps/server/.openspec-target` says (e.g. `airtable-client`).
  - Default when the marker file is absent: `airtable-client` (today's first server change).
  - Marker file is gitignored — different agents on different worktrees can rotate independently.
- **Update** [.gitignore](../../../.gitignore) to ignore the marker file.
- **Update** [apps/server/openspec](../../../apps/server/openspec) symlink target from the now-archived `baseout-backup` to the active `airtable-client`.
- **Improve** [scripts/fix-symlinks.js](../../../scripts/fix-symlinks.js) to detect dangling symlinks (use `lstatSync`, not `existsSync`) — so when an in-flight change folder is moved (e.g. archived), the postinstall script repairs the broken symlink instead of skipping.

## Capabilities

### New Capabilities

- None at the spec level. This is repo plumbing.

### Modified Capabilities

- None.

## Impact

- File renames: `openspec/changes/baseout-backup/*` (15 files) → `openspec/changes/archive/baseout-backup/*`.
- Modified: [.gitignore](../../../.gitignore), [scripts/fix-symlinks.js](../../../scripts/fix-symlinks.js).
- Modified symlink: [apps/server/openspec](../../../apps/server/openspec).
- No code changes in `apps/server/src/`. No DB. No external services.

## Reversibility

Fully reversible:
- `git mv openspec/changes/archive/baseout-backup/ openspec/changes/baseout-backup/` undoes the rename.
- Revert the `.gitignore` and `scripts/fix-symlinks.js` diffs.
- Update the symlink target back to `baseout-backup`.

No data migration. No external state.

## Server-side handoff [SERVER-NOTE]

Server agents picking up work after this change lands:

- **Active change** for an `apps/server` agent is whatever `apps/server/openspec` resolves to. Set via `apps/server/.openspec-target` (single line, gitignored).
- **To rotate**: write the next change name to that file, then run `pnpm fix:symlinks` (or `pnpm install` — postinstall calls the same script).
- **Default target** when no marker exists: `airtable-client`. Change the constant in `scripts/fix-symlinks.js` (`SERVER_OPENSPEC_DEFAULT_TARGET`) when `airtable-client` archives and the next default-active server change takes its place.
- **Historical reference**: `openspec/changes/archive/baseout-backup/` preserves the original umbrella change for traceability when implementing per-feature successors. Don't edit it.
