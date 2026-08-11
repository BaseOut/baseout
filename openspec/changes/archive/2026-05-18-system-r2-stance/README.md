# system-r2-stance

Decision doc that records Baseout's stance on managed Cloudflare R2 storage: **R2 is the default managed destination** under a `StorageWriter` abstraction, with BYOS providers as alternate strategies. Commit `8fc1f61` ripped out every R2 binding from `apps/server` as a temporary measure to unblock local-dev iteration (CSVs now write via `trigger/tasks/_lib/local-fs-write.ts`, which is dev-only). R2 returns under [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0 as the first `StorageWriter` strategy.

This change is **docs-only** — no code is touched. Its scope is the proposal-text reconciliation flagged in [specreview/05-update-2026-05-13b.md §A](../../../specreview/05-update-2026-05-13b.md): three downstream proposals (`server-byos-destinations`, `server-attachments`, `server-retention-and-cleanup`) still reference R2 bindings that no longer exist. After this change, each of those proposals points at the R2-returns Phase 0 step rather than assuming R2 is already present.

See [proposal.md](./proposal.md) for the decision and [tasks.md](./tasks.md) for the exact edits to each affected proposal.
