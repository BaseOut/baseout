# server-feature-decomposition — design

## Why a meta-change

Wrapping the decomposition as an OpenSpec change (vs. ad-hoc shell commands or direct edits) provides:
- A single reviewable PR for the entire bootstrap.
- An agent dispatch target — one agent can `opsx:apply` this in its own worktree while the user works other tracks.
- A trail in `openspec/changes/archive/` after archival, documenting how the server folder structure came to be.

## Source for the content

The full content the agent writes during `opsx:apply` is specified in [/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md](/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md). The agent's job is mechanical: copy content blocks from the plan into the appropriate file paths. No design decisions are made during apply.

## Decisions

### Worktree dispatch model
Agent runs `git worktree add ../bo-server-decomp -b change/server-feature-decomposition` and works there. Track A (web cutover) proceeds in the main worktree concurrently — the bootstrap touches only `openspec/changes/`, `openspec/changes/archive/`, and `scripts/fix-symlinks.js`, none of which Track A modifies.

### Symlink target rotation in `scripts/fix-symlinks.js`
Before this change, `scripts/fix-symlinks.js` hard-codes `apps/server/openspec → ../../openspec/changes/baseout-backup`. After: the script reads a marker file `apps/server/.openspec-target` (gitignored — agent-local) or falls back to a defaulted const at the top of the script. Day-1 default is `airtable-client`. As subsequent server changes go in flight, agents update the marker (or the const for cross-team work).

### One fleshed change vs. all stubs
The plan's umbrella table identifies `airtable-client` as the one change to flesh out fully day-1 (no upstream deps; immediately actionable). The other 15 are stubs because:
- Their proposals would duplicate work already in the umbrella (now archived) — better to flesh them out when an agent actually picks one up via `opsx:propose <stub-name>`.
- 16 fully-detailed proposals would be ~150 KB of markdown for work that may shift as `airtable-client` ships and reveals interface gaps.

## Risks / Trade-offs

- **Stub proposals are skeletal.** An agent picking up `baseout-server-engine-core` will still need to flesh it out via `opsx:propose baseout-server-engine-core` (which re-runs the propose flow against the existing folder). Mitigation: the stub `proposal.md` includes the dependency list and the source PRD/Features anchors so the next agent has a starting point.
- **Symlink rotation is per-developer.** If the marker file is gitignored, two agents in different worktrees can each point at a different in-flight change. That's the intent. If the marker is committed, rotation becomes a coordination point. Recommendation: gitignored.

## Migration plan

Single phase. See `tasks.md`.
