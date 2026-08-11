# system-r2-revive

Decision doc that **un-parks managed Cloudflare R2** and **corrects the revival architecture**. Supersedes the relevant clauses of the archived [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md) and reverses the "pause R2" stance introduced by commit `37fb95a` (conventional-commit scope `system-r2-park`, which deleted `apps/server/src/lib/storage/strategies/r2-managed.ts`, removed R2 env, and added migration `0012_pause_r2_default.sql`).

Two things changed since the stance doc was written:

1. **R2 is back** as the all-tiers default destination per [PRD §7.2](../../../shared/Baseout_PRD.md), coexisting with BYOS (Google Drive / Dropbox / Box / OneDrive). The user wants both selectable.
2. **The architecture in `system-r2-stance` is stale.** It said R2 returns via a Worker `BACKUPS_R2` binding under `server-byos-destinations` Phase 0. But backups no longer run in a Cloudflare Worker — they run on Trigger.dev's **Node runner** (`apps/workflows`). A Node process has no `env.BACKUPS_R2` binding. R2 must therefore be reached via R2's **S3-compatible API**.

This change is **docs-only** — no code is touched. The code lands in [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) (R2 `StorageWriter`) and the attachment changes ([`workflows-attachments`](../workflows-attachments/proposal.md) + [`server-attachments`](../server-attachments/proposal.md)).

See [proposal.md](./proposal.md) for the decision and [tasks.md](./tasks.md) for the exact edits to affected proposals.
