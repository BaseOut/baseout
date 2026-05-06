## Context

Multiple server agents need to work in parallel without each one's worktree clobbering the others' active change. Git worktrees give us per-branch checkouts; the rotating symlink lets each worktree point at *its* current change without forcing a single global "active" change.

## Goals

- One simple, gitignored mechanism to set the active server change per worktree.
- Default behavior (no marker file present) still works — points at the canonical first server change.
- Postinstall hook repairs the symlink whenever it's stale.

## Non-Goals

- Multiple-active-changes-at-once on `apps/server`. The symlink is a single-target convenience for opening the change folder; nothing in the workflow requires more.
- Web-side equivalent. `apps/web` work is already split into per-feature changes that don't share the umbrella problem.
- Automatic rotation when a change archives. Manual: edit `.openspec-target`, run `pnpm fix:symlinks`.

## Decisions

### D1 — Marker file is gitignored, single line

`apps/server/.openspec-target` contains exactly one line: the change folder name (without the `openspec/changes/` prefix). Gitignored so worktrees don't fight; absence falls back to `SERVER_OPENSPEC_DEFAULT_TARGET`.

**Why:** Smallest possible footprint; reads with `readFileSync(...).trim()`; no parser needed.

### D2 — Default target lives as a constant in `scripts/fix-symlinks.js`

When `airtable-client` archives and the next change becomes the default, edit the constant in `scripts/fix-symlinks.js` and merge. One PR per default rotation.

**Why:** A repo-level constant is more discoverable than a config file. The default rotates infrequently (every few days at most); a one-line const change is fine.

### D3 — `lstatSync` over `existsSync` for dangling-link detection

`existsSync` follows symlinks; a link to a moved directory returns `false` and gets skipped. `lstatSync` returns the link itself even if its target is gone, so the script can detect "link exists but points nowhere" and repair it.

**Why:** Without this fix, archiving a change folder leaves the symlink dangling forever, since postinstall thinks "it doesn't exist, must create it" → "wait, lstatSync says it does, abort". `lstatSync` correctly distinguishes link-exists-but-broken from no-link.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | Two worktrees on the same machine get confused if one writes the marker and the other reads stale | Low | Each worktree has its own `apps/server/` (worktree contents are separate), so the marker files are independent. |
| R2 | Default target lags reality (e.g., `airtable-client` archives but constant still says `airtable-client`) | Medium | Acceptable — a non-existent change folder makes the postinstall log a clear error, prompting the rotate-the-default PR. |
| R3 | Marker file accidentally committed | Low | Gitignored. Easily caught in code review. |

## Verification

```bash
# Default behavior
pnpm install
ls -la apps/server/openspec
# → symlinks to ../../openspec/changes/airtable-client

# Rotate
echo "baseout-server-engine-core" > apps/server/.openspec-target
pnpm fix:symlinks
ls -la apps/server/openspec
# → symlinks to ../../openspec/changes/baseout-server-engine-core

# Reset
rm apps/server/.openspec-target
pnpm fix:symlinks
ls -la apps/server/openspec
# → symlinks back to airtable-client
```
