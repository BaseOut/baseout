## 1. Pre-flight

- [x] 1.1 Confirm `openspec/changes/baseout-backup/` exists with full proposal/design/tasks (it does — current state).
- [x] 1.2 Confirm `apps/server/openspec` symlink currently resolves to `../../openspec/changes/baseout-backup`.
- [x] 1.3 Confirm `mkdir -p openspec/changes/archive/` doesn't conflict with anything (verify the only other archive-bound path is the existing `openspec/changes/archive/` — already empty per current state).

## 2. Archive the umbrella

- [x] 2.1 `git mv openspec/changes/baseout-backup openspec/changes/archive/baseout-backup`

## 3. Create the airtable-client change folder

For each file below, write the content verbatim from `/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md` "Full content: openspec/changes/airtable-client/" section:

- [x] 3.1 `mkdir -p openspec/changes/airtable-client/specs/airtable-client`
- [x] 3.2 Write `openspec/changes/airtable-client/.openspec.yaml`
- [x] 3.3 Write `openspec/changes/airtable-client/README.md`
- [x] 3.4 Write `openspec/changes/airtable-client/proposal.md`
- [x] 3.5 Write `openspec/changes/airtable-client/design.md`
- [x] 3.6 Write `openspec/changes/airtable-client/tasks.md`
- [x] 3.7 Write `openspec/changes/airtable-client/specs/airtable-client/spec.md`

## 4. Create 15 stub change folders

For each name in this list:
- baseout-server-engine-core
- baseout-server-durable-objects
- baseout-server-storage-r2
- baseout-server-storage-googledrive
- baseout-server-storage-dropbox
- baseout-server-storage-box
- baseout-server-storage-onedrive
- baseout-server-storage-s3
- baseout-server-storage-frameio
- baseout-server-restore-core
- baseout-server-cron-webhook-renewal
- baseout-server-cron-oauth-refresh
- baseout-server-websocket-progress
- baseout-server-dynamic-backup
- baseout-server-schema-diff

Do (15 × 5 = 75 small writes, scriptable):

- [x] 4.1 `mkdir openspec/changes/<name>`
- [x] 4.2 Write `openspec/changes/<name>/.openspec.yaml` with `schema: spec-driven` + `created: 2026-05-07`
- [x] 4.3 Write `openspec/changes/<name>/README.md`: 2 lines — `# <name>` then `Stub. Flesh out via opsx:propose <name> when an agent picks it up.`
- [x] 4.4 Write `openspec/changes/<name>/proposal.md`: `## Why` (1 sentence per the umbrella table from the plan), `## What Changes` (the scope-line from the table), `## Depends on` (deps column from the table linking each `[<dep-name>](../<dep-name>/)`).
- [x] 4.5 Write `openspec/changes/<name>/design.md`: `# <name> — design (TBD)`.
- [x] 4.6 Write `openspec/changes/<name>/tasks.md`: `# Tasks (TBD)`.

## 5. Update scripts/fix-symlinks.js for symlink target rotation

- [x] 5.1 Add `apps/server/.openspec-target` to `.gitignore`.
- [x] 5.2 Edit `scripts/fix-symlinks.js`. Replace the hard-coded `apps/server/openspec` target with a lookup: read `apps/server/.openspec-target` if present (single line: change-folder name); else fall back to a constant `SERVER_OPENSPEC_DEFAULT_TARGET = 'airtable-client'` at the top of the file.
- [x] 5.3 Resolve the symlink target as `../../openspec/changes/${target}` and create/refresh the symlink.
- [x] 5.4 Run `pnpm fix:symlinks` (or `node scripts/fix-symlinks.js`); verify `apps/server/openspec` now resolves to `openspec/changes/airtable-client`.

## 6. Verification

- [x] 6.1 `npx @fission-ai/openspec validate --all` — all 25 changes pass; only pre-existing `spec/app-naming` fails (missing `## Purpose` / `## Requirements` headers — unrelated to this change).
- [x] 6.2 `openspec list` shows the 16 server-side changes active (`airtable-client` 0/55, `server-feature-decomposition` 21/30, plus 15 stubs at "No tasks"); `baseout-backup` no longer in active list (now under `archive/`).
- [x] 6.3 `apps/server/openspec` resolves to `../../openspec/changes/airtable-client/` (verified via `readlink`).
- [x] 6.4 Bootstrap diff is correct: rename of `baseout-backup` → `archive/baseout-backup/*`, 16 new `openspec/changes/<name>/` folders, `scripts/fix-symlinks.js` modified, `.gitignore` modified, `apps/server/openspec` symlink retargeted. (Other modifications visible in `git status` — `apps/web/*` files — are from a parallel `baseout-web-stability-pass-1` agent and are not part of this change's diff.)
- [x] 6.5 Source code under `apps/web/src/`, `packages/`, `shared/`, `brand/` was NOT modified by this bootstrap. The only `apps/server/` change is the symlink retarget (per §5).

## 7. PR + handoff

- [ ] 7.1 Open PR titled `server-feature-decomposition: archive baseout-backup; bootstrap 16 per-feature server changes`.
- [ ] 7.2 PR body links: `openspec/changes/server-feature-decomposition/` AND `/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md`.
- [ ] 7.3 PR description notes: this is a docs-only refactor; no source code modified; ready for fast review.
- [ ] 7.4 On merge, dispatch the next agent on `airtable-client` (Track B mid-morning hand-off).
