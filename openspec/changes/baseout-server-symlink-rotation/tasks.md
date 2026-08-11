# Tasks — baseout-server-symlink-rotation

All implementation already exists on the working tree (uncommitted on `main` as of 2026-05-06). This task list documents the steps; ticking them off confirms each piece is in the staged diff.

## 1 — Archive the umbrella change

- [x] 1.1 `git mv openspec/changes/baseout-backup/ openspec/changes/archive/baseout-backup/` (15 files preserved verbatim).

## 2 — Symlink rotation scheme

- [x] 2.1 Update [scripts/fix-symlinks.js](../../../scripts/fix-symlinks.js):
  - Add `SERVER_OPENSPEC_DEFAULT_TARGET = 'airtable-client'` constant.
  - Add `resolveServerOpenspecTarget()` helper that reads `apps/server/.openspec-target` if present, otherwise returns the default.
  - Use the resolved target as the link target for `apps/server/openspec` instead of the hardcoded `baseout-backup`.
- [x] 2.2 Improve dangling-symlink detection — use `lstatSync` instead of `existsSync` so links pointing at moved directories are repaired rather than skipped.

## 3 — Wire the marker

- [x] 3.1 Update [.gitignore](../../../.gitignore) to ignore `apps/server/.openspec-target`.
- [x] 3.2 Update the [apps/server/openspec](../../../apps/server/openspec) symlink to point at `../../openspec/changes/airtable-client` (the new default target).

## 4 — Verification

- [ ] 4.1 `pnpm install` runs the postinstall script cleanly with no marker file → symlink resolves to `airtable-client`.
- [ ] 4.2 Write `engine-core` to `apps/server/.openspec-target`, re-run `pnpm fix:symlinks`, confirm symlink retargets to `baseout-server-engine-core` (or whatever the next change is named).
- [ ] 4.3 `pnpm --filter @baseout/web typecheck` — clean. (web typecheck is independent of this scheme but confirms no spillover.)

## Out of scope

- Decomposing `baseout-backup` into per-feature changes — already done in earlier work; the per-feature stubs (`baseout-server-engine-core`, `baseout-server-durable-objects`, etc.) exist as folders.
- Filling in any of the per-feature stubs — done by their own changes when each gets claimed.
- CI gates that enforce "PR touching `apps/` must reference a change folder" — cutover plan §6.4; separate change.
