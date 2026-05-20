# system-r2-park

Supersedes [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md). Records the reversal-of-record after the boss verbally vetoed paying for managed Cloudflare R2 on 2026-05-19 (post commit [`fbdc26e`](../../../apps/server/wrangler.jsonc.example), which had just restored the `BACKUPS_R2` binding under the prior decision).

**Decision: managed R2 is paused, not deleted.** R2 may return. The cheapest reversal path is the deciding factor in every choice:

- **Code**: delete the binding, `r2-managed.ts`, and the R2 strategy test from `apps/server`.
- **Schema**: drop the `r2_managed` DEFAULT on `backup_configurations.storageType`. Leave the `storage_destinations.type` CHECK constraint untouched — reviving R2 becomes a single app-layer flag, not a migration.
- **Openspec**: park R2 phases in three downstream proposals (`server-byos-destinations`, `server-attachments`, `server-retention-and-cleanup`) — each Out of Scope row tagged `Future change — R2 revival`.
- **PRD/Features**: one-row touch-up each. Not a BYOS-only rewrite.

This change is **not docs-only**. It coordinates spec edits, code rollback, a frontend allowlist flip, and one master-DB migration. See [proposal.md](./proposal.md) for the reversal-of-record, [design.md](./design.md) for why the pause shape was chosen over a hard pivot or a feature flag, and [tasks.md](./tasks.md) for the per-phase implementation steps (Phases 1–5 + Verification).

After this change lands, [`project_r2_informal_veto.md`](file:///Users/autumnshakespeare/.claude/projects/-Users-autumnshakespeare-baseout/memory/project_r2_informal_veto.md) is renamed from "informal veto" → "documented pause via system-r2-park."
