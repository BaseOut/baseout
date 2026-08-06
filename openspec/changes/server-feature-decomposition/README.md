# server-feature-decomposition

Bootstrap change. Decomposes the umbrella `openspec/changes/baseout-backup/` into 16 per-feature changes so multiple agents can work `apps/server` in parallel. Archives the umbrella, creates one fully fleshed change (`airtable-client`) plus 15 stubs, updates `scripts/fix-symlinks.js` so `apps/server/openspec` rotates to whichever server change is in flight.

When this change archives, the new server changes are live and parallel-agent work on `apps/server` begins.

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md). The full content this change writes is sourced from [/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md](/Users/autumnshakespeare/.claude/plans/yes-make-the-plan-fluffy-hanrahan.md).
