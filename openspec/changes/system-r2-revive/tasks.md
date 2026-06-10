## Phase 1 — Edits to affected proposals

This change has no code tasks. The outputs are edits to existing proposal files so they reference the R2-revive decision and stop assuming a Worker binding.

### 1.1 — `server-byos-destinations`

- [x] 1.1.1 Edit [openspec/changes/server-byos-destinations/proposal.md](../server-byos-destinations/proposal.md) — mark **Phase 0** stale: prepend a note that the Worker `BACKUPS_R2` binding instruction is superseded by [`system-r2-revive`](../system-r2-revive/proposal.md); R2 now lands as a Node-runner S3-API `StorageWriter` in [`workflows-r2-writer`](../workflows-r2-writer/proposal.md). Do not delete Phase 0 (history); annotate it.

### 1.2 — `server-attachments`

- [x] 1.2.1 Edit [openspec/changes/server-attachments/proposal.md](../server-attachments/proposal.md) top-of-file "Depends on" banner — replace the dependency on `server-byos-destinations` Phase 0 (R2 binding) with a dependency on [`workflows-attachments`](../workflows-attachments/proposal.md)'s `writeBlob` interface method. Note that the `r2_object_key` column is now a destination-agnostic `storage_key`.
- [x] 1.2.2 Edit [openspec/changes/server-attachments/tasks.md](../server-attachments/tasks.md) banner accordingly.

### 1.3 — `workflows-attachments`

- [x] 1.3.1 Edit [openspec/changes/workflows-attachments/proposal.md](../workflows-attachments/proposal.md) — replace "storage destination strategy owned by `server-byos-destinations`" with "owned by [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) (R2) + the existing BYOS writers"; the downloader writes through the shared `writeBlob` interface method this change adds.

### 1.4 — Auto-memory + runbook

- [x] 1.4.1 Update the auto-memory note `project_r2_documented_pause.md` (and MEMORY.md pointer) to reflect that R2 is being revived via Node-runner S3-API under `system-r2-revive` rather than parked.

## Verification

- All edits are docs-only. No tests to run.
- `git diff --stat` shows only `.md` files modified plus the new `openspec/changes/system-r2-revive/` directory.
- After completion, `server-byos-destinations`, `server-attachments`, and `workflows-attachments` each reference `system-r2-revive` and no longer instruct re-adding a Worker `BACKUPS_R2` binding as the live plan.
