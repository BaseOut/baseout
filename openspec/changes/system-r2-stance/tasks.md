## Phase 1 — Edits to affected proposals

This change has no code tasks. The only outputs are edits to three existing proposal files so they reference the R2-stance decision rather than assume R2 is already present.

### 1.1 — `server-byos-destinations`

- [ ] 1.1.1 Edit [openspec/changes/server-byos-destinations/proposal.md](../server-byos-destinations/proposal.md) — prepend a new Phase 0 under "What Changes":
  - **Phase 0 — Re-introduce managed R2 binding + `StorageWriter` interface.**
    - Re-add `BACKUPS_R2` binding to `apps/server/wrangler.jsonc.example` and `wrangler.test.jsonc` (the example block exists in `git log` pre-`8fc1f61`).
    - Re-add `env.BACKUPS_R2: R2Bucket` to `apps/server/src/env.d.ts`.
    - Create the `StorageWriter` interface at `apps/server/src/lib/storage/storage-writer.ts` (currently described under what is now Phase B; promote it here).
    - Implement `r2-managed.ts` as the first strategy. It is a refactor of the deleted `trigger/tasks/_lib/r2-proxy-write.ts` (recoverable from `git show 8fc1f61^:apps/server/trigger/tasks/_lib/r2-proxy-write.ts`).
  - Renumber the existing Phase A → B, B → C, etc.
  - Add a link at the top of the proposal: "Depends on: [`system-r2-stance`](../system-r2-stance/proposal.md) decision."
- [ ] 1.1.2 Edit the paired [openspec/changes/server-byos-destinations/tasks.md](../server-byos-destinations/tasks.md) — prepend the matching Phase 0 task block (binding restoration → interface → r2-managed strategy → unit tests).
- [ ] 1.1.3 Edit [openspec/changes/server-byos-destinations/design.md](../server-byos-destinations/design.md) — add a Phase 0 design subsection covering the binding shape (R2 access via Workers binding API, not S3-API) and the strategy class.

### 1.2 — `server-attachments`

- [ ] 1.2.1 Edit [openspec/changes/server-attachments/proposal.md](../server-attachments/proposal.md) — under "Out of Scope" or a new top-of-file "Depends on" line, note: "Phase B's R2-writing path requires [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0 to land first (R2 binding + `StorageWriter` interface). Phase A (schema + dedup table) is independent and can ship before that."
- [ ] 1.2.2 Edit the paired [openspec/changes/server-attachments/tasks.md](../server-attachments/tasks.md) — mark every Phase B task with a leading "**(blocked on `byos-destinations` Phase 0)**" note.

### 1.3 — `server-retention-and-cleanup`

- [ ] 1.3.1 Edit [openspec/changes/server-retention-and-cleanup/proposal.md](../server-retention-and-cleanup/proposal.md) — under "Out of Scope" or a new top-of-file "Depends on" line, note: "The cleanup engine's `DELETE` path requires [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0 to land first (`StorageWriter.delete()` is the call site). Phase A (retention-policy schema) is independent."
- [ ] 1.3.2 Edit the paired [openspec/changes/server-retention-and-cleanup/tasks.md](../server-retention-and-cleanup/tasks.md) — mark every cleanup-execution task with the "**(blocked on `byos-destinations` Phase 0)**" note.

### 1.4 — Specreview note

- [ ] 1.4.1 Edit [specreview/05-update-2026-05-13b.md](../../../specreview/05-update-2026-05-13b.md) §A — append a short "**Resolved**: see [`system-r2-stance`](../openspec/changes/system-r2-stance/proposal.md)." line so future readers don't re-litigate.

## Verification

- All edits are docs-only. No tests to run.
- After completion, the four files at issue must each reference `system-r2-stance` by name.
- `git diff --stat` should show only `.md` files modified plus the new `openspec/changes/system-r2-stance/` directory created.
